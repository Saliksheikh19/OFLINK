export interface OFLinkSettings {
  // Node IDs
  localNodeId: string;
  targetNodeId: string;

  // BLE Configuration (ESP32 Nordic UART Service)
  serviceUuid: string;
  txCharacteristicUuid: string;
  rxCharacteristicUuid: string;
  autoReconnect: boolean;

  // Signal Quality Thresholds (Configurable)
  rssiGoodThreshold: number; // e.g. -95 dBm
  rssiFairThreshold: number; // e.g. -110 dBm
  snrGoodThreshold: number;  // e.g. 5.0 dB
  snrFairThreshold: number;  // e.g. 0.0 dB
  pdrGoodThreshold: number;  // e.g. 90 %
  pdrFairThreshold: number;  // e.g. 70 %

  // Link Loss & Tracking
  linkLostTimeoutSec: number; // e.g. 60 seconds
  breadcrumbDistanceMeters: number; // e.g. 25 meters
  breadcrumbIntervalSec: number; // e.g. 30 seconds

  // RF Physical Specs (ESP32 + Semtech SX1262)
  loraFrequencyMhz: number;
  loraSpreadingFactor: number;
  loraBandwidthKhz: number;
  loraCodingRate: string;
  loraTxPowerDbm: number;

  // Transmission Protocol & Delimiters
  transmissionFormat: 'AUTO' | 'JSON' | 'PLAIN_TEXT';
  appendNewline: boolean;
  webRelayEnabled: boolean;

  // Hardware Simulation Mode (Allows running full app without ESP32 attached)
  mockBleEnabled: boolean;
  theme: 'dark' | 'tactical' | 'light';
}

export const DEFAULT_SETTINGS: OFLinkSettings = {
  localNodeId: 'OFLINK-A',
  targetNodeId: 'OFLINK-B',

  // Custom OFLINK & User ESP32 Sketch UUIDs
  serviceUuid: '6d7f1000-7c8a-4d91-9b61-1b632fcb1234', // Custom OFLINK BLE Service
  txCharacteristicUuid: '6d7f1001-7c8a-4d91-9b61-1b632fcb1234', // Phone -> ESP32 Write
  rxCharacteristicUuid: '6d7f1002-7c8a-4d91-9b61-1b632fcb1234', // ESP32 -> Phone Notify
  autoReconnect: true,

  transmissionFormat: 'AUTO',
  appendNewline: false, // Clean JSON ending in '}' matches ESP32 bleBuffer.endsWith("}")
  webRelayEnabled: false, // Disabled by default so real BLE + LoRa hardware is tested offline

  rssiGoodThreshold: -95,
  rssiFairThreshold: -110,
  snrGoodThreshold: 5.0,
  snrFairThreshold: 0.0,
  pdrGoodThreshold: 90,
  pdrFairThreshold: 70,

  linkLostTimeoutSec: 60,
  breadcrumbDistanceMeters: 25,
  breadcrumbIntervalSec: 30,

  loraFrequencyMhz: 433.05, // 433.05 MHz as per PTA ISM band configuration
  loraSpreadingFactor: 9,
  loraBandwidthKhz: 125,
  loraCodingRate: '4/7',
  loraTxPowerDbm: 10,

  mockBleEnabled: false, // Default to FALSE so real ESP32 connects immediately!
  theme: 'dark',
};

export const STORAGE_KEYS = {
  SETTINGS: 'oflink_settings_v1',
  MESSAGES: 'oflink_messages_v1',
  LOCATIONS: 'oflink_locations_v1',
  BREADCRUMBS: 'oflink_breadcrumbs_v1',
  SOS_EVENTS: 'oflink_sos_events_v1',
  LINK_LOGS: 'oflink_link_logs_v1',
  LAST_KNOWN_LOCATION: 'oflink_last_known_loc_v1',
  KNOWN_DEVICES: 'oflink_known_devices_v1',
};
