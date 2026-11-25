// Production-ready Arduino C++ Firmware matching user's SX1278 + ESP32 configuration
// Custom OFLINK 6D7F BLE Service + Semtech SX1278 (433.05 MHz LoRa)

export const ESP32_FIRMWARE_ARDUINO_CODE = `#include <Arduino.h>
#include <SPI.h>
#include <LoRa.h>

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#include <ArduinoJson.h>

// =====================================================
// NODE SELECTION (Flash NODE A on Node 1, NODE B on Node 2)
// =====================================================

// FOR NODE A:
#define NODE_ID "A"

// FOR NODE B (Uncomment for Node B and comment Node A above):
// #define NODE_ID "B"

// =====================================================
// SX1278 PINS (SPI & Control)
// =====================================================

#define LORA_SS    5
#define LORA_RST   14
#define LORA_DIO0  2

#define LORA_SCK   18
#define LORA_MISO  19
#define LORA_MOSI  23

// =====================================================
// LORA RF CONFIGURATION (433.05 MHz ISM)
// =====================================================

#define LORA_FREQ 433.05E6

#define LORA_SF 9
#define LORA_BW 125E3
#define LORA_CR 7
#define LORA_TX_POWER 10

// SAME ON BOTH NODES
#define LORA_SYNC_WORD 0x34

// =====================================================
// BLE UUIDS (Custom OFLINK)
// =====================================================

#define SERVICE_UUID "6d7f1000-7c8a-4d91-9b61-1b632fcb1234"

// PHONE -> ESP32 (Write)
#define TX_UUID      "6d7f1001-7c8a-4d91-9b61-1b632fcb1234"

// ESP32 -> PHONE (Notify)
#define RX_UUID      "6d7f1002-7c8a-4d91-9b61-1b632fcb1234"

// =====================================================
// BLE STATE
// =====================================================

BLEServer *pServer = nullptr;
BLECharacteristic *rxCharacteristic = nullptr;
BLECharacteristic *txCharacteristic = nullptr;

bool phoneConnected = false;
String bleBuffer = "";

// =====================================================
// ACK / RETRY TRACKING
// =====================================================

String pendingPacket = "";
String pendingMessageId = "";
bool waitingForAck = false;
unsigned long lastSendTime = 0;
const unsigned long ACK_TIMEOUT = 4000;
int retryCount = 0;
const int MAX_RETRIES = 2;

// =====================================================
// DUPLICATE DETECTION
// =====================================================

const int RECENT_ID_COUNT = 15;
String recentMessageIds[RECENT_ID_COUNT];
int recentIndex = 0;

bool alreadyReceived(String msgId) {
  for (int i = 0; i < RECENT_ID_COUNT; i++) {
    if (recentMessageIds[i] == msgId) {
      return true;
    }
  }
  return false;
}

void rememberMessage(String msgId) {
  recentMessageIds[recentIndex] = msgId;
  recentIndex++;
  if (recentIndex >= RECENT_ID_COUNT) {
    recentIndex = 0;
  }
}

// =====================================================
// BLE -> PHONE TRANSMIT
// =====================================================

void sendToPhone(String msg) {
  Serial.print("BLE -> Phone: ");
  Serial.println(msg);

  if (!phoneConnected || rxCharacteristic == nullptr) {
    return;
  }

  // Every application packet ends with newline
  String framed = msg + "\\n";
  rxCharacteristic->setValue(framed.c_str());
  rxCharacteristic->notify();
  delay(25);
}

// =====================================================
// LORA SEND
// =====================================================

bool sendLoRa(String packet) {
  Serial.println();
  Serial.print("LoRa TX: ");
  Serial.println(packet);

  LoRa.idle();
  if (LoRa.beginPacket() == 0) {
    Serial.println("LoRa beginPacket FAILED");
    return false;
  }

  LoRa.print(packet);
  int result = LoRa.endPacket();

  if (result == 1) {
    Serial.println("LoRa TX successful");
    return true;
  }

  Serial.println("LoRa TX FAILED");
  return false;
}

// =====================================================
// RADIO ACK TRANSMIT
// =====================================================

void sendAck(String msgId) {
  String ack = String(NODE_ID) + "|ACK|" + msgId + "|OK";
  Serial.print("Sending RADIO ACK: ");
  Serial.println(msgId);
  sendLoRa(ack);
}

// =====================================================
// PROCESS PACKET FROM PHONE
// =====================================================

void processPhonePacket(String data) {
  Serial.println();
  Serial.println("==============================");
  Serial.print("Phone -> ESP32: ");
  Serial.println(data);

  String type = "";
  String msgId = "";
  String payload = "";

  // 1. JSON Format from Web App
  if (data.startsWith("{")) {
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, data);
    if (error) {
      Serial.print("JSON ERROR: ");
      Serial.println(error.c_str());
      sendToPhone("ERROR|INVALID_JSON");
      return;
    }

    type = String(doc["type"] | "");
    if (!doc["messageId"].isNull()) {
      msgId = String(doc["messageId"].as<const char *>());
    } else if (!doc["id"].isNull()) {
      msgId = String(doc["id"].as<const char *>());
    }

    if (!doc["payload"].isNull()) {
      payload = String(doc["payload"].as<const char *>());
    } else if (!doc["message"].isNull()) {
      payload = String(doc["message"].as<const char *>());
    } else if (!doc["content"].isNull()) {
      payload = String(doc["content"].as<const char *>());
    }

    if (type == "LOCATION" || type == "SOS") {
      if (!doc["latitude"].isNull() && !doc["longitude"].isNull()) {
        double lat = doc["latitude"];
        double lng = doc["longitude"];
        payload = String(lat, 6) + "," + String(lng, 6);
      }
    }
  } 
  // 2. Pipe Format
  else {
    int p1 = data.indexOf('|');
    int p2 = data.indexOf('|', p1 + 1);

    if (p1 == -1 || p2 == -1) {
      Serial.println("Invalid phone packet");
      return;
    }

    type = data.substring(0, p1);
    msgId = data.substring(p1 + 1, p2);
    payload = data.substring(p2 + 1);
  }

  // Mobile App ACK is ignored; ESP32 manages radio ACKs autonomously
  if (type == "ACK") {
    Serial.println("APP ACK IGNORED (Radio ACK is handled by ESP32 only).");
    return;
  }

  if (type != "TEXT" && type != "LOCATION" && type != "SOS") {
    Serial.print("Unsupported outgoing type: ");
    Serial.println(type);
    return;
  }

  if (msgId.length() == 0) {
    Serial.println("Missing message ID");
    return;
  }

  // Build Radio Packet: NODE_ID|TYPE|MSG_ID|PAYLOAD
  String radioPacket = String(NODE_ID) + "|" + type + "|" + msgId + "|" + payload;

  if (type == "SOS") {
    sendToPhone("SOS_STATUS|" + msgId + "|SENDING");
  }

  bool success = sendLoRa(radioPacket);
  if (success) {
    pendingPacket = radioPacket;
    pendingMessageId = msgId;
    waitingForAck = true;
    retryCount = 0;
    lastSendTime = millis();
    sendToPhone("MESSAGE_STATUS|" + msgId + "|SENT");
  } else {
    waitingForAck = false;
    sendToPhone("MESSAGE_STATUS|" + msgId + "|FAILED");
  }

  Serial.println("==============================");
}

// =====================================================
// BLE SERVER CALLBACKS
// =====================================================

class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *server) override {
    phoneConnected = true;
    Serial.println();
    Serial.println("############################");
    Serial.print("PHONE CONNECTED TO OFLINK-");
    Serial.println(NODE_ID);
    Serial.println("############################");
  }

  void onDisconnect(BLEServer *server) override {
    phoneConnected = false;
    bleBuffer = "";
    Serial.println();
    Serial.print("PHONE DISCONNECTED FROM OFLINK-");
    Serial.println(NODE_ID);
    delay(200);
    BLEDevice::startAdvertising();
    Serial.println("BLE advertising restarted");
  }
};

// =====================================================
// BLE WRITE CALLBACKS (PHONE -> ESP32)
// =====================================================

class MyWriteCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) override {
    String value = characteristic->getValue();
    if (value.length() == 0) return;

    bleBuffer += value;

    // Check for newline delimiter
    int newlinePos = bleBuffer.indexOf('\\n');
    while (newlinePos != -1) {
      String completePacket = bleBuffer.substring(0, newlinePos);
      bleBuffer = bleBuffer.substring(newlinePos + 1);
      completePacket.trim();
      if (completePacket.length() > 0) {
        processPhonePacket(completePacket);
      }
      newlinePos = bleBuffer.indexOf('\\n');
    }

    // Check for JSON braces
    if (bleBuffer.startsWith("{") && bleBuffer.endsWith("}")) {
      processPhonePacket(bleBuffer);
      bleBuffer = "";
    }
  }
};

// =====================================================
// PROCESS INCOMING LORA PACKET
// =====================================================

void processLoRaPacket(String packet) {
  Serial.println();
  Serial.println("******************************");
  Serial.print("LoRa RX: ");
  Serial.println(packet);

  int p1 = packet.indexOf('|');
  int p2 = packet.indexOf('|', p1 + 1);
  int p3 = packet.indexOf('|', p2 + 1);

  if (p1 == -1 || p2 == -1 || p3 == -1) {
    Serial.println("Malformed LoRa packet");
    return;
  }

  String sender = packet.substring(0, p1);
  String type = packet.substring(p1 + 1, p2);
  String msgId = packet.substring(p2 + 1, p3);
  String payload = packet.substring(p3 + 1);

  // Send Signal Status to Phone
  String statusMsg = "STATUS|RSSI=" + String(LoRa.packetRssi()) + "|SNR=" + String(LoRa.packetSnr());
  sendToPhone(statusMsg);

  // 1. Radio ACK received
  if (type == "ACK") {
    Serial.print("RADIO ACK RECEIVED for: ");
    Serial.println(msgId);

    if (waitingForAck && msgId == pendingMessageId) {
      waitingForAck = false;
      pendingPacket = "";
      pendingMessageId = "";
      sendToPhone("MESSAGE_STATUS|" + msgId + "|DELIVERED");
    }
    return;
  }

  // 2. Duplicate Detection
  if (alreadyReceived(msgId)) {
    Serial.println("DUPLICATE PACKET - Resending Radio ACK");
    sendAck(msgId);
    return;
  }

  rememberMessage(msgId);

  // Send ACK over LoRa
  sendAck(msgId);

  // Push received message to Phone via BLE
  sendToPhone(type + "|" + msgId + "|" + payload);
  Serial.println("******************************");
}

// =====================================================
// SETUP
// =====================================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("======================================");
  Serial.print("OFLINK NODE ");
  Serial.println(NODE_ID);
  Serial.println("======================================");

  // 1. Initialize SPI & LoRa Transceiver
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_SS);
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);

  if (!LoRa.begin(LORA_FREQ)) {
    Serial.println("LoRa initialization FAILED! Check wiring.");
    while (1) { delay(1000); }
  }

  LoRa.setSpreadingFactor(LORA_SF);
  LoRa.setSignalBandwidth(LORA_BW);
  LoRa.setCodingRate4(LORA_CR);
  LoRa.setTxPower(LORA_TX_POWER);
  LoRa.setSyncWord(LORA_SYNC_WORD);

  Serial.println("SX1278 LoRa Initialized @ 433.05 MHz");

  // 2. Initialize BLE
  String devName = "OFLINK-" + String(NODE_ID);
  BLEDevice::init(devName.c_str());

  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  // RX Characteristic (ESP32 -> Phone: Notify)
  rxCharacteristic = pService->createCharacteristic(
    RX_UUID,
    BLECharacteristic::PROPERTY_NOTIFY | BLECharacteristic::PROPERTY_READ
  );
  rxCharacteristic->addDescriptor(new BLE2902());

  // TX Characteristic (Phone -> ESP32: Write)
  txCharacteristic = pService->createCharacteristic(
    TX_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  txCharacteristic->setCallbacks(new MyWriteCallbacks());

  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.print("BLE Advertised as: ");
  Serial.println(devName);
  Serial.println("Bridge Ready.");
}

// =====================================================
// MAIN LOOP (LoRa Receive & ACK Timeout/Retry)
// =====================================================

void loop() {
  // Check for incoming LoRa packets
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String incoming = "";
    while (LoRa.available()) {
      incoming += (char)LoRa.read();
    }
    processLoRaPacket(incoming);
  }

  // Check for ACK timeout & retry
  if (waitingForAck) {
    if (millis() - lastSendTime > ACK_TIMEOUT) {
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        lastSendTime = millis();
        Serial.print("RETRYING LoRa TX (Attempt ");
        Serial.print(retryCount + 1);
        Serial.println(")...");
        sendToPhone("MESSAGE_STATUS|" + pendingMessageId + "|RETRYING");
        sendLoRa(pendingPacket);
      } else {
        Serial.println("LoRa Delivery FAILED (Max retries reached)");
        waitingForAck = false;
        sendToPhone("MESSAGE_STATUS|" + pendingMessageId + "|FAILED");
        pendingPacket = "";
        pendingMessageId = "";
      }
    }
  }

  delay(10);
}
`;
