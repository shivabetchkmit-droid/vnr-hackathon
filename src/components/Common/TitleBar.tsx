import React, { useEffect, useState } from 'react';
import { Minus, Square, Copy, X, ShieldCheck, WifiOff } from 'lucide-react';

interface TitleBarProps {
  isOfflineMode?: boolean;
  engineRunning?: boolean;
}

export const TitleBar: React.FC<TitleBarProps> = ({ isOfflineMode = true, engineRunning = false }) => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const checkMaximized = async () => {
      if (window.snvAi?.system?.isMaximized) {
        const max = await window.snvAi.system.isMaximized();
        setIsMaximized(max);
      }
    };
    checkMaximized();
    window.addEventListener('resize', checkMaximized);
    return () => window.removeEventListener('resize', checkMaximized);
  }, []);

  const handleMinimize = () => {
    window.snvAi?.system?.minimizeWindow();
  };

  const handleMaximize = async () => {
    window.snvAi?.system?.maximizeWindow();
    if (window.snvAi?.system?.isMaximized) {
      const max = await window.snvAi.system.isMaximized();
      setIsMaximized(max);
    }
  };

  const handleClose = () => {
    window.snvAi?.system?.closeWindow();
  };

  return (
    <header className="app-titlebar h-9 w-full bg-[#0d1017] border-b border-[#1f2638] flex items-center justify-between select-none z-50 text-xs text-slate-300">
      {/* Left: Logo & App Title */}
      <div className="flex items-center gap-2 pl-3">
        <div className="w-5 h-5 flex items-center justify-center">
          <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm0 4a3 3 0 110 6 3 3 0 010-6zm3 12H9v-1.5c0-1.5 3-2.25 3-2.25s3 .75 3 2.25V18z"/>
          </svg>
        </div>
        <span className="font-semibold text-slate-200 tracking-wide">SNV AI</span>
        <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">v1.0.0</span>

        {/* Offline & Local Badge */}
        <div
          onClick={async () => {
            if (!engineRunning && window.snvAi?.ai?.startEngine) {
              await window.snvAi.ai.startEngine();
            }
          }}
          className={`no-drag ml-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-medium transition-all ${
            engineRunning
              ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-400'
              : 'bg-amber-950/60 border-amber-500/30 text-amber-400 cursor-pointer hover:bg-amber-900/40'
          }`}
          title={engineRunning ? 'Local AI Engine is active' : 'Click to start Local AI Engine'}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              engineRunning ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          ></span>
          <span>{engineRunning ? 'Local AI Ready' : 'Start Engine'}</span>
        </div>
      </div>

      {/* Center: Tagline (Draggable) */}
      <div className="hidden md:flex items-center gap-1 text-[11px] text-slate-400 font-medium">
        <WifiOff className="w-3 h-3 text-emerald-400" />
        <span>Your Private AI. Running Locally.</span>
      </div>

      {/* Right: Window Controls */}
      <div className="no-drag flex items-center h-full">
        <button
          onClick={handleMinimize}
          className="h-full px-3.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleMaximize}
          className="h-full px-3.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center"
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          <Square className="w-3 h-3" />
        </button>

        <button
          onClick={handleClose}
          className="h-full px-3.5 hover:bg-rose-600 text-slate-400 hover:text-white transition-colors flex items-center justify-center"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
