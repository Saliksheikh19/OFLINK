import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  RotateCcw,
  MapPin,
  Trash2,
  Radio,
  ShieldAlert,
  Compass,
  Bluetooth,
  Terminal,
  Zap,
  ChevronDown,
  ChevronUp,
  Cpu,
  Wifi,
  FileCode,
} from 'lucide-react';
import { oflinkService } from '../services/oflinkService.ts';
import { bleManager, BleLogEntry, BleNodeSlot } from '../services/ble/bleService.ts';
import { localDatabase } from '../services/storage/localDatabase.ts';
import { ChatMessage, PacketPriority, BleConnectionState } from '../models/packets.ts';
import { Button } from '../components/ui/button.tsx';
import { Input } from '../components/ui/input.tsx';
import { Badge } from '../components/ui/badge.tsx';

interface ChatScreenProps {
  onNavigateToMap?: () => void;
  onNavigateToBle?: () => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ onNavigateToMap, onNavigateToBle }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => localDatabase.getMessages());
  const [inputText, setInputText] = useState('');
  const [priority, setPriority] = useState<PacketPriority>('NORMAL');
  const [isSending, setIsSending] = useState(false);
  const [bleState, setBleState] = useState<BleConnectionState>(() => bleManager.getConnectionState());
  const [slots, setSlots] = useState<{ A: BleNodeSlot; B: BleNodeSlot }>(() => bleManager.getSlots());
  const [bleLogs, setBleLogs] = useState<BleLogEntry[]>(() => bleManager.getLogs());
  const [showTerminal, setShowTerminal] = useState(false);
  const [settings, setSettings] = useState(() => localDatabase.getSettings());
  const [connectLoading, setConnectLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  const linkMetrics = oflinkService.getLinkMetrics();
  const isAnyHardwareConnected = slots.A.state === 'CONNECTED' || slots.B.state === 'CONNECTED';

  useEffect(() => {
    const unsubDB = localDatabase.subscribe(() => {
      setMessages(localDatabase.getMessages());
      setSettings(localDatabase.getSettings());
    });
    const unsubBleState = bleManager.subscribeToState((st) => {
      setBleState(st);
    });
    const unsubSlots = bleManager.subscribeToSlots((sl) => {
      setSlots(sl);
    });
    const unsubLogs = bleManager.subscribeToLogs((l) => {
      setBleLogs([...l]);
    });

    return () => {
      unsubDB();
      unsubBleState();
      unsubSlots();
      unsubLogs();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (showTerminal) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [bleLogs, showTerminal]);

  const handleSend = async (overrideText?: string, overridePriority?: PacketPriority) => {
    const textToSend = overrideText !== undefined ? overrideText : inputText;
    if (!textToSend.trim() || isSending) return;

    setIsSending(true);
    setInputText('');

    try {
      await oflinkService.sendTextMessage(textToSend, overridePriority || priority);
    } catch (err: any) {
      console.error('Failed to send text message:', err);
      bleManager.addLog('ERROR', `Send failed: ${err.message || String(err)}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleShareLocationInChat = async () => {
    try {
      const loc = await oflinkService.shareMyLocation('HIGH');
      const text = `📍 GNSS Position: ${loc.latitude.toFixed(5)}° N, ${loc.longitude.toFixed(5)}° E (±${Math.round(loc.accuracy || 5)}m)`;
      await oflinkService.sendTextMessage(text, 'HIGH');
    } catch (e) {
      console.error(e);
    }
  };

  const handleRetry = async (msg: ChatMessage) => {
    localDatabase.updateMessageStatus(msg.messageId, 'PENDING');
    await oflinkService.sendTextMessage(msg.text, msg.priority);
  };

  const handleQuickConnectBle = async () => {
    setConnectLoading(true);
    try {
      await bleManager.connectSlot('A', { forceRealBle: true });
    } finally {
      setConnectLoading(false);
    }
  };

  const toggleFormat = (fmt: 'AUTO' | 'JSON' | 'PLAIN_TEXT') => {
    localDatabase.updateSettings({ transmissionFormat: fmt });
    setSettings(localDatabase.getSettings());
    bleManager.addLog('INFO', `Switched Protocol Format to: ${fmt}`);
  };

  const handleSwitchNodeRole = (role: 'OFLINK-A' | 'OFLINK-B') => {
    const target = role === 'OFLINK-A' ? 'OFLINK-B' : 'OFLINK-A';
    localDatabase.updateSettings({
      localNodeId: role,
      targetNodeId: target,
    });
    setSettings(localDatabase.getSettings());
    bleManager.addLog('INFO', `Switched this device role to: ${role} (Target: ${target})`);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const tacticalPresets = [
    'Status check. All clear.',
    'At rendezvous coordinates.',
    'Holding defensive position.',
    'Clear to advance.',
    '433 MHz LoRa link verified.',
  ];

  return (
    <div className="flex flex-col h-[calc(100dvh-160px)] lg:h-[calc(100vh-120px)] bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative">
      {/* Tactical Chat Header */}
      <div className="bg-[#0b101d] border-b border-slate-800/80 px-4 sm:px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-sky-400">
            <Radio className="w-5 h-5" />
            <span
              className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${
                isAnyHardwareConnected
                  ? 'bg-emerald-500 animate-pulse'
                  : 'bg-amber-500'
              }`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-white font-mono">Chatting with: {settings.targetNodeId}</span>
              <Badge variant={isAnyHardwareConnected ? 'success' : 'outline'}>
                {isAnyHardwareConnected
                  ? `${slots.A.device?.name || slots.B.device?.name || 'ESP32'} · 433 MHz`
                  : 'LoRa Standby'}
              </Badge>
            </div>
            <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1">
                <span className="text-slate-400">This Phone:</span>
                <span className="inline-flex items-center bg-slate-900 border border-slate-700/80 rounded-md p-0.5">
                  <button
                    onClick={() => handleSwitchNodeRole('OFLINK-A')}
                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
                      settings.localNodeId === 'OFLINK-A'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Node A
                  </button>
                  <button
                    onClick={() => handleSwitchNodeRole('OFLINK-B')}
                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
                      settings.localNodeId === 'OFLINK-B'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Node B
                  </button>
                </span>
              </span>
              <span>•</span>
              <span>Target: <strong className="text-sky-300 font-mono">{settings.targetNodeId}</strong></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Live Diagnostic Terminal Toggle */}
          <button
            onClick={() => setShowTerminal(!showTerminal)}
            title="Toggle Live BLE/LoRa Hardware Terminal"
            className={`p-2 rounded-xl transition-colors ${
              showTerminal
                ? 'bg-sky-600/30 text-sky-300 border border-sky-500/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Terminal className="w-4 h-4" />
          </button>

          {onNavigateToMap && (
            <button
              onClick={onNavigateToMap}
              title="View on Map"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
            >
              <Compass className="w-4 h-4 text-amber-400" />
            </button>
          )}

          <button
            onClick={handleShareLocationInChat}
            title="Send My Location in Chat"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
          >
            <MapPin className="w-4 h-4 text-emerald-400" />
          </button>

          <button
            onClick={() => {
              if (window.confirm('Clear local chat history?')) {
                localDatabase.clearMessages();
              }
            }}
            title="Clear Chat History"
            className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-900 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Hardware Disconnected Helper Banner */}
      {!isAnyHardwareConnected && !settings.mockBleEnabled && (
        <div className="bg-amber-950/80 border-b border-amber-800/60 px-4 py-2 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <Bluetooth className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            <span>
              <strong>ESP32 Hardware Disconnected.</strong> Connect your Bluetooth node to transmit over 433 MHz LoRa.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="default"
              onClick={handleQuickConnectBle}
              disabled={connectLoading}
              className="h-7 text-[11px] px-2.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold"
            >
              <Zap className="w-3 h-3 mr-1" />
              {connectLoading ? 'Opening...' : 'Connect ESP32'}
            </Button>
            {onNavigateToBle && (
              <Button
                size="sm"
                variant="outline"
                onClick={onNavigateToBle}
                className="h-7 text-[11px] px-2 border-amber-700 text-amber-300"
              >
                BLE Setup
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Protocol Framing Quick Switcher */}
      <div className="bg-[#080d19] border-b border-slate-900 px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <span>TX Protocol:</span>
          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => toggleFormat('AUTO')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                (settings.transmissionFormat || 'AUTO') === 'AUTO'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Clean JSON ending in '}' for ESP32 bleBuffer.endsWith('}')"
            >
              JSON (ESP32)
            </button>
            <button
              onClick={() => toggleFormat('JSON')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                settings.transmissionFormat === 'JSON'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="JSON with trailing newline \\n"
            >
              JSON+\n
            </button>
            <button
              onClick={() => toggleFormat('PLAIN_TEXT')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                settings.transmissionFormat === 'PLAIN_TEXT'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Pipe format TYPE|MSG_ID|PAYLOAD\\n"
            >
              PIPE (\n)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAnyHardwareConnected && !settings.mockBleEnabled ? (
            <span className="text-emerald-400 font-bold text-[10px]">
              LINK: BLE → 433 MHz LoRa (WiFi Bypassed)
            </span>
          ) : (
            <span className="text-slate-500 text-[10px]">
              {settings.webRelayEnabled ? 'WiFi Relay Standby' : 'Offline LoRa Only'}
            </span>
          )}
        </div>
      </div>

      {/* Live BLE Hardware Diagnostic Terminal (Collapsible) */}
      {showTerminal && (
        <div className="bg-slate-950 border-b border-slate-800 p-3 max-h-48 overflow-y-auto font-mono text-[11px] space-y-1.5 shadow-inner">
          <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1 mb-1">
            <span className="font-bold flex items-center gap-1.5 text-sky-400">
              <Terminal className="w-3.5 h-3.5" />
              LIVE BLE & LORA I/O CONSOLE (6D7F / NUS)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => bleManager.clearLogs()}
                className="text-[10px] text-slate-500 hover:text-slate-300"
              >
                Clear Log
              </button>
              <button
                onClick={() => setShowTerminal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>

          {bleLogs.length === 0 ? (
            <div className="text-slate-600 italic py-2">
              No BLE packets sent yet. Type a message below or connect your hardware.
            </div>
          ) : (
            bleLogs.slice(0, 30).map((entry) => (
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
          <div ref={logsEndRef} />
        </div>
      )}

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-[#070b14] bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
              <Radio className="w-8 h-8" />
            </div>
            <div className="text-base font-bold text-slate-300">Offline Field Comms Ready</div>
            <div className="text-xs text-slate-400 max-w-sm leading-relaxed">
              Messages are chunked in safe 20-byte ATT packets over BLE to your ESP32 and transmitted directly over 433 MHz LoRa.
            </div>
            {!isAnyHardwareConnected && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleQuickConnectBle}
                className="mt-2 text-sky-400 border-sky-800 hover:bg-sky-950"
              >
                <Bluetooth className="w-3.5 h-3.5 mr-1.5" />
                Connect ESP32 Hardware Now
              </Button>
            )}
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.isSelf;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} max-w-[88%] sm:max-w-[75%] md:max-w-[65%] ${
                  isSelf ? 'ml-auto' : 'mr-auto'
                }`}
              >
                {/* Message Bubble */}
                <div
                  className={`rounded-2xl px-4 py-2.5 shadow-lg text-sm break-words relative transition-all ${
                    isSelf
                      ? msg.priority === 'CRITICAL'
                        ? 'bg-red-950 border border-red-700 text-red-100 rounded-br-xs'
                        : msg.priority === 'HIGH'
                        ? 'bg-amber-950 border border-amber-700 text-amber-100 rounded-br-xs'
                        : 'bg-sky-600 text-white rounded-br-xs shadow-sky-950/50'
                      : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-bl-xs'
                  }`}
                >
                  {/* Sender Tag */}
                  {!isSelf && (
                    <div className="text-[10px] font-bold font-mono text-sky-400 mb-0.5">
                      {msg.sender}
                    </div>
                  )}

                  {/* Priority Pill */}
                  {msg.priority !== 'NORMAL' && (
                    <div
                      className={`text-[9px] font-black font-mono tracking-wider uppercase mb-1 flex items-center gap-1 ${
                        msg.priority === 'CRITICAL' ? 'text-red-300' : 'text-amber-300'
                      }`}
                    >
                      <ShieldAlert className="w-3 h-3" />
                      PRIORITY: {msg.priority}
                    </div>
                  )}

                  {/* Text Content */}
                  <div className="leading-relaxed select-text font-sans">{msg.text}</div>

                  {/* Message Footer: Timestamp & Delivery Checkmarks */}
                  <div
                    className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] font-mono select-none ${
                      isSelf ? 'text-sky-100/80' : 'text-slate-400'
                    }`}
                  >
                    <span>{formatTime(msg.timestamp)}</span>

                    {isSelf && (
                      <span className="flex items-center ml-0.5">
                        {msg.deliveryStatus === 'PENDING' && (
                          <span title="Transmitting chunks over BLE to ESP32">
                            <Clock className="w-3 h-3 animate-spin text-slate-300" />
                          </span>
                        )}
                        {msg.deliveryStatus === 'SENT' && (
                          <span title="Delivered to ESP32 LoRa radio buffer (Broadcasted)">
                            <Check className="w-3.5 h-3.5 text-slate-300" />
                          </span>
                        )}
                        {msg.deliveryStatus === 'DELIVERED' && (
                          <span title="Confirmed delivered (LoRa ACK verified)">
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-300" />
                          </span>
                        )}
                        {msg.deliveryStatus === 'FAILED' && (
                          <button
                            onClick={() => handleRetry(msg)}
                            className="flex items-center gap-0.5 text-red-300 hover:text-white"
                            title="Failed. Click to retry"
                          >
                            <AlertCircle className="w-3 h-3" />
                            <span>Retry</span>
                            <RotateCcw className="w-2.5 h-2.5 ml-0.5" />
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Tactical Presets Bar */}
      <div className="bg-[#0a0f1d] border-t border-slate-800/80 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        {tacticalPresets.map((preset, i) => (
          <Button
            key={i}
            variant="outline"
            size="sm"
            onClick={() => handleSend(preset, 'NORMAL')}
            className="text-[11px] h-7 px-2.5 rounded-lg shrink-0 font-medium whitespace-nowrap"
          >
            {preset}
          </Button>
        ))}
      </div>

      {/* Input & Priority Bar */}
      <div className="bg-[#0b101e] p-3 sm:p-4 border-t border-slate-800 space-y-2 shrink-0">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-mono text-[11px]">Packet Priority:</span>
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {(['NORMAL', 'HIGH', 'CRITICAL'] as PacketPriority[]).map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`px-3 py-0.5 rounded-lg text-[10px] font-bold font-mono transition-colors ${
                  priority === p
                    ? p === 'CRITICAL'
                      ? 'bg-red-600 text-white'
                      : p === 'HIGH'
                      ? 'bg-amber-600 text-white'
                      : 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              isAnyHardwareConnected
                ? `Type message for 433 MHz LoRa (${slots.A.device?.name || 'ESP32'})...`
                : 'Type message (connect ESP32 or test web relay)...'
            }
            className="h-11 rounded-2xl"
          />

          <Button
            variant="default"
            size="default"
            onClick={() => handleSend()}
            disabled={!inputText.trim() || isSending}
            className="h-11 px-4 sm:px-5 rounded-2xl shrink-0"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline font-mono">
              {isSending ? 'SENDING...' : 'TRANSMIT'}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
};
