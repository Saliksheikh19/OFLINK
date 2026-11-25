import React, { useState, useEffect } from 'react';
import {
  Bluetooth,
  RefreshCw,
  Check,
  Radio,
  Cpu,
  Power,
  Sliders,
  AlertCircle,
  ShieldCheck,
  ExternalLink,
  MapPin,
  Smartphone,
  Zap,
  ArrowRightLeft,
  CheckCircle2,
  Activity,
  Layers,
  Copy,
  Terminal,
  FileCode,
  Code2,
} from 'lucide-react';
import { bleManager, BleNodeSlot, BleLogEntry } from '../services/ble/bleService.ts';
import { localDatabase } from '../services/storage/localDatabase.ts';
import { BleConnectionState, BleDevice } from '../models/packets.ts';
import { ESP32_FIRMWARE_ARDUINO_CODE } from '../config/esp32FirmwareCode.ts';
import { Button } from '../components/ui/button.tsx';
import { Badge } from '../components/ui/badge.tsx';
import { Card } from '../components/ui/card.tsx';

export const BleConnectionScreen: React.FC = () => {
  const [bleState, setBleState] = useState<BleConnectionState>(() => bleManager.getConnectionState());
  const [slots, setSlots] = useState<{ A: BleNodeSlot; B: BleNodeSlot }>(() => bleManager.getSlots());
  const [discoveredDevices, setDiscoveredDevices] = useState<BleDevice[]>(() =>
    bleManager.getDiscoveredDevices()
  );
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(() => bleManager.getLastScanError());
  const [settings, setSettings] = useState(() => localDatabase.getSettings());
  const [linkCopied, setLinkCopied] = useState(false);
  const [firmwareCopied, setFirmwareCopied] = useState(false);
  const [showFirmwareCode, setShowFirmwareCode] = useState(false);
  const [bleLogs, setBleLogs] = useState<BleLogEntry[]>(() => bleManager.getLogs());
  const [rfTestState, setRfTestState] = useState<{
    running: boolean;
    result?: {
      success: boolean;
      roundTripMs: number;
      message: string;
      rssi?: number;
      snr?: number;
    };
  }>({ running: false });

  const isIframe = bleManager.isRunningInIframe();
  const bothConnected = slots.A.state === 'CONNECTED' && slots.B.state === 'CONNECTED';
  const anyConnected = slots.A.state === 'CONNECTED' || slots.B.state === 'CONNECTED';

  useEffect(() => {
    const unsubBle = bleManager.subscribeToState((state) => {
      setBleState(state);
      setScanError(bleManager.getLastScanError());
    });
    const unsubSlots = bleManager.subscribeToSlots((updatedSlots) => {
      setSlots(updatedSlots);
    });
    const unsubDB = localDatabase.subscribe(() => {
      setSettings(localDatabase.getSettings());
    });
    const unsubLogs = bleManager.subscribeToLogs((l) => {
      setBleLogs([...l]);
    });
    return () => {
      unsubBle();
      unsubSlots();
      unsubDB();
      unsubLogs();
    };
  }, []);

  const handleConnectSlot = async (slotId: 'A' | 'B') => {
    setScanError(null);
    try {
      const ok = await bleManager.connectSlot(slotId, { forceRealBle: true });
      if (!ok) {
        setScanError(bleManager.getLastScanError() || `Failed to connect Node ${slotId}.`);
      }
    } catch (e: any) {
      setScanError(e?.message || `Error connecting Node ${slotId}`);
    }
  };

  const handleDisconnectSlot = async (slotId: 'A' | 'B') => {
    await bleManager.disconnectSlot(slotId);
  };

  const handleDisconnectAll = async () => {
    await bleManager.disconnect();
  };

  const handleScan = async () => {
    setIsScanning(true);
    setScanError(null);
    try {
      const devices = await bleManager.scanForNodes({ forceRealBle: true });
      setDiscoveredDevices(devices);
      setScanError(bleManager.getLastScanError());
    } catch (e: any) {
      setScanError(e?.message || 'Bluetooth scan failed');
    } finally {
      setIsScanning(false);
    }
  };

  const handleRunRfBenchmark = async () => {
    setRfTestState({ running: true });
    try {
      const result = await bleManager.testInterNodeLoRaPing();
      setRfTestState({ running: false, result });
    } catch (e: any) {
      setRfTestState({
        running: false,
        result: {
          success: false,
          roundTripMs: 0,
          message: e?.message || 'Benchmark failed',
        },
      });
    }
  };

  const toggleMockMode = (enabled: boolean) => {
    localDatabase.updateSettings({ mockBleEnabled: enabled });
    if (enabled) {
      bleManager.connectSlot('A');
    } else {
      bleManager.disconnect();
    }
  };

  const switchToCustomOflinkProfile = () => {
    localDatabase.updateSettings({
      serviceUuid: '6d7f1000-7c8a-4d91-9b61-1b632fcb1234',
      txCharacteristicUuid: '6d7f1001-7c8a-4d91-9b61-1b632fcb1234',
      rxCharacteristicUuid: '6d7f1002-7c8a-4d91-9b61-1b632fcb1234',
      loraFrequencyMhz: 433.05,
      loraCodingRate: '4/7',
      loraTxPowerDbm: 10,
    });
    setSettings(localDatabase.getSettings());
    setScanError(null);
  };

  const switchToNordicNusProfile = () => {
    localDatabase.updateSettings({
      serviceUuid: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
      txCharacteristicUuid: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
      rxCharacteristicUuid: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
    });
    setSettings(localDatabase.getSettings());
    setScanError(null);
  };

  const isNordicActive = settings.serviceUuid.toLowerCase().startsWith('6e400001');

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Radio className="w-6 h-6 text-sky-400" />
            <span>ESP32 Hardware Nodes</span>
          </h2>
          <p className="text-xs text-slate-400">
            Nordic UART BLE 5.0 Bridge · 433 MHz Semtech LoRa Transceiver Pair
          </p>
        </div>

        <div className="flex items-center gap-2">
          {anyConnected && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnectAll}
              className="text-xs border-red-800 text-red-400 hover:bg-red-950/50"
            >
              <Power className="w-3.5 h-3.5 mr-1" />
              Disconnect All
            </Button>
          )}

          <Button
            variant="default"
            size="sm"
            onClick={handleScan}
            disabled={isScanning}
            className="text-xs font-bold gap-1.5 bg-sky-600 hover:bg-sky-500 shadow-md shadow-sky-950/40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Scanning...' : 'Scan Bluetooth'}</span>
          </Button>
        </div>
      </div>

      {/* MOBILE TESTING GUIDE & PUBLIC LINK BANNER */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-950/90 via-slate-900 to-indigo-950/90 border border-indigo-700/60 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-emerald-400 shrink-0" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              Mobile Testing Link (Zero Restriction)
            </h3>
          </div>
          <Badge variant="outline" className="text-[10px] border-sky-400/50 text-sky-300 font-mono w-fit">
            PUBLIC PHONE LINK
          </Badge>
        </div>

        <p className="text-[11px] text-indigo-200/90 leading-relaxed font-sans">
          Phone par <strong className="text-white">"ais-dev-..."</strong> link restricted aata hai kyunki dev session Google login mangta hai. Mobile phone par test karne ke liye ye <strong className="text-emerald-300">Shared Link</strong> open karein:
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-950/90 p-2.5 rounded-xl border border-indigo-900/60 font-mono text-[11px]">
          <span className="text-emerald-400 select-all truncate flex-1 font-semibold px-1">
            https://ais-pre-vjcu5fstagwmbxejkkp3ab-331218448063.asia-northeast1.run.app
          </span>
          <button
            type="button"
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText('https://ais-pre-vjcu5fstagwmbxejkkp3ab-331218448063.asia-northeast1.run.app');
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2500);
              }
            }}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shrink-0 transition-colors cursor-pointer"
          >
            {linkCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                <span className="text-emerald-200">COPIED!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Phone Link</span>
              </>
            )}
          </button>
        </div>

        <div className="text-[10px] text-slate-400 flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-indigo-950">
          <span>✅ <strong>Note:</strong> Android par Chrome use karein. Location (GPS) aur Bluetooth lazmi ON rakhein.</span>
        </div>
      </div>

      {/* IPHONE (iOS) WEB BLUETOOTH GUIDE BANNER */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-lg space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-sky-950 border border-sky-800 flex items-center justify-center text-xs font-bold text-sky-400">
              iOS
            </span>
            <h4 className="text-xs font-black text-white uppercase tracking-wider">
              iPhone (iOS) Users: Web Bluetooth Setup
            </h4>
          </div>
          <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-300 font-mono">
            Apple App Store Free
          </Badge>
        </div>
        <p className="text-[11px] text-slate-300 leading-relaxed">
          Apple apne default Safari aur iOS Chrome mein Web Bluetooth allow nahi karta. iPhone ko ESP32 se Bluetooth par connect karne ke liye:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-sans">
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
            <div className="font-bold text-sky-400 flex items-center gap-1">
              <span>1. App Store Kholein</span>
            </div>
            <div className="text-[10px] text-slate-400">
              iPhone ke App Store se free <strong className="text-white">"Bluefy - Web BLE Browser"</strong> search karke install karein.
            </div>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
            <div className="font-bold text-emerald-400 flex items-center gap-1">
              <span>2. Link Paste Karein</span>
            </div>
            <div className="text-[10px] text-slate-400">
              Bluefy browser open karein aur yehi shared link address bar mein paste karein.
            </div>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
            <div className="font-bold text-amber-400 flex items-center gap-1">
              <span>3. Connect ESP32</span>
            </div>
            <div className="text-[10px] text-slate-400">
              <strong>Connect BLE</strong> dabayein — iPhone par Bluetooth popup aayega aur OFLINK connect ho jayega!
            </div>
          </div>
        </div>
      </div>

      {/* iFrame Browser Warning Banner */}
      {isIframe && (
        <div className="p-4 rounded-2xl bg-amber-950/50 border border-amber-600/70 text-amber-200 text-xs space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Browser Notice: Embedded Preview Detected</span>
            </div>
            <a
              href={typeof window !== 'undefined' ? window.location.href : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500 text-slate-950 font-bold rounded-lg text-xs hover:bg-amber-400 transition-colors shrink-0 shadow"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Direct Tab</span>
            </a>
          </div>
          <p className="text-[11px] text-amber-200/90 leading-relaxed">
            Chrome security blocks Web Bluetooth inside embedded iframes. Agar Bluetooth dialog open na ho to app ko <strong>Chrome ke alag tab</strong> mein direct URL se open karein.
          </p>
        </div>
      )}

      {/* Scan Error or Diagnostic Notice */}
      {scanError && (
        <div className="p-4 rounded-2xl bg-red-950/60 border border-red-700/60 text-red-200 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Hardware Diagnostic: {scanError.split(':')[0]}</span>
          </div>
          <p className="text-[11px] text-red-200/90 leading-relaxed font-mono">
            {scanError}
          </p>
        </div>
      )}

      {/* DUAL NODE SLOTS: NODE A & NODE B */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* SLOT A: NODE A */}
        <Card
          className={`p-5 space-y-4 border transition-all ${
            slots.A.state === 'CONNECTED'
              ? 'bg-slate-950/90 border-emerald-500/50 shadow-lg shadow-emerald-950/30'
              : 'bg-slate-900/60 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center border font-bold text-sm ${
                  slots.A.state === 'CONNECTED'
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-700'
                    : slots.A.state === 'CONNECTING'
                    ? 'bg-amber-950 text-amber-400 border-amber-700 animate-pulse'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                A
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-white text-base">Node A (Primary)</h3>
                  <Badge
                    variant={
                      slots.A.state === 'CONNECTED'
                        ? 'success'
                        : slots.A.state === 'CONNECTING'
                        ? 'warning'
                        : 'secondary'
                    }
                    className="text-[10px] font-mono"
                  >
                    {slots.A.state}
                  </Badge>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  BLE Target: <span className="text-sky-400 font-bold">OFLINK-A</span> (ID: NODE-A)
                </div>
              </div>
            </div>
          </div>

          {slots.A.device ? (
            <div className="bg-slate-950/90 p-3 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Device Name:</span>
                <span className="font-bold text-slate-200">{slots.A.device.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">GATT Address/ID:</span>
                <span className="font-mono text-slate-300 text-[10px] truncate max-w-[180px]">
                  {slots.A.device.id}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-900">
                <span className="text-slate-400">Packets TX / RX:</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {slots.A.packetsTransmitted} TX · {slots.A.packetsReceived} RX
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/50 p-3 rounded-xl border border-dashed border-slate-800 text-center py-4 text-xs text-slate-500">
              Board 1 disconnected. Click below to pair via Web Bluetooth.
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            {slots.A.state === 'CONNECTED' ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDisconnectSlot('A')}
                className="w-full font-bold text-xs font-mono"
              >
                DISCONNECT NODE A
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => handleConnectSlot('A')}
                disabled={slots.A.state === 'CONNECTING'}
                className="w-full font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/40"
              >
                <Bluetooth className="w-3.5 h-3.5 mr-1.5" />
                <span>
                  {slots.A.state === 'CONNECTING' ? 'CONNECTING...' : 'CONNECT NODE A (OFLINK-A)'}
                </span>
              </Button>
            )}
          </div>
        </Card>

        {/* SLOT B: NODE B */}
        <Card
          className={`p-5 space-y-4 border transition-all ${
            slots.B.state === 'CONNECTED'
              ? 'bg-slate-950/90 border-cyan-500/50 shadow-lg shadow-cyan-950/30'
              : 'bg-slate-900/60 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center border font-bold text-sm ${
                  slots.B.state === 'CONNECTED'
                    ? 'bg-cyan-950 text-cyan-400 border-cyan-700'
                    : slots.B.state === 'CONNECTING'
                    ? 'bg-amber-950 text-amber-400 border-amber-700 animate-pulse'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                B
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-white text-base">Node B (Companion)</h3>
                  <Badge
                    variant={
                      slots.B.state === 'CONNECTED'
                        ? 'success'
                        : slots.B.state === 'CONNECTING'
                        ? 'warning'
                        : 'secondary'
                    }
                    className="text-[10px] font-mono"
                  >
                    {slots.B.state}
                  </Badge>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  BLE Target: <span className="text-cyan-400 font-bold">OFLINK-B</span> (ID: NODE-B)
                </div>
              </div>
            </div>
          </div>

          {slots.B.device ? (
            <div className="bg-slate-950/90 p-3 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Device Name:</span>
                <span className="font-bold text-slate-200">{slots.B.device.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">GATT Address/ID:</span>
                <span className="font-mono text-slate-300 text-[10px] truncate max-w-[180px]">
                  {slots.B.device.id}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-900">
                <span className="text-slate-400">Packets TX / RX:</span>
                <span className="font-mono text-cyan-400 font-bold">
                  {slots.B.packetsTransmitted} TX · {slots.B.packetsReceived} RX
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/50 p-3 rounded-xl border border-dashed border-slate-800 text-center py-4 text-xs text-slate-500">
              Board 2 disconnected. Click below to pair via Web Bluetooth.
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            {slots.B.state === 'CONNECTED' ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDisconnectSlot('B')}
                className="w-full font-bold text-xs font-mono"
              >
                DISCONNECT NODE B
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => handleConnectSlot('B')}
                disabled={slots.B.state === 'CONNECTING'}
                className="w-full font-bold text-xs bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-950/40"
              >
                <Bluetooth className="w-3.5 h-3.5 mr-1.5" />
                <span>
                  {slots.B.state === 'CONNECTING' ? 'CONNECTING...' : 'CONNECT NODE B (OFLINK-B)'}
                </span>
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* OVER-THE-AIR LORA BENCHMARK & LOOPBACK CARD */}
      <Card className="p-5 space-y-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-sky-800/60 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-950/80 border border-sky-700/80 text-sky-400 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-white text-sm sm:text-base flex items-center gap-2">
                <span>Inter-Node LoRa RF Loopback Test</span>
                {bothConnected && (
                  <Badge variant="success" className="text-[10px] font-mono">
                    DUAL MESH LINK READY
                  </Badge>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Transmit a benchmark packet across 433 MHz LoRa and verify receipt on the peer node
              </p>
            </div>
          </div>

          <Button
            variant="default"
            onClick={handleRunRfBenchmark}
            disabled={rfTestState.running || !anyConnected}
            className="gap-2 font-bold text-xs bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 text-white shadow-lg shadow-sky-950/50 shrink-0"
          >
            <Zap className={`w-4 h-4 ${rfTestState.running ? 'animate-bounce' : ''}`} />
            <span>{rfTestState.running ? 'TRANSMITTING OVER 433 MHz...' : 'TEST LORA RF TRANSMISSION'}</span>
          </Button>
        </div>

        {/* Live Test Result */}
        {rfTestState.result && (
          <div
            className={`p-4 rounded-xl border text-xs font-mono transition-all ${
              rfTestState.result.success
                ? 'bg-emerald-950/40 border-emerald-600/70 text-emerald-200'
                : 'bg-amber-950/40 border-amber-600/70 text-amber-200'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm mb-1">
              {rfTestState.result.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-400" />
              )}
              <span>{rfTestState.result.success ? 'RF Link Verified!' : 'Benchmark Notice'}</span>
            </div>
            <p className="text-[11px] leading-relaxed mb-2 font-sans">
              {rfTestState.result.message}
            </p>
            {rfTestState.result.roundTripMs > 0 && (
              <div className="flex flex-wrap gap-4 text-[10px] pt-2 border-t border-slate-800 text-slate-300">
                <div>
                  Roundtrip Latency: <span className="font-bold text-sky-400">{rfTestState.result.roundTripMs} ms</span>
                </div>
                <div>
                  Frequency: <span className="font-bold text-slate-200">433.05 MHz</span>
                </div>
                <div>
                  Spreading Factor: <span className="font-bold text-slate-200">SF9 / 125 kHz</span>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* READY-TO-FLASH ARDUINO C++ SKETCH CARD */}
      <Card className="p-5 space-y-4 bg-slate-900/80 border-slate-800 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-700/80 text-purple-400 flex items-center justify-center">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-white text-sm sm:text-base flex items-center gap-2">
                <span>ESP32 Arduino Firmware (.ino)</span>
                <Badge variant="outline" className="text-[10px] border-purple-500/50 text-purple-300 font-mono">
                  100% READY TO FLASH
                </Badge>
              </h3>
              <p className="text-xs text-slate-400">
                Complete C++ code with chunking, Nordic UART BLE, and SX127x/SX1262 LoRa transmission
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFirmwareCode(!showFirmwareCode)}
              className="text-xs text-purple-300 border-purple-800 hover:bg-purple-950/60"
            >
              <Code2 className="w-3.5 h-3.5 mr-1" />
              {showFirmwareCode ? 'Hide Code' : 'View Code'}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(ESP32_FIRMWARE_ARDUINO_CODE);
                  setFirmwareCopied(true);
                  setTimeout(() => setFirmwareCopied(false), 2500);
                }
              }}
              className="text-xs bg-purple-600 hover:bg-purple-500 text-white font-bold"
            >
              {firmwareCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1 text-emerald-300" />
                  <span>Code Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  <span>Copy .ino Code</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {showFirmwareCode && (
          <div className="space-y-2">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 max-h-72 overflow-y-auto text-slate-300 font-mono text-[11px] leading-relaxed">
              <pre className="whitespace-pre">{ESP32_FIRMWARE_ARDUINO_CODE}</pre>
            </div>
            <div className="text-[11px] text-slate-400 flex flex-wrap gap-3">
              <span>📌 <strong>Board 1:</strong> Keep name <code className="text-emerald-300">OFLINK-A</code></span>
              <span>📌 <strong>Board 2:</strong> Change name to <code className="text-cyan-300">OFLINK-B</code></span>
              <span>📌 <strong>Library:</strong> Install <code className="text-sky-300">"LoRa" by Sandeep Mistry</code> in Arduino IDE</span>
            </div>
          </div>
        )}
      </Card>

      {/* LIVE BLE I/O TERMINAL LOG */}
      <Card className="p-5 space-y-3 bg-slate-950 border-slate-800 font-mono">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2 text-sky-400 text-xs font-bold">
            <Terminal className="w-4 h-4" />
            <span>REAL-TIME HARDWARE TRANSMISSION LOGS</span>
          </div>
          <button
            onClick={() => bleManager.clearLogs()}
            className="text-[10px] text-slate-500 hover:text-slate-300"
          >
            Clear Log
          </button>
        </div>

        <div className="space-y-1.5 max-h-48 overflow-y-auto text-[11px]">
          {bleLogs.length === 0 ? (
            <div className="text-slate-600 italic py-2">
              No hardware transmission events yet. Connect your node or send a message to observe live packet activity.
            </div>
          ) : (
            bleLogs.map((entry) => (
              <div key={entry.id} className="flex items-start gap-2 leading-tight">
                <span className="text-slate-500 shrink-0 text-[10px]">
                  {new Date(entry.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span
                  className={`font-bold px-1 rounded text-[9px] shrink-0 ${
                    entry.type === 'TX'
                      ? 'bg-sky-950 text-sky-400 border border-sky-800'
                      : entry.type === 'RX'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : entry.type === 'ERROR'
                      ? 'bg-red-950 text-red-400 border border-red-800'
                      : 'bg-slate-900 text-slate-400'
                  }`}
                >
                  {entry.type} {entry.slotId ? `[Node ${entry.slotId}]` : ''}
                </span>
                <span
                  className={`break-all ${
                    entry.type === 'ERROR'
                      ? 'text-red-300'
                      : entry.type === 'TX'
                      ? 'text-sky-200'
                      : entry.type === 'RX'
                      ? 'text-emerald-200 font-semibold'
                      : 'text-slate-400'
                  }`}
                >
                  {entry.message}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Mock Simulation & UUID Profiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Mock BLE Testing Mode Toggle */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Simulation / Demo Mode
                </h3>
                <p className="text-xs text-slate-400">
                  Virtual 433 MHz LoRa packets (Turn OFF for real ESP32)
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.mockBleEnabled}
                onChange={(e) => toggleMockMode(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          <div className={`p-2.5 rounded-xl text-xs font-mono ${settings.mockBleEnabled ? 'bg-amber-950/30 border border-amber-800/50 text-amber-200' : 'bg-slate-950 text-slate-400'}`}>
            Status: <strong>{settings.mockBleEnabled ? 'Simulation ACTIVE (Virtual Packets)' : 'Real Hardware Mode (Web Bluetooth)'}</strong>
          </div>
        </Card>

        {/* UUID Configuration Reference & Switcher */}
        <Card className="p-5 space-y-3 text-xs font-mono">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                BLE GATT Profile
              </div>
              <div className="text-[11px] text-slate-300 font-sans mt-0.5">
                Active: <strong className={isNordicActive ? 'text-amber-400' : 'text-sky-400'}>{isNordicActive ? 'Nordic NUS (6E400001)' : 'Custom (6D7F1000)'}</strong>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant={isNordicActive ? 'default' : 'outline'}
                size="sm"
                onClick={switchToNordicNusProfile}
                className={`text-[10px] h-7 px-2 font-bold ${
                  isNordicActive ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'text-amber-400 border-amber-800'
                }`}
              >
                Nordic NUS (6E40)
              </Button>
              <Button
                variant={!isNordicActive ? 'default' : 'outline'}
                size="sm"
                onClick={switchToCustomOflinkProfile}
                className={`text-[10px] h-7 px-2 font-bold ${
                  !isNordicActive ? 'bg-sky-600 hover:bg-sky-500 text-white' : 'text-sky-400 border-sky-800'
                }`}
              >
                OFLINK (6D7F)
              </Button>
            </div>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1 text-[10px] text-slate-400">
            <div>Service: <span className="text-sky-300 select-all font-bold">{settings.serviceUuid}</span></div>
            <div>TX (Write): <span className="text-emerald-300 select-all">{settings.txCharacteristicUuid}</span></div>
            <div>RX (Notify): <span className="text-amber-300 select-all">{settings.rxCharacteristicUuid}</span></div>
          </div>
        </Card>
      </div>
    </div>
  );
};
