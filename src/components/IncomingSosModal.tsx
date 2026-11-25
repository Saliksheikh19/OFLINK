import React from 'react';
import { AlertOctagon, MapPin, Radio, Check, X, ShieldAlert, ArrowUpRight } from 'lucide-react';
import { SosEvent } from '../models/packets.ts';
import { locationService } from '../services/location/locationService.ts';
import { Button } from './ui/button.tsx';
import { Badge } from './ui/badge.tsx';

interface IncomingSosModalProps {
  sosEvent: SosEvent | null;
  myLocation: { latitude: number; longitude: number };
  onAcknowledge: (id: string) => void;
  onViewOnMap: () => void;
  onDismiss: () => void;
}

export const IncomingSosModal: React.FC<IncomingSosModalProps> = ({
  sosEvent,
  myLocation,
  onAcknowledge,
  onViewOnMap,
  onDismiss,
}) => {
  if (!sosEvent || sosEvent.isSelf || sosEvent.status === 'RESOLVED') {
    return null;
  }

  const { distanceMeters, formattedDistance, cardinalDirection, bearingDegrees } =
    locationService.calculateDistanceAndBearing(
      myLocation.latitude,
      myLocation.longitude,
      sosEvent.latitude,
      sosEvent.longitude
    );

  const elapsedSec = Math.max(0, Math.floor((Date.now() - sosEvent.timestamp) / 1000));
  const timeText =
    elapsedSec < 60 ? `${elapsedSec} seconds ago` : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s ago`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-950 border-2 border-red-600 rounded-2xl shadow-2xl overflow-hidden">
        {/* Pulsing Emergency Header */}
        <div className="bg-red-600 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertOctagon className="w-6 h-6 animate-bounce" />
            <div>
              <div className="font-black text-sm tracking-widest uppercase">Emergency SOS Received</div>
              <div className="text-[11px] text-red-100 font-mono">PRIORITY: CRITICAL · OVERRIDE</div>
            </div>
          </div>
          <button
            onClick={onDismiss}
            title="Minimize alert"
            className="p-1 rounded-lg hover:bg-red-700 active:scale-95 text-white/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Details */}
        <div className="p-5 space-y-4">
          <div className="bg-red-950/40 border border-red-800/60 rounded-xl p-3.5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-red-300">Originating Node</span>
              <span className="text-base font-black text-red-400 font-mono">{sosEvent.nodeId}</span>
            </div>
            <div className="text-xs text-slate-300 mt-1 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-red-400" />
              Direct emergency beacon via SX1262 LoRa
            </div>
          </div>

          {/* Grid Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">Distance</div>
              <div className="text-xl font-bold text-white font-mono">{formattedDistance}</div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                {cardinalDirection} ({Math.round(bearingDegrees)}°)
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">Time Elapsed</div>
              <div className="text-base font-bold text-slate-200 font-mono">{timeText}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Continuous GPS fix</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">LoRa Link RSSI</div>
              <div className="text-base font-bold text-slate-200 font-mono">
                {sosEvent.rssi !== undefined ? `${sosEvent.rssi} dBm` : '-92 dBm'}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">LoRa Link SNR</div>
              <div className="text-base font-bold text-slate-200 font-mono">
                {sosEvent.snr !== undefined ? `+${sosEvent.snr} dB` : '+6.4 dB'}
              </div>
            </div>
          </div>

          {/* Coordinates */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 font-mono text-xs">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-red-400" />
              Target GNSS Coordinates
            </div>
            <div className="text-slate-200 font-bold">
              {sosEvent.latitude.toFixed(6)}° N, {sosEvent.longitude.toFixed(6)}° E
            </div>
          </div>

          {/* Status info */}
          {sosEvent.status === 'ACKNOWLEDGED' && (
            <div className="text-xs text-emerald-400 flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-800/40 px-3 py-2 rounded-xl">
              <Check className="w-4 h-4" />
              You acknowledged this distress signal. ACK transmitted over LoRa.
            </div>
          )}

          {/* Action Buttons via shadcn Button */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              variant="outline"
              size="lg"
              onClick={onViewOnMap}
              className="text-xs"
            >
              <ArrowUpRight className="w-4 h-4 text-sky-400" />
              VIEW ON OFFLINE MAP
            </Button>

            <Button
              variant={sosEvent.status === 'ACKNOWLEDGED' ? 'secondary' : 'destructive'}
              size="lg"
              onClick={() => onAcknowledge(sosEvent.id)}
              disabled={sosEvent.status === 'ACKNOWLEDGED'}
              className="text-xs"
            >
              <Check className="w-4 h-4" />
              {sosEvent.status === 'ACKNOWLEDGED' ? 'ACKNOWLEDGED' : 'ACKNOWLEDGE SOS'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
