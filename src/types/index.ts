export type AppTheme = 'dark' | 'light' | 'system';
export type AIMode = 'general' | 'study' | 'coding' | 'document';

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  content?: string;
  path?: string;
  previewUrl?: string;
  base64?: string;
}

export interface GeneratedImageRecord {
  id: string;
  prompt: string;
  enhancedPrompt?: string;
  filePath: string;
  width: number;
  height: number;
  steps: number;
  seed: number;
  model: string;
  createdAt: number;
  parentImageId?: string;
  isAiGenerated: boolean;
}

export interface ImageGenParams {
  id: string;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfgScale?: number;
  seed?: number;
  modelPath?: string;
  samplingMethod?: string;
}

export interface ImageEditParams extends ImageGenParams {
  initImagePath: string;
  strength?: number;
}

export interface HardwareInfo {
  gpuName: string;
  vramGB: number;
  cpuModel: string;
  ramGB: number;
  freeRamGB: number;
  diskFreeGB: number;
  deviceType: 'NVIDIA GPU (CUDA/Vulkan)' | 'Vulkan GPU' | 'CPU';
  recommendedModel: string;
  optimalResolution: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  model?: string;
  mode?: AIMode;
  attachments?: Attachment[];
  imageRecord?: GeneratedImageRecord;
  isStreaming?: boolean;
  error?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  mode: AIMode;
  pinned?: boolean;
}

export interface LocalModel {
  name: string;
  size: number;
  digest: string;
  modifiedAt: string;
  family?: string;
  format?: string;
  parameterSize?: string;
  quantizationLevel?: string;
  supportsVision?: boolean;
}

export interface AppSettings {
  theme: AppTheme;
  startWithWindows: boolean;
  ollamaUrl: string;
  selectedModel: string;
  temperature: number;
  maxTokens: number;
  contextLength: number;
  enterToSend: boolean;
  showTimestamps: boolean;
  saveHistory: boolean;
  strictOfflineMode: boolean;
  studyModePrompt: string;
  codingModePrompt: string;
  documentModePrompt: string;
  autoEnhancePrompts?: boolean;
  selectedImageModel?: string;
  imageSteps?: number;
  imageWidth?: number;
  imageHeight?: number;
  imageCfgScale?: number;
}

export interface OllamaStatus {
  isRunning: boolean;
  version?: string;
  models: LocalModel[];
  error?: string;
  url: string;
}

export interface StorageInfo {
  chatsCount: number;
  messagesCount: number;
  dbSizeBytes: number;
  dbPath: string;
  imagesCount?: number;
  imagesSizeBytes?: number;
}

export interface SystemDiagnostic {
  desktopApp: { ok: boolean; message: string };
  localEngine: { ok: boolean; message: string; version?: string };
  installedModels: { ok: boolean; message: string; count: number };
  localDatabase: { ok: boolean; message: string; path?: string };
  fileStorage: { ok: boolean; message: string };
  imageGenEngine?: { ok: boolean; message: string };
}
