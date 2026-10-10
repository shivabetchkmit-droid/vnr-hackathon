import { app, BrowserWindow, ipcMain, dialog, shell, protocol } from 'electron';
import path from 'path';
import fs from 'fs';
import { OllamaService } from './services/ollamaService';
import { DbService } from './services/dbService';
import { DocumentParser } from './services/documentParser';
import { RagService } from './services/ragService';
import { HardwareService } from './services/hardwareService';
import { ImageGenService, ImageGenParams, ImageEditParams } from './services/imageGenService';
import { RouterService } from './services/routerService';
import { SystemDiagnostic } from './types';

let mainWindow: BrowserWindow | null = null;
let ollamaService: OllamaService;
let dbService: DbService;
let imageGenService: ImageGenService;

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow(): void {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const iconPath = path.join(__dirname, '../assets/icon.png');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    frame: false, // Modern frameless custom titlebar
    title: 'SNV AI',
    backgroundColor: '#0f1117',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Handle external links safely
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialize services and IPC
async function initApp() {
  const userData = app.getPath('userData');
  ollamaService = new OllamaService();
  dbService = new DbService(userData);
  imageGenService = new ImageGenService(userData);

  await dbService.init();

  // Auto-start Ollama in background so it's ready immediately
  ollamaService.ensureRunning().catch(console.error);

  setupIpcHandlers();
  createWindow();
}

function setupIpcHandlers() {
  // --- AI Chat IPC ---
  ipcMain.handle('ai:start-engine', async (_, customUrl?: string) => {
    return await ollamaService.ensureRunning(customUrl);
  });

  ipcMain.handle('ai:check-status', async (_, customUrl?: string) => {
    return await ollamaService.getStatus(customUrl);
  });

  ipcMain.handle('ai:send-message', async (event, params: {
    requestId: string;
    model: string;
    messages: Array<{ role: string; content: string; images?: string[] }>;
    temperature?: number;
    maxTokens?: number;
    contextLength?: number;
    ollamaUrl?: string;
  }) => {
    const webContents = event.sender;

    // Check if any message contains images
    const hasImages = params.messages.some(m => m.images && m.images.length > 0);
    let targetModel = params.model;

    // If user prompt has images, make sure we use a vision-capable model
    if (hasImages && !ollamaService.isVisionModel(targetModel)) {
      const status = await ollamaService.getStatus(params.ollamaUrl);
      const visionModel = status.models.find(m => m.supportsVision || ollamaService.isVisionModel(m.name));
      targetModel = visionModel ? visionModel.name : 'moondream:latest';
      console.log(`Auto-switching to vision model: ${targetModel}`);
    } else if (!hasImages && ollamaService.isVisionModel(targetModel)) {
      // If user prompt has NO images, vision-only models like moondream MUST NEVER be used!
      const status = await ollamaService.getStatus(params.ollamaUrl);
      const textModel = status.models.find(m => !ollamaService.isVisionModel(m.name));
      targetModel = textModel ? textModel.name : 'llama3.2:latest';
      console.log(`Auto-switching from vision model to text model: ${targetModel}`);
    }

    ollamaService.streamChat(
      params.requestId,
      { ...params, model: targetModel },
      (chunk) => {
        if (!webContents.isDestroyed()) {
          webContents.send('ai:chunk', { requestId: params.requestId, chunk });
        }
      },
      (fullText) => {
        if (!webContents.isDestroyed()) {
          webContents.send('ai:done', { requestId: params.requestId, fullText });
        }
      },
      (error) => {
        if (!webContents.isDestroyed()) {
          webContents.send('ai:error', { requestId: params.requestId, error });
        }
      }
    );
  });

  ipcMain.handle('ai:stop-generation', (_, requestId: string) => {
    return ollamaService.stopGeneration(requestId);
  });

  ipcMain.handle('ai:pull-model', async (event, params: { modelName: string; ollamaUrl?: string }) => {
    const webContents = event.sender;
    ollamaService.pullModel(
      params.modelName,
      params.ollamaUrl,
      (progress) => {
        if (!webContents.isDestroyed()) {
          webContents.send('ai:pull-progress', { modelName: params.modelName, ...progress });
        }
      },
      () => {
        if (!webContents.isDestroyed()) {
          webContents.send('ai:pull-done', { modelName: params.modelName });
        }
      },
      (error) => {
        if (!webContents.isDestroyed()) {
          webContents.send('ai:pull-error', { modelName: params.modelName, error });
        }
      }
    );
  });

  // --- Hardware Information IPC ---
  ipcMain.handle('hardware:get-info', async () => {
    return await HardwareService.getHardwareInfo();
  });

  // --- Image Generation & Studio IPC ---
  ipcMain.handle('images:get-models', () => {
    return imageGenService.getInstalledImageModels();
  });

  ipcMain.handle('images:generate', async (event, params: ImageGenParams) => {
    const webContents = event.sender;
    await imageGenService.generateImage(
      params,
      (status) => {
        if (!webContents.isDestroyed()) {
          webContents.send('images:progress', { id: params.id, status });
        }
      },
      (record) => {
        dbService.saveImageRecord(record);
        if (!webContents.isDestroyed()) {
          webContents.send('images:done', { id: params.id, record });
        }
      },
      (error) => {
        if (!webContents.isDestroyed()) {
          webContents.send('images:error', { id: params.id, error });
        }
      }
    );
  });

  ipcMain.handle('images:edit', async (event, params: ImageEditParams) => {
    const webContents = event.sender;
    await imageGenService.editImage(
      params,
      (status) => {
        if (!webContents.isDestroyed()) {
          webContents.send('images:progress', { id: params.id, status });
        }
      },
      (record) => {
        dbService.saveImageRecord(record);
        if (!webContents.isDestroyed()) {
          webContents.send('images:done', { id: params.id, record });
        }
      },
      (error) => {
        if (!webContents.isDestroyed()) {
          webContents.send('images:error', { id: params.id, error });
        }
      }
    );
  });

  ipcMain.handle('images:stop-generation', (_, id: string) => {
    return imageGenService.stopGeneration(id);
  });

  ipcMain.handle('images:get-history', (_, limit?: number, offset?: number) => {
    return dbService.getImageRecords(limit, offset);
  });

  ipcMain.handle('images:get-record', (_, id: string) => {
    return dbService.getImageRecord(id);
  });

  ipcMain.handle('images:delete', (_, id: string, filePath: string) => {
    imageGenService.deleteImage(filePath);
    dbService.deleteImageRecord(id);
    return true;
  });

  ipcMain.handle('images:save-as', async (_, filePath: string, defaultName?: string) => {
    if (!mainWindow || !fs.existsSync(filePath)) return { success: false };
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Generated Image',
      defaultPath: defaultName || path.basename(filePath),
      filters: [
        { name: 'PNG Image', extensions: ['png'] },
        { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] },
        { name: 'WebP Image', extensions: ['webp'] }
      ]
    });

    if (result.canceled || !result.filePath) return { success: false, canceled: true };
    await imageGenService.saveImageAs(filePath, result.filePath);
    return { success: true, filePath: result.filePath };
  });

  ipcMain.handle('images:open-folder', () => {
    const imagesDir = path.join(app.getPath('userData'), 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    shell.openPath(imagesDir);
  });

  ipcMain.handle('images:download-model', async (event, params: { url: string; fileName: string }) => {
    const webContents = event.sender;
    imageGenService.downloadModel(
      params.url,
      params.fileName,
      (progress) => {
        if (!webContents.isDestroyed()) {
          webContents.send('images:download-progress', { fileName: params.fileName, ...progress });
        }
      },
      (modelPath) => {
        if (!webContents.isDestroyed()) {
          webContents.send('images:download-done', { fileName: params.fileName, modelPath });
        }
      },
      (error) => {
        if (!webContents.isDestroyed()) {
          webContents.send('images:download-error', { fileName: params.fileName, error });
        }
      }
    );
  });

  ipcMain.handle('images:import-model', async () => {
    if (!mainWindow) return { canceled: true };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Image Model File (.safetensors or .gguf)',
      properties: ['openFile'],
      filters: [
        { name: 'Diffusion Models', extensions: ['safetensors', 'gguf', 'ckpt', 'bin'] }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) return { canceled: true };
    const src = result.filePaths[0];
    const targetDir = path.join(app.getPath('userData'), 'models', 'images');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const dest = path.join(targetDir, path.basename(src));
    if (src !== dest) {
      fs.copyFileSync(src, dest);
    }
    return { canceled: false, path: dest, name: path.basename(src) };
  });

  // --- Router & Prompt Enhancement IPC ---
  ipcMain.handle('router:classify', (_, text: string, hasImages?: boolean, hasPrevImg?: boolean) => {
    return RouterService.classifyIntent(text, hasImages, hasPrevImg);
  });

  ipcMain.handle('router:enhance-prompt', async (_, prompt: string) => {
    return RouterService.enhancePromptFast(prompt);
  });

  // --- DB IPC ---
  ipcMain.handle('db:get-chats', (_, query?: string) => {
    return dbService.getChats(query);
  });

  ipcMain.handle('db:get-chat', (_, id: string) => {
    return dbService.getChat(id);
  });

  ipcMain.handle('db:save-chat', (_, chat) => {
    dbService.saveChat(chat);
  });

  ipcMain.handle('db:update-chat-title', (_, id: string, title: string) => {
    dbService.updateChatTitle(id, title);
  });

  ipcMain.handle('db:delete-chat', (_, id: string) => {
    dbService.deleteChat(id);
  });

  ipcMain.handle('db:clear-all-chats', () => {
    dbService.clearAllChats();
  });

  ipcMain.handle('db:get-messages', (_, chatId: string) => {
    return dbService.getMessages(chatId);
  });

  ipcMain.handle('db:save-message', (_, message) => {
    dbService.saveMessage(message);
  });

  ipcMain.handle('db:update-message-content', (_, id: string, content: string) => {
    dbService.updateMessageContent(id, content);
  });

  ipcMain.handle('db:delete-messages-after', (_, chatId: string, timestamp: number) => {
    dbService.deleteMessagesAfter(chatId, timestamp);
  });

  ipcMain.handle('db:get-settings', () => {
    return dbService.getSettings();
  });

  ipcMain.handle('db:save-setting', (_, key: string, value: any) => {
    dbService.saveSetting(key, value);
    if (key === 'startWithWindows') {
      app.setLoginItemSettings({
        openAtLogin: Boolean(value),
        openAsHidden: false
      });
    }
  });

  ipcMain.handle('db:get-storage-info', () => {
    return dbService.getStorageInfo();
  });

  // --- Files & RAG IPC ---
  ipcMain.handle('files:select-file', async () => {
    if (!mainWindow) return { canceled: true };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Document to Analyze',
      properties: ['openFile'],
      filters: [
        {
          name: 'Supported Documents & Code',
          extensions: [
            'txt', 'pdf', 'docx', 'md', 'markdown', 'csv', 'json',
            'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'h',
            'html', 'css', 'sql', 'yaml', 'yml', 'xml', 'log'
          ]
        },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const filePath = result.filePaths[0];
    const stat = fs.statSync(filePath);
    return {
      canceled: false,
      file: {
        name: path.basename(filePath),
        path: filePath,
        size: stat.size,
        ext: path.extname(filePath).toLowerCase()
      }
    };
  });

  ipcMain.handle('files:select-image', async () => {
    if (!mainWindow) return { canceled: true, images: [] };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Image(s) for Vision Understanding',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, images: [] };
    }

    const images = result.filePaths.map(filePath => {
      const stat = fs.statSync(filePath);
      const buffer = fs.readFileSync(filePath);
      const base64 = buffer.toString('base64');
      const ext = path.extname(filePath).replace('.', '').toLowerCase();
      const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
      return {
        name: path.basename(filePath),
        path: filePath,
        base64,
        dataUrl: `data:${mime};base64,${base64}`,
        size: stat.size
      };
    });

    return {
      canceled: false,
      images,
      // For backwards compatibility
      image: images[0]
    };
  });

  ipcMain.handle('files:get-image-data-url', (_, filePath: string) => {
    try {
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        const base64 = buffer.toString('base64');
        const ext = path.extname(filePath).replace('.', '').toLowerCase();
        const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
        return `data:${mime};base64,${base64}`;
      }
    } catch (e) {
      console.error('Failed to read image data URL:', e);
    }
    return '';
  });

  ipcMain.handle('files:process-document', async (_, filePath: string) => {
    const doc = await DocumentParser.parseFile(filePath);
    const chunks = RagService.chunkText(doc.name, doc.text);
    return {
      name: doc.name,
      path: doc.path,
      text: doc.text,
      chunkCount: chunks.length
    };
  });

  ipcMain.handle('files:query-rag', async (_, params: { query: string; documentName: string; text: string }) => {
    const chunks = RagService.chunkText(params.documentName, params.text);
    const relevant = RagService.retrieveRelevantChunks(params.query, chunks, 5);
    const augmentedPrompt = RagService.buildAugmentedPrompt(params.query, relevant, params.documentName);
    return {
      augmentedPrompt,
      chunks: relevant
    };
  });

  // --- Window Controls ---
  ipcMain.on('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on('window:close', () => {
    mainWindow?.close();
  });

  ipcMain.handle('window:is-maximized', () => {
    return mainWindow?.isMaximized() || false;
  });

  ipcMain.on('system:open-external', (_, url: string) => {
    shell.openExternal(url);
  });

  // --- Diagnostics check for System & Hardware ---
  ipcMain.handle('system:get-diagnostics', async (_, customOllamaUrl?: string): Promise<SystemDiagnostic> => {
    const ollamaStatus = await ollamaService.getStatus(customOllamaUrl);
    const storage = dbService.getStorageInfo();
    const sdBinary = imageGenService.findSdCliBinary();
    const installedImageModels = imageGenService.getInstalledImageModels();

    return {
      desktopApp: {
        ok: true,
        message: 'SNV AI desktop application is running locally'
      },
      localEngine: {
        ok: ollamaStatus.isRunning,
        message: ollamaStatus.isRunning
          ? 'Ollama local inference service connected'
          : (ollamaStatus.error || 'Ollama engine not detected'),
        version: ollamaStatus.version
      },
      installedModels: {
        ok: ollamaStatus.models.length > 0,
        message: ollamaStatus.models.length > 0
          ? `${ollamaStatus.models.length} local LLM model(s) installed`
          : 'No local AI models installed',
        count: ollamaStatus.models.length
      },
      localDatabase: {
        ok: true,
        message: 'Local SQLite database operational',
        path: storage.dbPath
      },
      fileStorage: {
        ok: true,
        message: 'Local filesystem access ready for document RAG'
      },
      imageGenEngine: {
        ok: !!sdBinary,
        message: sdBinary
          ? `Local image engine ready (${installedImageModels.length} image model(s) installed)`
          : 'Image generation engine runtime not found'
      }
    };
  });
}

app.whenReady().then(initApp);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
