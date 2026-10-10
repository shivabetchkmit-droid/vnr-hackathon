import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn, execSync } from 'child_process';
import { LocalModel, OllamaStatus } from '../types';

export class OllamaService {
  private defaultHost = '127.0.0.1';
  private defaultPort = 11434;
  private activeControllers: Map<string, AbortController> = new Map();
  private isStartingEngine = false;

  private getBaseUrl(customUrl?: string): { host: string; port: number } {
    if (!customUrl) {
      return { host: this.defaultHost, port: this.defaultPort };
    }
    try {
      const parsed = new URL(customUrl);
      return {
        host: parsed.hostname || this.defaultHost,
        port: parseInt(parsed.port, 10) || this.defaultPort
      };
    } catch {
      return { host: this.defaultHost, port: this.defaultPort };
    }
  }

  // Locate the Ollama executable on the local Windows system
  public findOllamaBinary(): string | null {
    const localAppData = process.env.LOCALAPPDATA || '';
    const userProfile = process.env.USERPROFILE || '';
    const programFiles = process.env.ProgramFiles || '';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || '';

    const candidates = [
      path.join(localAppData, 'Programs', 'Ollama', 'ollama app.exe'),
      path.join(userProfile, 'AppData', 'Local', 'Programs', 'Ollama', 'ollama app.exe'),
      path.join(localAppData, 'Programs', 'Ollama', 'ollama.exe'),
      path.join(userProfile, 'AppData', 'Local', 'Programs', 'Ollama', 'ollama.exe'),
      path.join(programFiles, 'Ollama', 'ollama app.exe'),
      path.join(programFiles, 'Ollama', 'ollama.exe'),
      path.join(programFilesX86, 'Ollama', 'ollama app.exe'),
      path.join(programFilesX86, 'Ollama', 'ollama.exe')
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    try {
      const stdout = execSync('where.exe ollama', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
      const firstLine = stdout.split('\r\n')[0].trim();
      if (firstLine && fs.existsSync(firstLine)) {
        return firstLine;
      }
    } catch {
      // not in PATH
    }

    return null;
  }

  // Quick ping to check if the Ollama endpoint is answering
  public async ping(customUrl?: string): Promise<boolean> {
    const { host, port } = this.getBaseUrl(customUrl);
    return new Promise((resolve) => {
      const req = http.request(
        {
          host,
          port,
          path: '/api/tags',
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

  // Ensure Ollama is running; if not, automatically spawn it in the background
  public async ensureRunning(customUrl?: string): Promise<boolean> {
    const isUp = await this.ping(customUrl);
    if (isUp) return true;

    if (this.isStartingEngine) {
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 400));
        if (await this.ping(customUrl)) return true;
      }
      return false;
    }

    this.isStartingEngine = true;
    try {
      const binary = this.findOllamaBinary();
      if (!binary) {
        console.warn('Ollama binary not found on this computer');
        return false;
      }

      console.log(`Auto-starting local Ollama service: ${binary}`);
      const args = binary.toLowerCase().includes('ollama app.exe') ? [] : ['serve'];
      const child = spawn(binary, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      });
      child.unref();

      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const ok = await this.ping(customUrl);
        if (ok) {
          console.log('Local AI engine successfully started and listening');
          return true;
        }
      }
    } catch (err) {
      console.error('Failed to spawn local Ollama engine:', err);
    } finally {
      this.isStartingEngine = false;
    }

    return await this.ping(customUrl);
  }

  // Check if a model supports vision based on its name or details
  public isVisionModel(modelName: string): boolean {
    const lower = modelName.toLowerCase();
    const visionKeywords = ['vision', 'llava', 'minicpm-v', 'bakllava', 'moondream', 'qwen2-vl', 'cogvlm'];
    return visionKeywords.some(keyword => lower.includes(keyword));
  }

  // Check Ollama service health and get installed models
  public async getStatus(customUrl?: string): Promise<OllamaStatus> {
    const { host, port } = this.getBaseUrl(customUrl);
    const url = `http://${host}:${port}`;

    let isUp = await this.ping(customUrl);
    if (!isUp) {
      isUp = await this.ensureRunning(customUrl);
    }

    if (!isUp) {
      return {
        isRunning: false,
        models: [],
        error: 'Local AI engine is not running. Please make sure Ollama is installed and started.',
        url
      };
    }

    return new Promise((resolve) => {
      const req = http.request(
        {
          host,
          port,
          path: '/api/tags',
          method: 'GET',
          timeout: 2500
        },
        (res) => {
          if (res.statusCode !== 200) {
            resolve({
              isRunning: false,
              models: [],
              error: `Local engine returned status ${res.statusCode}`,
              url
            });
            return;
          }

          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              const rawModels = parsed.models || [];
              const models: LocalModel[] = rawModels.map((m: any) => ({
                name: m.name,
                size: m.size || 0,
                digest: m.digest || '',
                modifiedAt: m.modified_at || '',
                family: m.details?.family || '',
                format: m.details?.format || '',
                parameterSize: m.details?.parameter_size || '',
                quantizationLevel: m.details?.quantization_level || '',
                supportsVision: this.isVisionModel(m.name)
              }));

              resolve({
                isRunning: true,
                models,
                url
              });
            } catch (err: any) {
              resolve({
                isRunning: true,
                models: [],
                error: 'Could not parse local model list',
                url
              });
            }
          });
        }
      );

      req.on('error', (err: any) => {
        resolve({
          isRunning: false,
          models: [],
          error: 'Local AI engine is not running. Please make sure Ollama is started.',
          url
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          isRunning: false,
          models: [],
          error: 'Connection to local AI engine timed out',
          url
        });
      });

      req.end();
    });
  }

  // Stream chat generation from Ollama
  public async streamChat(
    requestId: string,
    params: {
      model: string;
      messages: Array<{ role: string; content: string; images?: string[] }>;
      temperature?: number;
      maxTokens?: number;
      contextLength?: number;
      ollamaUrl?: string;
    },
    onChunk: (chunk: string) => void,
    onDone: (fullText: string) => void,
    onError: (error: string) => void
  ): Promise<void> {
    const isReady = await this.ensureRunning(params.ollamaUrl);
    if (!isReady) {
      onError('Local AI engine is starting up or not running. Please wait a moment and try again.');
      return;
    }

    const { host, port } = this.getBaseUrl(params.ollamaUrl);
    const controller = new AbortController();
    this.activeControllers.set(requestId, controller);

    const postData = JSON.stringify({
      model: params.model,
      messages: params.messages,
      stream: true,
      options: {
        temperature: params.temperature ?? 0.7,
        top_p: 0.9,
        num_predict: params.maxTokens ?? 4096,
        num_ctx: params.contextLength ?? 8192
      }
    });

    let fullResponse = '';
    let isDoneTriggered = false;

    const triggerDone = (text: string) => {
      if (isDoneTriggered) return;
      isDoneTriggered = true;
      this.activeControllers.delete(requestId);
      onDone(text);
    };

    const req = http.request(
      {
        host,
        port,
        path: '/api/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        signal: controller.signal
      },
      (res) => {
        if (res.statusCode !== 200) {
          this.activeControllers.delete(requestId);
          let errData = '';
          res.on('data', (c) => (errData += c));
          res.on('end', () => {
            onError(`Local engine error (${res.statusCode}): ${errData || 'Model request failed'}`);
          });
          return;
        }

        let buffer = '';

        res.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const parsed = JSON.parse(trimmed);
              if (parsed.message?.content) {
                const token = parsed.message.content;
                fullResponse += token;
                onChunk(token);
              }
              if (parsed.done) {
                triggerDone(fullResponse);
              }
            } catch {
              // ignore partial line JSON parse errors
            }
          }
        });

        res.on('end', () => {
          if (buffer.trim()) {
            try {
              const parsed = JSON.parse(buffer.trim());
              if (parsed.message?.content) {
                fullResponse += parsed.message.content;
                onChunk(parsed.message.content);
              }
            } catch {
              // ignore
            }
          }
          triggerDone(fullResponse);
        });
      }
    );

    req.on('error', (err: any) => {
      this.activeControllers.delete(requestId);
      if (err.name === 'AbortError' || controller.signal.aborted) {
        onDone(fullResponse);
      } else {
        onError(`AI generation failed: ${err.message || 'Cannot communicate with local model'}`);
      }
    });

    req.write(postData);
    req.end();
  }

  // Stop active generation
  public stopGeneration(requestId: string): boolean {
    const controller = this.activeControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(requestId);
      return true;
    }
    return false;
  }

  // Pull local model with explicit user authorization
  public async pullModel(
    modelName: string,
    ollamaUrl: string | undefined,
    onProgress: (data: { status: string; completed?: number; total?: number }) => void,
    onDone: () => void,
    onError: (err: string) => void
  ): Promise<void> {
    const { host, port } = this.getBaseUrl(ollamaUrl);
    const postData = JSON.stringify({ name: modelName, stream: true });

    const req = http.request(
      {
        host,
        port,
        path: '/api/pull',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      },
      (res) => {
        if (res.statusCode !== 200) {
          onError(`Failed to download model (HTTP ${res.statusCode})`);
          return;
        }

        let buffer = '';
        res.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const parsed = JSON.parse(trimmed);
              onProgress({
                status: parsed.status,
                completed: parsed.completed,
                total: parsed.total
              });
              if (parsed.status === 'success') {
                onDone();
              }
            } catch {
              // ignore
            }
          }
        });

        res.on('end', () => {
          onDone();
        });
      }
    );

    req.on('error', (err: any) => {
      onError(`Error pulling model: ${err.message}`);
    });

    req.write(postData);
    req.end();
  }
}
