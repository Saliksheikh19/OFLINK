import React from 'react';
import {
  Radio,
  Shield,
  Cpu,
  Brain,
  Layers,
  Lock,
  ArrowRight,
  ExternalLink,
  Info,
} from 'lucide-react';

export const AboutScreen: React.FC = () => {
  return (
    <div className="space-y-6 pb-12">
      {/* Brand Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-4 shadow-xl">
        <div className="w-20 h-20 rounded-3xl bg-slate-950 border-2 border-sky-500/40 mx-auto flex items-center justify-center">
          <Radio className="w-10 h-10 text-sky-400" />
        </div>

        <div>
          <h2 className="text-3xl font-black tracking-tight text-white">OFLINK</h2>
          <p className="text-sm font-semibold text-sky-400 mt-1">Connect Beyond the Network.</p>
        </div>

        <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
          OFLINK is an offline, infrastructure-independent peer-to-peer tactical communication application
          operating over low-power Bluetooth Low Energy and Semtech SX1262 LoRa transceivers.
        </p>
      </div>

      {/* System Architecture */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-wider">
          <Layers className="w-4 h-4 text-sky-400" />
          <span>System Topology & Architecture</span>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 space-y-3">
          <div className="flex items-center justify-between text-sky-300 font-bold border-b border-slate-800 pb-2">
            <span>OPERATOR A</span>
            <span className="text-amber-400">LONG-RANGE LORA RF LINK</span>
            <span>OPERATOR B</span>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-2 py-2 text-center">
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 w-full md:w-auto">
              <div className="font-bold text-white">Android Phone A</div>
              <div className="text-[10px] text-slate-400">OFLINK App · Built-in GNSS</div>
            </div>

            <span className="text-slate-500 text-xs">BLE 5.0 ↓</span>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 w-full md:w-auto">
              <div className="font-bold text-white">ESP32 + SX1262 A</div>
              <div className="text-[10px] text-slate-400">Nordic UART · +14 dBm</div>
            </div>

            <span className="text-amber-400 text-xs font-bold">⇄ 433 MHz LoRa (PTA) ⇄</span>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 w-full md:w-auto">
              <div className="font-bold text-white">ESP32 + SX1262 B</div>
              <div className="text-[10px] text-slate-400">Nordic UART · +14 dBm</div>
            </div>

            <span className="text-slate-500 text-xs">BLE 5.0 ↑</span>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 w-full md:w-auto">
              <div className="font-bold text-white">Android Phone B</div>
              <div className="text-[10px] text-slate-400">OFLINK App · Built-in GNSS</div>
            </div>
          </div>
        </div>

        <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
          <li>Core communication functions 100% offline without Internet, cellular towers, or Wi-Fi.</li>
          <li>Utilizes the Android device's internal GNSS receiver—no external GPS module needed.</li>
          <li>Local SQLite / IndexedDB database acts as primary store; 100% offline, zero cloud or MongoDB dependency.</li>
        </ul>
      </div>

      {/* Disabled Future Section: AI Link Prediction (Per Prompt Requirement 23) */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-3 opacity-90 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              AI Link Prediction
            </h3>
          </div>
          <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
            FUTURE ROADMAP (DISABLED)
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          An offline lightweight edge prediction model planned for future releases to forecast wireless link degradation,
          recommend optimal antenna azimuth, and calculate dynamic relay routes.
        </p>

        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80 space-y-2 text-xs font-mono">
          <div className="text-[11px] text-slate-400 uppercase tracking-wider">
            Future Input Telemetry Parameters:
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-slate-300 text-[11px]">
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              • RSSI Trend (dBm)
            </div>
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              • SNR Gradient (dB)
            </div>
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              • Packet Delivery Ratio (PDR)
            </div>
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              • Retransmission Count
            </div>
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              • Haversine Distance (km)
            </div>
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              • Operator Movement Vector
            </div>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 italic">
          * Currently disabled. Rule-based signal thresholds remain authoritative.
        </div>
      </div>

      {/* Specifications & Standards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2 text-xs">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">
          Engineering Specifications
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-300 font-mono text-[11px]">
          <div>• Protocol: Binary JSON over Nordic UART (BLE 5.0)</div>
          <div>• LoRa Modulation: Chirp Spread Spectrum (SX1262)</div>
          <div>• Local Storage: SQLite / Browser IndexedDB engine</div>
          <div>• Geodesics: WGS-84 Haversine & Great-Circle Bearing</div>
          <div>• SOS Priority: Hard pre-emption in firmware FIFO</div>
          <div>• Encryption: AES-128 / Hardware CCM support</div>
        </div>
      </div>
    </div>
  );
};
