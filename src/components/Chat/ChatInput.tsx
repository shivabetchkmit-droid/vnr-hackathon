import React, { useRef, useEffect, useState } from 'react';
import {
  Send,
  Square,
  Paperclip,
  Image as ImageIcon,
  X,
  BookOpen,
  Code2,
  FileText,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { AIMode, Attachment } from '../../types';

interface ChatInputProps {
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
  engineRunning?: boolean;
  modelSupportsVision?: boolean;
  activeModelName?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
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
  enterToSend = true,
  engineRunning = false,
  modelSupportsVision = false,
  activeModelName
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (enterToSend && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerating && (input.trim() || attachments.length > 0)) {
        onSend();
      }
    }
  };

  const handleAttachFile = async () => {
    try {
      const res = await window.snvAi?.files?.selectFile();
      if (!res?.canceled && res?.file) {
        onAddAttachment({
          id: Math.random().toString(36).substring(2, 9),
          name: res.file.name,
          type: res.file.ext,
          size: res.file.size,
          path: res.file.path
        });
        if (activeMode !== 'document') {
          onChangeMode('document');
        }
      }
    } catch (err) {
      console.error('Error selecting file:', err);
    }
  };

  const handleAttachImage = async () => {
    try {
      const res = await window.snvAi?.files?.selectImage();
      if (!res?.canceled) {
        const selected = res.images && res.images.length > 0 ? res.images : (res.image ? [res.image] : []);
        for (const img of selected) {
          onAddAttachment({
            id: Math.random().toString(36).substring(2, 9),
            name: img.name,
            type: 'image/png',
            size: img.size,
            path: img.path,
            content: img.base64,
            base64: img.base64,
            previewUrl: img.dataUrl || `data:image/png;base64,${img.base64}`
          });
        }
      }
    } catch (err) {
      console.error('Error selecting image:', err);
    }
  };

  // Drag and drop support
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        const isImg = file.type.startsWith('image/');

        if (isImg) {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1] || '';
            onAddAttachment({
              id: Math.random().toString(36).substring(2, 9),
              name: file.name,
              type: file.type,
              size: file.size,
              path: (file as any).path || '',
              content: base64,
              base64,
              previewUrl: result
            });
          };
          reader.readAsDataURL(file);
        } else {
          onAddAttachment({
            id: Math.random().toString(36).substring(2, 9),
            name: file.name,
            type: file.name.split('.').pop() || 'txt',
            size: file.size,
            path: (file as any).path || ''
          });
          if (activeMode !== 'document') {
            onChangeMode('document');
          }
        }
      }
    }
  };

  const modes: Array<{ id: AIMode; label: string; icon: any; color: string }> = [
    { id: 'general', label: 'General', icon: Sparkles, color: 'text-purple-400' },
    { id: 'study', label: 'Study Mode', icon: BookOpen, color: 'text-amber-400' },
    { id: 'coding', label: 'Coding Mode', icon: Code2, color: 'text-cyan-400' },
    { id: 'document', label: 'Document Mode', icon: FileText, color: 'text-emerald-400' }
  ];

  const canSend = !isGenerating && (input.trim().length > 0 || attachments.length > 0);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-4 pt-1 select-none">
      {/* Mode Switcher & Helper Pills */}
      <div className="flex items-center justify-between gap-2 mb-2 px-1">
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          {modes.map((m) => {
            const Icon = m.icon;
            const isActive = activeMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onChangeMode(m.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-slate-700/80 text-white border border-slate-600 shadow-sm'
                    : 'bg-slate-800/40 text-slate-400 hover:text-slate-300 hover:bg-slate-800'
                }`}
                title={`Switch to ${m.label}`}
              >
                <Icon className={`w-3.5 h-3.5 ${m.color}`} />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Warning if offline engine is not running */}
        {!engineRunning && (
          <div className="flex items-center gap-1 text-[11px] text-amber-400/90 font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Local engine offline</span>
          </div>
        )}
      </div>

      {/* Main Input Container with Drag and Drop */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative rounded-2xl bg-[#151923] border transition-all shadow-lg ${
          isDragging
            ? 'border-indigo-500 ring-2 ring-indigo-500/30 bg-[#191f2e]'
            : 'border-slate-700/80 focus-within:border-emerald-500/70'
        }`}
      >
        {/* Attachment chips preview */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 border-b border-slate-800">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-lg bg-[#1e2535] border border-slate-700 text-xs text-slate-200"
              >
                {att.previewUrl || att.base64 ? (
                  <img
                    src={att.previewUrl || (att.base64?.startsWith('data:') ? att.base64 : `data:image/png;base64,${att.base64}`)}
                    alt={att.name}
                    className="w-5 h-5 rounded object-cover border border-slate-600"
                  />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span className="truncate max-w-[160px] font-medium">{att.name}</span>
                <button
                  onClick={() => onRemoveAttachment(att.id)}
                  className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                  title="Remove attachment"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Text Area */}
        <div className="flex items-end px-3.5 py-2.5">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              activeMode === 'study'
                ? 'Ask a concept to learn in Study Mode (WHAT, WHY, HOW, EXAMPLE)...'
                : activeMode === 'coding'
                ? 'Ask a programming or architecture question...'
                : activeMode === 'document'
                ? 'Ask a question about the attached document...'
                : 'Message SNV AI or ask to create an image (e.g. Create a futuristic city on Saturn)...'
            }
            rows={1}
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none max-h-48 leading-relaxed font-sans"
          />

          {/* Action buttons (Attach File, Attach Image, Send/Stop) */}
          <div className="flex items-center gap-1.5 ml-2 pb-0.5">
            <button
              onClick={handleAttachFile}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Attach Document (PDF, Word, TXT, Code, CSV, JSON)"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <button
              onClick={handleAttachImage}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Attach Image(s) for Vision analysis"
            >
              <ImageIcon className="w-4 h-4" />
            </button>

            {isGenerating ? (
              <button
                onClick={onStop}
                className="p-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-md flex items-center justify-center"
                title="Stop Generation"
              >
                <Square className="w-4 h-4 fill-white" />
              </button>
            ) : (
              <button
                onClick={onSend}
                disabled={!canSend}
                className={`p-2 rounded-xl transition-all shadow-md flex items-center justify-center ${
                  canSend
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
                title="Send Message (Enter)"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 px-2 mt-1.5">
        <span>Enter to send, Shift + Enter for new line • Drag & drop images/files supported</span>
        <span>100% Offline AI</span>
      </div>
    </div>
  );
};
