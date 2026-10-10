import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Play,
  RotateCcw,
  Download,
  FolderOpen,
  Trash2,
  Sliders,
  Maximize2,
  Layers,
  Wand2,
  X,
  Check,
  AlertCircle,
  Copy,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Cpu
} from 'lucide-react';
import { GeneratedImageRecord, HardwareInfo } from '../../types';

interface ImageStudioProps {
  onBackToChat?: () => void;
}

const STYLE_PRESETS = [
  { name: 'Natural / Raw', suffix: '' },
  { name: 'Photorealistic', suffix: 'cinematic 35mm photograph, 8k resolution, highly detailed, photorealistic, natural lighting' },
  { name: 'Cyberpunk', suffix: 'cyberpunk aesthetic, neon city illumination, volumetric light, reflective wet streets, 8k render' },
  { name: 'Anime / Manga', suffix: 'anime style, vibrant colors, makoto shinkai aesthetic, clean lines, detailed digital art' },
  { name: 'Watercolor', suffix: 'delicate watercolor painting, artistic brushstrokes, textured paper, pastel wash, soft light' },
  { name: 'Cinematic Fantasy', suffix: 'epic high-fantasy digital art, dramatic lighting, volumetric clouds, intricate details, masterpiece' },
  { name: '3D Render', suffix: 'octane render, unreal engine 5, raytracing, 8k resolution, photorealistic studio render' }
];

const ASPECT_RATIOS = [
  { label: '1:1 Square', width: 1024, height: 1024 },
  { label: '16:9 Landscape', width: 1152, height: 648 },
  { label: '9:16 Portrait', width: 648, height: 1152 },
  { label: '4:3 Standard', width: 1024, height: 768 }
];

export const ImageStudio: React.FC<ImageStudioProps> = ({ onBackToChat }) => {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('ugly, deformed, blurry, bad anatomy, bad quality, low resolution');
  const [selectedStyle, setSelectedStyle] = useState('Natural / Raw');
  const [selectedRatio, setSelectedRatio] = useState(ASPECT_RATIOS[0]);

  // Advanced settings
  const [steps, setSteps] = useState(25);
  const [cfgScale, setCfgScale] = useState(6.5);
  const [seed, setSeed] = useState(-1);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // Status & Generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [activeGenId, setActiveGenId] = useState<string | null>(null);

  // Image editing (img2img)
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [editStrength, setEditStrength] = useState(0.65);

  // Gallery & Showcase
  const [history, setHistory] = useState<GeneratedImageRecord[]>([]);
  const [selectedImage, setSelectedImage] = useState<GeneratedImageRecord | null>(null);
  const [selectedImageDataUrl, setSelectedImageDataUrl] = useState<string>('');
  const [previewModalImage, setPreviewModalImage] = useState<GeneratedImageRecord | null>(null);
  const [previewModalDataUrl, setPreviewModalDataUrl] = useState<string>('');

  // Models & Hardware
  const [installedModels, setInstalledModels] = useState<Array<{ name: string; path: string; sizeBytes: number; isDefault: boolean }>>([]);
  const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo | null>(null);
  const [isDownloadingModel, setIsDownloadingModel] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ percent: number; completed: number; total: number } | null>(null);

  const [copied, setCopied] = useState(false);

  // 1. Initial Load
  useEffect(() => {
    loadModelsAndHardware();
    loadHistory();

    // Listen to image generation progress
    const cleanupProgress = window.snvAi?.images?.onProgress?.((data) => {
      setGenerationProgress(data.status);
    });

    const cleanupDone = window.snvAi?.images?.onDone?.((data) => {
      setIsGenerating(false);
      setActiveGenId(null);
      setGenerationProgress('');
      setSelectedImage(data.record);
      loadImageDataUrl(data.record.filePath, setSelectedImageDataUrl);
      loadHistory();
    });

    const cleanupError = window.snvAi?.images?.onError?.((data) => {
      setIsGenerating(false);
      setActiveGenId(null);
      setGenerationProgress('');
      alert(`Generation failed: ${data.error}`);
    });

    const cleanupDlProgress = window.snvAi?.images?.onDownloadProgress?.((data) => {
      setDownloadProgress({ percent: data.percent, completed: data.completed, total: data.total });
    });

    const cleanupDlDone = window.snvAi?.images?.onDownloadDone?.(() => {
      setIsDownloadingModel(false);
      setDownloadProgress(null);
      loadModelsAndHardware();
    });

    const cleanupDlError = window.snvAi?.images?.onDownloadError?.((data) => {
      setIsDownloadingModel(false);
      setDownloadProgress(null);
      alert(`Model download error: ${data.error}`);
    });

    return () => {
      cleanupProgress?.();
      cleanupDone?.();
      cleanupError?.();
      cleanupDlProgress?.();
      cleanupDlDone?.();
      cleanupDlError?.();
    };
  }, []);

  const loadModelsAndHardware = async () => {
    try {
      if (window.snvAi?.images?.getModels) {
        const models = await window.snvAi.images.getModels();
        setInstalledModels(models || []);
      }
      if (window.snvAi?.hardware?.getInfo) {
        const hw = await window.snvAi.hardware.getInfo();
        setHardwareInfo(hw);
      }
    } catch (e) {
      console.error('Failed to load models/hardware:', e);
    }
  };

  const loadHistory = async () => {
    try {
      if (window.snvAi?.images?.getHistory) {
        const records = await window.snvAi.images.getHistory(50, 0);
        setHistory(records || []);
        if (records && records.length > 0 && !selectedImage) {
          setSelectedImage(records[0]);
          loadImageDataUrl(records[0].filePath, setSelectedImageDataUrl);
        }
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  };

  const loadImageDataUrl = async (filePath: string, setter: (url: string) => void) => {
    try {
      if (window.snvAi?.files?.getImageDataUrl) {
        const url = await window.snvAi.files.getImageDataUrl(filePath);
        setter(url);
      }
    } catch (e) {
      console.error('Failed to load image data URL:', e);
    }
  };

  // Enhance prompt with AI
  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) return;
    try {
      const enhanced = await window.snvAi?.router?.enhancePrompt(prompt);
      if (enhanced) {
        setPrompt(enhanced);
      }
    } catch (e) {
      console.error('Failed to enhance prompt:', e);
    }
  };

  // Trigger txt2img generation
  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    if (installedModels.length === 0) {
      alert('No image model installed. Please download DreamShaper 8 LCM below or import a model.');
      return;
    }

    const genId = 'gen_' + Date.now();
    setActiveGenId(genId);
    setIsGenerating(true);
    setGenerationProgress('Initializing local diffusion model...');

    // Combine prompt with selected style preset
    const preset = STYLE_PRESETS.find((s) => s.name === selectedStyle);
    const finalPrompt = preset?.suffix ? `${prompt.trim()}, ${preset.suffix}` : prompt.trim();

    try {
      await window.snvAi?.images?.generate({
        id: genId,
        prompt: finalPrompt,
        negativePrompt,
        width: selectedRatio.width,
        height: selectedRatio.height,
        steps,
        cfgScale,
        seed: seed >= 0 ? seed : undefined,
        samplingMethod: 'lcm'
      });
    } catch (err: any) {
      setIsGenerating(false);
      setActiveGenId(null);
      setGenerationProgress('');
      alert(`Generation error: ${err.message}`);
    }
  };

  // Trigger img2img editing
  const handleEditImage = async () => {
    if (!selectedImage || !editPrompt.trim() || isGenerating) return;

    const editId = 'edit_' + Date.now();
    setActiveGenId(editId);
    setIsGenerating(true);
    setGenerationProgress('Applying edits to image with local model...');

    try {
      await window.snvAi?.images?.edit({
        id: editId,
        initImagePath: selectedImage.filePath,
        prompt: editPrompt.trim(),
        negativePrompt,
        width: selectedImage.width,
        height: selectedImage.height,
        steps: Math.max(steps, 8),
        cfgScale,
        strength: editStrength
      });
      setIsEditingMode(false);
      setEditPrompt('');
    } catch (err: any) {
      setIsGenerating(false);
      setActiveGenId(null);
      setGenerationProgress('');
      alert(`Image editing failed: ${err.message}`);
    }
  };

  // Stop active generation
  const handleStop = async () => {
    if (activeGenId && window.snvAi?.images?.stopGeneration) {
      await window.snvAi.images.stopGeneration(activeGenId);
      setIsGenerating(false);
      setActiveGenId(null);
      setGenerationProgress('');
    }
  };

  // Save As
  const handleSaveAs = async (img: GeneratedImageRecord) => {
    try {
      if (window.snvAi?.images?.saveAs) {
        await window.snvAi.images.saveAs(img.filePath, `SNV_AI_${img.id}.png`);
      }
    } catch (e) {
      console.error('Failed to save image:', e);
    }
  };

  // Delete Image
  const handleDelete = async (img: GeneratedImageRecord) => {
    if (!confirm('Are you sure you want to delete this generated image?')) return;
    try {
      if (window.snvAi?.images?.delete) {
        await window.snvAi.images.delete(img.id, img.filePath);
        if (selectedImage?.id === img.id) {
          setSelectedImage(null);
          setSelectedImageDataUrl('');
        }
        await loadHistory();
      }
    } catch (e) {
      console.error('Failed to delete image:', e);
    }
  };

  // Copy prompt
  const handleCopyPrompt = (p: string) => {
    navigator.clipboard.writeText(p);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 1-Click Recommended Model Download
  const handleDownloadRecommendedModel = async () => {
    setIsDownloadingModel(true);
    try {
      await window.snvAi?.images?.downloadModel({
        url: 'https://huggingface.co/haven-ai-companion/dreamshaper8-lcm-gguf/resolve/main/DreamShaper8_LCM_q4_0.gguf',
        fileName: 'DreamShaper8_LCM_q4_0.gguf'
      });
    } catch (e: any) {
      setIsDownloadingModel(false);
      alert(`Failed to start download: ${e.message}`);
    }
  };

  // Import Custom Model
  const handleImportModel = async () => {
    try {
      const res = await window.snvAi?.images?.importModel();
      if (!res.canceled) {
        await loadModelsAndHardware();
      }
    } catch (e) {
      console.error('Failed to import model:', e);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d1017] text-slate-100 overflow-hidden select-none">
      {/* Studio Header Bar */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-[#121622]/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-900/30">
            <Wand2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              SNV AI Image Studio
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                100% Offline
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              {hardwareInfo ? (
                <span>
                  Accelerated on <strong className="text-slate-300">{hardwareInfo.gpuName}</strong> ({hardwareInfo.vramGB} GB VRAM)
                </span>
              ) : (
                'Local Stable Diffusion Engine'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {installedModels.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-mono text-[11px] truncate max-w-[140px]">
                {installedModels[0].name.replace('.gguf', '').replace('.safetensors', '')}
              </span>
            </div>
          )}

          <button
            onClick={() => window.snvAi?.images?.openFolder()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 text-xs text-slate-300 hover:text-white border border-slate-700/50 transition-colors"
            title="Open generated images folder in Windows Explorer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
            <span>Open Folder</span>
          </button>
        </div>
      </div>

      {/* Main Studio Body: Left Creation Panel & Right Showcase/Gallery */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: Prompt & Controls */}
        <div className="w-full lg:w-[460px] p-5 border-r border-slate-800/80 flex flex-col gap-4 overflow-y-auto">
          {/* Missing Model Banner (if no models yet) */}
          {installedModels.length === 0 && (
            <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex flex-col gap-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-semibold text-indigo-200">
                    Local Image Model Setup
                  </h3>
                  <p className="text-[11px] text-indigo-300/80 mt-1 leading-relaxed">
                    Download <strong>DreamShaper 8 (LCM)</strong> (~1.5 GB). It runs in only 4–6 steps (~2.5s on your RTX 3050) and works 100% offline.
                  </p>
                </div>
              </div>

              {isDownloadingModel ? (
                <div className="flex flex-col gap-1.5 mt-1">
                  <div className="flex items-center justify-between text-[11px] text-indigo-300">
                    <span>Downloading DreamShaper 8...</span>
                    <span>{downloadProgress?.percent || 0}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-indigo-950 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                      style={{ width: `${downloadProgress?.percent || 0}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={handleDownloadRecommendedModel}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Model (~1.5 GB)</span>
                  </button>
                  <button
                    onClick={handleImportModel}
                    className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition-colors border border-slate-700"
                  >
                    Import Custom
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Prompt Box */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">
                Prompt
              </label>
              <button
                onClick={handleEnhancePrompt}
                disabled={!prompt.trim() || isGenerating}
                className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 disabled:opacity-40 transition-colors"
                title="Expand prompt with atmospheric lighting and composition details"
              >
                <Sparkles className="w-3 h-3" />
                <span>Enhance Prompt (AI)</span>
              </button>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image you want to create (e.g. A city on Saturn with glass buildings and hovering vehicles at sunset)..."
              rows={4}
              className="w-full p-3 text-xs bg-[#151924] border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none font-sans leading-relaxed"
            />
          </div>

          {/* Style Presets */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-300">Style Preset</label>
            <div className="flex flex-wrap gap-1.5">
              {STYLE_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => setSelectedStyle(preset.name)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                    selectedStyle === preset.name
                      ? 'bg-indigo-600/20 border-indigo-500/60 text-indigo-300 font-medium'
                      : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Aspect Ratio Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-300">Aspect Ratio</label>
            <div className="grid grid-cols-2 gap-2">
              {ASPECT_RATIOS.map((ratio) => (
                <button
                  key={ratio.label}
                  onClick={() => setSelectedRatio(ratio)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-all ${
                    selectedRatio.label === ratio.label
                      ? 'bg-indigo-600/20 border-indigo-500/60 text-indigo-300 font-medium'
                      : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span>{ratio.label}</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {ratio.width}×{ratio.height}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Collapsible Advanced Settings */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#141824]/40">
            <button
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="w-full flex items-center justify-between p-3 text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-slate-400" />
                <span>Advanced Parameters</span>
              </div>
              {isAdvancedOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {isAdvancedOpen && (
              <div className="p-3 pt-0 flex flex-col gap-3 border-t border-slate-800/60 text-xs">
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Sampling Steps</span>
                    <span className="font-mono">{steps}</span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={25}
                    step={1}
                    value={steps}
                    onChange={(e) => setSteps(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                  <span className="text-[10px] text-slate-500">4–8 steps recommended for LCM</span>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>CFG / Guidance Scale</span>
                    <span className="font-mono">{cfgScale.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min={1.0}
                    max={10.0}
                    step={0.5}
                    value={cfgScale}
                    onChange={(e) => setCfgScale(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 mb-1 block">Negative Prompt</label>
                  <input
                    type="text"
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    className="w-full p-2 bg-[#10131d] border border-slate-700/60 rounded-lg text-slate-300 text-xs font-sans"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Primary Action Button */}
          <div className="mt-auto pt-2">
            {isGenerating ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-950/60 border border-indigo-500/40 text-xs text-indigo-200">
                  <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  <span className="truncate">{generationProgress || 'Generating image...'}</span>
                </div>
                <button
                  onClick={handleStop}
                  className="w-full py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors"
                >
                  Cancel Generation
                </button>
              </div>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || installedModels.length === 0}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/50 transition-all active:scale-[0.99]"
              >
                <Wand2 className="w-4 h-4" />
                <span>Generate Image</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Active Showcase & History Gallery */}
        <div className="flex-1 flex flex-col h-full bg-[#0a0c12] overflow-hidden">
          {/* Showcase Area */}
          <div className="flex-1 p-6 flex flex-col items-center justify-center relative overflow-hidden">
            {selectedImage && selectedImageDataUrl ? (
              <div className="flex flex-col items-center max-w-full max-h-full">
                {/* Image Container with AI Badge */}
                <div className="relative group rounded-2xl overflow-hidden shadow-2xl border border-slate-800 bg-[#12151e] max-h-[480px]">
                  <img
                    src={selectedImageDataUrl}
                    alt={selectedImage.prompt}
                    className="max-h-[480px] w-auto object-contain cursor-pointer"
                    onClick={() => {
                      setPreviewModalImage(selectedImage);
                      setPreviewModalDataUrl(selectedImageDataUrl);
                    }}
                  />
                  {/* AI Generated Badge */}
                  <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-[10px] font-medium text-white/90 flex items-center gap-1 shadow-sm">
                    <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                    <span>AI Generated</span>
                  </div>

                  {/* Hover Quick Actions */}
                  <button
                    onClick={() => {
                      setPreviewModalImage(selectedImage);
                      setPreviewModalDataUrl(selectedImageDataUrl);
                    }}
                    className="absolute bottom-3 right-3 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Full view"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Details & Actions Bar */}
                <div className="w-full max-w-xl mt-4 flex items-center justify-between gap-3 px-2">
                  <div className="truncate flex-1">
                    <p className="text-xs text-slate-200 font-medium truncate" title={selectedImage.prompt}>
                      {selectedImage.prompt}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {selectedImage.width}×{selectedImage.height} • {selectedImage.steps} steps • seed {selectedImage.seed}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleCopyPrompt(selectedImage.prompt)}
                      className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      title="Copy prompt"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => {
                        setPrompt(selectedImage.prompt);
                        handleGenerate();
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition-colors"
                      title="Regenerate with new seed"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Regenerate</span>
                    </button>
                    <button
                      onClick={() => setIsEditingMode(!isEditingMode)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs transition-colors"
                      title="Modify image with natural language"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleSaveAs(selectedImage)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
                      title="Save image to your computer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </button>
                    <button
                      onClick={() => handleDelete(selectedImage)}
                      className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Delete image"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline Editing Drawer */}
                {isEditingMode && (
                  <div className="w-full max-w-xl mt-3 p-3 rounded-xl bg-[#141825] border border-purple-500/30 flex flex-col gap-2 shadow-lg">
                    <div className="flex items-center justify-between text-xs text-purple-300 font-medium">
                      <span>Image-to-Image Natural Modification</span>
                      <button onClick={() => setIsEditingMode(false)} className="text-slate-400 hover:text-white">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        placeholder="e.g. Make the sky darker, add mountains in the background..."
                        className="flex-1 p-2 bg-[#0d1017] border border-slate-700/80 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                        onKeyDown={(e) => e.key === 'Enter' && handleEditImage()}
                      />
                      <button
                        onClick={handleEditImage}
                        disabled={!editPrompt.trim() || isGenerating}
                        className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-medium transition-colors"
                      >
                        Apply Edit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-8 text-slate-500">
                <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3">
                  <ImageIcon className="w-8 h-8 text-slate-600" />
                </div>
                <h3 className="text-sm font-medium text-slate-300">Ready to Generate</h3>
                <p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
                  Enter a prompt on the left and click Generate Image to create offline AI art.
                </p>
              </div>
            )}
          </div>

          {/* Bottom Gallery Strip */}
          <div className="h-32 border-t border-slate-800/80 bg-[#0e111a] p-3 flex flex-col gap-1.5 overflow-hidden">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-medium text-slate-400">
                Recent Creations ({history.length})
              </span>
            </div>
            <div className="flex-1 flex gap-2.5 overflow-x-auto pb-1">
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedImage(item);
                    loadImageDataUrl(item.filePath, setSelectedImageDataUrl);
                  }}
                  className={`relative flex-shrink-0 h-20 w-20 rounded-xl overflow-hidden cursor-pointer border transition-all ${
                    selectedImage?.id === item.id
                      ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                      : 'border-slate-800 hover:border-slate-600 opacity-70 hover:opacity-100'
                  }`}
                >
                  <GalleryThumbnail filePath={item.filePath} prompt={item.prompt} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Full Preview Modal */}
      {previewModalImage && previewModalDataUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6"
          onClick={() => setPreviewModalImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewModalImage(null)}
              className="absolute -top-10 right-0 text-slate-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewModalDataUrl}
              alt={previewModalImage.prompt}
              className="max-h-[80vh] w-auto rounded-2xl shadow-2xl border border-slate-800"
            />
            <div className="mt-3 flex items-center justify-between w-full px-2 text-xs text-slate-300">
              <span className="truncate max-w-lg">{previewModalImage.prompt}</span>
              <button
                onClick={() => handleSaveAs(previewModalImage)}
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

// Thumbnail component helper
const GalleryThumbnail: React.FC<{ filePath: string; prompt: string }> = ({ filePath, prompt }) => {
  const [url, setUrl] = useState('');

  useEffect(() => {
    let isMounted = true;
    window.snvAi?.files?.getImageDataUrl?.(filePath).then((dataUrl) => {
      if (isMounted) setUrl(dataUrl);
    });
    return () => {
      isMounted = false;
    };
  }, [filePath]);

  if (!url) {
    return <div className="w-full h-full bg-slate-800 animate-pulse" />;
  }

  return <img src={url} alt={prompt} className="w-full h-full object-cover" />;
};
