import React from 'react';
import { Sparkles, BookOpen, Code2, FileText } from 'lucide-react';
import {
  ChatMessage,
  ChatSession,
  AIMode,
  Attachment,
  OllamaStatus,
  SystemDiagnostic,
  GeneratedImageRecord
} from '../../types';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { WelcomeScreen } from './WelcomeScreen';

interface ChatAreaProps {
  currentChat: ChatSession | null;
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isGenerating: boolean;
  activeMode: AIMode;
  onChangeMode: (mode: AIMode) => void;
  attachments: Attachment[];
  onAddAttachment: (att: Attachment) => void;
  onRemoveAttachment: (id: string) => void;
  enterToSend?: boolean;
  showTimestamps?: boolean;
  engineRunning?: boolean;
  modelSupportsVision?: boolean;
  activeModelName?: string;
  diagnostics: SystemDiagnostic | null;
  ollamaStatus: OllamaStatus | null;
  onRefreshDiagnostics: () => void;
  onSelectStarterPrompt: (prompt: string, mode: AIMode) => void;
  onRegenerate: () => void;
  onEditMessage: (id: string, newContent: string) => void;
  onEditImage?: (record: GeneratedImageRecord) => void;
  onOpenModelModal: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  currentChat,
  messages,
  input,
  setInput,
  onSend,
  onStop,
  isGenerating,
  activeMode,
  onChangeMode,
  attachments,
  onAddAttachment,
  onRemoveAttachment,
  enterToSend,
  showTimestamps,
  engineRunning,
  modelSupportsVision,
  activeModelName,
  diagnostics,
  ollamaStatus,
  onRefreshDiagnostics,
  onSelectStarterPrompt,
  onRegenerate,
  onEditMessage,
  onEditImage,
  onOpenModelModal
}) => {
  const getModeIcon = (mode: AIMode) => {
    switch (mode) {
      case 'study': return <BookOpen className="w-3.5 h-3.5 text-amber-400" />;
      case 'coding': return <Code2 className="w-3.5 h-3.5 text-cyan-400" />;
      case 'document': return <FileText className="w-3.5 h-3.5 text-emerald-400" />;
      default: return <Sparkles className="w-3.5 h-3.5 text-purple-400" />;
    }
  };

  return (
    <main className="flex-1 flex flex-col h-full bg-[#0b0e16] overflow-hidden select-none">
      {/* Top Chat Bar Header */}
      <header className="h-12 border-b border-[#1b2234] px-4 flex items-center justify-between bg-[#0e111a]/80 backdrop-blur-sm z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#161a27] border border-slate-800 text-xs">
            {getModeIcon(activeMode)}
            <span className="font-medium text-slate-200 capitalize">{activeMode} Mode</span>
          </div>

          <span className="text-slate-600">/</span>

          <span className="text-xs font-semibold text-slate-200 truncate">
            {currentChat ? currentChat.title : 'New Conversation'}
          </span>
        </div>

        {/* Right Info: Model & Offline Pill */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenModelModal}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#161b28] hover:bg-[#1d2334] border border-slate-800 text-xs text-slate-300 transition-colors"
            title="Click to change model"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="font-mono text-[11px] truncate max-w-[140px]">
              {activeModelName || 'Select Model'}
            </span>
          </button>
        </div>
      </header>

      {/* Chat Messages or Empty Welcome Screen */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {messages.length === 0 ? (
          <WelcomeScreen
            diagnostics={diagnostics}
            ollamaStatus={ollamaStatus}
            onRefreshDiagnostics={onRefreshDiagnostics}
            onSelectPrompt={onSelectStarterPrompt}
          />
        ) : (
          <MessageList
            messages={messages}
            showTimestamps={showTimestamps}
            onRegenerate={onRegenerate}
            onEditMessage={onEditMessage}
            onEditImage={onEditImage}
          />
        )}
      </div>

      {/* Bottom Input Area */}
      <ChatInput
        input={input}
        setInput={setInput}
        onSend={onSend}
        onStop={onStop}
        isGenerating={isGenerating}
        activeMode={activeMode}
        onChangeMode={onChangeMode}
        attachments={attachments}
        onAddAttachment={onAddAttachment}
        onRemoveAttachment={onRemoveAttachment}
        enterToSend={enterToSend}
        engineRunning={engineRunning}
        modelSupportsVision={modelSupportsVision}
        activeModelName={activeModelName}
      />
    </main>
  );
};
