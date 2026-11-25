import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Navigation,
  Compass,
  LocateFixed,
  Plus,
  Minus,
  Layers,
  MapPin,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { NodeLocation, BreadcrumbPoint } from '../../models/packets.ts';
import { locationService, DistanceAndBearing } from '../location/locationService.ts';

interface OfflineTacticalMapProps {
  myLocation: { latitude: number; longitude: number; accuracy?: number };
  remoteLocation: NodeLocation | null;
  lastKnownLocation: NodeLocation | null;
  breadcrumbs: BreadcrumbPoint[];
  isLinkLost: boolean;
  lastContactTime: number;
  onFocusRemote?: () => void;
  className?: string;
}

export const OfflineTacticalMap: React.FC<OfflineTacticalMapProps> = ({
  myLocation,
  remoteLocation,
  lastKnownLocation,
  breadcrumbs,
  isLinkLost,
  lastContactTime,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Map viewport state: center lat/lon and scale (pixels per degree)
  // 1 degree latitude is approx 111,000 meters.
  // Default center halfway between me and remote
  const [centerLat, setCenterLat] = useState<number>(() => {
    return remoteLocation
      ? (myLocation.latitude + remoteLocation.latitude) / 2
      : myLocation.latitude;
  });
  const [centerLon, setCenterLon] = useState<number>(() => {
    return remoteLocation
      ? (myLocation.longitude + remoteLocation.longitude) / 2
      : myLocation.longitude;
  });

  // Scale: pixels per degree (higher = more zoomed in)
  // At zoom ~50,000 px/deg, 1km is ~450px
  const [zoomScale, setZoomScale] = useState<number>(65000);
  const [showTopo, setShowTopo] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);

  // Dragging / Panning state
  const isDragging = useRef<boolean>(false);
  const dragStart = useRef<{ x: number; y: number; lat: number; lon: number }>({
    x: 0,
    y: 0,
    lat: 0,
    lon: 0,
  });

  // Calculate live distance & bearing
  const targetLoc = remoteLocation || lastKnownLocation;
  const metrics: DistanceAndBearing | null = targetLoc
    ? locationService.calculateDistanceAndBearing(
        myLocation.latitude,
        myLocation.longitude,
        targetLoc.latitude,
        targetLoc.longitude
      )
    : null;

  // Center on local node
  const handleCenterMe = useCallback(() => {
    setCenterLat(myLocation.latitude);
    setCenterLon(myLocation.longitude);
  }, [myLocation.latitude, myLocation.longitude]);

  // Center on remote node
  const handleCenterRemote = useCallback(() => {
    if (targetLoc) {
      setCenterLat(targetLoc.latitude);
      setCenterLon(targetLoc.longitude);
    }
  }, [targetLoc]);

  // Zoom controls
  const handleZoomIn = () => setZoomScale((prev) => Math.min(prev * 1.35, 300000));
  const handleZoomOut = () => setZoomScale((prev) => Math.max(prev / 1.35, 12000));

  // Convert GPS Coordinates to Canvas Pixels
  const coordsToScreen = useCallback(
    (lat: number, lon: number, width: number, height: number) => {
      // Mercator projection approximation for local tactical scale
      const cosLat = Math.cos((centerLat * Math.PI) / 180);
      const x = width / 2 + (lon - centerLon) * zoomScale * cosLat;
      const y = height / 2 - (lat - centerLat) * zoomScale;
      return { x, y };
    },
    [centerLat, centerLon, zoomScale]
  );

  // Convert Screen Pixels back to GPS Coordinates
  const screenToCoords = useCallback(
    (x: number, y: number, width: number, height: number) => {
      const cosLat = Math.cos((centerLat * Math.PI) / 180);
      const lon = centerLon + (x - width / 2) / (zoomScale * cosLat);
      const lat = centerLat - (y - height / 2) / zoomScale;
      return { lat, lon };
    },
    [centerLat, centerLon, zoomScale]
  );

  // Draw tactical map on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // 1. Dark tactical background field
    ctx.fillStyle = '#0f172a'; // slate-900
    ctx.fillRect(0, 0, width, height);

    // 2. Offline Topographic Contour Simulation (Pure vector geometry)
    if (showTopo) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.45)'; // slate-700 subtle
      const numRings = 7;
      const origin = coordsToScreen(
        myLocation.latitude - 0.003,
        myLocation.longitude + 0.004,
        width,
        height
      );

      for (let r = 1; r <= numRings; r++) {
        ctx.beginPath();
        const baseRadius = (r * 75 * zoomScale) / 65000;
        const steps = 36;
        for (let i = 0; i <= steps; i++) {
          const angle = (i * 2 * Math.PI) / steps;
          // Organic contour distortion
          const wobble = Math.sin(angle * 3 + r) * (14 * (zoomScale / 65000)) + Math.cos(angle * 5) * 8;
          const px = origin.x + (baseRadius + wobble) * Math.cos(angle);
          const py = origin.y + (baseRadius + wobble) * 0.7 * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();

        // Elevation tag
        if (r % 2 === 0) {
          ctx.fillStyle = 'rgba(100, 116, 139, 0.5)';
          ctx.font = '9px monospace';
          ctx.fillText(`+${r * 25}m`, origin.x + baseRadius, origin.y);
        }
      }
    }

    // 3. Tactical Coordinate Grid
    if (showGrid) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)'; // slate-700
      ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
      ctx.font = '10px monospace';

      const gridSpacingDeg = 0.005; // ~550m
      const startCoord = screenToCoords(0, height, width, height);
      const endCoord = screenToCoords(width, 0, width, height);

      const minLon = Math.floor(startCoord.lon / gridSpacingDeg) * gridSpacingDeg;
      const maxLon = Math.ceil(endCoord.lon / gridSpacingDeg) * gridSpacingDeg;
      const minLat = Math.floor(startCoord.lat / gridSpacingDeg) * gridSpacingDeg;
      const maxLat = Math.ceil(endCoord.lat / gridSpacingDeg) * gridSpacingDeg;

      // Vertical lon lines
      for (let lon = minLon; lon <= maxLon; lon += gridSpacingDeg) {
        const { x } = coordsToScreen(centerLat, lon, width, height);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        ctx.fillText(lon.toFixed(3), x + 4, height - 8);
      }

      // Horizontal lat lines
      for (let lat = minLat; lat <= maxLat; lat += gridSpacingDeg) {
        const { y } = coordsToScreen(lat, centerLon, width, height);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.fillText(lat.toFixed(3), 6, y - 4);
      }
    }

    // 4. Draw Emergency Breadcrumb Trail for Remote Node
    if (breadcrumbs.length > 0) {
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = '#f59e0b'; // amber-500
      ctx.beginPath();

      breadcrumbs.forEach((bc, idx) => {
        const pt = coordsToScreen(bc.latitude, bc.longitude, width, height);
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash

      // Waypoint marker dots
      breadcrumbs.forEach((bc) => {
        const pt = coordsToScreen(bc.latitude, bc.longitude, width, height);
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
        ctx.fill();

        // Waypoint number tag
        ctx.fillStyle = '#fde68a';
        ctx.font = '9px monospace';
        ctx.fillText(`P${bc.stepNumber}`, pt.x + 6, pt.y - 4);
      });
    }

    // 5. Bearing / Vector line between Local and Remote Node
    if (targetLoc) {
      const myPt = coordsToScreen(myLocation.latitude, myLocation.longitude, width, height);
      const remPt = coordsToScreen(targetLoc.latitude, targetLoc.longitude, width, height);

      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = isLinkLost ? 'rgba(239, 68, 68, 0.6)' : 'rgba(56, 189, 248, 0.7)'; // red or sky blue
      ctx.beginPath();
      ctx.moveTo(myPt.x, myPt.y);
      ctx.lineTo(remPt.x, remPt.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Distance tag on the middle of the line
      if (metrics) {
        const midX = (myPt.x + remPt.x) / 2;
        const midY = (myPt.y + remPt.y) / 2;
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        const text = `${metrics.formattedDistance} · ${metrics.cardinalDirection}`;
        ctx.font = '11px sans-serif';
        const txtWidth = ctx.measureText(text).width;
        ctx.fillRect(midX - txtWidth / 2 - 6, midY - 10, txtWidth + 12, 20);
        ctx.strokeRect(midX - txtWidth / 2 - 6, midY - 10, txtWidth + 12, 20);
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(text, midX - txtWidth / 2, midY + 4);
      }
    }

    // 6. Draw Local Node (Phone A) Marker
    {
      const pt = coordsToScreen(myLocation.latitude, myLocation.longitude, width, height);

      // Accuracy ring
      const accuracyRadius = Math.max(16, ((myLocation.accuracy || 10) / 111000) * zoomScale);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.12)'; // sky-400
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, accuracyRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Outer tactical crosshair
      ctx.strokeStyle = '#38bdf8'; // sky-400
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 11, 0, Math.PI * 2);
      ctx.stroke();

      // Crosshair lines
      ctx.beginPath();
      ctx.moveTo(pt.x - 16, pt.y);
      ctx.lineTo(pt.x + 16, pt.y);
      ctx.moveTo(pt.x, pt.y - 16);
      ctx.lineTo(pt.x, pt.y + 16);
      ctx.stroke();

      // Inner solid point
      ctx.fillStyle = '#0284c7'; // sky-600
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.fillStyle = '#bae6fd';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('YOU (LOCAL)', pt.x + 18, pt.y + 4);
    }

    // 7. Draw Remote Node (Phone B) or Last Known Location Marker
    if (targetLoc) {
      const pt = coordsToScreen(targetLoc.latitude, targetLoc.longitude, width, height);
      const isGhost = isLinkLost || !remoteLocation;

      if (isGhost) {
        // Last-Known Location Ghost Marker (tactical dashed halo)
        ctx.strokeStyle = '#ef4444'; // red-500
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
        ctx.fill();

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = '#fca5a5';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`LAST KNOWN: ${targetLoc.nodeId}`, pt.x + 22, pt.y - 4);
        ctx.fillStyle = '#ef4444';
        ctx.font = '10px monospace';
        ctx.fillText(`[LINK LOST]`, pt.x + 22, pt.y + 10);
      } else {
        // Active Remote Node (emerald / amber)
        ctx.strokeStyle = '#10b981'; // emerald-500
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 14, 0, Math.PI * 2);
        ctx.stroke();

        // Pulse ring
        ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
        ctx.fill();

        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = '#a7f3d0';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(targetLoc.nodeId, pt.x + 18, pt.y + 4);
      }
    }

    // 8. Tactical Scale Bar in bottom-left
    {
      const barMeters = 500;
      const barPixels = (barMeters / 111000) * zoomScale;
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(20, height - 20);
      ctx.lineTo(20 + barPixels, height - 20);
      ctx.moveTo(20, height - 25);
      ctx.lineTo(20, height - 15);
      ctx.moveTo(20 + barPixels, height - 25);
      ctx.lineTo(20 + barPixels, height - 15);
      ctx.stroke();

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '10px monospace';
      ctx.fillText(`${barMeters}m OFFLINE SCALE`, 20, height - 30);
    }

    // 9. North Arrow / Compass Rose in top-right
    {
      const cx = width - 36;
      const cy = 40;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Red north needle
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 14);
      ctx.lineTo(cx - 5, cy);
      ctx.lineTo(cx + 5, cy);
      ctx.closePath();
      ctx.fill();

      // White south needle
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(cx, cy + 14);
      ctx.lineTo(cx - 5, cy);
      ctx.lineTo(cx + 5, cy);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('N', cx - 3, cy - 16);
    }
  }, [
    centerLat,
    centerLon,
    zoomScale,
    showTopo,
    showGrid,
    myLocation,
    remoteLocation,
    lastKnownLocation,
    breadcrumbs,
    isLinkLost,
    coordsToScreen,
    screenToCoords,
    metrics,
    targetLoc,
  ]);

  // Touch and Mouse Drag handlers for smooth panning
  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      lat: centerLat,
      lon: centerLon,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    const cosLat = Math.cos((centerLat * Math.PI) / 180);
    const dLon = dx / (zoomScale * cosLat);
    const dLat = dy / zoomScale;

    setCenterLon(dragStart.current.lon - dLon);
    setCenterLat(dragStart.current.lat + dLat);
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  // Format last updated text
  const elapsedSec = Math.max(0, Math.floor((Date.now() - lastContactTime) / 1000));
  const lastUpdatedText =
    elapsedSec < 60 ? `${elapsedSec}s ago` : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s ago`;

  return (
    <div className={`relative w-full h-full bg-slate-900 select-none overflow-hidden ${className}`}>
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
      />

      {/* Top HUD: Distance & Bearing Card */}
      <div className="absolute top-3 left-3 right-16 z-20 pointer-events-none">
        <div className="bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-xl p-3 shadow-xl max-w-md pointer-events-auto">
          {targetLoc ? (
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isLinkLost ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'
                    }`}
                  />
                  {targetLoc.nodeId}
                </span>
                <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  {lastUpdatedText}
                </span>
              </div>

              {metrics && (
                <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-slate-800/80">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">Distance</div>
                    <div className="text-lg font-bold text-white font-mono">{metrics.formattedDistance}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 text-right">Bearing</div>
                    <div className="text-lg font-bold text-sky-400 font-mono text-right flex items-center gap-1">
                      <Navigation
                        className="w-3.5 h-3.5 text-sky-400"
                        style={{ transform: `rotate(${metrics.bearingDegrees}deg)` }}
                      />
                      {metrics.cardinalDirection} ({Math.round(metrics.bearingDegrees)}°)
                    </div>
                  </div>
                </div>
              )}

              {isLinkLost && (
                <div className="mt-2 text-[11px] text-red-400 flex items-center gap-1.5 bg-red-950/40 px-2 py-1 rounded border border-red-800/40">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Showing preserved last known position
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-slate-500" />
              Waiting for remote node location via LoRa...
            </div>
          )}
        </div>
      </div>

      {/* Floating Tactical Map Controls */}
      <div className="absolute right-3 bottom-6 z-20 flex flex-col gap-2 pointer-events-auto">
        <button
          onClick={handleZoomIn}
          title="Zoom In"
          className="w-10 h-10 rounded-xl bg-slate-900/90 text-slate-200 border border-slate-700/80 shadow-lg flex items-center justify-center hover:bg-slate-800 active:scale-95 transition-transform"
        >
          <Plus className="w-5 h-5" />
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom Out"
          className="w-10 h-10 rounded-xl bg-slate-900/90 text-slate-200 border border-slate-700/80 shadow-lg flex items-center justify-center hover:bg-slate-800 active:scale-95 transition-transform"
        >
          <Minus className="w-5 h-5" />
        </button>
        <div className="h-px bg-slate-800 my-0.5" />
        <button
          onClick={handleCenterMe}
          title="Center on My GPS"
          className="w-10 h-10 rounded-xl bg-sky-950/80 text-sky-400 border border-sky-800/80 shadow-lg flex items-center justify-center hover:bg-sky-900 active:scale-95 transition-transform"
        >
          <LocateFixed className="w-5 h-5" />
        </button>
        {targetLoc && (
          <button
            onClick={handleCenterRemote}
            title={isLinkLost ? 'Center on Last Known' : 'Center on Remote Node'}
            className="w-10 h-10 rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 shadow-lg flex items-center justify-center hover:bg-emerald-900 active:scale-95 transition-transform"
          >
            <Compass className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={() => setShowTopo((p) => !p)}
          title="Toggle Topography Contours"
          className={`w-10 h-10 rounded-xl shadow-lg flex items-center justify-center active:scale-95 transition-colors ${
            showTopo
              ? 'bg-amber-950/80 text-amber-400 border border-amber-800/80'
              : 'bg-slate-900/90 text-slate-400 border border-slate-700/80'
          }`}
        >
          <Layers className="w-5 h-5" />
        </button>
      </div>

      {/* Offline Badge Footer */}
      <div className="absolute left-3 bottom-2 text-[10px] text-slate-500 font-mono tracking-wide">
        OFFLINE TACTICAL VECTOR CANVAS · NO INTERNET TILES REQUIRED
      </div>
    </div>
  );
};
