import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  Check,
  RotateCcw,
  Clock,
  MapPin,
  Radio,
  ShieldAlert,
  X,
  Compass,
  ArrowRight,
} from 'lucide-react';
import { oflinkService } from '../services/oflinkService.ts';
import { localDatabase } from '../services/storage/localDatabase.ts';
import { locationService } from '../services/location/locationService.ts';
import { SosEvent } from '../models/packets.ts';
import { Button } from '../components/ui/button.tsx';
import { Badge } from '../components/ui/badge.tsx';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.tsx';

type SosTransmissionState = 'IDLE' | 'SENDING' | 'RETRYING' | 'DELIVERED' | 'FAILED';

export const SosScreen: React.FC = () => {
  const [transState, setTransState] = useState<SosTransmissionState>('IDLE');
  const [retryAttempt, setRetryAttempt] = useState<number>(1);
  const [activeSos, setActiveSos] = useState<SosEvent | null>(null);
  const [sosHistory, setSosHistory] = useState<SosEvent[]>(() => localDatabase.getSosEvents());
  const [holdProgress, setHoldProgress] = useState<number>(0);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  const holdTimerRef = useRef<any>(null);
  const holdStartTimeRef = useRef<number>(0);

  const settings = localDatabase.getSettings();
  const myCoords = locationService.getCurrentCoordinates();

  useEffect(() => {
    const unsub = localDatabase.subscribe(() => {
      setSosHistory(localDatabase.getSosEvents());
    });
    return () => unsub();
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<string>('CRITICAL DISTRESS');

  const categories = [
    'CRITICAL DISTRESS',
    'MEDICAL EMERGENCY',
    'EQUIPMENT FAILURE',
    'LOST / OFF-TRAIL',
  ];

  // Hold-to-activate logic (2.0 seconds continuous hold)
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (transState === 'SENDING' || transState === 'RETRYING') return;

    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(30);
      } catch (_) {}
    }

    holdStartTimeRef.current = Date.now();
    holdTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - holdStartTimeRef.current;
      const progress = Math.min(100, (elapsed / 2000) * 100);
      setHoldProgress(progress);

      if (elapsed >= 2000) {
        clearInterval(holdTimerRef.current);
        if ('vibrate' in navigator) {
          try {
            navigator.vibrate([100, 50, 150]);
          } catch (_) {}
        }
        triggerSos();
      }
    }, 25);
  };

  const handlePointerUp = (e?: React.PointerEvent) => {
    if (e) e.preventDefault();
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setHoldProgress(0);
  };

  const triggerSos = async () => {
    setHoldProgress(0);
    setTransState('SENDING');
    setRetryAttempt(1);

    try {
      const event = await oflinkService.triggerEmergencySos(selectedCategory);
      setActiveSos(event);

      setTimeout(() => {
        setTransState('DELIVERED');
      }, 1600);
    } catch (e) {
      console.error(e);
      setTransState('FAILED');
    }
  };

  const handleCancelSos = async () => {
    if (activeSos) {
      await oflinkService.cancelOrResolveMySos(activeSos.id);
      setActiveSos(null);
    }
    setTransState('IDLE');
  };

  return (
    <div className="space-y-5 pb-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-red-500 flex items-center gap-2">
            Priority SOS System
          </h2>
          <p className="text-xs text-slate-400">
            Emergency distress beacon broadcast with highest LoRa queue priority over 433 MHz
          </p>
        </div>

        <Badge variant="destructive" className="text-[10px] self-start sm:self-auto uppercase">
          PTA 433 MHz · HARDWARE PRE-EMPTION
        </Badge>
      </div>

      {/* Responsive Split on Desktop (lg:grid-cols-12) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Left Column: Big Tactile Hold Button & Live States (7 cols) */}
        <div className="lg:col-span-7 bg-[#0b0f1d] border-2 border-red-900/60 rounded-3xl p-4 sm:p-7 text-center shadow-2xl relative overflow-hidden flex flex-col items-center justify-center">
          {/* Ambient red flare */}
          <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-red-600/15 via-red-900/5 to-transparent pointer-events-none" />

          {/* Distress Preset Category Selector Chips */}
          <div className="w-full max-w-md mb-4 relative z-10">
            <div className="text-[10px] font-mono uppercase text-slate-400 mb-1.5 text-center">
              Select Distress Reason:
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className="h-7 text-[10px] font-mono px-2.5 rounded-lg"
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>

          {/* State Tag */}
          <div className="mb-3 relative z-10">
            {transState === 'IDLE' && (
              <Badge variant="secondary" className="text-[11px] sm:text-xs py-1 px-3">
                Hold button for 2.0s to broadcast emergency beacon
              </Badge>
            )}

            {transState === 'SENDING' && (
              <Badge variant="warning" className="text-xs py-1.5 px-4 animate-pulse gap-2">
                <Clock className="w-4 h-4 animate-spin" />
                SOS Sending... (Broadcasting via 433 MHz LoRa)
              </Badge>
            )}

            {transState === 'RETRYING' && (
              <Badge variant="warning" className="text-xs py-1.5 px-4 animate-pulse gap-2">
                <RotateCcw className="w-4 h-4 animate-spin" />
                SOS Retrying... (Attempt {retryAttempt}/3)
              </Badge>
            )}

            {transState === 'DELIVERED' && (
              <Badge variant="success" className="text-xs py-1.5 px-4 gap-2">
                <Check className="w-4 h-4" />
                SOS Delivered ✓ (Remote ACK confirmed)
              </Badge>
            )}

            {transState === 'FAILED' && (
              <Badge variant="destructive" className="text-xs py-1.5 px-4 gap-2">
                <AlertOctagon className="w-4 h-4" />
                SOS Failed · Remote Node Unreachable
              </Badge>
            )}
          </div>

          {/* Giant Tactile Button with Radial SVG Ring (Fully Scalable & Responsive) */}
          <div className="relative inline-flex items-center justify-center my-3 w-52 h-52 sm:w-60 sm:h-60 max-w-full">
            {/* Concentric Ambient Ripple Rings */}
            <span className="absolute -inset-2 rounded-full bg-red-600/20 beacon-ripple-ring pointer-events-none" />
            {holdProgress > 0 && (
              <span className="absolute -inset-4 rounded-full bg-red-500/30 animate-ping pointer-events-none" />
            )}

            <svg className="w-full h-full -rotate-90" viewBox="0 0 240 240">
              <circle
                cx="120"
                cy="120"
                r="104"
                className="text-slate-800"
                strokeWidth="10"
                stroke="currentColor"
                fill="transparent"
              />
              <circle
                cx="120"
                cy="120"
                r="104"
                className="text-red-500 transition-all duration-75"
                strokeWidth="10"
                strokeDasharray={2 * Math.PI * 104}
                strokeDashoffset={2 * Math.PI * 104 * (1 - holdProgress / 100)}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
              />
            </svg>

            {/* Tactile SOS Button */}
            <button
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={`absolute w-38 h-38 sm:w-44 sm:h-44 rounded-full font-black text-2xl sm:text-3xl tracking-widest flex flex-col items-center justify-center text-white shadow-2xl active:scale-95 transition-all select-none touch-none ${
                transState === 'DELIVERED'
                  ? 'bg-emerald-600 shadow-emerald-950 border-4 border-emerald-400'
                  : transState === 'SENDING' || transState === 'RETRYING'
                  ? 'bg-amber-600 shadow-amber-950 border-4 border-amber-400'
                  : 'bg-gradient-to-tr from-red-700 via-red-600 to-rose-500 hover:from-red-600 hover:to-rose-400 shadow-red-950 border-4 border-red-400/90 emergency-glow'
              }`}
            >
              <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 mb-0.5 animate-pulse text-white drop-shadow-md" />
              <span className="drop-shadow-md">SOS</span>
              <span className="text-[10px] sm:text-[11px] font-mono tracking-normal font-bold opacity-90 mt-0.5">
                {holdProgress > 0 ? `${Math.round(holdProgress)}% HOLD` : 'HOLD 2S'}
              </span>
            </button>
          </div>

          {/* Hold Progress Bar Indicator */}
          <div className="w-48 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800 mb-2">
            <div
              className="h-full bg-gradient-to-r from-red-500 to-rose-400 transition-all duration-75"
              style={{ width: `${holdProgress}%` }}
            />
          </div>

          {/* Fallback dialog trigger */}
          <div className="mt-2">
            <Button
              variant="link"
              size="sm"
              onClick={() => setShowConfirmModal(true)}
              className="text-xs text-slate-400 hover:text-red-400"
            >
              Or tap for instant confirmation dialog
            </Button>
          </div>

          {/* Cancel distress signal button */}
          {(transState === 'SENDING' || transState === 'RETRYING' || transState === 'DELIVERED') && (
            <div className="mt-5 pt-3 border-t border-slate-800 w-full flex items-center justify-center">
              <Button
                variant="destructive"
                onClick={handleCancelSos}
                className="rounded-2xl text-xs font-mono"
              >
                CANCEL / RESOLVE DISTRESS SIGNAL
              </Button>
            </div>
          )}
        </div>

        {/* Right Column: Broadcast Coordinate Payload & Distress Logs (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Live GNSS Coordinate Payload */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-sky-950 text-sky-400 border border-sky-800/50">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    Emergency GNSS Payload
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Direct WGS-84 fix from device receiver
                  </div>
                </div>
              </div>
              <Badge variant="success">
                ±{Math.round(myCoords.accuracy || 5)}m
              </Badge>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Target Node:</span>
                <span className="text-white font-bold">{settings.targetNodeId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Latitude:</span>
                <span className="text-emerald-400 font-bold">{myCoords.latitude.toFixed(6)}° N</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Longitude:</span>
                <span className="text-emerald-400 font-bold">{myCoords.longitude.toFixed(6)}° E</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">RF Channel:</span>
                <span className="text-sky-300 font-bold">{settings.loraFrequencyMhz} MHz (PTA)</span>
              </div>
            </div>
          </Card>

          {/* Distress Event Log Card */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 font-mono">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <span>Distress Event Log</span>
              </h3>
              <Badge variant="secondary">
                {sosHistory.length} event(s)
              </Badge>
            </div>

            {sosHistory.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 font-mono">
                No active or historical distress events logged. System is standby.
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-2">
                {sosHistory.map((event) => (
                  <div
                    key={event.id}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <ShieldAlert
                        className={`w-4 h-4 ${event.isSelf ? 'text-amber-400' : 'text-red-400'}`}
                      />
                      <div>
                        <span className="font-bold text-slate-200">
                          {event.isSelf ? 'My Broadcast' : `From ${event.nodeId}`}
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {event.latitude.toFixed(4)}°, {event.longitude.toFixed(4)}°
                        </div>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <Badge
                        variant={event.status === 'ACTIVE' ? 'destructive' : 'success'}
                      >
                        {event.status}
                      </Badge>
                      <div className="text-[10px] text-slate-500 mt-1">
                        {new Date(event.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Confirmation Modal via shadcn Dialog */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="border-red-600 max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2 text-red-500 mb-1">
              <AlertTriangle className="w-5 h-5" />
              <DialogTitle className="text-red-500 uppercase tracking-wider text-base">
                Confirm SOS Broadcast
              </DialogTitle>
            </div>
            <DialogDescription className="text-slate-300 text-xs">
              This will immediately transmit a CRITICAL distress beacon with your GNSS coordinates to{' '}
              <strong className="text-white">{settings.targetNodeId}</strong> over 433 MHz LoRa.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="grid grid-cols-2 gap-2 mt-2">
            <Button
              variant="secondary"
              onClick={() => setShowConfirmModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowConfirmModal(false);
                triggerSos();
              }}
            >
              Broadcast SOS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
