import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Shield,
  HardDrive,
  MessageSquare,
  Cpu,
  Trash2,
  Check,
  AlertTriangle,
  RefreshCw,
  Sun,
  Moon,
  Monitor,
  FolderOpen,
  Sparkles
} from 'lucide-react';
import { AppSettings, StorageInfo, SystemDiagnostic, OllamaStatus, HardwareInfo } from '../../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  ollamaStatus: OllamaStatus | null;
  onClearHistory: () => void;
  diagnostics: SystemDiagnostic | null;
  onRefreshDiagnostics: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSetting,
  ollamaStatus,
  onClearHistory,
  diagnostics,
  onRefreshDiagnostics
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'chat' | 'privacy' | 'storage'>('general');
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo | null>(null);

  useEffect(() => {
    if (isOpen) {
      window.snvAi?.db?.getStorageInfo().then(setStorageInfo).catch(console.error);
      window.snvAi?.hardware?.getInfo?.().then(setHardwareInfo).catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'general' as const, label: 'General', icon: Sliders },
    { id: 'ai' as const, label: 'Hardware & AI', icon: Cpu },
    { id: 'chat' as const, label: 'Chat & Prompts', icon: MessageSquare },
    { id: 'privacy' as const, label: 'Privacy', icon: Shield },
    { id: 'storage' as const, label: 'Storage & Files', icon: HardDrive }
  ];

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(2)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-2xl bg-[#131722] border border-slate-800 rounded-2xl shadow-2xl flex flex-col h-[600px] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Settings</h2>
              <p className="text-[11px] text-slate-400">Configure application, local AI models, and data storage</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content with Tab Sidebar */}
        <div className="flex-1 flex overflow-hidden">
          {/* Tab List */}
          <div className="w-48 bg-[#0e111a] border-r border-slate-800 p-3 space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[#1a2133] text-emerald-400 border border-slate-700/60 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Panels */}
          <div className="flex-1 p-6 overflow-y-auto bg-[#131722] text-xs">
            {/* GENERAL TAB */}
            {activeTab === 'general' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-2">Theme Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'dark', label: 'Dark Mode', icon: Moon },
                      { id: 'light', label: 'Light Mode', icon: Sun },
                      { id: 'system', label: 'System Default', icon: Monitor }
                    ].map((th) => {
                      const Icon = th.icon;
                      const isSel = settings.theme === th.id;
                      return (
                        <button
                          key={th.id}
                          onClick={() => onSaveSetting('theme', th.id as any)}
                          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                            isSel
                              ? 'bg-emerald-600/20 border-emerald-500/60 text-emerald-300'
                              : 'bg-[#181d2c] border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{th.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-200">Start with Windows</div>
                      <div className="text-[11px] text-slate-500">
                        Automatically launch SNV AI when your computer boots up
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.startWithWindows}
                      onChange={(e) => onSaveSetting('startWithWindows', e.target.checked)}
                      className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* HARDWARE & AI TAB */}
            {activeTab === 'ai' && (
              <div className="space-y-4">
                {/* Hardware card */}
                {hardwareInfo && (
                  <div className="p-3.5 rounded-xl bg-[#181e2e] border border-slate-700/60 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-200">Detected Hardware</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                        {hardwareInfo.deviceType}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500 block">GPU:</span>
                        <span className="text-slate-200 font-medium truncate block">{hardwareInfo.gpuName}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">VRAM:</span>
                        <span className="text-slate-200 font-medium">{hardwareInfo.vramGB} GB Dedicated</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">CPU:</span>
                        <span className="text-slate-200 font-medium truncate block">{hardwareInfo.cpuModel}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">System RAM:</span>
                        <span className="text-slate-200 font-medium">{hardwareInfo.ramGB} GB ({hardwareInfo.freeRamGB} GB free)</span>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">Local Ollama API Endpoint</label>
                  <input
                    type="text"
                    value={settings.ollamaUrl}
                    onChange={(e) => onSaveSetting('ollamaUrl', e.target.value)}
                    className="w-full px-3 py-2 bg-[#181d2c] border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                    placeholder="http://127.0.0.1:11434"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Default local loopback endpoint for Ollama runtime.
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-200">Temperature: {settings.temperature}</label>
                    <span className="text-[11px] text-slate-500">
                      {settings.temperature < 0.4 ? 'Precise' : settings.temperature > 0.8 ? 'Creative' : 'Balanced'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.temperature}
                    onChange={(e) => onSaveSetting('temperature', parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">Max Generation Length (Tokens)</label>
                  <input
                    type="number"
                    value={settings.maxTokens}
                    onChange={(e) => onSaveSetting('maxTokens', parseInt(e.target.value, 10) || 2048)}
                    className="w-full px-3 py-2 bg-[#181d2c] border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* CHAT TAB */}
            {activeTab === 'chat' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-slate-800/80">
                  <div>
                    <div className="font-semibold text-slate-200">Enter to Send</div>
                    <div className="text-[11px] text-slate-500">
                      Press Enter to send a message, Shift + Enter for a newline
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enterToSend}
                    onChange={(e) => onSaveSetting('enterToSend', e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-800/80">
                  <div>
                    <div className="font-semibold text-slate-200">Show Timestamps</div>
                    <div className="text-[11px] text-slate-500">
                      Display time next to each conversation message
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.showTimestamps}
                    onChange={(e) => onSaveSetting('showTimestamps', e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-semibold text-slate-200">Save Chat History</div>
                    <div className="text-[11px] text-slate-500">
                      Persist conversation history into local SQLite database
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.saveHistory}
                    onChange={(e) => onSaveSetting('saveHistory', e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* PRIVACY TAB */}
            {activeTab === 'privacy' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-1">
                    <Shield className="w-4 h-4" />
                    <span>Your Privacy Guarantee</span>
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    Your conversations, generated images, uploaded documents, and vision analysis are processed 100% locally on your computer.
                    SNV AI makes NO requests to OpenAI, Google, Anthropic, or any remote telemetry servers.
                  </p>
                </div>

                <div className="flex items-center justify-between py-3 border-t border-slate-800/80">
                  <div>
                    <div className="font-semibold text-slate-200">Strict Offline Mode</div>
                    <div className="text-[11px] text-slate-500">
                      Completely blocks external network calls, external API queries, or online lookups
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.strictOfflineMode}
                    onChange={(e) => onSaveSetting('strictOfflineMode', e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* STORAGE TAB */}
            {activeTab === 'storage' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-xl bg-[#181d2c] border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-mono mb-1">Chats</div>
                    <div className="text-base font-bold text-slate-100">{storageInfo?.chatsCount ?? 0}</div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#181d2c] border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-mono mb-1">Messages</div>
                    <div className="text-base font-bold text-slate-100">{storageInfo?.messagesCount ?? 0}</div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#181d2c] border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-mono mb-1">Images Created</div>
                    <div className="text-base font-bold text-slate-100">{storageInfo?.imagesCount ?? 0}</div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#181d2c] border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-mono mb-1">DB Size</div>
                    <div className="text-base font-bold text-slate-100">
                      {formatBytes(storageInfo?.dbSizeBytes ?? 0)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-[#181d2c] border border-slate-800">
                  <div>
                    <div className="font-medium text-slate-200">Generated Images Storage</div>
                    <div className="text-[11px] text-slate-500">
                      {formatBytes(storageInfo?.imagesSizeBytes ?? 0)} in %AppData%/snv-ai/images/
                    </div>
                  </div>
                  <button
                    onClick={() => window.snvAi?.images?.openFolder?.()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Open Folder</span>
                  </button>
                </div>

                <div className="p-3 rounded-lg bg-[#0f121a] border border-slate-800 text-[11px] text-slate-400 font-mono break-all">
                  <div className="text-slate-500 mb-1">SQLite Database Location:</div>
                  <div>{storageInfo?.dbPath || 'Windows %AppData%/snv-ai/data/snv_ai.db'}</div>
                </div>

                <div className="pt-3 border-t border-slate-800/80">
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to clear all chat conversations? This cannot be undone.')) {
                        onClearHistory();
                        window.snvAi?.db?.getStorageInfo().then(setStorageInfo).catch(console.error);
                      }
                    }}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-600/10 border border-rose-500/30 text-rose-400 hover:bg-rose-600/20 text-xs font-medium transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Clear All Chat History</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-[#0e111a] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
