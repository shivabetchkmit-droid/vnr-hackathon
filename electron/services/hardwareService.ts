import { execSync } from 'child_process';
import os from 'os';
import fs from 'fs';

export interface HardwareInfo {
  gpuName: string;
  vramMB: number;
  cudaAvailable: boolean;
  cudaVersion?: string;
  cpuName: string;
  cpuCores: number;
  totalRamGB: number;
  freeRamGB: number;
  diskFreeGB: number;
  deviceType: 'NVIDIA GPU (CUDA/Vulkan)' | 'Vulkan GPU' | 'CPU';
  recommendedModel: string;
  recommendedResolution: { width: number; height: number };
}

export class HardwareService {
  private static cachedInfo: HardwareInfo | null = null;

  public static getHardwareInfo(): HardwareInfo {
    if (this.cachedInfo) {
      return this.cachedInfo;
    }

    let gpuName = 'Integrated Graphics / CPU';
    let vramMB = 0;
    let cudaAvailable = false;
    let cudaVersion = '';

    // Check nvidia-smi
    try {
      const smiOutput = execSync('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits', {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 3000
      });
      const lines = smiOutput.trim().split('\n');
      if (lines.length > 0) {
        const [name, memory] = lines[0].split(',').map((s) => s.trim());
        if (name) {
          gpuName = name;
          vramMB = parseInt(memory, 10) || 0;
          cudaAvailable = true;
        }
      }
    } catch {
      // nvidia-smi failed or not available, fallback to WMI
      try {
        const wmiOutput = execSync('powershell -NoProfile -Command "(Get-CimInstance Win32_VideoController | Select-Object -First 1 Name, AdapterRAM) | ConvertTo-Json"', {
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: 4000
        });
        const parsed = JSON.parse(wmiOutput);
        if (parsed.Name) {
          gpuName = parsed.Name;
          vramMB = Math.round((parsed.AdapterRAM || 0) / (1024 * 1024));
        }
      } catch {
        // ignore
      }
    }

    // Check CUDA version if nvidia-smi exists
    if (cudaAvailable) {
      try {
        const cudaOut = execSync('nvidia-smi', {
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: 3000
        });
        const match = cudaOut.match(/CUDA Version:\s*([0-9.]+)/i);
        if (match) {
          cudaVersion = match[1];
        }
      } catch {
        // ignore
      }
    }

    // CPU Info
    const cpus = os.cpus();
    const cpuName = cpus[0]?.model.trim() || 'Intel / AMD Processor';
    const cpuCores = cpus.length;

    // RAM Info
    const totalRamGB = Math.round((os.totalmem() / (1024 * 1024 * 1024)) * 10) / 10;
    const freeRamGB = Math.round((os.freemem() / (1024 * 1024 * 1024)) * 10) / 10;

    // Free Disk Space on C:
    let diskFreeGB = 0;
    try {
      const diskOut = execSync('powershell -NoProfile -Command "[math]::Round((Get-PSDrive C).Free / 1GB, 1)"', {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 3000
      });
      diskFreeGB = parseFloat(diskOut.trim()) || 0;
    } catch {
      diskFreeGB = 50;
    }

    let deviceType: HardwareInfo['deviceType'] = 'CPU';
    if (cudaAvailable && vramMB >= 3500) {
      deviceType = 'NVIDIA GPU (CUDA/Vulkan)';
    } else if (vramMB >= 2000) {
      deviceType = 'Vulkan GPU';
    }

    // Recommendations based on hardware
    let recommendedModel = 'SD-Turbo (Fast 512x512)';
    let recommendedResolution = { width: 512, height: 512 };

    if (vramMB >= 8000) {
      recommendedModel = 'SDXL-Lightning / SDXL (1024x1024)';
      recommendedResolution = { width: 1024, height: 1024 };
    } else if (vramMB >= 4000) {
      recommendedModel = 'SD-Turbo / DreamShaper 8 (512x512)';
      recommendedResolution = { width: 512, height: 512 };
    } else {
      recommendedModel = 'SD-Turbo Q4/Q8 (Low VRAM / CPU)';
      recommendedResolution = { width: 512, height: 512 };
    }

    const info: HardwareInfo = {
      gpuName,
      vramMB,
      cudaAvailable,
      cudaVersion,
      cpuName,
      cpuCores,
      totalRamGB,
      freeRamGB,
      diskFreeGB,
      deviceType,
      recommendedModel,
      recommendedResolution
    };

    this.cachedInfo = info;
    return info;
  }
}
