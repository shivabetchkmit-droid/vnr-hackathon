import { contextBridge, ipcRenderer } from 'electron';
import {
  AppSettings,
  ChatMessage,
  ChatSession,
  GeneratedImageRecord,
  HardwareInfo,
  ImageEditParams,
  ImageGenParams,
  OllamaStatus,
  StorageInfo,
  SystemDiagnostic
} from './types';

const api = {
  // AI Operations
  ai: {
    startEngine: (customUrl?: string): Promise<boolean> =>
      ipcRenderer.invoke('ai:start-engine', customUrl),
    checkStatus: (customUrl?: string): Promise<OllamaStatus> =>
      ipcRenderer.invoke('ai:check-status', customUrl),
    sendMessage: (params: {
      requestId: string;
      model: string;
      messages: Array<{ role: string; content: string; images?: string[] }>;
      temperature?: number;
      maxTokens?: number;
      contextLength?: number;
      ollamaUrl?: string;
    }): Promise<void> => ipcRenderer.invoke('ai:send-message', params),
    stopGeneration: (requestId: string): Promise<boolean> =>
      ipcRenderer.invoke('ai:stop-generation', requestId),
    onChunk: (callback: (data: { requestId: string; chunk: string }) => void) => {
      const subscription = (_: any, data: { requestId: string; chunk: string }) => callback(data);
      ipcRenderer.on('ai:chunk', subscription);
      return () => ipcRenderer.removeListener('ai:chunk', subscription);
    },
    onDone: (callback: (data: { requestId: string; fullText: string }) => void) => {
      const subscription = (_: any, data: { requestId: string; fullText: string }) => callback(data);
      ipcRenderer.on('ai:done', subscription);
      return () => ipcRenderer.removeListener('ai:done', subscription);
    },
    onError: (callback: (data: { requestId: string; error: string }) => void) => {
      const subscription = (_: any, data: { requestId: string; error: string }) => callback(data);
      ipcRenderer.on('ai:error', subscription);
      return () => ipcRenderer.removeListener('ai:error', subscription);
    },
    pullModel: (params: { modelName: string; ollamaUrl?: string }): Promise<void> =>
      ipcRenderer.invoke('ai:pull-model', params),
    onPullProgress: (callback: (data: { modelName: string; status: string; completed?: number; total?: number }) => void) => {
      const subscription = (_: any, data: any) => callback(data);
      ipcRenderer.on('ai:pull-progress', subscription);
      return () => ipcRenderer.removeListener('ai:pull-progress', subscription);
    },
    onPullDone: (callback: (data: { modelName: string }) => void) => {
      const subscription = (_: any, data: any) => callback(data);
      ipcRenderer.on('ai:pull-done', subscription);
      return () => ipcRenderer.removeListener('ai:pull-done', subscription);
    },
    onPullError: (callback: (data: { modelName: string; error: string }) => void) => {
      const subscription = (_: any, data: any) => callback(data);
      ipcRenderer.on('ai:pull-error', subscription);
      return () => ipcRenderer.removeListener('ai:pull-error', subscription);
    }
  },

  // Hardware Information
  hardware: {
    getInfo: (): Promise<HardwareInfo> => ipcRenderer.invoke('hardware:get-info')
  },

  // Image Generation & Studio
  images: {
    getModels: (): Promise<Array<{ name: string; path: string; sizeBytes: number; isDefault: boolean }>> =>
      ipcRenderer.invoke('images:get-models'),
    generate: (params: ImageGenParams): Promise<void> =>
      ipcRenderer.invoke('images:generate', params),
    edit: (params: ImageEditParams): Promise<void> =>
      ipcRenderer.invoke('images:edit', params),
    stopGeneration: (id: string): Promise<boolean> =>
      ipcRenderer.invoke('images:stop-generation', id),
    getHistory: (limit?: number, offset?: number): Promise<GeneratedImageRecord[]> =>
      ipcRenderer.invoke('images:get-history', limit, offset),
    getRecord: (id: string): Promise<GeneratedImageRecord | null> =>
      ipcRenderer.invoke('images:get-record', id),
    delete: (id: string, filePath: string): Promise<boolean> =>
      ipcRenderer.invoke('images:delete', id, filePath),
    saveAs: (filePath: string, defaultName?: string): Promise<{ success: boolean; filePath?: string; canceled?: boolean }> =>
      ipcRenderer.invoke('images:save-as', filePath, defaultName),
    openFolder: (): Promise<void> =>
      ipcRenderer.invoke('images:open-folder'),
    downloadModel: (params: { url: string; fileName: string }): Promise<void> =>
      ipcRenderer.invoke('images:download-model', params),
    importModel: (): Promise<{ canceled: boolean; path?: string; name?: string }> =>
      ipcRenderer.invoke('images:import-model'),
    onProgress: (callback: (data: { id: string; status: string }) => void) => {
      const subscription = (_: any, data: { id: string; status: string }) => callback(data);
      ipcRenderer.on('images:progress', subscription);
      return () => ipcRenderer.removeListener('images:progress', subscription);
    },
    onDone: (callback: (data: { id: string; record: GeneratedImageRecord }) => void) => {
      const subscription = (_: any, data: { id: string; record: GeneratedImageRecord }) => callback(data);
      ipcRenderer.on('images:done', subscription);
      return () => ipcRenderer.removeListener('images:done', subscription);
    },
    onError: (callback: (data: { id: string; error: string }) => void) => {
      const subscription = (_: any, data: { id: string; error: string }) => callback(data);
      ipcRenderer.on('images:error', subscription);
      return () => ipcRenderer.removeListener('images:error', subscription);
    },
    onDownloadProgress: (callback: (data: { fileName: string; completed: number; total: number; percent: number }) => void) => {
      const subscription = (_: any, data: any) => callback(data);
      ipcRenderer.on('images:download-progress', subscription);
      return () => ipcRenderer.removeListener('images:download-progress', subscription);
    },
    onDownloadDone: (callback: (data: { fileName: string; modelPath: string }) => void) => {
      const subscription = (_: any, data: any) => callback(data);
      ipcRenderer.on('images:download-done', subscription);
      return () => ipcRenderer.removeListener('images:download-done', subscription);
    },
    onDownloadError: (callback: (data: { fileName: string; error: string }) => void) => {
      const subscription = (_: any, data: any) => callback(data);
      ipcRenderer.on('images:download-error', subscription);
      return () => ipcRenderer.removeListener('images:download-error', subscription);
    }
  },

  // Intent Routing & Prompt Enhancement
  router: {
    classify: (text: string, hasImages?: boolean, hasPrevImg?: boolean): Promise<{ intent: string; cleanPrompt: string; confidence: number }> =>
      ipcRenderer.invoke('router:classify', text, hasImages, hasPrevImg),
    enhancePrompt: (prompt: string): Promise<string> =>
      ipcRenderer.invoke('router:enhance-prompt', prompt)
  },

  // Database / History
  db: {
    getChats: (query?: string): Promise<ChatSession[]> =>
      ipcRenderer.invoke('db:get-chats', query),
    getChat: (id: string): Promise<ChatSession | null> =>
      ipcRenderer.invoke('db:get-chat', id),
    saveChat: (chat: ChatSession): Promise<void> =>
      ipcRenderer.invoke('db:save-chat', chat),
    updateChatTitle: (id: string, title: string): Promise<void> =>
      ipcRenderer.invoke('db:update-chat-title', id, title),
    deleteChat: (id: string): Promise<void> =>
      ipcRenderer.invoke('db:delete-chat', id),
    clearAllChats: (): Promise<void> =>
      ipcRenderer.invoke('db:clear-all-chats'),
    getMessages: (chatId: string): Promise<ChatMessage[]> =>
      ipcRenderer.invoke('db:get-messages', chatId),
    saveMessage: (message: ChatMessage): Promise<void> =>
      ipcRenderer.invoke('db:save-message', message),
    updateMessageContent: (id: string, content: string): Promise<void> =>
      ipcRenderer.invoke('db:update-message-content', id, content),
    deleteMessagesAfter: (chatId: string, timestamp: number): Promise<void> =>
      ipcRenderer.invoke('db:delete-messages-after', chatId, timestamp),
    getSettings: (): Promise<Partial<AppSettings>> =>
      ipcRenderer.invoke('db:get-settings'),
    saveSetting: (key: string, value: any): Promise<void> =>
      ipcRenderer.invoke('db:save-setting', key, value),
    getStorageInfo: (): Promise<StorageInfo> =>
      ipcRenderer.invoke('db:get-storage-info')
  },

  // Files & Local RAG
  files: {
    selectFile: (): Promise<{ canceled: boolean; file?: { name: string; path: string; size: number; ext: string } }> =>
      ipcRenderer.invoke('files:select-file'),
    selectImage: (): Promise<{
      canceled: boolean;
      images: Array<{ name: string; path: string; base64: string; dataUrl: string; size: number }>;
      image?: { name: string; path: string; base64: string; dataUrl: string; size: number };
    }> => ipcRenderer.invoke('files:select-image'),
    getImageDataUrl: (filePath: string): Promise<string> =>
      ipcRenderer.invoke('files:get-image-data-url', filePath),
    processDocument: (filePath: string): Promise<{ name: string; path: string; text: string; chunkCount: number }> =>
      ipcRenderer.invoke('files:process-document', filePath),
    queryDocumentRag: (params: { query: string; documentName: string; text: string }): Promise<{ augmentedPrompt: string; chunks: any[] }> =>
      ipcRenderer.invoke('files:query-rag', params)
  },

  // Window Controls & System Diagnostics
  system: {
    minimizeWindow: () => ipcRenderer.send('window:minimize'),
    maximizeWindow: () => ipcRenderer.send('window:maximize'),
    closeWindow: () => ipcRenderer.send('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:is-maximized'),
    getSystemDiagnostics: (customOllamaUrl?: string): Promise<SystemDiagnostic> =>
      ipcRenderer.invoke('system:get-diagnostics', customOllamaUrl),
    openExternal: (url: string) => ipcRenderer.send('system:open-external', url)
  }
};

contextBridge.exposeInMainWorld('snvAi', api);

export type SnvAiApi = typeof api;
