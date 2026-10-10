import React, { useState } from 'react';
import {
  Plus,
  Search,
  MessageSquare,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit2,
  Check,
  X,
  Cpu,
  ShieldCheck,
  Layers,
  Wand2,
  Image as ImageIcon
} from 'lucide-react';
import { ChatSession, OllamaStatus } from '../../types';

interface SidebarProps {
  chats: ChatSession[];
  activeChatId: string | null;
  activeView: 'chat' | 'images';
  onSelectView: (view: 'chat' | 'images') => void;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onRenameChat: (id: string, newTitle: string) => void;
  onDeleteChat: (id: string) => void;
  onOpenSettings: () => void;
  onOpenModels: () => void;
  ollamaStatus: OllamaStatus | null;
  activeModelName: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  chats,
  activeChatId,
  activeView,
  onSelectView,
  onSelectChat,
  onNewChat,
  onRenameChat,
  onDeleteChat,
  onOpenSettings,
  onOpenModels,
  ollamaStatus,
  activeModelName,
  isCollapsed,
  onToggleCollapse
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const filteredChats = chats.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group chats by date (Today, Yesterday, Previous 7 Days, Older)
  const groupChats = (chatList: ChatSession[]) => {
    const today: ChatSession[] = [];
    const yesterday: ChatSession[] = [];
    const lastWeek: ChatSession[] = [];
    const older: ChatSession[] = [];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;
    const startOfLastWeek = startOfToday - 7 * 86400000;

    for (const chat of chatList) {
      if (chat.updatedAt >= startOfToday) {
        today.push(chat);
      } else if (chat.updatedAt >= startOfYesterday) {
        yesterday.push(chat);
      } else if (chat.updatedAt >= startOfLastWeek) {
        lastWeek.push(chat);
      } else {
        older.push(chat);
      }
    }

    return [
      { label: 'Today', list: today },
      { label: 'Yesterday', list: yesterday },
      { label: 'Previous 7 Days', list: lastWeek },
      { label: 'Older', list: older }
    ].filter((g) => g.list.length > 0);
  };

  const grouped = groupChats(filteredChats);

  const startRename = (chat: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditingTitle(chat.title);
  };

  const saveRename = (chatId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (editingTitle.trim()) {
      onRenameChat(chatId, editingTitle.trim());
    }
    setEditingChatId(null);
  };

  const cancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(null);
  };

  const isEngineReady = Boolean(ollamaStatus?.isRunning && ollamaStatus.models.length > 0);

  if (isCollapsed) {
    return (
      <aside className="w-14 bg-[#10131d] border-r border-[#1e2436] flex flex-col items-center py-3 select-none z-30 transition-all duration-200">
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 mb-4 transition-colors"
          title="Expand Sidebar"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <button
          onClick={onNewChat}
          className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md mb-3 transition-colors"
          title="New Chat"
        >
          <Plus className="w-5 h-5" />
        </button>

        {/* View Switchers */}
        <button
          onClick={() => onSelectView('chat')}
          className={`p-2 rounded-lg mb-2 transition-colors ${
            activeView === 'chat'
              ? 'bg-slate-800 text-emerald-400'
              : 'text-slate-400 hover:text-white hover:bg-slate-850'
          }`}
          title="Chat"
        >
          <MessageSquare className="w-5 h-5" />
        </button>

        <button
          onClick={() => onSelectView('images')}
          className={`p-2 rounded-lg mb-4 transition-colors ${
            activeView === 'images'
              ? 'bg-indigo-900/40 text-indigo-400 border border-indigo-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-850'
          }`}
          title="Image Studio"
        >
          <Wand2 className="w-5 h-5" />
        </button>

        <div className="flex-1" />

        {/* Bottom icon triggers */}
        <button
          onClick={onOpenModels}
          className={`p-2 rounded-lg mb-2 transition-colors ${
            isEngineReady ? 'text-emerald-400 hover:bg-slate-800' : 'text-amber-400 hover:bg-slate-800'
          }`}
          title={`Active Model: ${activeModelName || 'None'}`}
        >
          <Cpu className="w-5 h-5" />
        </button>

        <button
          onClick={onOpenSettings}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Settings"
        >
          <SettingsIcon className="w-5 h-5" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-64 bg-[#10131d] border-r border-[#1e2436] flex flex-col h-full select-none z-30 transition-all duration-200">
      {/* Top Header */}
      <div className="p-3 border-b border-[#1e2436]/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 tracking-wide leading-tight">SNV AI</h1>
            <p className="text-[10px] text-slate-400 leading-tight">Private Offline AI</p>
          </div>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          title="Collapse Sidebar"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Views Switcher: Chat vs Image Studio */}
      <div className="p-3 pb-1">
        <div className="flex gap-1.5 p-1 rounded-xl bg-[#161a27] border border-slate-800/80">
          <button
            onClick={() => onSelectView('chat')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
              activeView === 'chat'
                ? 'bg-slate-800 text-slate-100 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>
          <button
            onClick={() => onSelectView('images')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
              activeView === 'images'
                ? 'bg-gradient-to-r from-purple-900/60 to-indigo-900/60 text-indigo-200 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Images</span>
          </button>
        </div>
      </div>

      {/* New Chat Button */}
      <div className="px-3 py-2">
        <button
          onClick={() => {
            onSelectView('chat');
            onNewChat();
          }}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md shadow-emerald-950/30 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-8 pr-2.5 py-1.5 bg-[#171b28] border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-600"
          />
        </div>
      </div>

      {/* Chat History List */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-4">
        {grouped.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            {searchQuery ? 'No chats found matching search' : 'No previous conversations'}
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.label}>
              <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.list.map((chat) => {
                  const isActive = chat.id === activeChatId && activeView === 'chat';
                  const isEditing = editingChatId === chat.id;

                  return (
                    <div
                      key={chat.id}
                      onClick={() => {
                        onSelectView('chat');
                        onSelectChat(chat.id);
                      }}
                      className={`group relative flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-[#1b2131] text-emerald-400 font-medium'
                          : 'text-slate-300 hover:bg-[#151925] hover:text-slate-100'
                      }`}
                    >
                      <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />

                      {isEditing ? (
                        <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveRename(chat.id);
                              if (e.key === 'Escape') setEditingChatId(null);
                            }}
                            autoFocus
                            className="flex-1 px-1.5 py-0.5 bg-[#0f121b] border border-emerald-500 rounded text-xs text-white focus:outline-none"
                          />
                          <button
                            onClick={(e) => saveRename(chat.id, e)}
                            className="p-1 hover:text-emerald-400"
                            title="Save"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={cancelRename}
                            className="p-1 hover:text-rose-400"
                            title="Cancel"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="truncate flex-1 min-w-0">{chat.title}</span>

                          {/* Hover action buttons */}
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                            <button
                              onClick={(e) => startRename(chat, e)}
                              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"
                              title="Rename chat"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteChat(chat.id);
                              }}
                              className="p-1 rounded hover:bg-rose-900/40 text-slate-400 hover:text-rose-400"
                              title="Delete chat"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bottom Panel: Model Selector & Settings */}
      <div className="p-3 border-t border-[#1e2436]/80 space-y-1.5 bg-[#0e111a]">
        {/* Active Model Pill */}
        <button
          onClick={onOpenModels}
          className="w-full flex items-center justify-between p-2 rounded-lg bg-[#161a27] hover:bg-[#1c2233] border border-slate-800 text-xs transition-colors"
          title="Change active local model"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                isEngineReady ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <div className="truncate text-left">
              <div className="text-[10px] text-slate-500 font-mono leading-none mb-0.5">LOCAL MODEL</div>
              <div className="font-medium text-slate-200 truncate leading-none">
                {activeModelName || 'No model selected'}
              </div>
            </div>
          </div>
          <Layers className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-[#161a27] text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <SettingsIcon className="w-4 h-4 text-slate-400" />
          <span>Settings & Storage</span>
        </button>
      </div>
    </aside>
  );
};
