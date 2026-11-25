# OFLINK · Connect Beyond the Network

> **Offline, infrastructure-independent peer-to-peer tactical communication system.**  
> Designed for off-grid operations using Android smartphones paired with local ESP32 + Semtech SX1262 LoRa nodes via Bluetooth Low Energy (BLE).

---

## 1. System Topology & Architecture

The smartphone does **NOT** communicate directly with LoRa.

```
+---------------------------------------------------------------------------------------------+
|                                      OFLINK LINK ARCHITECTURE                                |
+---------------------------------------------------------------------------------------------+
|                                                                                             |
|   [ Phone A ]                                                             [ Phone B ]       |
|    (OFLINK App)                                                            (OFLINK App)      |
|         │                                                                       ▲           |
|         ▼ Bluetooth Low Energy (BLE 5.0)                                         │ BLE 5.0   |
|   [ ESP32 Node A ]                                                        [ ESP32 Node B ]  |
|         │ SPI                                                                   ▲ SPI       |
|         ▼                                                                       │           |
|   [ SX1262 LoRa A ] ────── Long-Range Sub-GHz LoRa RF (433 MHz PTA) ──────► [ SX1262 LoRa B ]   |
|                                                                                             |
+---------------------------------------------------------------------------------------------+
```

### Zero-Dependency Core Operation
The core communication system operates fully offline without:
- ❌ Cellular / 4G / 5G
- ❌ Wi-Fi / Local Area Networks
- ❌ Internet gateways
- ❌ Cloud backends or Firebase
- ❌ External GPS/GNSS receiver modules (uses the phone's native built-in GNSS)

---

## 2. Configured BLE GATT UUIDs

The application communicates with the ESP32 node via a Nordic UART compatible GATT service. These values are configurable in the **Settings** screen and in `src/config/oflinkConfig.ts`:

| Property | UUID | Description |
| :--- | :--- | :--- |
| **SERVICE_UUID** | `6E400001-B5A3-F393-E0A9-E50E24DCCA9E` | Primary OFLINK Nordic UART BLE Service |
| **TX_CHARACTERISTIC** | `6E400002-B5A3-F393-E0A9-E50E24DCCA9E` | Phone writes packets $\rightarrow$ ESP32 |
| **RX_CHARACTERISTIC** | `6E400003-B5A3-F393-E0A9-E50E24DCCA9E` | ESP32 notifies incoming packets $\rightarrow$ Phone |

---

## 3. LoRa RF Physical Specifications (PTA Compliant)

- **Transceiver**: Semtech SX1262
- **Frequency**: `433.0 MHz` (Pakistan Telecommunication Authority ISM Band: `433.05 - 434.79 MHz`)
- **Spreading Factor**: `SF9` (balanced range vs airtime)
- **Bandwidth**: `125.0 kHz`
- **Coding Rate**: `4/5`
- **TX Power**: `+14 dBm` (25 mW standard as per PTA short-range device regulations)
- **Sync Word**: `0x12` (Private LoRa Network)

---

## 4. Packet Specifications

All packets are encoded as compact JSON payloads transmitted over BLE and LoRa:

### Text Message Packet
```json
{
  "type": "TEXT",
  "messageId": "MSG-KJ912-482",
  "sender": "OFLINK-A",
  "priority": "NORMAL",
  "payload": "At rendezvous coordinates. Sector is clear.",
  "timestamp": 1742081234000
}
```

### Location Sharing Packet
```json
{
  "type": "LOCATION",
  "messageId": "LOC-L82F1",
  "sender": "OFLINK-A",
  "priority": "HIGH",
  "latitude": 24.8607,
  "longitude": 67.0011,
  "accuracy": 4.5,
  "altitude": 14.2,
  "timestamp": 1742081250000
}
```

### Priority SOS Distress Packet
```json
{
  "type": "SOS",
  "messageId": "SOS-9812A",
  "sender": "OFLINK-A",
  "priority": "CRITICAL",
  "latitude": 24.8607,
  "longitude": 67.0011,
  "accuracy": 3.8,
  "timestamp": 1742081290000
}
```

### Acknowledgement (ACK) Packet
```json
{
  "type": "ACK",
  "messageId": "ACK-1742081300",
  "sender": "OFLINK-B",
  "targetMessageId": "MSG-KJ912-482",
  "receivedAt": 1742081300000
}
```

### Link Status Telemetry Packet
```json
{
  "type": "STATUS",
  "messageId": "STAT-1742081310",
  "sender": "OFLINK-B",
  "rssi": -92,
  "snr": 6.4,
  "pdr": 96,
  "retries": 1,
  "latency": 850,
  "timestamp": 1742081310000
}
```

---

## 5. Offline-First Architecture & Storage

1. **Local Database (Primary Store)**:
   - Built on indexed local relational storage (`src/services/storage/localDatabase.ts`).
   - Stores all messages, delivery states, breadcrumb trails, last-known locations, link logs, and device configurations.
   - 100% operational in disconnected wilderness/field environments.
   - Supports 1-click JSON backup export and restore.

2. **Offline Tactical Vector Map**:
   - Built on dedicated HTML5 vector canvas geometry (`src/services/maps/OfflineTacticalMap.tsx`).
   - Zero HTTP requests; does not load external Google Maps tiles.
   - Renders topo contours, tactical coordinate grid, heading compass rose, dynamic scale bar, operator markers, distance arc, and emergency breadcrumb paths ($P_1 \rightarrow P_2 \rightarrow P_3$).
   - Calculates distance (Haversine formula) and 16-point cardinal bearing (e.g. `NW · 315°`) entirely on-device.

3. **Priority SOS System**:
   - 2-second hold-to-activate radial progress button to prevent accidental triggers.
   - Pushes `priority: CRITICAL` packets through the ESP32 FIFO queue with automatic retransmission backoff.
   - Prominent incoming emergency alert dialog and permanent header strip that never gets hidden by standard messages.

4. **100% Offline Local Archive & Recovery**:
   - Zero cloud database, zero MongoDB, zero external dependencies.
   - 1-click JSON backup export and restore directly from device storage.
   - All session data, coordinates, and chat history are self-contained.

---

## 6. Directory Structure

```
├── android/app/src/main/AndroidManifest.xml  # Native Android BLE & GNSS permissions
├── firmware/esp32_sx1262_oflink.ino          # Complete ESP32 + SX1262 Arduino firmware
├── src/
│   ├── config/oflinkConfig.ts                # Default BLE UUIDs, thresholds & settings
│   ├── models/packets.ts                     # TypeScript packet interfaces & priorities
│   ├── services/
│   │   ├── ble/bleService.ts                 # Reusable BLE manager & Mock simulator
│   │   ├── location/locationService.ts       # Native GNSS & Haversine/Bearing math
│   │   ├── maps/OfflineTacticalMap.tsx       # 100% offline tactical vector map canvas
│   │   ├── storage/localDatabase.ts          # Primary offline SQLite/local database
│   │   ├── permissions/androidPermissions.ts # Android permission manager
│   │   └── oflinkService.ts                  # Central packet orchestrator & ACK handler
│   ├── components/
│   │   └── IncomingSosModal.tsx              # Emergency alert modal overlay
│   ├── screens/
│   │   ├── SplashScreen.tsx                  # Tactical splash screen
│   │   ├── HomeDashboardScreen.tsx           # Main status card & quick actions
│   │   ├── ChatScreen.tsx                    # WhatsApp-style offline messaging
│   │   ├── MapScreen.tsx                     # Full offline map & breadcrumb drawer
│   │   ├── LocationDetailsScreen.tsx         # GNSS telemetry & vector readouts
│   │   ├── LinkStatusScreen.tsx              # LoRa RSSI/SNR meters & link lost alert
│   │   ├── SosScreen.tsx                     # Hold-to-activate emergency distress
│   │   ├── BleConnectionScreen.tsx           # BLE scanning & hardware simulator
│   │   ├── SettingsScreen.tsx                # Thresholds, UUIDs & node IDs
│   │   ├── LocalBackupScreen.tsx             # 100% offline JSON backup/restore
│   │   └── AboutScreen.tsx                   # Topology & AI prediction placeholder
│   ├── App.tsx                               # Primary app layout & navigation
│   ├── index.css                             # Global Tailwind CSS styling
│   └── main.tsx                              # React DOM root entrypoint
├── server.ts                                 # Express full-stack API + Vite middleware
└── .env.example                              # Environment configuration template
```

---

## 7. Running the Application

### Development (Full-Stack Dev Server)
```bash
npm run dev
```
Starts the Node.js Express API and mounts Vite middleware on `http://localhost:3000`.

### Building for Production
```bash
npm run build
npm start
```
Compiles client assets into `dist/` and serves the production bundle.
