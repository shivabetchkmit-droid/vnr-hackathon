import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Copy,
  Check,
  RotateCcw,
  Edit2,
  FileText,
  Image as ImageIcon,
  Bot,
  User,
  GraduationCap,
  Code2,
  BookOpen,
  Sparkles,
  Download,
  Maximize2,
  Wand2,
  X
} from 'lucide-react';
import { ChatMessage, AIMode, GeneratedImageRecord } from '../../types';
import { CodeBlock } from './CodeBlock';

interface MessageItemProps {
  message: ChatMessage;
  isLastAssistant: boolean;
  showTimestamps?: boolean;
  onRegenerate?: () => void;
  onEditMessage?: (id: string, newContent: string) => void;
  onEditImage?: (record: GeneratedImageRecord) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isLastAssistant,
  showTimestamps = true,
  onRegenerate,
  onEditMessage,
  onEditImage
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const [imageDataUrl, setImageDataUrl] = useState<string>('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  // Load image data URL if this message has an attached imageRecord
  useEffect(() => {
    let isMounted = true;
    if (message.imageRecord?.filePath) {
      window.snvAi?.files?.getImageDataUrl?.(message.imageRecord.filePath).then((url) => {
        if (isMounted) setImageDataUrl(url);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [message.imageRecord?.filePath]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleSaveEdit = () => {
    if (editValue.trim() && editValue !== message.content) {
      onEditMessage?.(message.id, editValue.trim());
    }
    setIsEditing(false);
  };

  const handleSaveImage = async () => {
    if (!message.imageRecord) return;
    try {
      await window.snvAi?.images?.saveAs(
        message.imageRecord.filePath,
        `SNV_AI_${message.imageRecord.id}.png`
      );
    } catch (e) {
      console.error('Failed to save image:', e);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getModeBadge = (mode?: AIMode) => {
    if (!mode || mode === 'general') return null;
    if (mode === 'study') {
      return (
        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
          <BookOpen className="w-2.5 h-2.5" />
          Study Mode
        </span>
      );
    }
    if (mode === 'coding') {
      return (
        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">
          <Code2 className="w-2.5 h-2.5" />
          Coding Mode
        </span>
      );
    }
    if (mode === 'document') {
      return (
        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
          <FileText className="w-2.5 h-2.5" />
          Document Mode
        </span>
      );
    }
    return null;
  };

  return (
    <div
      className={`group w-full py-4 px-4 md:px-8 transition-colors ${
        isAssistant ? 'bg-[#121622]/60 border-y border-slate-800/40' : 'bg-transparent'
      }`}
    >
      <div className="max-w-4xl mx-auto flex gap-3.5 items-start">
        {/* Avatar */}
        <div className="flex-shrink-0 pt-0.5">
          {isUser ? (
            <div className="w-7 h-7 rounded-lg bg-slate-700/80 border border-slate-600/50 flex items-center justify-center text-slate-200 shadow-sm">
              <User className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-700 border border-emerald-500/40 flex items-center justify-center text-white shadow-sm">
              <Bot className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Content Container */}
        <div className="flex-1 min-w-0">
          {/* Header row (Role, Mode, Model, Timestamp) */}
          <div className="flex items-center gap-2 mb-1.5 select-none">
            <span className="text-xs font-semibold text-slate-200">
              {isUser ? 'You' : 'SNV AI'}
            </span>
            {isAssistant && message.model && (
              <span className="text-[10px] text-slate-500 font-mono">
                {message.model}
              </span>
            )}
            {getModeBadge(message.mode)}
            {showTimestamps && (
              <span className="text-[10px] text-slate-500 ml-auto font-mono">
                {formatTime(message.timestamp)}
              </span>
            )}
          </div>

          {/* User Attachments preview (Images or Documents) */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {message.attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#1a2130] border border-slate-700/80 text-xs text-slate-300"
                >
                  {att.previewUrl || att.base64 ? (
                    <img
                      src={att.previewUrl || (att.base64?.startsWith('data:') ? att.base64 : `data:image/png;base64,${att.base64}`)}
                      alt={att.name}
                      className="w-7 h-7 rounded object-cover border border-slate-700"
                    />
                  ) : att.type.includes('image') ? (
                    <ImageIcon className="w-4 h-4 text-cyan-400" />
                  ) : (
                    <FileText className="w-4 h-4 text-emerald-400" />
                  )}
                  <span className="font-medium truncate max-w-[180px]">{att.name}</span>
                  <span className="text-[10px] text-slate-500">
                    ({(att.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Message Text / Markdown Content */}
          {isEditing ? (
            <div className="mt-1 flex flex-col gap-2">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full p-2.5 text-xs text-slate-100 bg-[#161a25] border border-emerald-500/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none font-sans"
                rows={3}
                autoFocus
              />
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium"
                >
                  Save & Regenerate
                </button>
              </div>
            </div>
          ) : isAssistant ? (
            <div className="prose-snv text-xs sm:text-sm text-slate-200 select-text leading-relaxed">
              {message.content && (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, inline, className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline ? (
                        <CodeBlock
                          language={match ? match[1] : undefined}
                          value={String(children).replace(/\n$/, '')}
                        />
                      ) : (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    }
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              )}

              {/* Streaming Indicator */}
              {message.isStreaming && (
                <span className="cursor-blink inline-block ml-1" title="Generating..." />
              )}

              {/* Error display */}
              {message.error && (
                <div className="mt-2 p-2.5 rounded bg-rose-950/40 border border-rose-600/40 text-rose-300 text-xs">
                  {message.error}
                </div>
              )}

              {/* INLINE GENERATED IMAGE */}
              {message.imageRecord && (
                <div className="mt-3 flex flex-col gap-2 max-w-md">
                  <div className="relative group/img rounded-xl overflow-hidden border border-slate-800 shadow-xl bg-[#0f121b]">
                    {imageDataUrl ? (
                      <img
                        src={imageDataUrl}
                        alt={message.imageRecord.prompt}
                        className="w-full h-auto object-cover cursor-pointer transition-transform duration-300 group-hover/img:scale-[1.01]"
                        onClick={() => setIsPreviewOpen(true)}
                      />
                    ) : (
                      <div className="w-full h-64 bg-slate-800/60 animate-pulse flex items-center justify-center text-slate-500 text-xs">
                        Loading image...
                      </div>
                    )}

                    {/* AI Generated Badge */}
                    <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-[10px] font-medium text-white/90 flex items-center gap-1 shadow-sm select-none">
                      <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                      <span>AI Generated</span>
                    </div>

                    {/* Quick Expand Button */}
                    <button
                      onClick={() => setIsPreviewOpen(true)}
                      className="absolute bottom-2.5 right-2.5 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white border border-white/20 opacity-0 group-hover/img:opacity-100 transition-opacity"
                      title="Expand full view"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Image Action Buttons */}
                  <div className="flex items-center gap-2 select-none">
                    <button
                      onClick={handleSaveImage}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600/90 hover:bg-indigo-500 text-white text-[11px] font-medium transition-colors"
                      title="Save image to your computer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Save Image</span>
                    </button>
                    {onRegenerate && (
                      <button
                        onClick={onRegenerate}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] transition-colors border border-slate-700/60"
                        title="Regenerate this image"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Regenerate</span>
                      </button>
                    )}
                    {onEditImage && (
                      <button
                        onClick={() => onEditImage(message.imageRecord!)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-[11px] transition-colors"
                        title="Edit image with natural language"
                      >
                        <Wand2 className="w-3 h-3" />
                        <span>Edit Image</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs sm:text-sm text-slate-100 whitespace-pre-wrap select-text leading-relaxed">
              {message.content}
            </div>
          )}

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 mt-2 select-none opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors"
              title="Copy message text"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>

            {isUser && onEditMessage && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors"
                title="Edit message"
              >
                <Edit2 className="w-3 h-3" />
                <span>Edit</span>
              </button>
            )}

            {isAssistant && isLastAssistant && onRegenerate && !message.isStreaming && (
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors"
                title="Regenerate response"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Regenerate</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Full Preview Modal for Inline Generated Image */}
      {isPreviewOpen && imageDataUrl && message.imageRecord && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsPreviewOpen(false)}
              className="absolute -top-10 right-0 text-slate-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={imageDataUrl}
              alt={message.imageRecord.prompt}
              className="max-h-[80vh] w-auto rounded-2xl shadow-2xl border border-slate-800"
            />
            <div className="mt-3 flex items-center justify-between w-full px-2 text-xs text-slate-300">
              <span className="truncate max-w-lg">{message.imageRecord.prompt}</span>
              <button
                onClick={handleSaveImage}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save Image</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
