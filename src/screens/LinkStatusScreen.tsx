import React, { useState, useEffect } from 'react';
import {
  Activity,
  Radio,
  Bluetooth,
  Clock,
  RotateCcw,
  AlertTriangle,
  MapPin,
  TrendingUp,
  Cpu,
  Wifi,
  Sliders,
} from 'lucide-react';
import { oflinkService } from '../services/oflinkService.ts';
import { localDatabase } from '../services/storage/localDatabase.ts';
import { bleManager } from '../services/ble/bleService.ts';
import { LinkMetrics, LinkLogEntry } from '../models/packets.ts';

interface LinkStatusScreenProps {
  onNavigateToMap: () => void;
  onNavigateToSettings: () => void;
}

export const LinkStatusScreen: React.FC<LinkStatusScreenProps> = ({
  onNavigateToMap,
  onNavigateToSettings,
}) => {
  const [metrics, setMetrics] = useState<LinkMetrics>(() => oflinkService.getLinkMetrics());
  const [logs, setLogs] = useState<LinkLogEntry[]>(() => localDatabase.getLinkLogs());
  const [now, setNow] = useState(Date.now());

  const settings = localDatabase.getSettings();
  const bleState = oflinkService.getBleState();
  const connectedDevice = oflinkService.getConnectedBleDevice();
  const lastKnown = localDatabase.getLastKnownLocation();

  useEffect(() => {
    const unsubOF = oflinkService.subscribe(() => {
      setMetrics(oflinkService.getLinkMetrics());
    });
    const unsubDB = localDatabase.subscribe(() => {
      setLogs(localDatabase.getLinkLogs());
    });
    const timer = setInterval(() => setNow(Date.now()), 1000);

    return () => {
      unsubOF();
      unsubDB();
      clearInterval(timer);
    };
  }, []);

  const elapsedSec = Math.max(0, Math.floor((now - metrics.lastContact) / 1000));
  const isLinkLost = metrics.quality === 'LOST' || elapsedSec > settings.linkLostTimeoutSec;

  const lastContactFormatted =
    elapsedSec < 60
      ? `${elapsedSec} seconds ago`
      : `${Math.floor(elapsedSec / 60)} min ${elapsedSec % 60} sec ago`;

  // Quality badge styling based on user-configured thresholds
  const getQualityBadge = () => {
    if (isLinkLost) {
      return (
        <span className="text-xs font-black font-mono px-3 py-1 bg-red-950 text-red-400 border border-red-800 rounded-lg">
          LINK LOST
        </span>
      );
    }
    switch (metrics.quality) {
      case 'GOOD':
        return (
          <span className="text-xs font-black font-mono px-3 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-lg">
            GOOD SIGNAL
          </span>
        );
      case 'FAIR':
        return (
          <span className="text-xs font-black font-mono px-3 py-1 bg-amber-950 text-amber-400 border border-amber-800 rounded-lg">
            FAIR SIGNAL
          </span>
        );
      case 'WEAK':
        return (
          <span className="text-xs font-black font-mono px-3 py-1 bg-red-950 text-red-400 border border-red-800 rounded-lg">
            WEAK SIGNAL
          </span>
        );
      default:
        return null;
    }
  };

  // Convert RSSI to progress percentage (-130 dBm to -40 dBm)
  const rssiPercent = Math.max(0, Math.min(100, Math.round(((metrics.rssi + 130) / 90) * 100)));

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            Link & Signal Status
          </h2>
          <p className="text-xs text-slate-400">
            Real-time LoRa communication statistics from ESP32 node
          </p>
        </div>

        <button
          onClick={onNavigateToSettings}
          title="Threshold Settings"
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors"
        >
          <Sliders className="w-5 h-5 text-sky-400" />
        </button>
      </div>

      {/* Target Node & Link Lost Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
              Remote LoRa Node
            </div>
            <div className="text-2xl font-black text-white font-mono mt-0.5">
              {settings.targetNodeId}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              <Bluetooth className="w-3.5 h-3.5 text-sky-400" />
              <span>Local BLE Link: </span>
              <span className="font-bold text-slate-200">{bleState}</span>
              {connectedDevice && (
                <span className="text-[10px] text-slate-400 font-mono">({connectedDevice.name})</span>
              )}
            </div>
          </div>

          <div>{getQualityBadge()}</div>
        </div>

        {/* Prominent Link Lost Warning if timeout has expired */}
        {isLinkLost && (
          <div className="p-4 bg-red-950/70 border border-red-800 rounded-xl space-y-3 animate-in fade-in">
            <div className="flex items-center gap-2.5 text-red-300">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <div className="font-bold text-sm tracking-wide">LINK LOST WARNING</div>
                <div className="text-xs text-red-200">
                  No telemetry or ACK received for {lastContactFormatted} (timeout: {settings.linkLostTimeoutSec}s).
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-red-900/60 text-xs">
              <span className="text-slate-300 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                Last known location: <strong className="text-white">Available</strong>
              </span>

              <button
                onClick={onNavigateToMap}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] tracking-wide active:scale-95 transition-all"
              >
                VIEW LAST LOCATION
              </button>
            </div>
          </div>
        )}

        {/* Telemetry Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          {/* RSSI Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">RSSI</span>
              <Radio className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono mt-1">
              {metrics.rssi} <span className="text-xs font-normal text-slate-400">dBm</span>
            </div>
            {/* Visual Signal Meter */}
            <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  metrics.rssi > settings.rssiGoodThreshold
                    ? 'bg-emerald-500'
                    : metrics.rssi > settings.rssiFairThreshold
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${rssiPercent}%` }}
              />
            </div>
          </div>

          {/* SNR Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">SNR</span>
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono mt-1">
              {metrics.snr > 0 ? `+${metrics.snr}` : metrics.snr}{' '}
              <span className="text-xs font-normal text-slate-400">dB</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-2">
              Signal-to-Noise Ratio
            </div>
          </div>

          {/* PDR Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">PDR (Delivery)</span>
              <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
              {metrics.pdr}%
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-2">
              Packet Delivery Ratio
            </div>
          </div>

          {/* Latency & Retries Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Latency / Retries</span>
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono mt-1">
              {metrics.latency} <span className="text-xs font-normal text-slate-400">ms</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-2">
              Avg retries: {metrics.retries}
            </div>
          </div>
        </div>

        {/* Last Contact */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs font-mono text-slate-400">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Last contact timestamp:
          </span>
          <span className="text-slate-200 font-bold">{lastContactFormatted}</span>
        </div>
      </div>

      {/* LoRa Physical RF Configuration (Hardware Specification) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-sky-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              LoRa Physical RF Parameters (SX1262)
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">ESP32 + Semtech SX1262</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 text-xs font-mono">
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block">Frequency</span>
            <span className="font-bold text-slate-200">{settings.loraFrequencyMhz} MHz (PTA)</span>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block">Spreading Factor</span>
            <span className="font-bold text-slate-200">SF{settings.loraSpreadingFactor}</span>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block">Bandwidth</span>
            <span className="font-bold text-slate-200">{settings.loraBandwidthKhz} kHz</span>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block">Coding Rate</span>
            <span className="font-bold text-slate-200">{settings.loraCodingRate}</span>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block">TX Power</span>
            <span className="font-bold text-slate-200">+{settings.loraTxPowerDbm} dBm (PTA ISM)</span>
          </div>
        </div>
      </div>

      {/* Configurable Thresholds Clarification Note (Per User Prompt Requirement 7) */}
      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl text-xs text-slate-400 space-y-1">
        <div className="font-semibold text-slate-300">Configurable Signal Quality Thresholds</div>
        <p className="text-[11px] leading-relaxed">
          Signal quality tags (Good / Fair / Weak) reflect user-configurable field limits, not universal scientific constants:
          Good (RSSI &gt; {settings.rssiGoodThreshold} dBm, SNR &gt; +{settings.snrGoodThreshold} dB, PDR &gt; {settings.pdrGoodThreshold}%),
          Fair (RSSI &gt; {settings.rssiFairThreshold} dBm, SNR &gt; {settings.snrFairThreshold} dB),
          Link Lost Timeout: {settings.linkLostTimeoutSec}s.
        </p>
      </div>

      {/* Telemetry History Log */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Recent Telemetry Snapshots
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {logs.length} logged in local DB
          </span>
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500">
            No link telemetry logs recorded yet. Packets from ESP32 will log automatically.
          </div>
        ) : (
          <div className="max-h-48 overflow-y-auto space-y-1.5 font-mono text-xs">
            {logs.slice(-8).reverse().map((log) => (
              <div
                key={log.id}
                className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex items-center justify-between text-slate-300"
              >
                <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className="text-sky-400">{log.rssi} dBm</span>
                <span className="text-emerald-400">+{log.snr} dB</span>
                <span>PDR: {log.pdr}%</span>
                <span>{log.latency}ms</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
