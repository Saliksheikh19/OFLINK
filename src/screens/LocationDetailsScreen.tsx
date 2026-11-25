import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Send,
  Navigation,
  Compass,
  Clock,
  Radio,
  RefreshCw,
  Map,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { oflinkService } from '../services/oflinkService.ts';
import { localDatabase } from '../services/storage/localDatabase.ts';
import { locationService, GeoCoordinates } from '../services/location/locationService.ts';
import { NodeLocation } from '../models/packets.ts';

interface LocationDetailsScreenProps {
  onNavigateToMap: () => void;
}

export const LocationDetailsScreen: React.FC<LocationDetailsScreenProps> = ({
  onNavigateToMap,
}) => {
  const [myCoords, setMyCoords] = useState<GeoCoordinates>(() =>
    locationService.getCurrentCoordinates()
  );
  const [remoteLocation, setRemoteLocation] = useState<NodeLocation | null>(() =>
    localDatabase.getLastKnownLocation()
  );
  const [locations, setLocations] = useState<NodeLocation[]>(() =>
    localDatabase.getLocations()
  );
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [now, setNow] = useState(Date.now());

  const settings = localDatabase.getSettings();
  const linkMetrics = oflinkService.getLinkMetrics();
  const isLinkLost = linkMetrics.quality === 'LOST';

  useEffect(() => {
    const unsubLoc = locationService.subscribe((coords) => {
      setMyCoords(coords);
    });
    const unsubDB = localDatabase.subscribe(() => {
      setRemoteLocation(localDatabase.getLastKnownLocation());
      setLocations(localDatabase.getLocations());
    });
    const timer = setInterval(() => setNow(Date.now()), 1000);

    return () => {
      unsubLoc();
      unsubDB();
      clearInterval(timer);
    };
  }, []);

  const handleShareLocation = async () => {
    setIsSharing(true);
    try {
      await oflinkService.shareMyLocation('HIGH');
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSharing(false);
    }
  };

  const handleAcquireFreshGps = async () => {
    setIsSharing(true);
    try {
      const fresh = await locationService.acquireFreshPosition();
      setMyCoords(fresh);
    } finally {
      setIsSharing(false);
    }
  };

  const metrics = remoteLocation
    ? locationService.calculateDistanceAndBearing(
        myCoords.latitude,
        myCoords.longitude,
        remoteLocation.latitude,
        remoteLocation.longitude
      )
    : null;

  const elapsedSec = remoteLocation
    ? Math.max(0, Math.floor((now - remoteLocation.timestamp) / 1000))
    : 0;
  const timeAgoStr =
    elapsedSec < 60 ? `${elapsedSec}s ago` : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s ago`;

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            Location Details
          </h2>
          <p className="text-xs text-slate-400">
            Internal smartphone GNSS telemetry and Haversine vectors
          </p>
        </div>

        <button
          onClick={handleShareLocation}
          disabled={isSharing}
          className={`h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all ${
            shareSuccess
              ? 'bg-emerald-500 text-slate-950'
              : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
          }`}
        >
          {isSharing ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          <span>{shareSuccess ? 'SENT ✓' : 'SHARE MY LOCATION'}</span>
        </button>
      </div>

      {/* Distance & Bearing Vector Hero Card */}
      {metrics && remoteLocation && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
              Vector to {remoteLocation.nodeId}
            </span>
            <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Updated {timeAgoStr}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                Haversine Distance
              </div>
              <div className="text-3xl font-black text-white font-mono mt-1">
                {metrics.formattedDistance}
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-1">
                Straight-line geodesic
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                Bearing & Direction
              </div>
              <div className="text-3xl font-black text-sky-400 font-mono mt-1 flex items-center gap-2">
                <Navigation
                  className="w-6 h-6 text-sky-400 shrink-0"
                  style={{ transform: `rotate(${metrics.bearingDegrees}deg)` }}
                />
                <span>{metrics.cardinalDirection}</span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-1">
                Azimuth: {Math.round(metrics.bearingDegrees)}°
              </div>
            </div>
          </div>

          {isLinkLost && (
            <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span>Link lost. Displaying preserved last-known coordinates.</span>
              </div>
              <button
                onClick={onNavigateToMap}
                className="text-xs font-bold text-red-300 underline"
              >
                View on Map
              </button>
            </div>
          )}
        </div>
      )}

      {/* Two Column Coordinates: Local vs Remote */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Local Node Phone GNSS */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-sky-500" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                My Phone Location ({settings.localNodeId})
              </h3>
            </div>
            <button
              onClick={handleAcquireFreshGps}
              title="Acquire fresh GNSS fix"
              className="p-1 rounded-lg text-slate-400 hover:text-white"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSharing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Latitude:</span>
              <span className="font-bold text-slate-200">{myCoords.latitude.toFixed(6)}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Longitude:</span>
              <span className="font-bold text-slate-200">{myCoords.longitude.toFixed(6)}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">GNSS Accuracy:</span>
              <span className="text-emerald-400 font-bold">
                ±{Math.round(myCoords.accuracy || 5)} m
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Altitude:</span>
              <span className="text-slate-300">{myCoords.altitude || 12} m MSL</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Acquired directly through the Android device's native GNSS receiver without requiring
            external hardware.
          </p>
        </div>

        {/* Remote Node Location */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  isLinkLost ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'
                }`}
              />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Remote Node ({settings.targetNodeId})
              </h3>
            </div>
            <button
              onClick={onNavigateToMap}
              className="text-xs font-mono text-sky-400 hover:text-sky-300 flex items-center gap-1"
            >
              <Map className="w-3.5 h-3.5" />
              Open Map
            </button>
          </div>

          {remoteLocation ? (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Latitude:</span>
                <span className="font-bold text-slate-200">
                  {remoteLocation.latitude.toFixed(6)}°
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Longitude:</span>
                <span className="font-bold text-slate-200">
                  {remoteLocation.longitude.toFixed(6)}°
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Last Received:</span>
                <span className="text-amber-400 font-bold">{timeAgoStr}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">State:</span>
                <span className={isLinkLost ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                  {isLinkLost ? 'Preserved Last-Known' : 'Active Fixed'}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-xs text-slate-500">
              No location packets received from {settings.targetNodeId} yet.
            </div>
          )}

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Preserved permanently in the local database even if wireless link drops out.
          </p>
        </div>
      </div>

      {/* Location Broadcast Log */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Location Packet Logs
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {locations.length} packet(s) stored locally
          </span>
        </div>

        {locations.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500">
            No location packets recorded yet.
          </div>
        ) : (
          <div className="max-h-48 overflow-y-auto space-y-1.5 font-mono text-xs">
            {locations.slice(-6).reverse().map((loc) => (
              <div
                key={loc.id}
                className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between text-slate-300"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      loc.isSelf ? 'bg-sky-400' : 'bg-emerald-400'
                    }`}
                  />
                  <span className="font-bold">{loc.nodeId}</span>
                </div>
                <span>
                  {loc.latitude.toFixed(5)}°, {loc.longitude.toFixed(5)}°
                </span>
                <span className="text-[10px] text-slate-500">
                  {new Date(loc.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
