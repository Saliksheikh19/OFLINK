import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Send,
  Navigation,
  Compass,
  List,
  Trash2,
  Clock,
  Layers,
  AlertTriangle,
  LocateFixed,
} from 'lucide-react';
import { OfflineTacticalMap } from '../services/maps/OfflineTacticalMap.tsx';
import { oflinkService } from '../services/oflinkService.ts';
import { localDatabase } from '../services/storage/localDatabase.ts';
import { locationService } from '../services/location/locationService.ts';
import { NodeLocation, BreadcrumbPoint } from '../models/packets.ts';

export const MapScreen: React.FC = () => {
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbPoint[]>(() =>
    localDatabase.getBreadcrumbs()
  );
  const [remoteLoc, setRemoteLoc] = useState<NodeLocation | null>(() =>
    localDatabase.getLastKnownLocation()
  );
  const [myCoords, setMyCoords] = useState(() => locationService.getCurrentCoordinates());
  const [showTrailSheet, setShowTrailSheet] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  const linkMetrics = oflinkService.getLinkMetrics();
  const isLinkLost = linkMetrics.quality === 'LOST';

  useEffect(() => {
    const unsubDB = localDatabase.subscribe(() => {
      setBreadcrumbs(localDatabase.getBreadcrumbs());
      setRemoteLoc(localDatabase.getLastKnownLocation());
    });

    const unsubLoc = locationService.subscribe((coords) => {
      setMyCoords(coords);
    });

    return () => {
      unsubDB();
      unsubLoc();
    };
  }, []);

  const handleShareLocation = async () => {
    setSharing(true);
    try {
      await oflinkService.shareMyLocation('HIGH');
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setSharing(false);
    }
  };

  const handleClearTrail = () => {
    if (window.confirm('Clear breadcrumb trail history?')) {
      localDatabase.clearBreadcrumbs();
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100dvh-160px)] lg:h-[calc(100vh-120px)] bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative">
      {/* Tactical Canvas Map Main Area */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {/* Top Map Toolbar */}
        <div className="bg-[#0b101d] border-b border-slate-800/80 px-4 sm:px-6 py-2.5 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                Offline Tactical Canvas
                <span className="hidden sm:inline text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                  AIR-GAPPED
                </span>
              </h3>
              <div className="text-[10px] text-slate-400 font-mono">
                Topographic Geometry · No Google Maps HTTP Tiles Required
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTrailSheet((p) => !p)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors ${
                showTrailSheet
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-900 text-slate-200 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Trail ({breadcrumbs.length})</span>
            </button>

            <button
              onClick={handleShareLocation}
              disabled={sharing}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all ${
                shareSuccess
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-md shadow-sky-950'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>{shareSuccess ? 'SENT ✓' : 'SHARE FIX'}</span>
            </button>
          </div>
        </div>

        {/* Tactical Canvas Component */}
        <div className="flex-1 relative min-h-0">
          <OfflineTacticalMap
            myLocation={myCoords}
            remoteLocation={isLinkLost ? null : remoteLoc}
            lastKnownLocation={remoteLoc}
            breadcrumbs={breadcrumbs}
            isLinkLost={isLinkLost}
            lastContactTime={linkMetrics.lastContact}
          />
        </div>
      </div>

      {/* Emergency Breadcrumb History Drawer / Side Panel on Desktop */}
      {showTrailSheet && (
        <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-slate-800 bg-[#090e1b] z-30 flex flex-col p-4 shadow-2xl animate-in slide-in-from-bottom-4 lg:slide-in-from-right-4 duration-200 shrink-0 max-h-[50%] lg:max-h-full">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Breadcrumb History
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearTrail}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 p-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
              <button
                onClick={() => setShowTrailSheet(false)}
                className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-900 border border-slate-800"
              >
                Close
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-3 space-y-2">
            {breadcrumbs.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No breadcrumbs recorded yet. Movement updates will append here.
              </div>
            ) : (
              breadcrumbs.map((bc, idx) => {
                const isCurrent = idx === breadcrumbs.length - 1;
                return (
                  <div
                    key={bc.id}
                    className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-mono transition-all ${
                      isCurrent
                        ? 'bg-amber-950/40 border-amber-600/70 text-amber-200 shadow-md'
                        : 'bg-slate-950 border-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center font-black text-[11px] text-amber-400">
                        {bc.stepNumber}
                      </span>
                      <div>
                        <div className="font-bold text-[11px]">
                          {isCurrent ? 'Current / Fix' : `Waypoint P${bc.stepNumber}`}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {bc.latitude.toFixed(4)}°, {bc.longitude.toFixed(4)}°
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      {bc.distanceFromPrev !== undefined && (
                        <div className="text-[11px] text-emerald-400 font-bold">
                          +{bc.distanceFromPrev}m
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500">
                        {new Date(bc.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
