import {
  ChatMessage,
  NodeLocation,
  BreadcrumbPoint,
  SosEvent,
  LinkLogEntry,
  BleDevice,
  StorageState,
  MessageDeliveryStatus,
} from '../../models/packets.ts';
import { DEFAULT_SETTINGS, OFLinkSettings, STORAGE_KEYS } from '../../config/oflinkConfig.ts';

type Listener = () => void;

class LocalDatabase {
  private listeners: Set<Listener> = new Set();

  private messages: ChatMessage[] = [];
  private locations: NodeLocation[] = [];
  private breadcrumbs: BreadcrumbPoint[] = [];
  private sosEvents: SosEvent[] = [];
  private linkLogs: LinkLogEntry[] = [];
  private lastKnownLocation: NodeLocation | null = null;
  private settings: OFLinkSettings = { ...DEFAULT_SETTINGS };
  private knownDevices: BleDevice[] = [];
  private isLoaded: boolean = false;

  constructor() {
    this.loadFromStorage();
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('LocalDatabase listener error:', err);
      }
    });
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private loadFromStorage() {
    try {
      const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        if (parsed.serviceUuid === '6e400001-b5a3-f393-e0a9-e50e24dcca9e') {
          parsed.serviceUuid = '6d7f1000-7c8a-4d91-9b61-1b632fcb1234';
          parsed.txCharacteristicUuid = '6d7f1001-7c8a-4d91-9b61-1b632fcb1234';
          parsed.rxCharacteristicUuid = '6d7f1002-7c8a-4d91-9b61-1b632fcb1234';
        }
        this.settings = { ...DEFAULT_SETTINGS, ...parsed };
      }

      const storedMessages = localStorage.getItem(STORAGE_KEYS.MESSAGES);
      if (storedMessages) {
        this.messages = JSON.parse(storedMessages);
      } else {
        // Seed initial field chat message
        this.messages = [
          {
            id: 'msg-seed-1',
            messageId: 'MSG-INIT-01',
            sender: 'OFLINK-B',
            isSelf: false,
            text: 'OFLINK field node online. LoRa link standby on 433 MHz (PTA). Ready for offline test.',
            timestamp: Date.now() - 1000 * 60 * 3,
            priority: 'NORMAL',
            deliveryStatus: 'DELIVERED',
            storageState: 'STORED_LOCAL',
            retryCount: 0,
          },
        ];
        this.saveMessages();
      }

      const storedLocations = localStorage.getItem(STORAGE_KEYS.LOCATIONS);
      if (storedLocations) {
        this.locations = JSON.parse(storedLocations);
      }

      const storedLastKnown = localStorage.getItem(STORAGE_KEYS.LAST_KNOWN_LOCATION);
      if (storedLastKnown) {
        this.lastKnownLocation = JSON.parse(storedLastKnown);
      } else {
        this.lastKnownLocation = {
          id: 'loc-seed-b',
          nodeId: 'OFLINK-B',
          latitude: 24.8645,
          longitude: 67.0085,
          accuracy: 6,
          timestamp: Date.now() - 1000 * 45,
          isSelf: false,
          storageState: 'STORED_LOCAL',
        };
      }

      const storedBreadcrumbs = localStorage.getItem(STORAGE_KEYS.BREADCRUMBS);
      if (storedBreadcrumbs) {
        this.breadcrumbs = JSON.parse(storedBreadcrumbs);
      } else {
        this.breadcrumbs = [
          {
            id: 'bc-1',
            nodeId: 'OFLINK-B',
            latitude: 24.8610,
            longitude: 67.0030,
            timestamp: Date.now() - 1000 * 180,
            stepNumber: 1,
          },
          {
            id: 'bc-2',
            nodeId: 'OFLINK-B',
            latitude: 24.8628,
            longitude: 67.0055,
            timestamp: Date.now() - 1000 * 110,
            stepNumber: 2,
            distanceFromPrev: 310,
          },
          {
            id: 'bc-3',
            nodeId: 'OFLINK-B',
            latitude: 24.8645,
            longitude: 67.0085,
            timestamp: Date.now() - 1000 * 45,
            stepNumber: 3,
            distanceFromPrev: 360,
          },
        ];
      }

      const storedSos = localStorage.getItem(STORAGE_KEYS.SOS_EVENTS);
      if (storedSos) {
        this.sosEvents = JSON.parse(storedSos);
      }

      const storedLogs = localStorage.getItem(STORAGE_KEYS.LINK_LOGS);
      if (storedLogs) {
        this.linkLogs = JSON.parse(storedLogs);
      }

      const storedDevices = localStorage.getItem(STORAGE_KEYS.KNOWN_DEVICES);
      if (storedDevices) {
        this.knownDevices = JSON.parse(storedDevices);
      }

      this.isLoaded = true;
    } catch (err) {
      console.error('Error loading LocalDatabase:', err);
      this.isLoaded = true;
    }
  }

  // --- Settings ---
  public getSettings(): OFLinkSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<OFLinkSettings>) {
    this.settings = { ...this.settings, ...partial };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    this.notify();
  }

  // --- Messages ---
  public getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  public addMessage(message: ChatMessage) {
    this.messages.push(message);
    this.saveMessages();
    this.notify();
  }

  public updateMessageStatus(messageId: string, deliveryStatus: MessageDeliveryStatus, retryCount?: number) {
    const idx = this.messages.findIndex((m) => m.messageId === messageId);
    if (idx !== -1) {
      this.messages[idx].deliveryStatus = deliveryStatus;
      if (typeof retryCount === 'number') {
        this.messages[idx].retryCount = retryCount;
      }
      this.saveMessages();
      this.notify();
    }
  }

  public clearMessages() {
    this.messages = [];
    this.saveMessages();
    this.notify();
  }

  private saveMessages() {
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(this.messages));
  }

  // --- Locations & Breadcrumbs ---
  public getLocations(): NodeLocation[] {
    return [...this.locations];
  }

  public getLastKnownLocation(): NodeLocation | null {
    return this.lastKnownLocation ? { ...this.lastKnownLocation } : null;
  }

  public addLocation(location: NodeLocation) {
    this.locations.push(location);
    if (!location.isSelf) {
      this.lastKnownLocation = location;
      localStorage.setItem(STORAGE_KEYS.LAST_KNOWN_LOCATION, JSON.stringify(location));
    }
    localStorage.setItem(STORAGE_KEYS.LOCATIONS, JSON.stringify(this.locations));
    this.notify();
  }

  public getBreadcrumbs(): BreadcrumbPoint[] {
    return [...this.breadcrumbs];
  }

  public addBreadcrumb(point: BreadcrumbPoint) {
    this.breadcrumbs.push(point);
    if (this.breadcrumbs.length > 100) {
      this.breadcrumbs.shift();
    }
    localStorage.setItem(STORAGE_KEYS.BREADCRUMBS, JSON.stringify(this.breadcrumbs));
    this.notify();
  }

  public clearBreadcrumbs() {
    this.breadcrumbs = [];
    localStorage.setItem(STORAGE_KEYS.BREADCRUMBS, JSON.stringify(this.breadcrumbs));
    this.notify();
  }

  // --- SOS Events ---
  public getSosEvents(): SosEvent[] {
    return [...this.sosEvents];
  }

  public getActiveRemoteSos(): SosEvent | null {
    return this.sosEvents.find((s) => !s.isSelf && s.status === 'ACTIVE') || null;
  }

  public addSosEvent(event: SosEvent) {
    this.sosEvents.push(event);
    localStorage.setItem(STORAGE_KEYS.SOS_EVENTS, JSON.stringify(this.sosEvents));
    this.notify();
  }

  public acknowledgeSos(id: string) {
    const idx = this.sosEvents.findIndex((s) => s.id === id);
    if (idx !== -1) {
      this.sosEvents[idx].status = 'ACKNOWLEDGED';
      localStorage.setItem(STORAGE_KEYS.SOS_EVENTS, JSON.stringify(this.sosEvents));
      this.notify();
    }
  }

  public resolveSos(id: string) {
    const idx = this.sosEvents.findIndex((s) => s.id === id);
    if (idx !== -1) {
      this.sosEvents[idx].status = 'RESOLVED';
      localStorage.setItem(STORAGE_KEYS.SOS_EVENTS, JSON.stringify(this.sosEvents));
      this.notify();
    }
  }

  // --- Link Logs ---
  public getLinkLogs(): LinkLogEntry[] {
    return [...this.linkLogs];
  }

  public addLinkLog(log: LinkLogEntry) {
    this.linkLogs.push(log);
    if (this.linkLogs.length > 200) {
      this.linkLogs.shift();
    }
    localStorage.setItem(STORAGE_KEYS.LINK_LOGS, JSON.stringify(this.linkLogs));
    this.notify();
  }

  public clearLinkLogs() {
    this.linkLogs = [];
    localStorage.setItem(STORAGE_KEYS.LINK_LOGS, JSON.stringify(this.linkLogs));
    this.notify();
  }

  // --- Known BLE Devices ---
  public getKnownDevices(): BleDevice[] {
    return [...this.knownDevices];
  }

  public saveKnownDevice(device: BleDevice) {
    const existingIdx = this.knownDevices.findIndex((d) => d.id === device.id);
    if (existingIdx !== -1) {
      this.knownDevices[existingIdx] = device;
    } else {
      this.knownDevices.push(device);
    }
    localStorage.setItem(STORAGE_KEYS.KNOWN_DEVICES, JSON.stringify(this.knownDevices));
    this.notify();
  }

  // --- Backup & Export (100% Offline, on-device JSON dump) ---
  public exportDatabaseToJson(): string {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      nodeId: this.settings.localNodeId,
      storageType: 'LOCAL_OFFLINE_SQLITE_STORAGE',
      messages: this.messages,
      locations: this.locations,
      lastKnownLocation: this.lastKnownLocation,
      breadcrumbs: this.breadcrumbs,
      sosEvents: this.sosEvents,
      linkLogs: this.linkLogs,
      settings: this.settings,
    };
    return JSON.stringify(backup, null, 2);
  }

  public importDatabaseFromJson(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data.messages)) this.messages = data.messages;
      if (Array.isArray(data.locations)) this.locations = data.locations;
      if (data.lastKnownLocation) this.lastKnownLocation = data.lastKnownLocation;
      if (Array.isArray(data.breadcrumbs)) this.breadcrumbs = data.breadcrumbs;
      if (Array.isArray(data.sosEvents)) this.sosEvents = data.sosEvents;
      if (Array.isArray(data.linkLogs)) this.linkLogs = data.linkLogs;
      if (data.settings) this.settings = { ...DEFAULT_SETTINGS, ...data.settings };

      this.saveMessages();
      localStorage.setItem(STORAGE_KEYS.LOCATIONS, JSON.stringify(this.locations));
      if (this.lastKnownLocation) {
        localStorage.setItem(STORAGE_KEYS.LAST_KNOWN_LOCATION, JSON.stringify(this.lastKnownLocation));
      }
      localStorage.setItem(STORAGE_KEYS.BREADCRUMBS, JSON.stringify(this.breadcrumbs));
      localStorage.setItem(STORAGE_KEYS.SOS_EVENTS, JSON.stringify(this.sosEvents));
      localStorage.setItem(STORAGE_KEYS.LINK_LOGS, JSON.stringify(this.linkLogs));
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));

      this.notify();
      return true;
    } catch (e) {
      console.error('Failed to import database:', e);
      return false;
    }
  }

  public wipeAllData() {
    this.messages = [];
    this.locations = [];
    this.breadcrumbs = [];
    this.sosEvents = [];
    this.linkLogs = [];
    this.lastKnownLocation = null;
    localStorage.removeItem(STORAGE_KEYS.MESSAGES);
    localStorage.removeItem(STORAGE_KEYS.LOCATIONS);
    localStorage.removeItem(STORAGE_KEYS.BREADCRUMBS);
    localStorage.removeItem(STORAGE_KEYS.SOS_EVENTS);
    localStorage.removeItem(STORAGE_KEYS.LINK_LOGS);
    localStorage.removeItem(STORAGE_KEYS.LAST_KNOWN_LOCATION);
    this.notify();
  }
}

export const localDatabase = new LocalDatabase();
