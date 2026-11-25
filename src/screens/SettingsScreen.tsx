import React, { useState, useEffect } from 'react';
import {
  Save,
  RotateCcw,
  Sliders,
  Bluetooth,
  Radio,
  MapPin,
  Clock,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { localDatabase } from '../services/storage/localDatabase.ts';
import { DEFAULT_SETTINGS, OFLinkSettings } from '../config/oflinkConfig.ts';
import { androidPermissionsManager, AndroidPermissionState } from '../services/permissions/androidPermissions.ts';
import { Button } from '../components/ui/button.tsx';
import { Input } from '../components/ui/input.tsx';
import { Card } from '../components/ui/card.tsx';
import { Badge } from '../components/ui/badge.tsx';

export const SettingsScreen: React.FC = () => {
  const [form, setForm] = useState<OFLinkSettings>(() => localDatabase.getSettings());
  const [permissions, setPermissions] = useState<AndroidPermissionState>(() =>
    androidPermissionsManager.getPermissions()
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const unsubPerms = androidPermissionsManager.subscribe((p) => setPermissions(p));
    return () => unsubPerms();
  }, []);

  const handleChange = (field: keyof OFLinkSettings, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    localDatabase.updateSettings(form);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset all OFLINK settings to factory defaults?')) {
      setForm({ ...DEFAULT_SETTINGS });
      localDatabase.updateSettings({ ...DEFAULT_SETTINGS });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            Settings & Hardware
          </h2>
          <p className="text-xs text-slate-400">
            Node identifiers, BLE UUIDs, signal thresholds, and tracking rules
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleResetDefaults}
            title="Reset to defaults"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button
            variant={savedSuccess ? 'default' : 'default'}
            onClick={handleSave}
            className="gap-1.5 font-bold text-xs"
          >
            {savedSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{savedSuccess ? 'SAVED' : 'SAVE CONFIG'}</span>
          </Button>
        </div>
      </div>

      {/* 1. Node Identifiers */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-wider font-mono">
          <Radio className="w-4 h-4 text-sky-400" />
          <span>Node Identifiers</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-mono uppercase text-slate-400 block mb-1">
              Local Node Identifier (This Phone)
            </label>
            <Input
              type="text"
              value={form.localNodeId}
              onChange={(e) => handleChange('localNodeId', e.target.value.toUpperCase())}
              className="font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase text-slate-400 block mb-1">
              Target Remote Node Identifier
            </label>
            <Input
              type="text"
              value={form.targetNodeId}
              onChange={(e) => handleChange('targetNodeId', e.target.value.toUpperCase())}
              className="font-mono"
            />
          </div>
        </div>
      </Card>

      {/* Transmission Protocol & Mesh Relay */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-wider font-mono">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <span>Packet Framing & Multi-Device Sync</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-mono uppercase text-slate-400 block mb-1">
              Transmission Format
            </label>
            <select
              value={form.transmissionFormat || 'AUTO'}
              onChange={(e) => handleChange('transmissionFormat', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
            >
              <option value="AUTO">JSON (ESP32 — ends with &apos;&#125;&apos;, no \n)</option>
              <option value="JSON">JSON + \n (Newline-delimited JSON)</option>
              <option value="PLAIN_TEXT">PIPE Format (TYPE|ID|PAYLOAD\n)</option>
            </select>
            <span className="text-[10px] text-slate-500 block mt-1">
              Default &quot;JSON (ESP32)&quot; matches bleBuffer.startsWith(&quot;&#123;&quot;) &amp;&amp; bleBuffer.endsWith(&quot;&#125;&quot;).
            </span>
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase text-slate-400 block mb-1">
              Web Mesh Relay (WiFi Fallback Sync)
            </label>
            <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-xl">
              <span className="text-xs text-slate-300">WiFi relay when no BLE hardware is connected</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(form.webRelayEnabled)}
                  onChange={(e) => handleChange('webRelayEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
            <span className="text-[10px] text-slate-500 block mt-1">
              Automatically bypassed whenever real ESP32 BLE hardware is connected so you test pure LoRa.
            </span>
          </div>
        </div>
      </Card>

      {/* 2. Configurable BLE UUIDs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-wider">
            <Bluetooth className="w-4 h-4 text-sky-400" />
            <span>BLE GATT Service & Characteristic UUIDs</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setForm((prev) => ({
                ...prev,
                serviceUuid: '6d7f1000-7c8a-4d91-9b61-1b632fcb1234',
                txCharacteristicUuid: '6d7f1001-7c8a-4d91-9b61-1b632fcb1234',
                rxCharacteristicUuid: '6d7f1002-7c8a-4d91-9b61-1b632fcb1234',
                loraFrequencyMhz: 433.05,
                loraCodingRate: '4/7',
                loraTxPowerDbm: 10,
              }));
            }}
            className="text-[11px] h-7 px-2.5 text-sky-400 border-sky-800 hover:bg-sky-950/60"
          >
            Load .env UUIDs (6d7f1000)
          </Button>
        </div>

        <div className="space-y-3 font-mono text-xs">
          <div>
            <label className="text-[11px] uppercase text-slate-400 block mb-1">SERVICE_UUID</label>
            <input
              type="text"
              value={form.serviceUuid}
              onChange={(e) => handleChange('serviceUuid', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-sky-300 focus:border-sky-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] uppercase text-slate-400 block mb-1">
              TX_CHARACTERISTIC_UUID (App to ESP32)
            </label>
            <input
              type="text"
              value={form.txCharacteristicUuid}
              onChange={(e) => handleChange('txCharacteristicUuid', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-emerald-300 focus:border-sky-500 outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] uppercase text-slate-400 block mb-1">
              RX_CHARACTERISTIC_UUID (ESP32 to App)
            </label>
            <input
              type="text"
              value={form.rxCharacteristicUuid}
              onChange={(e) => handleChange('rxCharacteristicUuid', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-300 focus:border-sky-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* 3. Configurable Signal Quality Thresholds */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-wider">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <span>Signal Quality Thresholds (Configurable)</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Customize the limits that categorize signal health into Good, Fair, or Weak.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
            <span className="text-[10px] text-slate-400 uppercase block">RSSI Limits (dBm)</span>
            <div className="flex items-center justify-between">
              <span className="text-emerald-400">Good &ge;</span>
              <input
                type="number"
                value={form.rssiGoodThreshold}
                onChange={(e) => handleChange('rssiGoodThreshold', Number(e.target.value))}
                className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right text-white"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-amber-400">Fair &ge;</span>
              <input
                type="number"
                value={form.rssiFairThreshold}
                onChange={(e) => handleChange('rssiFairThreshold', Number(e.target.value))}
                className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right text-white"
              />
            </div>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
            <span className="text-[10px] text-slate-400 uppercase block">SNR Limits (dB)</span>
            <div className="flex items-center justify-between">
              <span className="text-emerald-400">Good &ge;</span>
              <input
                type="number"
                step="0.5"
                value={form.snrGoodThreshold}
                onChange={(e) => handleChange('snrGoodThreshold', Number(e.target.value))}
                className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right text-white"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-amber-400">Fair &ge;</span>
              <input
                type="number"
                step="0.5"
                value={form.snrFairThreshold}
                onChange={(e) => handleChange('snrFairThreshold', Number(e.target.value))}
                className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right text-white"
              />
            </div>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
            <span className="text-[10px] text-slate-400 uppercase block">PDR Limits (%)</span>
            <div className="flex items-center justify-between">
              <span className="text-emerald-400">Good &ge;</span>
              <input
                type="number"
                value={form.pdrGoodThreshold}
                onChange={(e) => handleChange('pdrGoodThreshold', Number(e.target.value))}
                className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right text-white"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-amber-400">Fair &ge;</span>
              <input
                type="number"
                value={form.pdrFairThreshold}
                onChange={(e) => handleChange('pdrFairThreshold', Number(e.target.value))}
                className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right text-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Tracking & Link Lost Timeout */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-wider">
          <Clock className="w-4 h-4 text-amber-400" />
          <span>Link Loss & Breadcrumb Rules</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div>
            <label className="text-[11px] uppercase text-slate-400 block mb-1">
              Link Lost Timeout (Seconds)
            </label>
            <input
              type="number"
              value={form.linkLostTimeoutSec}
              onChange={(e) => handleChange('linkLostTimeoutSec', Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            />
            <span className="text-[10px] text-slate-500 block mt-1">Default: 60s</span>
          </div>

          <div>
            <label className="text-[11px] uppercase text-slate-400 block mb-1">
              Breadcrumb Movement Threshold (Meters)
            </label>
            <input
              type="number"
              value={form.breadcrumbDistanceMeters}
              onChange={(e) => handleChange('breadcrumbDistanceMeters', Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            />
            <span className="text-[10px] text-slate-500 block mt-1">Default: 25m</span>
          </div>

          <div>
            <label className="text-[11px] uppercase text-slate-400 block mb-1">
              Breadcrumb Max Interval (Seconds)
            </label>
            <input
              type="number"
              value={form.breadcrumbIntervalSec}
              onChange={(e) => handleChange('breadcrumbIntervalSec', Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            />
            <span className="text-[10px] text-slate-500 block mt-1">Default: 30s</span>
          </div>
        </div>
      </div>

      {/* 5. LoRa RF Hardware & PTA 433MHz Regulation Configuration */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-wider">
            <Radio className="w-4 h-4 text-emerald-400" />
            <span>LoRa Physical RF & PTA 433 MHz Compliance</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2.5 py-0.5 rounded">
            PTA COMPLIANT
          </span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Configured for the Pakistan Telecommunication Authority (PTA) license-free ISM short-range device band (433.05 - 434.79 MHz).
        </p>

        <div className="space-y-3 font-mono text-xs">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] uppercase text-slate-400">Carrier Frequency (MHz)</label>
              <span className="text-[10px] text-slate-400">PTA Band: 433.05 - 434.79 MHz</span>
            </div>
            <input
              type="number"
              step="0.025"
              value={form.loraFrequencyMhz}
              onChange={(e) => handleChange('loraFrequencyMhz', Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-emerald-300 font-bold focus:border-emerald-500 outline-none"
            />

            {/* Quick PTA Frequency Presets */}
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[10px] text-slate-400">Presets:</span>
              {[
                { label: '433.0 MHz', val: 433.0 },
                { label: '433.175 MHz (Center)', val: 433.175 },
                { label: '433.375 MHz', val: 433.375 },
                { label: '433.5 MHz', val: 433.5 },
              ].map((p) => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => handleChange('loraFrequencyMhz', p.val)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                    form.loraFrequencyMhz === p.val
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            <div>
              <label className="text-[10px] uppercase text-slate-400 block mb-1">TX Power (dBm)</label>
              <input
                type="number"
                value={form.loraTxPowerDbm}
                onChange={(e) => handleChange('loraTxPowerDbm', Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white"
              />
              <span className="text-[9px] text-slate-400 block mt-0.5">PTA max +14 dBm</span>
            </div>

            <div>
              <label className="text-[10px] uppercase text-slate-400 block mb-1">Spreading Factor</label>
              <select
                value={form.loraSpreadingFactor}
                onChange={(e) => handleChange('loraSpreadingFactor', Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-white outline-none"
              >
                {[7, 8, 9, 10, 11, 12].map((sf) => (
                  <option key={sf} value={sf}>
                    SF{sf}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase text-slate-400 block mb-1">Bandwidth (kHz)</label>
              <select
                value={form.loraBandwidthKhz}
                onChange={(e) => handleChange('loraBandwidthKhz', Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-white outline-none"
              >
                <option value={125}>125 kHz (Standard)</option>
                <option value={250}>250 kHz</option>
                <option value={500}>500 kHz</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase text-slate-400 block mb-1">Coding Rate</label>
              <select
                value={form.loraCodingRate}
                onChange={(e) => handleChange('loraCodingRate', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-white outline-none"
              >
                <option value="4/5">4/5</option>
                <option value="4/6">4/6</option>
                <option value="4/7">4/7</option>
                <option value="4/8">4/8</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Android Permissions Inspector */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4 text-sky-400" />
          <span>Android Permissions Status</span>
        </div>
        <p className="text-xs text-slate-400">
          OFLINK handles permissions safely and provides friendly degradation without crashing if denied.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono pt-1">
          {Object.entries(permissions).map(([key, status]) => (
            <div
              key={key}
              className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between"
            >
              <span className="text-slate-300 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
              <button
                onClick={() => androidPermissionsManager.togglePermission(key as any)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors ${
                  status === 'GRANTED'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-red-950 text-red-400 border border-red-800'
                }`}
              >
                {status}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
