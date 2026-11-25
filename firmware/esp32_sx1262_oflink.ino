/**
 * ============================================================================
 * OFLINK ESP32 + SX1262 LoRa Companion Node Firmware
 * ============================================================================
 * Hardware: ESP32-WROOM-32 / ESP32-S3 + Semtech SX1262 LoRa Transceiver
 * Library dependencies:
 *   - RadioLib (v6.0.0+) by Jan Gromes
 *   - ESP32 BLE Arduino (built into ESP32 core)
 *   - ArduinoJson (v6.21.0+)
 *
 * Architecture:
 *   Android Phone <---[BLE 5.0 UART]---> ESP32 <---[SPI / SX1262]---> Long-Range LoRa Link
 * ============================================================================
 */

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <RadioLib.h>
#include <ArduinoJson.h>

// ----------------------------------------------------------------------------
// Hardware Status LED (Pin 2 is standard on ESP32 NodeMCU / DevKit boards)
// ----------------------------------------------------------------------------
#define LED_PIN 2

// ----------------------------------------------------------------------------
// BLE UUIDs
// Set to 1 for Custom OFLINK UUIDs (6d7f...), or 0 for Standard Nordic NUS (6e40...)
// ----------------------------------------------------------------------------
#define USE_CUSTOM_OFLINK_UUID 1

#if USE_CUSTOM_OFLINK_UUID
  #define SERVICE_UUID           "6d7f1000-7c8a-4d91-9b61-1b632fcb1234"
  #define CHARACTERISTIC_UUID_TX "6d7f1002-7c8a-4d91-9b61-1b632fcb1234" // ESP32 -> Phone (Notify)
  #define CHARACTERISTIC_UUID_RX "6d7f1001-7c8a-4d91-9b61-1b632fcb1234" // Phone -> ESP32 (Write)
#else
  // Standard Nordic UART Service (NUS)
  #define SERVICE_UUID           "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
  #define CHARACTERISTIC_UUID_TX "6e400003-b5a3-f393-e0a9-e50e24dcca9e" // ESP32 -> Phone (Notify)
  #define CHARACTERISTIC_UUID_RX "6e400002-b5a3-f393-e0a9-e50e24dcca9e" // Phone -> ESP32 (Write)
// ----------------------------------------------------------------------------
// NODE IDENTITY SELECTION (1 = Node A / OFLINK-A, 2 = Node B / OFLINK-B)
// ----------------------------------------------------------------------------
// Flash Board 1 with: #define NODE_ROLE 1 (advertises as "OFLINK-A", ID "NODE-A")
// Flash Board 2 with: #define NODE_ROLE 2 (advertises as "OFLINK-B", ID "NODE-B")
#define NODE_ROLE 1

#if NODE_ROLE == 1
  #define NODE_BLE_NAME "OFLINK-A"
  #define NODE_ID       "NODE-A"
  #define TARGET_NODE_ID "NODE-B"
#else
  #define NODE_BLE_NAME "OFLINK-B"
  #define NODE_ID       "NODE-B"
  #define TARGET_NODE_ID "NODE-A"
#endif

// ----------------------------------------------------------------------------
// LoRa Transceiver Selection (1 = SX1278 Ra-02 433MHz, 0 = SX1262)
// ----------------------------------------------------------------------------
#define USE_SX1278 1

#if USE_SX1278
  // SX1278 (e.g. Ai-Thinker Ra-02 433MHz) standard ESP32 SPI wiring
  #define LORA_NSS   5
  #define LORA_DIO0  26
  #define LORA_NRST  14
  #define LORA_DIO1  27
  SX1278 radio = new Module(LORA_NSS, LORA_DIO0, LORA_NRST, LORA_DIO1);
#else
  // SX1262 standard ESP32 SPI wiring
  #define LORA_NSS   5
  #define LORA_DIO1  26
  #define LORA_NRST  14
  #define LORA_BUSY  27
  SX1262 radio = new Module(LORA_NSS, LORA_DIO1, LORA_NRST, LORA_BUSY);
#endif

// ----------------------------------------------------------------------------
// Global State & Queues
// ----------------------------------------------------------------------------
BLEServer *pServer = NULL;
BLECharacteristic *pTxCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;

// Flags for non-blocking asynchronous LoRa
volatile bool receivedFlag = false;
volatile bool enableInterrupt = true;

// LoRa Telemetry Stats
uint32_t totalPacketsSent = 0;
uint32_t totalPacketsReceived = 0;
uint32_t totalPacketsLost = 0;
float lastRssi = -90.0;
float lastSnr = 6.0;
unsigned long lastStatusTime = 0;

// Priority FIFO Queues: SOS packets take immediate priority over NORMAL text
struct QueuedPacket {
  String json;
  bool isCritical;
};

#define QUEUE_SIZE 8
QueuedPacket txQueue[QUEUE_SIZE];
int queueHead = 0;
int queueTail = 0;
int queueCount = 0;

// ----------------------------------------------------------------------------
// Forward Declarations
// ----------------------------------------------------------------------------
void setFlag(void);
void sendStatusToBle();
void processBleReceivedData(String jsonString);

// Interrupt Service Routine for SX1262 DIO1
#if defined(ESP8266) || defined(ESP32)
  ICACHE_RAM_ATTR
#endif
void setFlag(void) {
  if (!enableInterrupt) return;
  receivedFlag = true;
}

// ----------------------------------------------------------------------------
// BLE Callbacks
// ----------------------------------------------------------------------------
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    digitalWrite(LED_PIN, HIGH); // Solid ON when connected
    Serial.println("[BLE] Phone Connected via Web Bluetooth");
  };

  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    digitalWrite(LED_PIN, LOW);
    Serial.println("[BLE] Phone Disconnected -> Restarting BLE Advertising...");
    // Auto restart advertising so phone can reconnect without resetting ESP32
    BLEDevice::startAdvertising();
  }
};

class RxCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    String rxValue = pCharacteristic->getValue().c_str();
    if (rxValue.length() > 0) {
      Serial.print("[BLE RX -> LoRa Queue] ");
      Serial.println(rxValue);
      processBleReceivedData(rxValue);
    }
  }
};

// ----------------------------------------------------------------------------
// Packet Queue & Priority Management
// ----------------------------------------------------------------------------
void enqueuePacket(String json, bool isCritical) {
  if (queueCount >= QUEUE_SIZE) {
    Serial.println("[QUEUE] Buffer full, dropping oldest normal packet");
    queueHead = (queueHead + 1) % QUEUE_SIZE;
    queueCount--;
  }

  // If critical SOS, push to front
  if (isCritical) {
    queueHead = (queueHead - 1 + QUEUE_SIZE) % QUEUE_SIZE;
    txQueue[queueHead].json = json;
    txQueue[queueHead].isCritical = true;
    queueCount++;
  } else {
    txQueue[queueTail].json = json;
    txQueue[queueTail].isCritical = false;
    queueTail = (queueTail + 1) % QUEUE_SIZE;
    queueCount++;
  }
}

void processBleReceivedData(String jsonString) {
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, jsonString);

  if (error) {
    Serial.print("[JSON Error] deserializeJson() failed: ");
    Serial.println(error.f_str());
    return;
  }

  const char* type = doc["type"];
  const char* priority = doc["priority"];
  bool isCritical = (priority && strcmp(priority, "CRITICAL") == 0);

  enqueuePacket(jsonString, isCritical);
}

// ----------------------------------------------------------------------------
// Setup
// ----------------------------------------------------------------------------
void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH); // Turn on LED at boot
  Serial.begin(115200);
  delay(600); // Non-blocking boot delay (replaces blocking while(!Serial))
  digitalWrite(LED_PIN, LOW);
  Serial.println("\n========================================================");
  Serial.println("[OFLINK] Booting ESP32 + LoRa Transceiver...");
  Serial.print("[BLE] Service UUID: ");
  Serial.println(SERVICE_UUID);
  Serial.println("========================================================");

  // 1. Initialize BLE Nordic UART Service
  BLEDevice::init(NODE_BLE_NAME);
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  pTxCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID_TX,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pTxCharacteristic->addDescriptor(new BLE2902());

  BLECharacteristic *pRxCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID_RX,
    BLECharacteristic::PROPERTY_WRITE
  );
  pRxCharacteristic->setCallbacks(new RxCallbacks());

  pService->start();

  // Setup advertising with complete local name and UUID
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06); // Assists iOS/Android Bluetooth discovery
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  Serial.print("[BLE] Advertising started! Visible as '");
  Serial.print(NODE_BLE_NAME);
  Serial.print("' | Active ID: ");
  Serial.println(NODE_ID);

  // 2. Initialize LoRa Radio (SX1278 / SX1262)
  // Frequency: 433.05 MHz (PTA compliant ISM band)
  // Parameters: Freq: 433.05 MHz, BW: 125.0 kHz, SF: 9, CR: 7 (4/7), SyncWord: 0x12, Power: +10 dBm
  Serial.print("[LoRa] Initializing radio at 433.05 MHz... ");
  int state = radio.begin(433.05, 125.0, 9, 7, 0x12, 10);

  if (state == RADIOLIB_ERR_NONE) {
    Serial.println("RADIO OK!");
  } else {
    Serial.print("RADIO INIT WARNING, code: ");
    Serial.println(state);
    Serial.println("[LoRa] Note: Check SPI jumper wires (NSS, DIO0/DIO1, MOSI, MISO, SCK)");
    // Keep BLE running so user can still pair and test over Bluetooth!
  }

  // Set packet received interrupt (DIO0 for SX1278, DIO1 for SX1262)
  #if USE_SX1278
    radio.setDio0Action(setFlag);
  #else
    radio.setDio1Action(setFlag);
  #endif

  // Start listening for incoming LoRa packets
  state = radio.startReceive();
  if (state != RADIOLIB_ERR_NONE) {
    Serial.print("[LoRa] startReceive failed, code: ");
    Serial.println(state);
  }
}

// ----------------------------------------------------------------------------
// Main Loop
// ----------------------------------------------------------------------------
void loop() {
  // 1. Handle incoming LoRa packets received via interrupt
  if (receivedFlag) {
    enableInterrupt = false;
    receivedFlag = false;

    String incomingStr;
    int state = radio.readData(incomingStr);

    if (state == RADIOLIB_ERR_NONE) {
      lastRssi = radio.getRSSI();
      lastSnr = radio.getSNR();
      totalPacketsReceived++;

      Serial.print("[LoRa RX] RSSI: ");
      Serial.print(lastRssi);
      Serial.print(" dBm, SNR: ");
      Serial.print(lastSnr);
      Serial.print(" dB | Payload: ");
      Serial.println(incomingStr);

      // Relay incoming LoRa packet to Android phone over BLE UART notify
      if (deviceConnected && pTxCharacteristic) {
        pTxCharacteristic->setValue((uint8_t*)incomingStr.c_str(), incomingStr.length());
        pTxCharacteristic->notify();
      }
    } else {
      totalPacketsLost++;
      Serial.print("[LoRa RX Error] Code: ");
      Serial.println(state);
    }

    // Return SX1262 to continuous receive mode
    radio.startReceive();
    enableInterrupt = true;
  }

  // 2. Transmit queued outgoing packets over LoRa
  if (queueCount > 0) {
    enableInterrupt = false;
    String packetToSend = txQueue[queueHead].json;
    queueHead = (queueHead + 1) % QUEUE_SIZE;
    queueCount--;

    Serial.print("[LoRa TX] Transmitting: ");
    Serial.println(packetToSend);

    int state = radio.transmit(packetToSend);
    if (state == RADIOLIB_ERR_NONE) {
      totalPacketsSent++;
      Serial.println("[LoRa TX] Transmit complete.");
    } else {
      Serial.print("[LoRa TX Error] Code: ");
      Serial.println(state);
    }

    // Resume listening immediately after TX
    radio.startReceive();
    enableInterrupt = true;
  }

  // 3. Send periodic status telemetry to phone every 10 seconds
  if (millis() - lastStatusTime > 10000) {
    lastStatusTime = millis();
    sendStatusToBle();
  }

  // 4. Handle BLE disconnection advertising restart
  if (!deviceConnected && oldDeviceConnected) {
    delay(500); // give the bluetooth stack the chance to get things ready
    pServer->startAdvertising();
    Serial.println("[BLE] Advertising restarted");
    oldDeviceConnected = deviceConnected;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }

  delay(20);
}

// ----------------------------------------------------------------------------
// Helper: Send Link Status Packet to Phone
// ----------------------------------------------------------------------------
void sendStatusToBle() {
  if (!deviceConnected || !pTxCharacteristic) return;

  uint32_t total = totalPacketsReceived + totalPacketsLost;
  uint8_t pdr = (total > 0) ? (uint8_t)((totalPacketsReceived * 100) / total) : 98;

  StaticJsonDocument<256> doc;
  doc["type"] = "STATUS";
  doc["messageId"] = "STAT-" + String(millis());
  doc["sender"] = NODE_ID;
  doc["timestamp"] = millis();
  doc["priority"] = "NORMAL";
  doc["rssi"] = (int)lastRssi;
  doc["snr"] = (float)lastSnr;
  doc["pdr"] = pdr;
  doc["retries"] = 1;
  doc["latency"] = 820;

  String output;
  serializeJson(doc, output);

  pTxCharacteristic->setValue((uint8_t*)output.c_str(), output.length());
  pTxCharacteristic->notify();
}
