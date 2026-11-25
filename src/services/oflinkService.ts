import {
  OFLinkPacket,
  TextPacket,
  LocationPacket,
  SosPacket,
  AckPacket,
  StatusPacket,
  ChatMessage,
  NodeLocation,
  SosEvent,
  LinkMetrics,
  SignalQuality,
  BleConnectionState,
  BleDevice,
  BreadcrumbPoint,
} from '../models/packets.ts';
import { localDatabase } from './storage/localDatabase.ts';
import { bleManager } from './ble/bleService.ts';
import { locationService, GeoCoordinates } from './location/locationService.ts';

type OFLinkListener = () => void;

class OFLinkService {
  private listeners: Set<OFLinkListener> = new Set();

  private linkMetrics: LinkMetrics = {
    rssi: -91,
    snr: 6.2,
    pdr: 96,
    retries: 1,
    latency: 820,
    lastContact: Date.now() - 1000 * 18,
    quality: 'GOOD',
  };

  private bleState: BleConnectionState = 'DISCONNECTED';
  private connectedBleDevice: BleDevice | null = null;
  private pendingAcks: Map<string, { timeoutId: any; retries: number; packet: OFLinkPacket }> = new Map();
  private linkCheckInterval: any = null;
  private activeSosEmergency: SosEvent | null = null;
  private recentPacketIds: Set<string> = new Set();
  private lastMeshPollTime: number = Date.now();
  private meshPollInterval: any = null;

  constructor() {
    this.init();
  }

  private init() {
    // Subscribe to BLE state
    bleManager.subscribeToState((state, device) => {
      this.bleState = state;
      this.connectedBleDevice = device;
      this.notify();
    });

    // Subscribe to incoming BLE packets
    bleManager.subscribeToPackets((packet, sourceSlot) => {
      this.handleIncomingPacket(packet, sourceSlot);
    });

    // Check link timeout every 3 seconds
    this.linkCheckInterval = setInterval(() => {
      this.checkLinkHealth();
    }, 3000);

    // Multi-device Web Mesh Relay polling (syncs across 2 browsers/phones on the same server)
    this.meshPollInterval = setInterval(() => {
      this.pollWebMeshRelay();
    }, 2500);

    // Initial check for active emergency
    this.activeSosEmergency = localDatabase.getActiveRemoteSos();
  }

  private async pollWebMeshRelay() {
    const settings = localDatabase.getSettings();
    const isRealBleConnected = bleManager.getConnectionState() === 'CONNECTED' && !settings.mockBleEnabled;
    if (!settings.webRelayEnabled || isRealBleConnected) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`/api/mesh/messages?since=${this.lastMeshPollTime}&exclude=${encodeURIComponent(settings.localNodeId)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data.serverTime) {
          this.lastMeshPollTime = data.serverTime;
        }
        if (Array.isArray(data.messages)) {
          for (const pkt of data.messages) {
            this.handleIncomingPacket(pkt);
          }
        }
      }
    } catch (e) {
      // Offline / standalone mode - ignore fetch error
    }
  }

  public subscribe(listener: OFLinkListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('OFLinkService notification error:', err);
      }
    });
  }

  // --- Packet Dispatching & Transmission ---

  public async sendTextMessage(text: string, priority: 'NORMAL' | 'HIGH' | 'CRITICAL' = 'NORMAL'): Promise<string> {
    const settings = localDatabase.getSettings();
    const messageId = `MSG-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;

    const chatMsg: ChatMessage = {
      id: messageId,
      messageId,
      sender: settings.localNodeId,
      isSelf: true,
      text: text.trim(),
      timestamp: Date.now(),
      priority,
      deliveryStatus: 'PENDING',
      storageState: 'STORED_LOCAL',
      retryCount: 0,
    };

    localDatabase.addMessage(chatMsg);

    const packet: TextPacket = {
      type: 'TEXT',
      messageId,
      sender: settings.localNodeId,
      timestamp: Date.now(),
      priority,
      payload: text.trim(),
    };

    await this.transmitWithAckTracking(packet, chatMsg.id);
    return messageId;
  }

  public async shareMyLocation(priority: 'NORMAL' | 'HIGH' = 'HIGH'): Promise<NodeLocation> {
    const settings = localDatabase.getSettings();
    const freshCoords: GeoCoordinates = await locationService.acquireFreshPosition();
    const messageId = `LOC-${Date.now().toString(36).toUpperCase()}`;

    const locRecord: NodeLocation = {
      id: messageId,
      nodeId: settings.localNodeId,
      latitude: freshCoords.latitude,
      longitude: freshCoords.longitude,
      accuracy: freshCoords.accuracy,
      timestamp: Date.now(),
      isSelf: true,
      storageState: 'STORED_LOCAL',
    };

    localDatabase.addLocation(locRecord);

    const packet: LocationPacket = {
      type: 'LOCATION',
      messageId,
      sender: settings.localNodeId,
      timestamp: Date.now(),
      priority,
      latitude: freshCoords.latitude,
      longitude: freshCoords.longitude,
      accuracy: freshCoords.accuracy,
      altitude: freshCoords.altitude,
    };

    await this.transmitWithAckTracking(packet);
    return locRecord;
  }

  public async triggerEmergencySos(customNote?: string): Promise<SosEvent> {
    const settings = localDatabase.getSettings();
    const coords: GeoCoordinates = await locationService.acquireFreshPosition();
    const messageId = `SOS-${Date.now().toString(36).toUpperCase()}`;

    const sosEvent: SosEvent = {
      id: messageId,
      messageId,
      nodeId: settings.localNodeId,
      isSelf: true,
      latitude: coords.latitude,
      longitude: coords.longitude,
      timestamp: Date.now(),
      status: 'ACTIVE',
      storageState: 'STORED_LOCAL',
    };

    localDatabase.addSosEvent(sosEvent);

    const packet: SosPacket = {
      type: 'SOS',
      messageId,
      sender: settings.localNodeId,
      timestamp: Date.now(),
      priority: 'CRITICAL',
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      note: customNote || 'CRITICAL DISTRESS SIGNAL ACTIVATED',
    };

    await this.transmitWithAckTracking(packet);
    this.notify();
    return sosEvent;
  }

  public async acknowledgeRemoteSos(sosId: string): Promise<void> {
    const settings = localDatabase.getSettings();
    localDatabase.acknowledgeSos(sosId);

    const ackPacket: AckPacket = {
      type: 'ACK',
      messageId: `ACK-SOS-${Date.now()}`,
      sender: settings.localNodeId,
      timestamp: Date.now(),
      priority: 'CRITICAL',
      targetMessageId: sosId,
      receivedAt: Date.now(),
    };

    await bleManager.sendPacket(ackPacket);
    this.activeSosEmergency = localDatabase.getActiveRemoteSos();
    this.notify();
  }

  public async cancelOrResolveMySos(sosId: string): Promise<void> {
    localDatabase.resolveSos(sosId);
    this.notify();
  }

  // Transmission with retry, web relay sync, and ACK waiting
  private async transmitWithAckTracking(packet: OFLinkPacket, localMessageId?: string) {
    const settings = localDatabase.getSettings();
    const isRealBleConnected = bleManager.getConnectionState() === 'CONNECTED' && !settings.mockBleEnabled;
    let sentOverBle = false;
    let sentOverWebRelay = false;

    // 1. Send via real BLE Hardware (or Mock if enabled)
    try {
      sentOverBle = await bleManager.sendPacket(packet);
    } catch (e) {
      console.warn('BLE dispatch error:', e);
    }

    // 2. Web Mesh Relay ONLY runs if real BLE hardware is NOT connected and device is online
    if (settings.webRelayEnabled && !isRealBleConnected && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        const res = await fetch('/api/mesh/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            packet,
            senderDeviceId: settings.localNodeId,
          }),
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          sentOverWebRelay = true;
        }
      } catch (err) {
        // Standalone offline mode, ignore
      }
    }

    const wasDispatched = sentOverBle || sentOverWebRelay;

    if (localMessageId) {
      localDatabase.updateMessageStatus(localMessageId, wasDispatched ? 'SENT' : 'FAILED');
    }

    if (!wasDispatched) return;

    // When real ESP32 BLE is connected, ESP32 firmware natively handles LoRa ACK timeouts & retries
    // and emits MESSAGE_STATUS|msgId|RETRYING / DELIVERED / FAILED back to the app.
    if (sentOverBle && !settings.mockBleEnabled) {
      return;
    }

    // Setup ACK expectation only for Mock/Web Relay mode
    const ackTimeout = setTimeout(() => {
      this.handleAckTimeout(packet.messageId, localMessageId);
    }, 4500);

    this.pendingAcks.set(packet.messageId, {
      timeoutId: ackTimeout,
      retries: 0,
      packet,
    });
  }

  private handleAckTimeout(messageId: string, localMessageId?: string) {
    const pending = this.pendingAcks.get(messageId);
    if (!pending) return;

    if (pending.retries < 2) {
      // Retry packet transmission
      pending.retries += 1;
      console.warn(`[LoRa Retrying] Packet ${messageId}, attempt ${pending.retries + 1}`);

      if (localMessageId) {
        localDatabase.updateMessageStatus(localMessageId, 'SENT', pending.retries);
      }

      bleManager.sendPacket(pending.packet);

      pending.timeoutId = setTimeout(() => {
        this.handleAckTimeout(messageId, localMessageId);
      }, 5000);
    } else {
      // Retries completed:
      // Note: In LoRa broadcast or unacknowledged mode, the message was transmitted by the ESP32.
      // We keep it as 'SENT' (single checkmark) rather than red 'FAILED' if the initial hardware write succeeded.
      this.pendingAcks.delete(messageId);
      this.notify();
    }
  }

  // --- Handling Incoming Packets ---

  private handleIncomingPacket(packet: OFLinkPacket, sourceSlot?: 'A' | 'B') {
    if (!packet || !packet.messageId) return;

    const settings = localDatabase.getSettings();
    const bothSlotsConnected = bleManager.areBothNodesConnected();

    // Prevent echoing own packets (unless both slots are connected on the same device and packet came from Slot B)
    if (packet.sender === settings.localNodeId && !(bothSlotsConnected && sourceSlot === 'B')) return;

    // Deduplicate packets already processed in the last 60 seconds
    if (this.recentPacketIds.has(packet.messageId)) return;
    this.recentPacketIds.add(packet.messageId);
    setTimeout(() => {
      this.recentPacketIds.delete(packet.messageId);
    }, 60000);

    this.linkMetrics.lastContact = Date.now();

    switch (packet.type) {
      case 'TEXT':
        this.handleIncomingText(packet);
        break;
      case 'LOCATION':
        this.handleIncomingLocation(packet);
        break;
      case 'SOS':
        this.handleIncomingSos(packet);
        break;
      case 'ACK':
        this.handleIncomingAck(packet);
        break;
      case 'STATUS':
        this.handleIncomingStatus(packet);
        break;
    }

    this.updateSignalQuality();
    this.notify();
  }

  private handleIncomingText(packet: TextPacket) {
    const chatMsg: ChatMessage = {
      id: packet.messageId,
      messageId: packet.messageId,
      sender: packet.sender,
      isSelf: false,
      text: packet.payload,
      timestamp: packet.timestamp || Date.now(),
      priority: packet.priority,
      deliveryStatus: 'DELIVERED',
      storageState: 'STORED_LOCAL',
      retryCount: 0,
    };

    localDatabase.addMessage(chatMsg);

    // Note: Autonomous Radio ACK is sent directly by ESP32 SX1278 firmware via sendAck(msgId)
  }

  private handleIncomingLocation(packet: LocationPacket) {
    const loc: NodeLocation = {
      id: packet.messageId,
      nodeId: packet.sender,
      latitude: packet.latitude,
      longitude: packet.longitude,
      accuracy: packet.accuracy,
      timestamp: packet.timestamp || Date.now(),
      isSelf: false,
      storageState: 'STORED_LOCAL',
    };

    localDatabase.addLocation(loc);

    // Record breadcrumb trail point
    const breadcrumbs = localDatabase.getBreadcrumbs();
    const prevPoint = breadcrumbs[breadcrumbs.length - 1];
    let distFromPrev: number | undefined;

    if (prevPoint) {
      const { distanceMeters } = locationService.calculateDistanceAndBearing(
        prevPoint.latitude,
        prevPoint.longitude,
        packet.latitude,
        packet.longitude
      );
      distFromPrev = Math.round(distanceMeters);
    }

    const bcPoint: BreadcrumbPoint = {
      id: `bc-${Date.now()}`,
      nodeId: packet.sender,
      latitude: packet.latitude,
      longitude: packet.longitude,
      timestamp: Date.now(),
      stepNumber: breadcrumbs.length + 1,
      distanceFromPrev: distFromPrev,
    };
    localDatabase.addBreadcrumb(bcPoint);
    // Note: Autonomous Radio ACK is sent directly by ESP32 SX1278 firmware
  }

  private handleIncomingSos(packet: SosPacket) {
    const sosEvent: SosEvent = {
      id: packet.messageId,
      messageId: packet.messageId,
      nodeId: packet.sender,
      isSelf: false,
      latitude: packet.latitude,
      longitude: packet.longitude,
      timestamp: packet.timestamp || Date.now(),
      status: 'ACTIVE',
      rssi: this.linkMetrics.rssi,
      snr: this.linkMetrics.snr,
      storageState: 'STORED_LOCAL',
    };

    localDatabase.addSosEvent(sosEvent);

    // Also update remote node location so map focuses on emergency point
    const loc: NodeLocation = {
      id: `sos-loc-${packet.messageId}`,
      nodeId: packet.sender,
      latitude: packet.latitude,
      longitude: packet.longitude,
      accuracy: packet.accuracy,
      timestamp: Date.now(),
      isSelf: false,
      storageState: 'STORED_LOCAL',
    };
    localDatabase.addLocation(loc);

    this.activeSosEmergency = sosEvent;
  }

  private handleIncomingAck(packet: AckPacket) {
    const pending = this.pendingAcks.get(packet.targetMessageId);
    if (pending) {
      clearTimeout(pending.timeoutId);
      this.pendingAcks.delete(packet.targetMessageId);
    }

    localDatabase.updateMessageStatus(packet.targetMessageId, 'DELIVERED');
  }

  private handleIncomingStatus(packet: StatusPacket) {
    this.linkMetrics = {
      rssi: packet.rssi,
      snr: packet.snr,
      pdr: packet.pdr,
      retries: packet.retries,
      latency: packet.latency,
      lastContact: Date.now(),
      quality: 'GOOD',
    };

    // Log link metric snapshot into local DB for historical analytics
    localDatabase.addLinkLog({
      id: `log-${Date.now()}`,
      nodeId: packet.sender,
      timestamp: Date.now(),
      rssi: packet.rssi,
      snr: packet.snr,
      pdr: packet.pdr,
      retries: packet.retries,
      latency: packet.latency,
      storageState: 'STORED_LOCAL',
    });

    this.updateSignalQuality();
  }

  private checkLinkHealth() {
    const settings = localDatabase.getSettings();
    const elapsedSec = (Date.now() - this.linkMetrics.lastContact) / 1000;

    if (elapsedSec > settings.linkLostTimeoutSec) {
      if (this.linkMetrics.quality !== 'LOST') {
        this.linkMetrics.quality = 'LOST';
        this.notify();
      }
    } else {
      this.updateSignalQuality();
    }
  }

  private updateSignalQuality() {
    const settings = localDatabase.getSettings();
    const elapsedSec = (Date.now() - this.linkMetrics.lastContact) / 1000;

    if (elapsedSec > settings.linkLostTimeoutSec) {
      this.linkMetrics.quality = 'LOST';
      return;
    }

    const { rssi, snr, pdr } = this.linkMetrics;

    if (rssi >= settings.rssiGoodThreshold && snr >= settings.snrGoodThreshold && pdr >= settings.pdrGoodThreshold) {
      this.linkMetrics.quality = 'GOOD';
    } else if (rssi >= settings.rssiFairThreshold && snr >= settings.snrFairThreshold && pdr >= settings.pdrFairThreshold) {
      this.linkMetrics.quality = 'FAIR';
    } else {
      this.linkMetrics.quality = 'WEAK';
    }
  }

  // --- Getters ---

  public getLinkMetrics(): LinkMetrics {
    return { ...this.linkMetrics };
  }

  public getBleState(): BleConnectionState {
    return this.bleState;
  }

  public getConnectedBleDevice(): BleDevice | null {
    return this.connectedBleDevice;
  }

  public getActiveSosEmergency(): SosEvent | null {
    return this.activeSosEmergency || localDatabase.getActiveRemoteSos();
  }

  public dismissActiveSosAlert() {
    this.activeSosEmergency = null;
    this.notify();
  }
}

export const oflinkService = new OFLinkService();
