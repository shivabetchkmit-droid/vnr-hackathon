import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';

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
  strength?: number; // 0.1 to 1.0 (default 0.65)
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

export class ImageGenService {
  private activePromptIds: Map<string, string> = new Map();
  private baseDir: string;
  private imagesDir: string;
  private modelsDir: string;
  private comfyPort = 8188;
  private comfyHost = '127.0.0.1';
  private isStartingEngine = false;

  private comfyPythonwPath =
    'C:\\Users\\HP\\AppData\\Local\\Comfy-Desktop\\ComfyUI-Installs\\shiva\\ComfyUI\\.venv\\Scripts\\pythonw.exe';
  private comfyPythonPath =
    'C:\\Users\\HP\\AppData\\Local\\Comfy-Desktop\\ComfyUI-Installs\\shiva\\ComfyUI\\.venv\\Scripts\\python.exe';
  private comfyWorkingDir =
    'C:\\Users\\HP\\AppData\\Local\\Comfy-Desktop\\ComfyUI-Installs\\shiva';
  private comfyOutputDir =
    'C:\\Users\\HP\\AppData\\Local\\Comfy-Desktop\\ComfyUI-Shared\\output';
  private comfyInputDir =
    'C:\\Users\\HP\\AppData\\Local\\Comfy-Desktop\\ComfyUI-Shared\\input';
  private comfyModelPathsYaml =
    'C:\\Users\\HP\\AppData\\Roaming\\Comfy Desktop\\instance-model-paths\\inst-1791436812863.yaml';
  private defaultModelCheckpoint = 'sd_xl_base_1.0.safetensors';

  constructor(userDataPath: string) {
    this.baseDir = userDataPath;
    this.imagesDir = path.join(userDataPath, 'images');
    this.modelsDir = path.join(userDataPath, 'models', 'images');

    if (!fs.existsSync(this.imagesDir)) {
      fs.mkdirSync(this.imagesDir, { recursive: true });
    }
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true });
    }
    if (!fs.existsSync(this.comfyOutputDir)) {
      fs.mkdirSync(this.comfyOutputDir, { recursive: true });
    }
    if (!fs.existsSync(this.comfyInputDir)) {
      fs.mkdirSync(this.comfyInputDir, { recursive: true });
    }
  }

  // Get python executable - prefers pythonw.exe to completely prevent CMD window from popping up
  public getPythonExecutable(): string {
    if (fs.existsSync(this.comfyPythonwPath)) {
      return this.comfyPythonwPath;
    }
    return this.comfyPythonPath;
  }

  // Check if local image generation backend runtime is found
  public findSdCliBinary(): string | null {
    const exe = this.getPythonExecutable();
    if (fs.existsSync(exe)) {
      return exe;
    }
    return null;
  }

  // Ping ComfyUI HTTP server
  public async pingComfy(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.request(
        {
          host: this.comfyHost,
          port: this.comfyPort,
          path: '/system_stats',
          method: 'GET',
          timeout: 1500
        },
        (res) => {
          resolve(res.statusCode === 200);
        }
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    });
  }

  // Ensure ComfyUI backend is up and running silently in background
  public async ensureRunning(onStatusUpdate?: (status: string) => void): Promise<boolean> {
    const isUp = await this.pingComfy();
    if (isUp) return true;

    if (this.isStartingEngine) {
      for (let i = 0; i < 70; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        if (await this.pingComfy()) return true;
      }
      return false;
    }

    this.isStartingEngine = true;
    try {
      const pythonExe = this.getPythonExecutable();
      if (fs.existsSync(pythonExe)) {
        console.log(`Auto-starting local ComfyUI SDXL backend silently: ${pythonExe}`);
        onStatusUpdate?.('Initializing local SDXL engine on GPU...');
        const args = [
          '-s',
          'ComfyUI\\main.py',
          '--extra-model-paths-config',
          this.comfyModelPathsYaml,
          '--input-directory',
          this.comfyInputDir,
          '--output-directory',
          this.comfyOutputDir
        ];

        // Using pythonw.exe + windowsHide: true ensures NO console or CMD window is created
        const child = spawn(pythonExe, args, {
          cwd: this.comfyWorkingDir,
          detached: true,
          stdio: 'ignore',
          windowsHide: true
        });
        child.unref();

        for (let i = 0; i < 70; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          if (await this.pingComfy()) {
            console.log('Local ComfyUI SDXL backend successfully started and listening on 8188');
            return true;
          }
          if (i > 0 && i % 5 === 0) {
            onStatusUpdate?.(`Initializing local SDXL engine on GPU (${i}s)...`);
          }
        }
      } else {
        console.warn('ComfyUI Python runtime not found at:', pythonExe);
      }
    } catch (err) {
      console.error('Failed to spawn local ComfyUI service:', err);
    } finally {
      this.isStartingEngine = false;
    }

    return await this.pingComfy();
  }

  // Scan for installed local image models (detects local SDXL Base 1.0)
  public getInstalledImageModels(): Array<{ name: string; path: string; sizeBytes: number; isDefault: boolean }> {
    const models: Array<{ name: string; path: string; sizeBytes: number; isDefault: boolean }> = [];

    // Check ComfyUI Shared models directory
    const comfyCheckpointPath =
      'C:\\Users\\HP\\AppData\\Local\\Comfy-Desktop\\ComfyUI-Shared\\models\\checkpoints\\sd_xl_base_1.0.safetensors';
    if (fs.existsSync(comfyCheckpointPath)) {
      const stat = fs.statSync(comfyCheckpointPath);
      models.push({
        name: 'SDXL Base 1.0 (Local)',
        path: 'sd_xl_base_1.0.safetensors',
        sizeBytes: stat.size,
        isDefault: true
      });
    }

    // Also check local AppData models dir if user added models
    if (fs.existsSync(this.modelsDir)) {
      try {
        const files = fs.readdirSync(this.modelsDir);
        for (const file of files) {
          const ext = path.extname(file).toLowerCase();
          if (['.safetensors', '.gguf', '.ckpt', '.bin'].includes(ext)) {
            const fullPath = path.join(this.modelsDir, file);
            const stat = fs.statSync(fullPath);
            models.push({
              name: file,
              path: fullPath,
              sizeBytes: stat.size,
              isDefault: models.length === 0
            });
          }
        }
      } catch (err) {
        console.error('Error scanning models directory:', err);
      }
    }

    return models;
  }

  // Generate Image from Text Prompt (txt2img) using local SDXL
  public async generateImage(
    params: ImageGenParams,
    onProgress: (status: string) => void,
    onDone: (record: GeneratedImageRecord) => void,
    onError: (error: string) => void
  ): Promise<void> {
    const isReady = await this.ensureRunning((status) => onProgress(status));
    if (!isReady) {
      onError('Local SDXL ComfyUI service is not responding. Please make sure ComfyUI is installed and running.');
      return;
    }

    const width = params.width || 1024;
    const height = params.height || 1024;
    const steps = params.steps || 25;
    const cfgScale = params.cfgScale || 6.5;
    const sampler = params.samplingMethod || 'euler';
    const seed =
      params.seed !== undefined && params.seed >= 0
        ? params.seed
        : Math.floor(Math.random() * 2147483647);
    const negative =
      params.negativePrompt ||
      '(worst quality, low quality:1.4), blurry, deformed, bad anatomy, bad hands, mutated fingers, out of focus, distorted, text, watermark';

    onProgress('Generating image with local SDXL...');

    const workflow = {
      '7': {
        inputs: {
          filename_prefix: 'snv_ai_sdxl',
          images: ['14', 0]
        },
        class_type: 'SaveImage'
      },
      '10': {
        inputs: {
          text: params.prompt,
          clip: ['15', 1]
        },
        class_type: 'CLIPTextEncode'
      },
      '11': {
        inputs: {
          text: negative,
          clip: ['15', 1]
        },
        class_type: 'CLIPTextEncode'
      },
      '12': {
        inputs: {
          seed: seed,
          steps: steps,
          cfg: cfgScale,
          sampler_name: sampler,
          scheduler: 'karras',
          denoise: 1,
          model: ['15', 0],
          positive: ['10', 0],
          negative: ['11', 0],
          latent_image: ['13', 0]
        },
        class_type: 'KSampler'
      },
      '13': {
        inputs: {
          width: width,
          height: height,
          batch_size: 1
        },
        class_type: 'EmptyLatentImage'
      },
      '14': {
        inputs: {
          samples: ['12', 0],
          vae: ['15', 2]
        },
        class_type: 'VAEDecode'
      },
      '15': {
        inputs: {
          ckpt_name: this.defaultModelCheckpoint
        },
        class_type: 'CheckpointLoaderSimple'
      }
    };

    try {
      const promptId = await this.queuePrompt(workflow);
      this.activePromptIds.set(params.id, promptId);

      // Poll history until completed
      let isCompleted = false;
      let attempts = 0;
      const maxAttempts = 150; // up to ~300s

      while (!isCompleted && attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1500));
        attempts++;

        // Verify if user cancelled
        if (!this.activePromptIds.has(params.id)) {
          return;
        }

        onProgress(`Generating image with SDXL (${attempts * 2}s elapsed)...`);

        const hist = await this.getHistory(promptId);
        if (hist && hist[promptId]) {
          const item = hist[promptId];
          if (item.status?.completed) {
            isCompleted = true;
            const outputs = item.outputs;
            const imgInfo = outputs?.['7']?.images?.[0];

            if (!imgInfo) {
              this.activePromptIds.delete(params.id);
              onError('SDXL finished generation but no output image was produced.');
              return;
            }

            const srcFile = path.join(
              this.comfyOutputDir,
              imgInfo.subfolder || '',
              imgInfo.filename
            );

            if (!fs.existsSync(srcFile)) {
              this.activePromptIds.delete(params.id);
              onError(`Generated image not found on disk at: ${srcFile}`);
              return;
            }

            // Copy to SNV AI storage for persistence
            const destFileName = `sdxl_${params.id}_${Date.now()}.png`;
            const destPath = path.join(this.imagesDir, destFileName);
            fs.copyFileSync(srcFile, destPath);

            this.activePromptIds.delete(params.id);

            const record: GeneratedImageRecord = {
              id: params.id,
              prompt: params.prompt,
              enhancedPrompt: params.prompt,
              filePath: destPath,
              width,
              height,
              steps,
              seed,
              model: 'SDXL Base 1.0',
              createdAt: Date.now(),
              isAiGenerated: true
            };

            onDone(record);
            return;
          }

          if (item.status?.status_str === 'error') {
            this.activePromptIds.delete(params.id);
            const errDetails = item.status?.messages
              ? JSON.stringify(item.status.messages)
              : 'Unknown ComfyUI error';
            onError(`SDXL Generation error: ${errDetails}`);
            return;
          }
        }
      }

      if (!isCompleted) {
        this.activePromptIds.delete(params.id);
        onError('Image generation timed out after 5 minutes.');
      }
    } catch (err: any) {
      this.activePromptIds.delete(params.id);
      onError(`SDXL Generation failed: ${err.message || 'Unknown error'}`);
    }
  }

  // Edit / Modify Image (img2img) using local SDXL
  public async editImage(
    params: ImageEditParams,
    onProgress: (status: string) => void,
    onDone: (record: GeneratedImageRecord) => void,
    onError: (error: string) => void
  ): Promise<void> {
    const isReady = await this.ensureRunning((status) => onProgress(status));
    if (!isReady) {
      onError('Local SDXL ComfyUI service is not responding.');
      return;
    }

    if (!fs.existsSync(params.initImagePath)) {
      onError(`Reference image not found: ${params.initImagePath}`);
      return;
    }

    // Copy init image to ComfyUI input folder
    const inputFileName = `input_${params.id}_${Date.now()}.png`;
    const destInputPath = path.join(this.comfyInputDir, inputFileName);
    fs.copyFileSync(params.initImagePath, destInputPath);

    const steps = params.steps || 25;
    const cfgScale = params.cfgScale || 6.5;
    const strength = params.strength !== undefined ? params.strength : 0.65;
    const seed =
      params.seed !== undefined && params.seed >= 0
        ? params.seed
        : Math.floor(Math.random() * 2147483647);
    const negative =
      params.negativePrompt ||
      '(worst quality, low quality:1.4), blurry, deformed, bad anatomy, bad hands, mutated fingers, out of focus, distorted';

    onProgress('Applying image edits with local SDXL...');

    const workflow = {
      '7': {
        inputs: {
          filename_prefix: 'snv_ai_sdxl_edit',
          images: ['14', 0]
        },
        class_type: 'SaveImage'
      },
      '10': {
        inputs: {
          text: params.prompt,
          clip: ['15', 1]
        },
        class_type: 'CLIPTextEncode'
      },
      '11': {
        inputs: {
          text: negative,
          clip: ['15', 1]
        },
        class_type: 'CLIPTextEncode'
      },
      '12': {
        inputs: {
          seed: seed,
          steps: steps,
          cfg: cfgScale,
          sampler_name: 'euler',
          scheduler: 'karras',
          denoise: strength,
          model: ['15', 0],
          positive: ['10', 0],
          negative: ['11', 0],
          latent_image: ['18', 0]
        },
        class_type: 'KSampler'
      },
      '14': {
        inputs: {
          samples: ['12', 0],
          vae: ['15', 2]
        },
        class_type: 'VAEDecode'
      },
      '15': {
        inputs: {
          ckpt_name: this.defaultModelCheckpoint
        },
        class_type: 'CheckpointLoaderSimple'
      },
      '16': {
        inputs: {
          image: inputFileName
        },
        class_type: 'LoadImage'
      },
      '18': {
        inputs: {
          pixels: ['16', 0],
          vae: ['15', 2]
        },
        class_type: 'VAEEncode'
      }
    };

    try {
      const promptId = await this.queuePrompt(workflow);
      this.activePromptIds.set(params.id, promptId);

      let isCompleted = false;
      let attempts = 0;
      const maxAttempts = 150;

      while (!isCompleted && attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1500));
        attempts++;

        if (!this.activePromptIds.has(params.id)) return;

        onProgress(`Modifying image with SDXL (${attempts * 2}s elapsed)...`);

        const hist = await this.getHistory(promptId);
        if (hist && hist[promptId]) {
          const item = hist[promptId];
          if (item.status?.completed) {
            isCompleted = true;
            const outputs = item.outputs;
            const imgInfo = outputs?.['7']?.images?.[0];

            if (!imgInfo) {
              this.activePromptIds.delete(params.id);
              onError('SDXL finished editing but no output image was produced.');
              return;
            }

            const srcFile = path.join(
              this.comfyOutputDir,
              imgInfo.subfolder || '',
              imgInfo.filename
            );

            const destFileName = `sdxl_edit_${params.id}_${Date.now()}.png`;
            const destPath = path.join(this.imagesDir, destFileName);
            fs.copyFileSync(srcFile, destPath);

            this.activePromptIds.delete(params.id);

            const record: GeneratedImageRecord = {
              id: params.id,
              prompt: params.prompt,
              filePath: destPath,
              width: params.width || 1024,
              height: params.height || 1024,
              steps,
              seed,
              model: 'SDXL Base 1.0',
              createdAt: Date.now(),
              parentImageId: params.initImagePath,
              isAiGenerated: true
            };

            onDone(record);
            return;
          }

          if (item.status?.status_str === 'error') {
            this.activePromptIds.delete(params.id);
            onError('SDXL Image editing failed on local engine.');
            return;
          }
        }
      }
    } catch (err: any) {
      this.activePromptIds.delete(params.id);
      onError(`SDXL Editing failed: ${err.message}`);
    }
  }

  // Queue prompt to ComfyUI
  private async queuePrompt(workflow: Record<string, any>): Promise<string> {
    const postData = JSON.stringify({ prompt: workflow });
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: this.comfyHost,
          port: this.comfyPort,
          path: '/prompt',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        },
        (res) => {
          let body = '';
          res.on('data', (d) => (body += d));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              if (parsed.prompt_id) {
                resolve(parsed.prompt_id);
              } else if (parsed.error) {
                reject(new Error(JSON.stringify(parsed.error)));
              } else {
                reject(new Error('No prompt_id returned from ComfyUI'));
              }
            } catch (e) {
              reject(new Error(`Failed to parse ComfyUI response: ${body}`));
            }
          });
        }
      );
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  // Query ComfyUI prompt history
  private async getHistory(promptId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      http
        .get(`http://${this.comfyHost}:${this.comfyPort}/history/${promptId}`, (res) => {
          let body = '';
          res.on('data', (d) => (body += d));
          res.on('end', () => {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              resolve({});
            }
          });
        })
        .on('error', reject);
    });
  }

  // Stop active image generation process
  public stopGeneration(id: string): boolean {
    const promptId = this.activePromptIds.get(id);
    if (promptId) {
      this.activePromptIds.delete(id);
      try {
        const req = http.request({
          host: this.comfyHost,
          port: this.comfyPort,
          path: '/interrupt',
          method: 'POST'
        });
        req.end();
      } catch (e) {
        console.error('Failed to send interrupt to ComfyUI:', e);
      }
      return true;
    }
    return false;
  }

  // Delete generated image file
  public deleteImage(filePath: string): boolean {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
    } catch (err) {
      console.error('Failed to delete image file:', err);
    }
    return false;
  }

  // Save Image As (PNG, JPEG, WebP)
  public async saveImageAs(
    sourcePath: string,
    targetPath: string,
    format: 'png' | 'jpeg' | 'webp' = 'png'
  ): Promise<boolean> {
    if (!fs.existsSync(sourcePath)) {
      throw new Error('Source image not found');
    }
    fs.copyFileSync(sourcePath, targetPath);
    return true;
  }

  // Download model placeholder
  public downloadModel(
    url: string,
    fileName: string,
    onProgress: (data: { completed: number; total: number; percent: number }) => void,
    onDone: (modelPath: string) => void,
    onError: (error: string) => void
  ): void {
    const targetPath = path.join(this.modelsDir, fileName);
    const tempPath = targetPath + '.tmp';
    const file = fs.createWriteStream(tempPath);

    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(tempPath);
          onError(`Failed to download (HTTP ${response.statusCode})`);
          return;
        }

        const total = parseInt(response.headers['content-length'] || '0', 10);
        let completed = 0;

        response.on('data', (chunk) => {
          completed += chunk.length;
          file.write(chunk);
          if (total > 0) {
            onProgress({
              completed,
              total,
              percent: Math.round((completed / total) * 100)
            });
          }
        });

        response.on('end', () => {
          file.end(() => {
            if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
            fs.renameSync(tempPath, targetPath);
            onDone(targetPath);
          });
        });
      })
      .on('error', (err) => {
        file.close();
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        onError(`Download failed: ${err.message}`);
      });
  }
}
