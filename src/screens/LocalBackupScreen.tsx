import React, { useState, useEffect } from 'react';
import {
  Database,
  Download,
  Upload,
  HardDrive,
  Trash2,
  Check,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Radio,
  WifiOff,
} from 'lucide-react';
import { localDatabase } from '../services/storage/localDatabase.ts';

export const LocalBackupScreen: React.FC = () => {
  const [messagesCount, setMessagesCount] = useState(0);
  const [locationsCount, setLocationsCount] = useState(0);
  const [breadcrumbsCount, setBreadcrumbsCount] = useState(0);
  const [logsCount, setLogsCount] = useState(0);
  const [settings, setSettings] = useState(() => localDatabase.getSettings());
  const [exportNotice, setExportNotice] = useState(false);
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);

  useEffect(() => {
    const updateStats = () => {
      setMessagesCount(localDatabase.getMessages().length);
      setLocationsCount(localDatabase.getLocations().length);
      setBreadcrumbsCount(localDatabase.getBreadcrumbs().length);
      setLogsCount(localDatabase.getLinkLogs().length);
      setSettings(localDatabase.getSettings());
    };

    updateStats();
    const unsubDB = localDatabase.subscribe(updateStats);
    return () => unsubDB();
  }, []);

  const handleExportBackup = () => {
    const json = localDatabase.exportDatabaseToJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OFLINK_Offline_Archive_${settings.localNodeId}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportNotice(true);
    setTimeout(() => setExportNotice(false), 3000);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = localDatabase.importDatabaseFromJson(content);
        if (success) {
          setRestoreNotice('Offline archive restored successfully into local storage!');
        } else {
          setRestoreNotice('Failed to parse archive JSON file.');
        }
        setTimeout(() => setRestoreNotice(null), 4000);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            Local Data & Archive
          </h2>
          <p className="text-xs text-slate-400">
            100% on-device local storage · Zero cloud or external database dependency
          </p>
        </div>

        <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-3 py-1 rounded-xl text-xs font-mono font-bold">
          <WifiOff className="w-3.5 h-3.5" /> AIR-GAPPED
        </span>
      </div>

      {/* Zero Internet / Zero Cloud Guarantee Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center gap-2.5 text-white font-bold text-sm">
          <ShieldCheck className="w-5 h-5 text-sky-400" />
          <span className="uppercase tracking-wider">Independent Local Operation</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          OFLINK stores every message, GNSS coordinate fix, emergency breadcrumb, and link telemetry log
          strictly on the device's local database. No MongoDB, no cloud servers, and no cellular connection
          are ever queried or required.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 font-mono text-xs">
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Zero Cellular / 4G / 5G</span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Zero Wi-Fi / Internet</span>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Zero MongoDB / Cloud</span>
          </div>
        </div>
      </div>

      {/* Local Storage Telemetry Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Local Database Storage Health
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Node: <strong className="text-sky-400">{settings.localNodeId}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block">Chat Messages</span>
            <span className="text-2xl font-black text-white mt-1 block">{messagesCount}</span>
            <span className="text-[10px] text-slate-400 mt-1 block">Local P2P text</span>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block">GNSS Fixes</span>
            <span className="text-2xl font-black text-sky-400 mt-1 block">{locationsCount}</span>
            <span className="text-[10px] text-slate-400 mt-1 block">Internal GNSS</span>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block">Breadcrumbs</span>
            <span className="text-2xl font-black text-amber-400 mt-1 block">{breadcrumbsCount}</span>
            <span className="text-[10px] text-slate-400 mt-1 block">Trail history</span>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block">Link Telemetry</span>
            <span className="text-2xl font-black text-emerald-400 mt-1 block">{logsCount}</span>
            <span className="text-[10px] text-slate-400 mt-1 block">LoRa RF snapshots</span>
          </div>
        </div>

        {/* Notices */}
        {exportNotice && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-800 rounded-xl text-xs text-emerald-200 font-mono flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Offline JSON archive saved to local storage download folder.</span>
          </div>
        )}

        {restoreNotice && (
          <div className="p-3 bg-sky-950/80 border border-sky-800 rounded-xl text-xs text-sky-200 font-mono flex items-center gap-2">
            <Check className="w-4 h-4 text-sky-400 shrink-0" />
            <span>{restoreNotice}</span>
          </div>
        )}

        {/* Export & Import Actions */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportBackup}
            className="h-11 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold font-mono flex items-center gap-2 active:scale-95 transition-all shadow-lg shadow-sky-950/50"
          >
            <Download className="w-4 h-4" />
            <span>EXPORT LOCAL ARCHIVE (JSON)</span>
          </button>

          <label className="h-11 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold font-mono flex items-center gap-2 border border-slate-700 active:scale-95 transition-all cursor-pointer">
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>RESTORE ARCHIVE FILE</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Storage Reset Maintenance */}
      <div className="bg-slate-900 border border-red-900/40 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center gap-2 text-red-400 font-bold text-sm uppercase tracking-wider">
          <Trash2 className="w-4 h-4" />
          <span>Local Storage Wipe</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Erase all locally cached messages, location logs, and breadcrumb trails to prepare for a new field exercise.
        </p>
        <button
          onClick={() => {
            if (window.confirm('Wipe all local session data from device? This cannot be undone.')) {
              localDatabase.wipeAllData();
            }
          }}
          className="px-4 py-2 rounded-xl bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800 text-xs font-mono font-bold transition-colors"
        >
          WIPE ON-DEVICE DATA
        </button>
      </div>
    </div>
  );
};
