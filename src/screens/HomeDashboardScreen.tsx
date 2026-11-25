import React, { useState } from 'react';
import {
  MessageSquare,
  MapPin,
  Map,
  Activity,
  AlertTriangle,
  Radio,
  Navigation,
  Clock,
  Send,
  Bluetooth,
  RefreshCw,
  Compass,
  WifiOff,
  Shield,
  Signal,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import { oflinkService } from '../services/oflinkService.ts';
import { localDatabase } from '../services/storage/localDatabase.ts';
import { locationService } from '../services/location/locationService.ts';
import { bleManager } from '../services/ble/bleService.ts';
import { Button } from '../components/ui/button.tsx';
import { Badge } from '../components/ui/badge.tsx';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card.tsx';

interface HomeDashboardScreenProps {
  onNavigate: (screen: string) => void;
}

export const HomeDashboardScreen: React.FC<HomeDashboardScreenProps> = ({ onNavigate }) => {
  const [sharingLocation, setSharingLocation] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  const settings = localDatabase.getSettings();
  const linkMetrics = oflinkService.getLinkMetrics();
  const bleState = oflinkService.getBleState();
  const lastKnown = localDatabase.getLastKnownLocation();
  const myCoords = locationService.getCurrentCoordinates();

  const isLinkLost = linkMetrics.quality === 'LOST';
  const elapsedSec = Math.max(0, Math.floor((Date.now() - linkMetrics.lastContact) / 1000));
  const lastContactStr =
    elapsedSec < 60 ? `${elapsedSec}s ago` : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s ago`;

  // Calculate distance and bearing
  const metrics = lastKnown
    ? locationService.calculateDistanceAndBearing(
        myCoords.latitude,
        myCoords.longitude,
        lastKnown.latitude,
        lastKnown.longitude
      )
    : null;

  const handleShareLocation = async () => {
    setSharingLocation(true);
    try {
      await oflinkService.shareMyLocation('HIGH');
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setSharingLocation(false);
    }
  };

  // Signal bar meter count (1 to 5)
  const getSignalBars = (rssi: number) => {
    if (rssi >= -80) return 5;
    if (rssi >= -95) return 4;
    if (rssi >= -105) return 3;
    if (rssi >= -115) return 2;
    if (rssi >= -125) return 1;
    return 0;
  };
  const signalBars = isLinkLost ? 0 : getSignalBars(linkMetrics.rssi);

  return (
    <div className="space-y-6 pb-6">
      {/* Top Banner: Air-Gapped Status & Quick Device Info */}
      <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900/60 border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-sky-400">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-white tracking-wide">
                PTA 433 MHz LoRa Field Node
              </span>
              <Badge variant="pta">
                COMPLIANT
              </Badge>
            </div>
            <div className="text-xs text-slate-400 font-mono mt-0.5">
              Frequency: {settings.loraFrequencyMhz} MHz · Output: +{settings.loraTxPowerDbm} dBm · SF{settings.loraSpreadingFactor}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono self-start sm:self-auto">
          <span className="text-slate-400">Target:</span>
          <Badge variant="secondary" className="font-bold text-sky-300 py-1 px-2.5">
            {settings.targetNodeId}
          </Badge>
        </div>
      </Card>

      {/* Responsive Grid Split for Desktop / Tablet */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Target Node Hero Card & Link Status (lg: 7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Primary Tactical Node Card */}
          <div className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900/90 to-[#0c1220] border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl">
            {/* Ambient Background Grid Pattern */}
            <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-25 pointer-events-none" />

            {/* Header: Node Name, Link Lost Status & Signal Bars */}
            <div className="relative flex items-center justify-between pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                {/* Radar target icon */}
                <div className="relative w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center">
                  <Compass className="w-6 h-6 text-sky-400" />
                  <span
                    className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full ${
                      isLinkLost
                        ? 'bg-red-500 animate-ping'
                        : bleState === 'CONNECTED'
                        ? 'bg-emerald-500'
                        : 'bg-amber-500'
                    }`}
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-white font-mono tracking-wider">
                      {settings.targetNodeId}
                    </h3>
                    <Badge variant={isLinkLost ? 'destructive' : 'success'}>
                      {isLinkLost ? 'LINK LOST' : 'CONNECTED'}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">
                    Peer Node via SX1262 LoRa 433 MHz
                  </div>
                </div>
              </div>

              {/* 5-Bar Signal Strength Meter */}
              <div className="flex flex-col items-end">
                <div className="flex items-end gap-1 h-6">
                  {[1, 2, 3, 4, 5].map((bar) => (
                    <span
                      key={bar}
                      style={{ height: `${bar * 20}%` }}
                      className={`w-1.5 rounded-xs transition-all duration-300 ${
                        bar <= signalBars
                          ? bar > 3
                            ? 'bg-emerald-400'
                            : bar > 1
                            ? 'bg-amber-400'
                            : 'bg-red-400'
                          : 'bg-slate-800'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-mono text-slate-400 mt-1">
                  {isLinkLost ? 'No Signal' : `${linkMetrics.rssi} dBm`}
                </span>
              </div>
            </div>

            {/* Link Lost Warning Banner */}
            {isLinkLost && (
              <div className="relative mt-4 p-4 bg-red-950/70 border border-red-800 rounded-2xl text-xs text-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                  <div>
                    <span className="font-bold uppercase tracking-wider block">LINK TIMEOUT EXCEEDED</span>
                    <span className="text-slate-300 text-[11px]">
                      No ACK or telemetry received for {lastContactStr}. Last-known position preserved.
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate('map')}
                  className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs tracking-wider shrink-0 transition-colors"
                >
                  VIEW LAST LOCATION
                </button>
              </div>
            )}

            {/* Tactical Metrics 4-Box Grid */}
            <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 hover:border-slate-700 transition-colors">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">Distance</div>
                <div className="text-2xl font-black text-white font-mono mt-1">
                  {metrics ? metrics.formattedDistance : '—'}
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-1">Haversine formula</div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 hover:border-slate-700 transition-colors">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">Bearing</div>
                <div className="text-2xl font-black text-sky-400 font-mono mt-1 flex items-center gap-1.5">
                  {metrics ? (
                    <>
                      <Navigation
                        className="w-5 h-5 text-sky-400 shrink-0 transition-transform duration-500"
                        style={{ transform: `rotate(${metrics.bearingDegrees}deg)` }}
                      />
                      <span>{metrics.cardinalDirection}</span>
                    </>
                  ) : (
                    '—'
                  )}
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-1">
                  {metrics ? `${Math.round(metrics.bearingDegrees)}° Azimuth` : 'Standby'}
                </div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 hover:border-slate-700 transition-colors">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">Delivery Rate</div>
                <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
                  {linkMetrics.pdr}%
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-1">Packet delivery</div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 hover:border-slate-700 transition-colors">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">Last Contact</div>
                <div className="text-sm font-bold text-slate-200 font-mono mt-2 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{lastContactStr}</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-1">Continuous ping</div>
              </div>
            </div>

            {/* Sub-Telemetry Ticker (RSSI, SNR, Retries, Latency) */}
            <div className="relative grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-800/80 text-center font-mono text-xs">
              <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-800/60">
                <span className="text-[10px] text-slate-500 uppercase block">RSSI</span>
                <span className="font-bold text-slate-200 text-sm">{linkMetrics.rssi} dBm</span>
              </div>
              <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-800/60">
                <span className="text-[10px] text-slate-500 uppercase block">SNR</span>
                <span className="font-bold text-emerald-400 text-sm">+{linkMetrics.snr} dB</span>
              </div>
              <div className="bg-slate-950/50 p-2 rounded-xl border border-slate-800/60">
                <span className="text-[10px] text-slate-500 uppercase block">Latency</span>
                <span className="font-bold text-slate-200 text-sm">{linkMetrics.latency} ms</span>
              </div>
            </div>
          </div>

          {/* Large Tactile Emergency SOS Trigger Bar */}
          <Button
            variant="sos"
            size="beacon"
            onClick={() => onNavigate('sos')}
            className="w-full min-h-[64px] py-3 flex items-center justify-between px-4 sm:px-6 shadow-xl shadow-red-950/70"
          >
            <div className="flex items-center gap-2.5 sm:gap-3 text-left min-w-0">
              <div className="w-10 h-10 rounded-xl bg-red-950/80 border border-red-400/50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 animate-pulse text-white" />
              </div>
              <div className="truncate">
                <div className="text-xs sm:text-sm font-black leading-tight text-white tracking-wide">
                  BROADCAST PRIORITY SOS
                </div>
                <div className="text-[10px] sm:text-[11px] text-red-100 font-normal normal-case truncate">
                  Immediate 433 MHz LoRa beacon broadcast
                </div>
              </div>
            </div>
            <Badge variant="destructive" className="bg-black/50 text-red-200 border-red-800/80 shrink-0 ml-2 py-1 px-2.5">
              HOLD 2S
            </Badge>
          </Button>
        </div>

        {/* RIGHT COLUMN: Quick Actions, Map Preview & Hardware Suite (lg: 5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Main Action Buttons Grid */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onNavigate('chat')}
              className="h-28 bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between items-start text-left shadow-lg active:scale-[0.98] transition-all group"
            >
              <div className="p-2.5 rounded-xl bg-sky-950 text-sky-400 border border-sky-800/50 group-hover:scale-105 transition-transform">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-1">
                  <span>Chat Comms</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 transition-colors" />
                </div>
                <div className="text-[10px] text-slate-400">Offline P2P text</div>
              </div>
            </button>

            <button
              onClick={handleShareLocation}
              disabled={sharingLocation}
              className={`h-28 border rounded-2xl p-4 flex flex-col justify-between items-start text-left shadow-lg active:scale-[0.98] transition-all group ${
                shareSuccess
                  ? 'bg-emerald-950/80 border-emerald-600 text-emerald-200'
                  : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-800'
              }`}
            >
              <div
                className={`p-2.5 rounded-xl transition-all ${
                  shareSuccess
                    ? 'bg-emerald-800 text-white'
                    : 'bg-emerald-950 text-emerald-400 border border-emerald-800/50 group-hover:scale-105'
                }`}
              >
                {sharingLocation ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <MapPin className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="text-xs font-bold text-white tracking-wide uppercase">
                  {shareSuccess ? 'Location Sent ✓' : 'Share Location'}
                </div>
                <div className="text-[10px] text-slate-400">Internal phone GNSS</div>
              </div>
            </button>

            <button
              onClick={() => onNavigate('map')}
              className="h-28 bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between items-start text-left shadow-lg active:scale-[0.98] transition-all group"
            >
              <div className="p-2.5 rounded-xl bg-amber-950 text-amber-400 border border-amber-800/50 group-hover:scale-105 transition-transform">
                <Map className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-1">
                  <span>Offline Map</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition-colors" />
                </div>
                <div className="text-[10px] text-slate-400">Tactical vector canvas</div>
              </div>
            </button>

            <button
              onClick={() => onNavigate('status')}
              className="h-28 bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between items-start text-left shadow-lg active:scale-[0.98] transition-all group"
            >
              <div className="p-2.5 rounded-xl bg-indigo-950 text-indigo-400 border border-indigo-800/50 group-hover:scale-105 transition-transform">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-1">
                  <span>RF Telemetry</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                </div>
                <div className="text-[10px] text-slate-400">Signal quality logs</div>
              </div>
            </button>
          </div>

          {/* Field Simulation Suite (Quick In-App Testing Controls via shadcn Card) */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 font-mono">
                <Radio className="w-4 h-4 text-sky-400" />
                <span>Field Simulation Suite</span>
              </div>
              <Badge variant="success">
                MOCK ACTIVE
              </Badge>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
              Inject real packet events into the local pipeline to test P2P logic before hardware field deployment.
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <Button
                variant="outline"
                size="sm"
                onClick={() => bleManager.injectIncomingMessage('Rendezvous reached. Sector 433 clear.')}
                className="justify-center"
              >
                <Send className="w-3.5 h-3.5 text-sky-400" />
                Simulate Message
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const base = lastKnown || { latitude: 24.8645, longitude: 67.0085 };
                  const newLat = base.latitude + (Math.random() * 0.002 - 0.001);
                  const newLon = base.longitude + (Math.random() * 0.002 - 0.001);
                  bleManager.injectIncomingLocation(newLat, newLon);
                }}
                className="justify-center"
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                Simulate Move
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const current = bleManager.getMockLinkLost();
                  bleManager.setMockLinkLost(!current);
                }}
                className="justify-center"
              >
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                Toggle Link Loss
              </Button>

              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  const base = lastKnown || { latitude: 24.8645, longitude: 67.0085 };
                  bleManager.injectIncomingSos(base.latitude, base.longitude, 'Operator emergency beacon simulated');
                }}
                className="justify-center"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                Simulate SOS
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
