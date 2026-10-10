import React, { useState, useEffect } from 'react';
import {
  X,
  Cpu,
  Check,
  RefreshCw,
  Eye,
  HardDrive,
  AlertCircle,
  Download,
  Loader2,
  Sparkles
} from 'lucide-react';
import { LocalModel, OllamaStatus } from '../../types';

interface ModelSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  ollamaStatus: OllamaStatus | null;
  selectedModel: string;
  onSelectModel: (modelName: string) => void;
  onRefresh: () => void;
}

export const ModelSelectorModal: React.FC<ModelSelectorModalProps> = ({
  isOpen,
  onClose,
  ollamaStatus,
  selectedModel,
  onSelectModel,
  onRefresh
}) => {
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{ status: string; completed?: number; total?: number } | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [customModelInput, setCustomModelInput] = useState('');

  useEffect(() => {
    if (!isOpen || !window.snvAi?.ai) return;

    const cleanupProgress = window.snvAi.ai.onPullProgress?.((data) => {
      setDownloadProgress({
        status: data.status,
        completed: data.completed,
        total: data.total
      });
    });

    const cleanupDone = window.snvAi.ai.onPullDone?.((data) => {
      setDownloadingModel(null);
      setDownloadProgress(null);
      onRefresh();
      onSelectModel(data.modelName);
    });

    const cleanupError = window.snvAi.ai.onPullError?.((data) => {
      setDownloadingModel(null);
      setDownloadProgress(null);
      setDownloadError(data.error);
    });

    return () => {
      cleanupProgress?.();
      cleanupDone?.();
      cleanupError?.();
    };
  }, [isOpen, onRefresh, onSelectModel]);

  if (!isOpen) return null;

  const models = ollamaStatus?.models || [];
  const isRunning = ollamaStatus?.isRunning || false;

  const handlePull = async (modelName: string) => {
    if (!modelName.trim() || downloadingModel) return;
    setDownloadingModel(modelName.trim());
    setDownloadProgress({ status: 'Starting download...' });
    setDownloadError(null);

    try {
      await window.snvAi?.ai?.pullModel?.({ modelName: modelName.trim() });
    } catch (err: any) {
      setDownloadingModel(null);
      setDownloadProgress(null);
      setDownloadError(err.message || 'Failed to initiate download');
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const recommendedModels = [
    { name: 'llama3.2', desc: 'Fast, state-of-the-art general purpose model', size: '2.0 GB' },
    { name: 'moondream', desc: 'Ultra-fast multimodal vision model for image Q&A and OCR', size: '1.7 GB' },
    { name: 'qwen2.5', desc: 'Superior coding, reasoning, and multilingual capabilities', size: '2.5 GB' },
    { name: 'gemma2', desc: 'High accuracy lightweight model by Google', size: '1.6 GB' },
    { name: 'llava', desc: 'Full-featured 7B vision model for images & documents', size: '4.7 GB' }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-lg bg-[#141824] border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Local AI Models</h2>
              <p className="text-[11px] text-slate-400">Select an offline model installed on your machine</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
              title="Refresh Models List"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Active Download Banner */}
          {downloadingModel && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium text-emerald-300">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Downloading {downloadingModel}...</span>
                </div>
                {downloadProgress?.total ? (
                  <span className="text-[11px] text-emerald-400 font-mono">
                    {Math.round(((downloadProgress.completed || 0) / downloadProgress.total) * 100)}%
                  </span>
                ) : null}
              </div>

              {downloadProgress?.total ? (
                <div className="w-full bg-emerald-950 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-400 h-full transition-all duration-300"
                    style={{
                      width: `${Math.round(
                        ((downloadProgress.completed || 0) / downloadProgress.total) * 100
                      )}%`
                    }}
                  />
                </div>
              ) : null}

              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="truncate">{downloadProgress?.status || 'Downloading...'}</span>
                {downloadProgress?.completed && downloadProgress?.total ? (
                  <span>
                    {formatBytes(downloadProgress.completed)} / {formatBytes(downloadProgress.total)}
                  </span>
                ) : null}
              </div>
            </div>
          )}

          {downloadError && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs">
              {downloadError}
            </div>
          )}

          {!isRunning ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
              <div className="flex items-center gap-2 font-semibold mb-1">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span>Local AI Engine Not Running</span>
              </div>
              <p className="text-slate-300 mb-2 leading-relaxed">
                SNV AI cannot communicate with the local inference service at {ollamaStatus?.url || 'http://127.0.0.1:11434'}.
              </p>
              <p className="text-slate-400 text-[11px]">
                Please start the Ollama application or service on your computer, then click the refresh button above.
              </p>
            </div>
          ) : models.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 text-xs">
              <div className="flex items-center gap-2 font-semibold text-slate-200 mb-1">
                <HardDrive className="w-4 h-4 text-slate-400" />
                <span>No local AI model is installed</span>
              </div>
              <p className="text-slate-400 mb-3 leading-relaxed">
                Your local Ollama service is connected, but no models are currently downloaded. Click any model below to download with your permission:
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Installed Models ({models.length})
              </div>
              {models.map((m) => {
                const isSelected = m.name === selectedModel;
                return (
                  <div
                    key={m.name}
                    onClick={() => {
                      onSelectModel(m.name);
                      onClose();
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-emerald-950/20 border-emerald-500/60 shadow-sm'
                        : 'bg-[#181d2c] border-slate-800 hover:border-slate-700 hover:bg-[#1e2336]'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-100">{m.name}</span>
                        {m.supportsVision ? (
                          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium" title="Used automatically when uploading images">
                            <Eye className="w-2.5 h-2.5" />
                            Vision (Image Q&A)
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                            <Sparkles className="w-2.5 h-2.5" />
                            Text & Code
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400">
                        <span>{formatBytes(m.size)}</span>
                        {m.parameterSize && <span>• {m.parameterSize}</span>}
                        {m.quantizationLevel && <span>• {m.quantizationLevel}</span>}
                      </div>
                    </div>

                    <div className="flex items-center">
                      {isSelected ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-slate-600 hover:border-slate-400" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Recommended Models Section (User-Approved One-Click Download) */}
          {isRunning && (
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Available Local Models (Download on Request)</span>
              </div>
              <div className="space-y-2">
                {recommendedModels.map((rec) => {
                  const isInstalled = models.some(
                    (m) => m.name.toLowerCase().startsWith(rec.name.toLowerCase())
                  );
                  return (
                    <div
                      key={rec.name}
                      className="p-3 rounded-xl bg-[#171b29] border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-slate-200 flex items-center gap-2">
                          <span>{rec.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">({rec.size})</span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">{rec.desc}</p>
                      </div>

                      {isInstalled ? (
                        <span className="text-[11px] text-emerald-400 font-medium px-2 py-1 bg-emerald-950/40 rounded border border-emerald-500/20">
                          Installed
                        </span>
                      ) : (
                        <button
                          onClick={() => handlePull(rec.name)}
                          disabled={Boolean(downloadingModel)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 text-xs font-medium transition-colors flex-shrink-0 disabled:opacity-50"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Get</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Custom Model Download */}
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="text"
                  value={customModelInput}
                  onChange={(e) => setCustomModelInput(e.target.value)}
                  placeholder="Or enter custom model name (e.g. phi3:mini)..."
                  className="flex-1 px-3 py-1.5 bg-[#171b29] border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-600 font-mono"
                />
                <button
                  onClick={() => handlePull(customModelInput)}
                  disabled={!customModelInput.trim() || Boolean(downloadingModel)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  <span>Download</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-[#10131d] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
