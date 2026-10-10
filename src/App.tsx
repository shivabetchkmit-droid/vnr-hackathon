import React, { useState, useEffect, useRef } from 'react';
import { TitleBar } from './components/Common/TitleBar';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ChatArea } from './components/Chat/ChatArea';
import { ImageStudio } from './components/Images/ImageStudio';
import { SettingsModal } from './components/Settings/SettingsModal';
import { ModelSelectorModal } from './components/Models/ModelSelectorModal';
import {
  ChatSession,
  ChatMessage,
  AppSettings,
  OllamaStatus,
  SystemDiagnostic,
  AIMode,
  Attachment,
  GeneratedImageRecord
} from './types';

const defaultSettings: AppSettings = {
  theme: 'dark',
  startWithWindows: false,
  ollamaUrl: 'http://127.0.0.1:11434',
  selectedModel: '',
  temperature: 0.7,
  maxTokens: 4096,
  contextLength: 8192,
  enterToSend: true,
  showTimestamps: true,
  saveHistory: true,
  strictOfflineMode: true,
  studyModePrompt: `You are an expert tutor in Study Mode. You explain concepts clearly, patiently, and thoroughly for learners.
Always structure explanations to foster deep understanding:
- Clear Intuitive Definition: Explain the concept simply without overwhelming jargon.
- Why It Matters & Core Purpose: Provide real-world context and motivation.
- Step-by-Step Breakdown: Unpack the underlying principles or mechanism.
- Concrete Examples & Analogies: Use memorable everyday analogies and clear practical examples.
- Key Takeaways & Review: Summarize the most important points and common pitfalls to avoid.`,
  codingModePrompt: `You are an expert software engineer in Coding Mode.
Assist with architecture, clean code design, debugging, and implementation.
- Provide clean, production-grade, idiomatic code with proper language tags.
- Explain the logic clearly, including edge cases, complexity, and best practices.
- Ensure 100% syntactically valid code in the target language.
- When asked to explain code, provide clear line-by-line or section-by-section walkthroughs.`,
  documentModePrompt: `You are an intelligent document analyst.
Answer questions accurately based strictly on the provided document context.
- Cite specific sections or context points when answering.
- If information is missing from the document, state so clearly.`
};

const isVisionModel = (modelName?: string): boolean => {
  if (!modelName) return false;
  const lower = modelName.toLowerCase();
  return ['vision', 'llava', 'minicpm-v', 'bakllava', 'moondream', 'qwen2-vl', 'cogvlm'].some((k) =>
    lower.includes(k)
  );
};

export const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);

  // Active workspace view: 'chat' or 'images'
  const [activeView, setActiveView] = useState<'chat' | 'images'>('chat');

  const [activeMode, setActiveMode] = useState<AIMode>('general');
  const [activeModelName, setActiveModelName] = useState<string>('');
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostic | null>(null);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isModelsModalOpen, setIsModelsModalOpen] = useState(false);

  const streamingTextRef = useRef('');
  const currentMsgIdRef = useRef('');
  const activeChatIdRef = useRef<string | null>(null);
  const activeModeRef = useRef<AIMode>('general');

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    activeModeRef.current = activeMode;
  }, [activeMode]);

  // 1. Initial Load: Settings, Chats, Diagnostics, Ollama Status
  useEffect(() => {
    const initApp = async () => {
      try {
        // Load Settings
        if (window.snvAi?.db?.getSettings) {
          const loaded = await window.snvAi.db.getSettings();
          if (loaded) {
            setSettings((prev) => ({ ...prev, ...loaded }));
            if (loaded.selectedModel && !isVisionModel(loaded.selectedModel)) {
              setActiveModelName(loaded.selectedModel);
            } else {
              setActiveModelName('llama3.2:latest');
            }
          }
        }

        // Load Chats
        await refreshChats();

        // Check Ollama status
        await checkOllamaStatus();

        // Load Diagnostics
        await refreshDiagnostics();
      } catch (err) {
        console.error('Initialization error:', err);
      }
    };

    initApp();
  }, []);

  // Apply Theme
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else if (settings.theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      // System
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.add('light');
        root.classList.remove('dark');
      }
    }
  }, [settings.theme]);

  // Listen to streaming AI IPC events (Ollama LLM)
  useEffect(() => {
    if (!window.snvAi?.ai) return;

    const cleanupChunk = window.snvAi.ai.onChunk((data) => {
      streamingTextRef.current += data.chunk;
      const updatedText = streamingTextRef.current;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === currentMsgIdRef.current
            ? { ...msg, content: updatedText, isStreaming: true }
            : msg
        )
      );
    });

    const cleanupDone = window.snvAi.ai.onDone((data) => {
      const finalText = data.fullText || streamingTextRef.current;
      setIsGenerating(false);
      setCurrentRequestId(null);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === currentMsgIdRef.current
            ? { ...msg, content: finalText, isStreaming: false }
            : msg
        )
      );

      // Persist finalized assistant message in SQLite
      if (currentMsgIdRef.current && activeChatId) {
        window.snvAi?.db?.updateMessageContent(currentMsgIdRef.current, finalText);
      }
    });

    const cleanupError = window.snvAi.ai.onError((data) => {
      setIsGenerating(false);
      setCurrentRequestId(null);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === currentMsgIdRef.current
            ? { ...msg, error: data.error, isStreaming: false }
            : msg
        )
      );
    });

    return () => {
      cleanupChunk?.();
      cleanupDone?.();
      cleanupError?.();
    };
  }, [activeChatId]);

  // Listen to Image Generation events for inline chat generation
  useEffect(() => {
    if (!window.snvAi?.images) return;

    const cleanupProgress = window.snvAi.images.onProgress((data) => {
      if (data.id === currentMsgIdRef.current) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === currentMsgIdRef.current
              ? { ...msg, content: data.status || 'Generating image...', isStreaming: true }
              : msg
          )
        );
      }
    });

    const cleanupDone = window.snvAi.images.onDone((data) => {
      if (data.id === currentMsgIdRef.current) {
        setIsGenerating(false);
        setCurrentRequestId(null);

        const updatedMsg: Partial<ChatMessage> = {
          content: '',
          imageRecord: data.record,
          isStreaming: false
        };

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === currentMsgIdRef.current
              ? { ...msg, ...updatedMsg }
              : msg
          )
        );

        // Persist message with image record
        const chatIdToSave = activeChatIdRef.current || activeChatId;
        if (chatIdToSave) {
          const finalMsg: ChatMessage = {
            id: currentMsgIdRef.current,
            chatId: chatIdToSave,
            role: 'assistant',
            content: '',
            imageRecord: data.record,
            timestamp: Date.now(),
            model: data.record.model,
            mode: activeModeRef.current || activeMode
          };
          window.snvAi?.db?.saveMessage(finalMsg);
        }
      }
    });

    const cleanupError = window.snvAi.images.onError((data) => {
      if (data.id === currentMsgIdRef.current) {
        setIsGenerating(false);
        setCurrentRequestId(null);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === currentMsgIdRef.current
              ? { ...msg, error: `Image generation failed: ${data.error}`, isStreaming: false }
              : msg
          )
        );
      }
    });

    return () => {
      cleanupProgress?.();
      cleanupDone?.();
      cleanupError?.();
    };
  }, [activeChatId, activeMode]);

  const refreshChats = async () => {
    if (!window.snvAi?.db?.getChats) return;
    try {
      const list = await window.snvAi.db.getChats();
      setChats(list);
    } catch (err) {
      console.error('Failed to get chats:', err);
    }
  };

  const checkOllamaStatus = async () => {
    if (!window.snvAi?.ai?.checkStatus) return;
    try {
      const status = await window.snvAi.ai.checkStatus(settings.ollamaUrl);
      setOllamaStatus(status);

      // Select default model prioritizing conversational text LLMs (not vision-only models)
      if (status.models && status.models.length > 0) {
        const textModels = status.models.filter((m) => !isVisionModel(m.name) && !m.supportsVision);
        const preferredDefault = textModels.length > 0 ? textModels[0].name : 'llama3.2:latest';

        if (!activeModelName || isVisionModel(activeModelName)) {
          setActiveModelName(preferredDefault);
          await window.snvAi?.db?.saveSetting('selectedModel', preferredDefault);
        }
      }
    } catch (err) {
      console.error('Failed to check Ollama status:', err);
    }
  };

  const refreshDiagnostics = async () => {
    if (!window.snvAi?.system?.getSystemDiagnostics) return;
    try {
      const diag = await window.snvAi.system.getSystemDiagnostics(settings.ollamaUrl);
      setDiagnostics(diag);
      await checkOllamaStatus();
    } catch (err) {
      console.error('Failed to get diagnostics:', err);
    }
  };

  // Switch or load active chat messages
  const handleSelectChat = async (chatId: string) => {
    setActiveChatId(chatId);
    try {
      const msgs = await window.snvAi?.db?.getMessages(chatId);
      setMessages(msgs || []);
      const chat = chats.find((c) => c.id === chatId);
      if (chat) {
        setActiveMode(chat.mode || 'general');
      }
    } catch (err) {
      console.error('Failed to load chat messages:', err);
    }
  };

  const handleNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
    setInput('');
    setAttachments([]);
    if (!activeModelName || isVisionModel(activeModelName)) {
      setActiveModelName('llama3.2:latest');
    }
  };

  const handleRenameChat = async (id: string, newTitle: string) => {
    await window.snvAi?.db?.updateChatTitle(id, newTitle);
    await refreshChats();
  };

  const handleDeleteChat = async (id: string) => {
    await window.snvAi?.db?.deleteChat(id);
    if (activeChatId === id) {
      handleNewChat();
    }
    await refreshChats();
  };

  const handleClearHistory = async () => {
    await window.snvAi?.db?.clearAllChats();
    handleNewChat();
    await refreshChats();
  };

  const handleSaveSetting = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    await window.snvAi?.db?.saveSetting(key, value);
    if (key === 'ollamaUrl') {
      setTimeout(checkOllamaStatus, 300);
    }
  };

  const handleSelectModel = (modelName: string) => {
    setActiveModelName(modelName);
    handleSaveSetting('selectedModel', modelName);
  };

  // Build system prompt based on mode
  const getSystemPrompt = (mode: AIMode): string => {
    switch (mode) {
      case 'study': return settings.studyModePrompt;
      case 'coding': return settings.codingModePrompt;
      case 'document': return settings.documentModePrompt;
      default:
        return `You are SNV AI, an expert, thoughtful, and highly capable AI assistant running locally and completely offline.

GUIDELINES FOR GENERATING RESPONSES:
1. Intelligence & Depth:
   - For simple greetings, casual chat, or quick factual questions: Provide a warm, concise, and direct response.
   - For educational, technical, programming, conceptual, or complex questions: Provide comprehensive, well-structured, insightful, and pedagogical explanations. Treat the user as an eager learner who appreciates clarity, depth, and precision.

2. Structure for Explanations (adapt naturally):
   - Clear Definition & Overview: Explain the core concept directly and clearly in plain terms.
   - Why It Matters: Explain why this concept is used and what real-world problem it solves.
   - How It Works: Explain the underlying mechanics, keywords, and rules step-by-step.
   - Practical Example / Code: Provide clean, idiomatic, well-commented examples. Never leave code unfinished.
   - Key Details & Nuances: Cover variations, types, or important edge cases.
   - Common Pitfalls & Best Practices: Highlight frequent beginner mistakes and how to avoid them.

3. Programming & Technical Accuracy:
   - Always ensure 100% syntactically correct code matching the requested language's rules (e.g., in Java, use constructor chaining \`this(...)\` rather than unsupported default parameter values).
   - When asked to explain lines, provide clear, line-by-line or block-by-block commentary.

4. Formatting & Tone:
   - Professional, encouraging, articulate, and conversational (similar to top-tier assistants like ChatGPT).
   - Use clean Markdown formatting: headings (##, ###), bullet points, and bold text for readability.
   - Maintain multi-turn context smoothly when answering follow-up questions.`;
    }
  };

  // Send message with intelligent Intent Routing (Chat vs Image Generation vs Vision)
  const handleSendMessage = async (textOverride?: string, modeOverride?: AIMode) => {
    const promptToSend = (textOverride || input).trim();
    const currentMode = modeOverride || activeMode;

    if (!promptToSend && attachments.length === 0) return;
    if (isGenerating) return;

    // Process document attachment if present (Local RAG)
    let finalPrompt = promptToSend;
    const docAttachment = attachments.find((a) => !a.type.includes('image'));
    const imageAttachments = attachments.filter((a) => a.type.includes('image') || a.previewUrl);
    const hasImages = imageAttachments.length > 0;

    // Check if there is an active previous image in this conversation
    const lastImageRecord = [...messages].reverse().find((m) => m.imageRecord)?.imageRecord;

    // Classify user intent
    let intentResult = { intent: 'chat', cleanPrompt: promptToSend };
    try {
      if (window.snvAi?.router?.classify) {
        intentResult = await window.snvAi.router.classify(
          promptToSend,
          hasImages,
          Boolean(lastImageRecord)
        );
      }
    } catch (e) {
      console.error('Intent classification error:', e);
    }

    if (docAttachment && docAttachment.path && window.snvAi?.files?.processDocument) {
      try {
        const parsedDoc = await window.snvAi.files.processDocument(docAttachment.path);
        const ragResult = await window.snvAi.files.queryDocumentRag({
          query: promptToSend,
          documentName: parsedDoc.name,
          text: parsedDoc.text
        });
        finalPrompt = ragResult.augmentedPrompt;
      } catch (err) {
        console.error('Document RAG processing failed:', err);
      }
    }

    // Determine model for chat/vision
    let targetModelForChat = activeModelName;
    if (hasImages) {
      const visionModel = ollamaStatus?.models?.find((m) => isVisionModel(m.name) || m.supportsVision);
      targetModelForChat = visionModel ? visionModel.name : 'moondream:latest';
    } else {
      if (!targetModelForChat || isVisionModel(targetModelForChat)) {
        const textModel = ollamaStatus?.models?.find((m) => !isVisionModel(m.name) && !m.supportsVision);
        targetModelForChat = textModel ? textModel.name : 'llama3.2:latest';
      }
      // Safety guard: For text questions without images, NEVER use moondream or any vision model!
      if (isVisionModel(targetModelForChat)) {
        targetModelForChat = 'llama3.2:latest';
      }
      if (!activeModelName || isVisionModel(activeModelName)) {
        setActiveModelName('llama3.2:latest');
      }
    }

    const isImageTask = intentResult.intent === 'image_generate' || intentResult.intent === 'image_edit';
    let chatId = activeChatId;

    // Create new chat session if none active
    if (!chatId) {
      chatId = 'chat_' + Date.now();
      const titleWords = promptToSend.split(/\s+/).slice(0, 6).join(' ') || 'New Conversation';
      const newSession: ChatSession = {
        id: chatId,
        title: titleWords,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        model: isImageTask ? 'SDXL Base 1.0' : targetModelForChat,
        mode: currentMode
      };

      await window.snvAi?.db?.saveChat(newSession);
      setActiveChatId(chatId);
      activeChatIdRef.current = chatId;
      await refreshChats();
    }

    // Prepare User Message
    const userMsgId = 'msg_user_' + Date.now();
    const userMessage: ChatMessage = {
      id: userMsgId,
      chatId,
      role: 'user',
      content: promptToSend,
      timestamp: Date.now(),
      mode: currentMode,
      attachments: [...attachments]
    };

    // Prepare Assistant placeholder
    const assistantMsgId = 'msg_ai_' + (Date.now() + 1);
    const assistantMessage: ChatMessage = {
      id: assistantMsgId,
      chatId,
      role: 'assistant',
      content: intentResult.intent === 'image_generate'
        ? 'Generating image...'
        : (intentResult.intent === 'image_edit' ? 'Modifying image...' : ''),
      timestamp: Date.now() + 1,
      model: isImageTask ? 'SDXL Base 1.0' : (targetModelForChat || 'llama3.2:latest'),
      mode: currentMode,
      isStreaming: true
    };

    const updatedMessages = [...messages, userMessage, assistantMessage];
    setMessages(updatedMessages);
    setInput('');
    setAttachments([]);

    // Persist user and initial assistant message
    await window.snvAi?.db?.saveMessage(userMessage);
    await window.snvAi?.db?.saveMessage(assistantMessage);

    // --- CASE 1: IMAGE GENERATION INTENT ---
    if (intentResult.intent === 'image_generate') {
      const installedModels = (await window.snvAi?.images?.getModels?.()) || [];
      if (installedModels.length === 0) {
        const noModelText =
          '🎨 To generate images offline, please download a local image model like **DreamShaper 8 (LCM)** from the **Images** tab in the sidebar. Once downloaded, you can create images directly here in chat or in the Image Studio.';
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: noModelText, isStreaming: false }
              : msg
          )
        );
        await window.snvAi?.db?.updateMessageContent(assistantMsgId, noModelText);
        return;
      }

      setIsGenerating(true);
      setCurrentRequestId(assistantMsgId);
      currentMsgIdRef.current = assistantMsgId;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content: 'Generating image...', isStreaming: true }
            : msg
        )
      );

      try {
        const enhanced = await window.snvAi?.router?.enhancePrompt?.(intentResult.cleanPrompt);
        await window.snvAi?.images?.generate({
          id: assistantMsgId,
          prompt: enhanced || intentResult.cleanPrompt,
          width: 1024,
          height: 1024,
          steps: 25,
          cfgScale: 6.5,
          samplingMethod: 'euler'
        });
      } catch (err: any) {
        setIsGenerating(false);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, error: `Image generation failed: ${err.message}`, isStreaming: false }
              : msg
          )
        );
      }
      return;
    }

    // --- CASE 2: IMAGE EDITING INTENT ---
    if (intentResult.intent === 'image_edit' && lastImageRecord) {
      setIsGenerating(true);
      setCurrentRequestId(assistantMsgId);
      currentMsgIdRef.current = assistantMsgId;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content: 'Modifying image...', isStreaming: true }
            : msg
        )
      );

      try {
        await window.snvAi?.images?.edit({
          id: assistantMsgId,
          initImagePath: lastImageRecord.filePath,
          prompt: intentResult.cleanPrompt,
          width: lastImageRecord.width || 1024,
          height: lastImageRecord.height || 1024,
          steps: 25,
          cfgScale: 6.5,
          strength: 0.65
        });
      } catch (err: any) {
        setIsGenerating(false);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, error: `Image editing failed: ${err.message}`, isStreaming: false }
              : msg
          )
        );
      }
      return;
    }

    // --- CASE 3: TEXT CHAT OR MULTIMODAL VISION ---
    const systemPrompt = getSystemPrompt(currentMode);
    const ollamaMessages: Array<{ role: string; content: string; images?: string[] }> = [
      { role: 'system', content: systemPrompt }
    ];

    // Include recent clean history (last 16 valid conversational turns)
    const validHistory = messages.filter((m) => {
      if (!m.content || !m.content.trim()) return false;
      if (m.error) return false;
      if (m.content.startsWith('🎨 Initializing') || m.content.startsWith('🎨 Applying')) return false;
      return true;
    });
    const contextHistory = validHistory.slice(-16);
    for (const m of contextHistory) {
      const turn: { role: string; content: string; images?: string[] } = {
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      };
      if (m.attachments) {
        const pastImgs = m.attachments
          .filter((a) => a.content || a.base64)
          .map((a) => (a.content || a.base64) as string);
        if (pastImgs.length > 0) {
          turn.images = pastImgs;
        }
      }
      ollamaMessages.push(turn);
    }

    // Add current user turn
    const currentTurn: { role: string; content: string; images?: string[] } = {
      role: 'user',
      content: finalPrompt
    };

    if (imageAttachments.length > 0) {
      const b64List = imageAttachments
        .map((a) => a.content || a.base64)
        .filter(Boolean) as string[];
      if (b64List.length > 0) {
        currentTurn.images = b64List;
      }
    }
    ollamaMessages.push(currentTurn);

    // Trigger local inference
    const requestId = 'req_' + Date.now();
    setCurrentRequestId(requestId);
    setIsGenerating(true);
    streamingTextRef.current = '';
    currentMsgIdRef.current = assistantMsgId;

    try {
      await window.snvAi?.ai?.sendMessage({
        requestId,
        model: targetModelForChat || 'llama3.2:latest',
        messages: ollamaMessages,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens || 4096,
        contextLength: settings.contextLength || 8192,
        ollamaUrl: settings.ollamaUrl
      });
    } catch (err: any) {
      setIsGenerating(false);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, error: `Local AI Error: ${err.message || 'Model connection failed'}`, isStreaming: false }
            : msg
        )
      );
    }
  };

  // Stop Generation
  const handleStopGeneration = () => {
    if (currentRequestId) {
      if (window.snvAi?.ai?.stopGeneration) {
        window.snvAi.ai.stopGeneration(currentRequestId);
      }
      if (window.snvAi?.images?.stopGeneration) {
        window.snvAi.images.stopGeneration(currentRequestId);
      }
      setIsGenerating(false);
      setCurrentRequestId(null);
    }
  };

  // Regenerate last AI response
  const handleRegenerate = async () => {
    if (messages.length < 2 || isGenerating) return;

    let lastUserIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserIndex = i;
        break;
      }
    }
    if (lastUserIndex === -1) return;

    const lastUserMsg = messages[lastUserIndex];

    if (activeChatId) {
      await window.snvAi?.db?.deleteMessagesAfter(activeChatId, lastUserMsg.timestamp);
    }

    const pruned = messages.slice(0, lastUserIndex + 1);
    setMessages(pruned);

    await handleSendMessage(lastUserMsg.content, lastUserMsg.mode);
  };

  // Edit message
  const handleEditMessage = async (msgId: string, newContent: string) => {
    const targetIdx = messages.findIndex((m) => m.id === msgId);
    if (targetIdx === -1) return;

    const targetMsg = messages[targetIdx];

    if (activeChatId) {
      await window.snvAi?.db?.deleteMessagesAfter(activeChatId, targetMsg.timestamp);
    }

    const pruned = messages.slice(0, targetIdx);
    setMessages(pruned);

    await handleSendMessage(newContent, targetMsg.mode);
  };

  // Edit Image from Chat button
  const handleEditImageFromChat = (record: GeneratedImageRecord) => {
    setActiveView('images');
  };

  const handleSelectStarterPrompt = (prompt: string, mode: AIMode) => {
    setActiveMode(mode);
    setInput(prompt);
  };

  const activeChat = chats.find((c) => c.id === activeChatId) || null;
  const activeModelObj = ollamaStatus?.models.find((m) => m.name === activeModelName);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0d14] text-slate-100">
      {/* Frameless Windows TitleBar */}
      <TitleBar
        isOfflineMode={settings.strictOfflineMode}
        engineRunning={Boolean(ollamaStatus?.isRunning && (ollamaStatus.models.length > 0))}
      />

      {/* Main App Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar
          chats={chats}
          activeChatId={activeChatId}
          activeView={activeView}
          onSelectView={setActiveView}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onRenameChat={handleRenameChat}
          onDeleteChat={handleDeleteChat}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenModels={() => setIsModelsModalOpen(true)}
          ollamaStatus={ollamaStatus}
          activeModelName={activeModelName}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {activeView === 'images' ? (
          <ImageStudio onBackToChat={() => setActiveView('chat')} />
        ) : (
          <ChatArea
            currentChat={activeChat}
            messages={messages}
            input={input}
            setInput={setInput}
            onSend={() => handleSendMessage()}
            onStop={handleStopGeneration}
            isGenerating={isGenerating}
            activeMode={activeMode}
            onChangeMode={setActiveMode}
            attachments={attachments}
            onAddAttachment={(att) => setAttachments((prev) => [...prev, att])}
            onRemoveAttachment={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
            enterToSend={settings.enterToSend}
            showTimestamps={settings.showTimestamps}
            engineRunning={Boolean(ollamaStatus?.isRunning)}
            modelSupportsVision={Boolean(activeModelObj?.supportsVision || ollamaStatus?.models.some(m => m.name.includes('moondream') || m.name.includes('vision') || m.name.includes('llava')))}
            activeModelName={activeModelName}
            diagnostics={diagnostics}
            ollamaStatus={ollamaStatus}
            onRefreshDiagnostics={refreshDiagnostics}
            onSelectStarterPrompt={handleSelectStarterPrompt}
            onRegenerate={handleRegenerate}
            onEditMessage={handleEditMessage}
            onEditImage={handleEditImageFromChat}
            onOpenModelModal={() => setIsModelsModalOpen(true)}
          />
        )}
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSetting={handleSaveSetting}
        ollamaStatus={ollamaStatus}
        onClearHistory={handleClearHistory}
        diagnostics={diagnostics}
        onRefreshDiagnostics={refreshDiagnostics}
      />

      {/* Model Selector Modal */}
      <ModelSelectorModal
        isOpen={isModelsModalOpen}
        onClose={() => setIsModelsModalOpen(false)}
        ollamaStatus={ollamaStatus}
        selectedModel={activeModelName}
        onSelectModel={handleSelectModel}
        onRefresh={checkOllamaStatus}
      />
    </div>
  );
};
