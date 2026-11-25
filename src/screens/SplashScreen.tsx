import React from 'react';
import { Radio, Shield, WifiOff, ArrowRight } from 'lucide-react';

interface SplashScreenProps {
  onEnter: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onEnter }) => {
  return (
    <div className="min-h-full flex flex-col justify-between p-6 bg-slate-950 text-slate-100 select-none">
      {/* Top status branding */}
      <div className="flex items-center justify-between pt-4">
        <span className="text-xs font-mono text-slate-400 tracking-wider">SECURE FIELD COMM</span>
        <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          SYSTEM READY
        </span>
      </div>

      {/* Hero Badge & Wordmark */}
      <div className="my-auto py-8 text-center space-y-6">
        <div className="relative inline-flex items-center justify-center">
          <div className="w-28 h-28 rounded-3xl bg-slate-900 border-2 border-sky-500/40 shadow-2xl flex items-center justify-center">
            <Radio className="w-14 h-14 text-sky-400" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-9 h-9 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-center">
            <WifiOff className="w-5 h-5 text-amber-400" />
          </div>
        </div>

        <div>
          <h1 className="text-4xl font-black tracking-tight text-white">OFLINK</h1>
          <p className="text-sm font-medium text-slate-400 mt-2">Connect Beyond the Network.</p>
        </div>

        <div className="max-w-xs mx-auto text-xs text-slate-400 space-y-2 pt-2 border-t border-slate-900">
          <div className="flex items-center justify-center gap-2">
            <Shield className="w-3.5 h-3.5 text-sky-400" />
            <span>Zero Cellular · Zero Wi-Fi · Zero Cloud</span>
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            BLE 5.0 → ESP32 → SX1262 LoRa (433 MHz PTA)
          </div>
        </div>
      </div>

      {/* Bottom Action */}
      <div className="space-y-3 pb-4">
        <button
          onClick={onEnter}
          className="w-full h-14 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm tracking-wide flex items-center justify-center gap-2 shadow-xl shadow-sky-500/10 active:scale-[0.98] transition-transform"
        >
          <span>ENTER TACTICAL CONSOLE</span>
          <ArrowRight className="w-4 h-4" />
        </button>
        <p className="text-[11px] text-center text-slate-400 font-mono">
          OFLINK v1.0.4 · Standalone Local Database
        </p>
      </div>
    </div>
  );
};
