export type PacketType = 'TEXT' | 'LOCATION' | 'SOS' | 'ACK' | 'STATUS';

export type PacketPriority = 'NORMAL' | 'HIGH' | 'CRITICAL';

export type MessageDeliveryStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';

export type StorageState = 'STORED_LOCAL' | 'EXPORTED';

export type BleConnectionState = 'DISCONNECTED' | 'SCANNING' | 'CONNECTING' | 'CONNECTED';

export type SignalQuality = 'GOOD' | 'FAIR' | 'WEAK' | 'LOST';

export interface BasePacket {
  type: PacketType;
  messageId: string;
  sender: string;
  timestamp: number;
  priority: PacketPriority;
}

export interface TextPacket extends BasePacket {
  type: 'TEXT';
  payload: string;
}

export interface LocationPacket extends BasePacket {
  type: 'LOCATION';
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
}

export interface SosPacket extends BasePacket {
  type: 'SOS';
  latitude: number;
  longitude: number;
  accuracy?: number;
  note?: string;
}

export interface AckPacket extends BasePacket {
  type: 'ACK';
  targetMessageId: string;
  receivedAt: number;
}

export interface StatusPacket extends BasePacket {
  type: 'STATUS';
  rssi: number;
  snr: number;
  pdr: number;
  retries: number;
  latency: number;
  batteryLevel?: number;
}

export type OFLinkPacket = TextPacket | LocationPacket | SosPacket | AckPacket | StatusPacket;

export interface ChatMessage {
  id: string;
  messageId: string;
  sender: string;
  isSelf: boolean;
  text: string;
  timestamp: number;
  priority: PacketPriority;
  deliveryStatus: MessageDeliveryStatus;
  storageState: StorageState;
  retryCount: number;
}

export interface NodeLocation {
  id: string;
  nodeId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
  isSelf: boolean;
  storageState: StorageState;
}

export interface BreadcrumbPoint {
  id: string;
  nodeId: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  stepNumber: number;
  distanceFromPrev?: number;
}

export interface SosEvent {
  id: string;
  messageId: string;
  nodeId: string;
  isSelf: boolean;
  latitude: number;
  longitude: number;
  timestamp: number;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  rssi?: number;
  snr?: number;
  storageState: StorageState;
}

export interface LinkMetrics {
  rssi: number;
  snr: number;
  pdr: number;
  retries: number;
  latency: number;
  lastContact: number;
  quality: SignalQuality;
}

export interface LinkLogEntry {
  id: string;
  nodeId: string;
  timestamp: number;
  rssi: number;
  snr: number;
  pdr: number;
  retries: number;
  latency: number;
  storageState: StorageState;
}

export interface BleDevice {
  id: string;
  name: string;
  rssi?: number;
  connected: boolean;
  lastSeen: number;
}
