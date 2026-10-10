import React, { useState } from 'react';
import {
  ShieldCheck,
  Cpu,
  Database,
  FileText,
  BookOpen,
  Code2,
  Sparkles,
  ExternalLink,
  RefreshCw,
  HardDrive,
  Power,
  Loader2
} from 'lucide-react';
import { SystemDiagnostic, OllamaStatus } from '../../types';

interface WelcomeScreenProps {
  diagnostics: SystemDiagnostic | null;
  ollamaStatus: OllamaStatus | null;
  onRefreshDiagnostics: () => void;
  onSelectPrompt: (prompt: string, mode: 'general' | 'study' | 'coding' | 'document') => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  diagnostics,
  ollamaStatus,
  onRefreshDiagnostics,
  onSelectPrompt
}) => {
  const [isStartingEngine, setIsStartingEngine] = useState(false);
  const isEngineReady = Boolean(ollamaStatus?.isRunning && (ollamaStatus.models.length > 0));

  const handleStartEngine = async () => {
    setIsStartingEngine(true);
    try {
      await window.snvAi?.ai?.startEngine?.();
      onRefreshDiagnostics();
    } catch (err) {
      console.error('Failed to start engine:', err);
    } finally {
      setIsStartingEngine(false);
    }
  };

  const quickStarters = [
    {
      title: 'Study Mode',
      desc: 'Explain concepts using WHAT → WHY → HOW → EXAMPLE',
      prompt: 'Explain Polymorphism in Java with clear real-world examples and step-by-step breakdown.',
      mode: 'study' as const,
      icon: BookOpen,
      color: 'text-amber-400 border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40'
    },
    {
      title: 'Coding Mode',
      desc: 'Debug, design, and explain code with architecture best practices',
      prompt: 'Write a high-performance Python script to parse a large CSV file with error handling and explain how it works.',
      mode: 'coding' as const,
      icon: Code2,
      color: 'text-cyan-400 border-cyan-500/20 bg-cyan-500/5 hover:border-cyan-500/40'
    },
    {
      title: 'Document Mode',
      desc: 'Upload a PDF, Word, or TXT file and query its contents locally',
      prompt: 'I will attach a document. Summarize the key concepts and architecture.',
      mode: 'document' as const,
      icon: FileText,
      color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40'
    },
    {
      title: 'General Assistant',
      desc: 'Ask questions, brainstorm ideas, and draft content offline',
      prompt: 'What are the fundamental differences between TCP and UDP protocols?',
      mode: 'general' as const,
      icon: Sparkles,
      color: 'text-purple-400 border-purple-500/20 bg-purple-500/5 hover:border-purple-500/40'
    }
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-6 max-w-4xl mx-auto overflow-y-auto select-none">
      {/* Brand Hero */}
      <div className="text-center my-6">
        <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500 p-0.5 shadow-lg shadow-emerald-950/40 flex items-center justify-center">
          <div className="w-full h-full bg-[#111622] rounded-2xl flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
          Welcome to <span className="text-emerald-400">SNV AI</span>
        </h1>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Your Private AI Assistant. Running 100% locally on your computer with zero cloud dependence.
        </p>
      </div>

      {/* System Diagnostics Card */}
      <div className="w-full bg-[#151924] border border-slate-800 rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              System Diagnostics & Local AI Status
            </h2>
          </div>
          <button
            onClick={onRefreshDiagnostics}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-emerald-400 px-2 py-1 rounded hover:bg-slate-800/80 transition-colors"
            title="Refresh status"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Check Status</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
          {/* Diagnostic: Desktop App */}
          <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#1a202e] border border-slate-800">
            <span className="text-emerald-400 font-bold mt-0.5">✓</span>
            <div>
              <div className="font-medium text-slate-200">Desktop App</div>
              <div className="text-[11px] text-slate-400">Installed & Native</div>
            </div>
          </div>

          {/* Diagnostic: Local AI Runtime */}
          <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#1a202e] border border-slate-800">
            {ollamaStatus?.isRunning ? (
              <span className="text-emerald-400 font-bold mt-0.5">✓</span>
            ) : (
              <span className="text-amber-400 font-bold mt-0.5">!</span>
            )}
            <div>
              <div className="font-medium text-slate-200">Local AI Engine</div>
              <div className="text-[11px] text-slate-400">
                {ollamaStatus?.isRunning ? 'Ollama Running' : 'Engine Unavailable'}
              </div>
            </div>
          </div>

          {/* Diagnostic: Installed Models */}
          <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#1a202e] border border-slate-800">
            {ollamaStatus?.models && ollamaStatus.models.length > 0 ? (
              <span className="text-emerald-400 font-bold mt-0.5">✓</span>
            ) : (
              <span className="text-amber-400 font-bold mt-0.5">!</span>
            )}
            <div>
              <div className="font-medium text-slate-200">Installed Models</div>
              <div className="text-[11px] text-slate-400">
                {ollamaStatus?.models?.length
                  ? `${ollamaStatus.models.length} model(s) ready`
                  : 'No models found'}
              </div>
            </div>
          </div>

          {/* Diagnostic: SQLite Database */}
          <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#1a202e] border border-slate-800">
            <span className="text-emerald-400 font-bold mt-0.5">✓</span>
            <div>
              <div className="font-medium text-slate-200">Local Database</div>
              <div className="text-[11px] text-slate-400">SQLite Ready</div>
            </div>
          </div>
        </div>

        {/* Guidance Notice if Engine or Models missing */}
        {!isEngineReady && (
          <div className="mt-3.5 pt-3 border-t border-slate-800/80 bg-emerald-950/20 border-l-2 border-l-emerald-500 rounded p-3 text-xs text-slate-300">
            <div className="font-semibold text-emerald-400 mb-1 flex items-center gap-1.5">
              <span>How to activate your Local AI Engine:</span>
            </div>
            <p className="text-slate-400 mb-2 leading-relaxed">
              SNV AI processes all requests on your machine using <strong>Ollama</strong>. To enable local AI models without internet:
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-slate-300 font-mono text-[11px]">
              <li>
                Download and install Ollama from{' '}
                <a
                  href="https://ollama.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 underline hover:text-cyan-300"
                >
                  https://ollama.com
                </a>
              </li>
              <li>
                Open PowerShell or Command Prompt and run:{' '}
                <span className="text-emerald-400 font-bold">ollama run llama3.2</span> or{' '}
                <span className="text-emerald-400 font-bold">ollama run qwen2.5</span>
              </li>
              <li>Click <strong>Check Status</strong> above once installed.</li>
            </ol>
            <div className="mt-3">
              <button
                onClick={handleStartEngine}
                disabled={isStartingEngine}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md transition-all disabled:opacity-60"
              >
                {isStartingEngine ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Power className="w-3.5 h-3.5" />
                )}
                <span>{isStartingEngine ? 'Starting Local AI Engine...' : 'Auto-Start Local AI Engine'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Starter Prompts */}
      <div className="w-full">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Explore Assistant Capabilities
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {quickStarters.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                onClick={() => onSelectPrompt(item.prompt, item.mode)}
                className={`text-left p-3.5 rounded-xl border transition-all duration-200 flex flex-col justify-between ${item.color}`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className="w-4 h-4" />
                  <span className="font-semibold text-xs text-slate-200">{item.title}</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2">{item.desc}</p>
                <span className="text-[11px] text-slate-300 font-mono line-clamp-1 italic">
                  "{item.prompt}"
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
