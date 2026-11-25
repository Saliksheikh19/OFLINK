/**
 * OFLINK · Connect Beyond the Network
 * Responsive Multi-Screen Tactical Field Communication Platform
 */

import React, { useState, useEffect } from 'react';
import {
  Home,
  MessageSquare,
  Map as MapIcon,
  Activity,
  AlertTriangle,
  Bluetooth,
  Settings as SettingsIcon,
  Database,
  Info,
  Radio,
  MapPin,
  Compass,
  Layers,
  ChevronRight,
  Shield,
  WifiOff,
  Menu,
  X,
  Send,
  RefreshCw,
} from 'lucide-react';

import { SplashScreen } from './screens/SplashScreen.tsx';
import { HomeDashboardScreen } from './screens/HomeDashboardScreen.tsx';
import { ChatScreen } from './screens/ChatScreen.tsx';
import { MapScreen } from './screens/MapScreen.tsx';
import { LinkStatusScreen } from './screens/LinkStatusScreen.tsx';
import { SosScreen } from './screens/SosScreen.tsx';
import { BleConnectionScreen } from './screens/BleConnectionScreen.tsx';
import { LocationDetailsScreen } from './screens/LocationDetailsScreen.tsx';
import { SettingsScreen } from './screens/SettingsScreen.tsx';
import { LocalBackupScreen } from './screens/LocalBackupScreen.tsx';
import { AboutScreen } from './screens/AboutScreen.tsx';
import { IncomingSosModal } from './components/IncomingSosModal.tsx';
import { PWAInstallButton } from './components/PWAInstallButton.tsx';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';

import { oflinkService } from './services/oflinkService.ts';
import { localDatabase } from './services/storage/localDatabase.ts';
import { locationService } from './services/location/locationService.ts';
import { bleManager } from './services/ble/bleService.ts';
import { SosEvent } from './models/packets.ts';
import { Button } from './components/ui/button.tsx';
import { Badge } from './components/ui/badge.tsx';

export default function App() {
  const [showSplash, setShowSplash] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<string>('home');
  const [showMobileDrawer, setShowMobileDrawer] = useState<boolean>(false);
  const [activeSosEmergency, setActiveSosEmergency] = useState<SosEvent | null>(null);
  const [myCoords, setMyCoords] = useState(() => locationService.getCurrentCoordinates());

  const bleState = oflinkService.getBleState();
  const linkMetrics = oflinkService.getLinkMetrics();
  const settings = localDatabase.getSettings();

  useEffect(() => {
    locationService.startWatching();

    const unsubOF = oflinkService.subscribe(() => {
      setActiveSosEmergency(oflinkService.getActiveSosEmergency());
    });

    const unsubLoc = locationService.subscribe((coords) => {
      setMyCoords(coords);
    });

    const unsubDB = localDatabase.subscribe(() => {
      setActiveSosEmergency(localDatabase.getActiveRemoteSos());
    });

    return () => {
      unsubOF();
      unsubLoc();
      unsubDB();
      locationService.stopWatching();
    };
  }, []);

  if (showSplash) {
    return (
      <div className="w-full min-h-screen bg-[#060911] flex items-center justify-center p-4">
        <div className="w-full max-w-md h-[88vh] bg-slate-950 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
          <SplashScreen onEnter={() => setShowSplash(false)} />
        </div>
      </div>
    );
  }

  const handleAcknowledgeSos = async (id: string) => {
    await oflinkService.acknowledgeRemoteSos(id);
  };

  const handleViewSosOnMap = () => {
    oflinkService.dismissActiveSosAlert();
    setCurrentScreen('map');
  };

  const navItems = [
    { id: 'home', label: 'Command Home', icon: Home },
    { id: 'chat', label: 'Field Comms', icon: MessageSquare },
    { id: 'map', label: 'Tactical Map', icon: MapIcon },
    { id: 'status', label: 'RF Telemetry', icon: Activity },
    { id: 'location', label: 'GNSS Vectors', icon: MapPin },
    { id: 'ble', label: 'BLE Hardware', icon: Bluetooth },
    { id: 'backup', label: 'Local Archive', icon: Database },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
    { id: 'about', label: 'System Info', icon: Info },
  ];

  return (
    <div className="min-h-screen w-full bg-[#060911] text-slate-100 flex flex-col lg:flex-row antialiased selection:bg-sky-500 selection:text-slate-950">
      {/* DESKTOP TACTICAL SIDEBAR (Visible on lg: and up) */}
      <aside className="hidden lg:flex w-72 flex-col justify-between bg-[#0a0f1d] border-r border-slate-800/80 sticky top-0 h-screen p-5 z-30 shrink-0">
        <div className="space-y-6">
          {/* Brand Wordmark & Mode Badge */}
          <div className="pb-4 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-500/20 to-sky-950 border border-sky-500/40 shadow-lg shadow-sky-950/50">
                <Radio className="w-6 h-6 text-sky-400" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/80" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                  OFLINK
                  <Badge variant="pta" className="text-[9px] px-1.5 py-0.5">
                    433 MHz
                  </Badge>
                </h1>
                <p className="text-[11px] text-slate-400 font-medium">Connect Beyond the Network.</p>
              </div>
            </div>

            {/* Offline & PTA Compliance pill */}
            <div className="mt-3.5 flex items-center justify-between text-[11px] font-mono bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1">
                <WifiOff className="w-3 h-3 text-amber-400" />
                100% Offline
              </span>
              <Badge variant="success" className="text-[10px] uppercase">
                PTA COMPLIANT
              </Badge>
            </div>
          </div>

          {/* Navigation Links List */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentScreen === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentScreen(item.id)}
                  className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all duration-150 ${
                    isActive
                      ? 'bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/20'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {isActive ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* High Priority Emergency SOS Trigger Button */}
          <Button
            variant="sos"
            size="lg"
            onClick={() => setCurrentScreen('sos')}
            className="w-full h-12 uppercase tracking-wider text-xs"
          >
            <AlertTriangle className="w-4 h-4 animate-pulse" />
            <span>Emergency SOS Beacon</span>
          </Button>
        </div>

        {/* Sidebar Footer: Hardware & Radio Link Status */}
        <div className="pt-4 border-t border-slate-800/80 space-y-2">
          <div className="bg-slate-950/90 border border-slate-800/80 rounded-xl p-3 text-[11px] font-mono space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 uppercase text-[10px]">Local Transceiver</span>
              <span className="font-bold text-sky-400">{settings.localNodeId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 uppercase text-[10px]">LoRa Signal</span>
              <span className="text-emerald-400 font-bold">{linkMetrics.rssi} dBm</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 uppercase text-[10px]">Packet Delivery</span>
              <span className="text-slate-200 font-bold">{linkMetrics.pdr}% PDR</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 font-mono text-center">
            ESP32 · SX1262 · 433 MHz PTA Band
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT WORKSPACE */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* TOP COMMAND HEADER (Tactical Glass, Ultra-Responsive & Clean) */}
        <header className="sticky top-0 z-40 bg-[#070b16]/95 backdrop-blur-xl border-b border-slate-800/80 px-3 sm:px-6 py-2 flex items-center justify-between gap-2 sm:gap-3">
          {/* Left: Brand lockup */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <button
              onClick={() => setCurrentScreen('home')}
              className="flex items-center gap-2 group text-left shrink-0"
              title="Return to Command Dashboard"
            >
              <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-sky-500/25 to-sky-950 border border-sky-500/40 flex items-center justify-center text-sky-400 shadow-md shadow-sky-950/60">
                <Radio className="w-4 h-4 text-sky-300" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/80" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="text-sm sm:text-base font-black tracking-tight text-white block">
                    OFLINK
                  </span>
                  <Badge variant="pta" className="text-[9px] px-1.5 py-0.5">
                    433 MHz
                  </Badge>
                </div>
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono mt-0.5 block truncate max-w-[120px] sm:max-w-none">
                  {settings.localNodeId} · PTA ISM
                </span>
              </div>
            </button>

            {/* Desktop Screen Breadcrumb Title */}
            <div className="hidden lg:flex items-center gap-2 text-xs font-mono ml-4 pl-4 border-l border-slate-800">
              <span className="text-slate-500">SECTION</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-200 font-bold uppercase tracking-wider">
                {navItems.find((n) => n.id === currentScreen)?.label || currentScreen}
              </span>
            </div>
          </div>

          {/* Center: Live GPS HUD (Desktop & Tablet) */}
          <div className="hidden md:flex items-center gap-3 bg-slate-950/90 border border-slate-800/80 px-3.5 py-1.5 rounded-xl font-mono text-xs">
            <div className="flex items-center gap-1.5 text-slate-400">
              <MapPin className="w-3.5 h-3.5 text-sky-400" />
              <span>GNSS:</span>
              <span className="text-slate-200 font-bold">
                {myCoords.latitude.toFixed(4)}°, {myCoords.longitude.toFixed(4)}°
              </span>
            </div>
            <span className="text-slate-600">|</span>
            <span className="text-emerald-400 font-bold">
              ±{Math.round(myCoords.accuracy || 5)}m
            </span>
          </div>

          {/* Right: Tactile Mobile & Desktop Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* In-App PWA Install Button */}
            <PWAInstallButton />

            {/* Quick Emergency SOS Pill Button (Prominent in Header on ALL screens) */}
            <Button
              variant="sos"
              size="sm"
              onClick={() => setCurrentScreen('sos')}
              title="Instant Distress Beacon"
              className={`h-8 sm:h-9 px-2.5 sm:px-3 text-xs tracking-wider ${
                currentScreen === 'sos'
                  ? 'border-white ring-2 ring-red-500/50'
                  : activeSosEmergency
                  ? 'emergency-glow animate-pulse'
                  : ''
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 animate-pulse shrink-0" />
              <span className="font-extrabold tracking-widest text-[11px] sm:text-xs">SOS</span>
            </Button>

            {/* BLE Status Button (Compact on mobile) */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentScreen('ble')}
              title={`BLE: ${bleState}`}
              className={`h-8 sm:h-9 px-2 sm:px-2.5 text-xs font-mono gap-1.5 ${
                bleState === 'CONNECTED'
                  ? 'bg-slate-900/90 text-slate-200 border-slate-800'
                  : 'bg-amber-950/80 text-amber-300 border-amber-800'
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    bleState === 'CONNECTED' ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    bleState === 'CONNECTED' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
              </span>
              <Bluetooth className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline text-[11px] font-bold">{bleState}</span>
            </Button>

            {/* Mobile Drawer Menu Button (Tactical Grid / Hamburger) */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowMobileDrawer(true)}
              title="Open Tactical Menu"
              className="lg:hidden h-8 w-8 sm:h-9 sm:w-9 bg-slate-900 border-slate-800 text-slate-300 hover:text-white"
            >
              <Menu className="w-4 h-4 text-sky-400" />
            </Button>

            {/* Desktop Settings Shortcut */}
            <Button
              variant={currentScreen === 'settings' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setCurrentScreen('settings')}
              title="Settings & Hardware"
              className="hidden sm:flex h-9 w-9"
            >
              <SettingsIcon className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* ACTIVE SOS EMERGENCY BANNER (Fixed Priority) */}
        {activeSosEmergency && activeSosEmergency.status === 'ACTIVE' && (
          <div className="bg-red-600 text-white px-3 sm:px-4 py-2 flex items-center justify-between text-xs font-bold animate-pulse z-30 shadow-lg">
            <div className="flex items-center gap-2 truncate">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="truncate">CRITICAL DISTRESS SIGNAL: {activeSosEmergency.nodeId}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setCurrentScreen('map')}
                className="underline hover:text-red-100 text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded bg-black/20"
              >
                MAP
              </button>
              <button
                onClick={() => handleAcknowledgeSos(activeSosEmergency.id)}
                className="bg-black/40 hover:bg-black/60 px-2 sm:px-2.5 py-0.5 rounded text-[10px] sm:text-[11px] font-mono font-bold"
              >
                ACK
              </button>
            </div>
          </div>
        )}

        {/* PRIMARY VIEWPORT: Responsive Container */}
        <main className="flex-1 p-3 sm:p-5 lg:p-8 w-full max-w-7xl mx-auto overflow-x-hidden pb-20 lg:pb-8">
          {currentScreen === 'home' && <HomeDashboardScreen onNavigate={setCurrentScreen} />}
          {currentScreen === 'chat' && (
            <ChatScreen
              onNavigateToMap={() => setCurrentScreen('map')}
              onNavigateToBle={() => setCurrentScreen('ble')}
            />
          )}
          {currentScreen === 'map' && <MapScreen />}
          {currentScreen === 'status' && (
            <LinkStatusScreen
              onNavigateToMap={() => setCurrentScreen('map')}
              onNavigateToSettings={() => setCurrentScreen('settings')}
            />
          )}
          {currentScreen === 'sos' && <SosScreen />}
          {currentScreen === 'ble' && <BleConnectionScreen />}
          {currentScreen === 'location' && (
            <LocationDetailsScreen onNavigateToMap={() => setCurrentScreen('map')} />
          )}
          {currentScreen === 'settings' && <SettingsScreen />}
          {currentScreen === 'backup' && <LocalBackupScreen />}
          {currentScreen === 'about' && <AboutScreen />}
        </main>

        {/* MOBILE BOTTOM NAVIGATION BAR (Raised Tactical Floating Center SOS Beacon) */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#070b16]/95 backdrop-blur-2xl border-t border-slate-800/80 px-2 py-1 shadow-2xl">
          <div className="grid grid-cols-5 items-center justify-items-center h-15 max-w-md mx-auto relative">
            {/* Tab 1: Home */}
            <button
              onClick={() => setCurrentScreen('home')}
              className={`w-full min-h-[44px] flex flex-col items-center justify-center transition-all ${
                currentScreen === 'home'
                  ? 'text-sky-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`p-1 rounded-xl transition-all ${
                  currentScreen === 'home' ? 'bg-sky-500/20 text-sky-300' : ''
                }`}
              >
                <Home className="w-5 h-5" />
              </div>
              <span className="text-[10px] tracking-tight font-medium mt-0.5">Home</span>
              {currentScreen === 'home' && (
                <span className="w-1.5 h-1 rounded-full bg-sky-400 mt-0.5 shadow-sm shadow-sky-400" />
              )}
            </button>

            {/* Tab 2: Chat */}
            <button
              onClick={() => setCurrentScreen('chat')}
              className={`w-full min-h-[44px] flex flex-col items-center justify-center transition-all ${
                currentScreen === 'chat'
                  ? 'text-sky-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`p-1 rounded-xl transition-all ${
                  currentScreen === 'chat' ? 'bg-sky-500/20 text-sky-300' : ''
                }`}
              >
                <MessageSquare className="w-5 h-5" />
              </div>
              <span className="text-[10px] tracking-tight font-medium mt-0.5">Chat</span>
              {currentScreen === 'chat' && (
                <span className="w-1.5 h-1 rounded-full bg-sky-400 mt-0.5 shadow-sm shadow-sky-400" />
              )}
            </button>

            {/* Tab 3: CENTER ELEVATED FLOATING TACTICAL SOS BEACON */}
            <div className="relative -top-4 flex flex-col items-center">
              <div className="relative flex items-center justify-center">
                {/* Ambient Ripple Ring */}
                <span className="absolute -inset-2 rounded-full bg-red-600/30 beacon-ripple-ring pointer-events-none" />

                <button
                  onClick={() => setCurrentScreen('sos')}
                  title="Priority SOS Distress Beacon"
                  className={`relative w-13 h-13 rounded-full flex flex-col items-center justify-center text-white shadow-xl active:scale-90 transition-transform select-none border-2 ${
                    currentScreen === 'sos'
                      ? 'bg-gradient-to-tr from-red-600 via-rose-600 to-red-500 border-white ring-4 ring-red-500/40 shadow-red-600/70'
                      : activeSosEmergency
                      ? 'bg-red-600 border-yellow-300 emergency-glow shadow-red-950 animate-pulse'
                      : 'bg-gradient-to-tr from-red-700 via-red-600 to-rose-600 hover:from-red-600 hover:to-rose-500 border-red-400/90 shadow-red-950/90'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5 text-white animate-pulse" />
                  <span className="text-[8px] font-black tracking-widest uppercase leading-none mt-0.5">
                    SOS
                  </span>
                </button>
              </div>
              <span
                className={`text-[9px] font-bold tracking-tight mt-0.5 ${
                  currentScreen === 'sos' ? 'text-red-400' : 'text-slate-400'
                }`}
              >
                Emergency
              </span>
            </div>

            {/* Tab 4: Map */}
            <button
              onClick={() => setCurrentScreen('map')}
              className={`w-full min-h-[44px] flex flex-col items-center justify-center transition-all ${
                currentScreen === 'map'
                  ? 'text-sky-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`p-1 rounded-xl transition-all ${
                  currentScreen === 'map' ? 'bg-sky-500/20 text-sky-300' : ''
                }`}
              >
                <MapIcon className="w-5 h-5" />
              </div>
              <span className="text-[10px] tracking-tight font-medium mt-0.5">Map</span>
              {currentScreen === 'map' && (
                <span className="w-1.5 h-1 rounded-full bg-sky-400 mt-0.5 shadow-sm shadow-sky-400" />
              )}
            </button>

            {/* Tab 5: Menu / More */}
            <button
              onClick={() => setShowMobileDrawer(true)}
              className="w-full min-h-[44px] flex flex-col items-center justify-center transition-all text-slate-400 hover:text-slate-200"
            >
              <div className="p-1 rounded-xl">
                <Menu className="w-5 h-5 text-slate-300" />
              </div>
              <span className="text-[10px] tracking-tight font-medium mt-0.5">Menu</span>
            </button>
          </div>
        </nav>

        {/* TACTICAL MOBILE SLIDE-OVER DRAWER (Complete System Navigation) */}
        {showMobileDrawer && (
          <div className="fixed inset-0 z-50 lg:hidden flex justify-end">
            {/* Backdrop Overlay */}
            <div
              onClick={() => setShowMobileDrawer(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in transition-opacity"
            />

            {/* Drawer Content */}
            <div className="relative w-4/5 max-w-sm h-full bg-[#0a0f1e] border-l border-slate-800/90 shadow-2xl flex flex-col justify-between p-5 z-10 overflow-y-auto">
              <div className="space-y-5">
                {/* Drawer Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-sky-950 border border-sky-800 flex items-center justify-center text-sky-400">
                      <Radio className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-black text-white font-mono">OFLINK TERMINAL</div>
                      <div className="text-[10px] text-emerald-400 font-mono">
                        PTA 433 MHz · {settings.localNodeId}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowMobileDrawer(false)}
                    className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Quick SOS Trigger in Drawer */}
                <button
                  onClick={() => {
                    setCurrentScreen('sos');
                    setShowMobileDrawer(false);
                  }}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-red-950/80 border border-red-500"
                >
                  <AlertTriangle className="w-4 h-4 animate-pulse" />
                  <span>EMERGENCY SOS BEACON</span>
                </button>

                {/* Navigation Items */}
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-mono text-slate-500 px-2 pb-1">
                    System Navigation
                  </div>
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentScreen === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setCurrentScreen(item.id);
                          setShowMobileDrawer(false);
                        }}
                        className={`w-full min-h-[44px] px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${
                          isActive
                            ? 'bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-500/20'
                            : 'text-slate-300 hover:text-white hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon
                            className={`w-4 h-4 ${
                              isActive ? 'text-slate-950' : 'text-slate-400'
                            }`}
                          />
                          <span>{item.label}</span>
                        </div>
                        <ChevronRight
                          className={`w-3.5 h-3.5 ${
                            isActive ? 'text-slate-950' : 'text-slate-600'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                {/* Quick Simulation Shortcuts in Drawer */}
                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                  <div className="text-[10px] uppercase font-mono text-slate-500 px-2">
                    Field Simulation Tools
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <button
                      onClick={() => {
                        bleManager.injectIncomingMessage('PTA 433 MHz comms verified. Link clear.');
                        setShowMobileDrawer(false);
                      }}
                      className="h-9 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center justify-center gap-1 text-[11px]"
                    >
                      <Send className="w-3 h-3 text-sky-400" />
                      Sim Msg
                    </button>
                    <button
                      onClick={() => {
                        const base = localDatabase.getLastKnownLocation() || {
                          latitude: 24.8645,
                          longitude: 67.0085,
                        };
                        bleManager.injectIncomingLocation(
                          base.latitude + (Math.random() * 0.002 - 0.001),
                          base.longitude + (Math.random() * 0.002 - 0.001)
                        );
                        setShowMobileDrawer(false);
                      }}
                      className="h-9 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center justify-center gap-1 text-[11px]"
                    >
                      <MapPin className="w-3 h-3 text-emerald-400" />
                      Sim Move
                    </button>
                  </div>
                </div>
              </div>

              {/* Drawer Footer Status */}
              <div className="pt-4 border-t border-slate-800 text-xs font-mono text-slate-400 space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span>PTA Band:</span>
                  <span className="text-emerald-400 font-bold">433.050 - 434.790 MHz</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>100% Offline:</span>
                  <span className="text-slate-200">No Cellular / No WiFi</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* High Priority Incoming SOS Alert Modal */}
      <IncomingSosModal
        sosEvent={activeSosEmergency}
        myLocation={myCoords}
        onAcknowledge={handleAcknowledgeSos}
        onViewOnMap={handleViewSosOnMap}
        onDismiss={() => oflinkService.dismissActiveSosAlert()}
      />

      {/* Offline Cached Mode Indicator */}
      <OfflineIndicator />
    </div>
  );
}
