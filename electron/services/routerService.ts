import { GeneratedImageRecord } from './imageGenService';

export type UserIntent = 'chat' | 'image_generate' | 'image_edit' | 'vision';

export interface IntentResult {
  intent: UserIntent;
  cleanPrompt: string;
  enhancedPrompt?: string;
  confidence: number;
}

export class RouterService {
  private static readonly NON_IMAGE_INDICATORS = [
    'code', 'script', 'function', 'class', 'method', 'program', 'app', 'application',
    'python', 'javascript', 'java', 'cpp', 'c\\+\\+', 'html', 'css', 'sql', 'regex',
    'list', 'table', 'summary', 'essay', 'story', 'poem', 'resume', 'plan', 'outline',
    'guide', 'tutorial', 'test case', 'algorithm', 'explanation', 'description', 'prompt'
  ];

  public static isNonImageRequest(text: string): boolean {
    const lower = text.toLowerCase();
    return this.NON_IMAGE_INDICATORS.some((ind) => {
      const escaped = ind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp('\\b' + escaped + '\\b', 'i');
      return regex.test(lower);
    });
  }

  // Common patterns for modifying or editing an existing image
  private static readonly EDIT_PATTERNS = [
    /^(?:make\s+it|make\s+the|change\s+the|change\s+it|turn\s+it\s+into|add\s+|remove\s+|delete\s+|replace\s+|modify\s+it|adjust\s+the|switch\s+to)\s*(.+)/i,
    /^(?:darker|brighter|more\s+vibrant|watercolor|cyberpunk|anime|black\s+and\s+white|sepia|oil\s+painting|sunset|sunrise|night|daytime)\b/i,
    /^(?:now\s+)?(?:add|remove|change|make)\s*(.+)/i
  ];

  /**
   * Classify user input intent into chat, image generation, image editing, or vision understanding.
   */
  public static classifyIntent(
    userText: string,
    hasImageAttachments: boolean = false,
    hasActivePreviousImage: boolean = false
  ): IntentResult {
    const trimmed = userText.trim();
    const lower = trimmed.toLowerCase();

    // 1. If images are attached, this is a vision understanding task
    if (hasImageAttachments) {
      return {
        intent: 'vision',
        cleanPrompt: trimmed,
        confidence: 0.99
      };
    }

    // 2. If the user previously generated an image in this conversation, check for edit instructions
    if (hasActivePreviousImage) {
      for (const pattern of this.EDIT_PATTERNS) {
        if (pattern.test(trimmed)) {
          return {
            intent: 'image_edit',
            cleanPrompt: trimmed,
            confidence: 0.95
          };
        }
      }
    }

    // 3. Suffix pattern: 'Give me a monkey image', 'send me a lion picture', 'a wallpaper of...', '... photo'
    const endPattern =
      /^(?:please\s+|can\s+you\s+(?:please\s+)?|could\s+you\s+(?:please\s+)?|i\s+want\s+(?:you\s+to\s+)?|give\s+me\s+|show\s+me\s+|send\s+me\s+|get\s+me\s+)?(.+?)\s+(?:image|picture|photo|wallpaper|drawing|painting|render|illustration|art)$/i;
    const endMatch = trimmed.match(endPattern);
    if (endMatch && endMatch[1] && !this.isNonImageRequest(endMatch[1])) {
      return {
        intent: 'image_generate',
        cleanPrompt: endMatch[1].replace(/^(?:a|an|the)\s+/i, '').trim(),
        confidence: 0.96
      };
    }

    // 4. Direct visual action verbs: draw, paint, sketch, illustrate
    const visualVerbPattern =
      /^(?:please\s+|can\s+you\s+(?:please\s+)?|could\s+you\s+(?:please\s+)?|kindly\s+)?(?:draw|paint|sketch|illustrate)\s+(?:me\s+)?(?:a|an|the)?\s*(.+)/i;
    const visualMatch = trimmed.match(visualVerbPattern);
    if (visualMatch && visualMatch[1] && !this.isNonImageRequest(visualMatch[1])) {
      return {
        intent: 'image_generate',
        cleanPrompt: visualMatch[1].trim(),
        confidence: 0.95
      };
    }

    // 5. Explicit colon triggers: 'generate image: ...', 'create image: ...', 'image: ...'
    if (lower.startsWith('generate image:') || lower.startsWith('create image:') || lower.startsWith('image:')) {
      return {
        intent: 'image_generate',
        cleanPrompt: trimmed.replace(/^(?:generate\s+image|create\s+image|image)\s*:\s*/i, '').trim(),
        confidence: 0.98
      };
    }

    // 6. Image phrase prefixes: 'generate an image of...', 'create a picture of...', 'give me an image of...'
    const phrasePattern =
      /^(?:please\s+|can\s+you\s+(?:please\s+)?|could\s+you\s+(?:please\s+)?|i\s+want\s+(?:you\s+to\s+)?|kindly\s+|give\s+me\s+|show\s+me\s+|send\s+me\s+|get\s+me\s+)?(?:generate|create|make|produce|provide|give|show|send|render)\s+(?:me\s+)?(?:an?\s+)?(?:image|picture|photo|wallpaper|artwork|drawing|painting|render|illustration|art)\s*(?:of|showing|with|depicting)?\s*(.+)/i;
    const phraseMatch = trimmed.match(phrasePattern);
    if (phraseMatch && phraseMatch[1] && !this.isNonImageRequest(phraseMatch[1])) {
      return {
        intent: 'image_generate',
        cleanPrompt: phraseMatch[1].replace(/^:\s*/, '').trim(),
        confidence: 0.95
      };
    }

    // 7. Object creation requests: 'create a...', 'generate a...', 'make a...', 'create lion', etc.
    const createObjectPattern =
      /^(?:please\s+|can\s+you\s+(?:please\s+)?|could\s+you\s+(?:please\s+)?|kindly\s+|i\s+want\s+(?:you\s+to\s+)?(?:please\s+)?|i\s+need\s+(?:a|an)?\s*)?(?:create|generate|make)\s+(?:me\s+)?(?:(?:a|an|the)\s+)?(.+)/i;
    const createMatch = trimmed.match(createObjectPattern);
    if (createMatch && createMatch[1] && !this.isNonImageRequest(createMatch[1])) {
      return {
        intent: 'image_generate',
        cleanPrompt: createMatch[1].replace(/^(?:a|an|the)\s+/i, '').trim(),
        confidence: 0.92
      };
    }

    // 8. Short image prefixes: 'image of...', 'photo of...', 'a wallpaper of...'
    const shortPrefix =
      /^(?:a|an|the)?\s*(?:image|picture|photo|drawing|painting|wallpaper|artwork)\s+of\s+(.+)/i;
    const shortMatch = trimmed.match(shortPrefix);
    if (shortMatch && shortMatch[1] && !this.isNonImageRequest(shortMatch[1])) {
      return {
        intent: 'image_generate',
        cleanPrompt: shortMatch[1].trim(),
        confidence: 0.95
      };
    }

    // Default to regular offline conversational AI
    return {
      intent: 'chat',
      cleanPrompt: trimmed,
      confidence: 0.95
    };
  }

  /**
   * Enrich a simple prompt with photographic, cinematic, and lighting keywords.
   */
  public static enhancePromptFast(prompt: string): string {
    const p = prompt.trim();
    const lower = p.toLowerCase();

    // If the prompt is already long and detailed, don't over-embellish
    if (p.split(' ').length > 18) {
      return p;
    }

    const enhancements: string[] = [];

    // Lighting
    if (!lower.includes('light') && !lower.includes('sun') && !lower.includes('glow')) {
      if (lower.includes('night') || lower.includes('dark')) {
        enhancements.push('cinematic neon lighting, volumetric atmosphere');
      } else if (lower.includes('sunset') || lower.includes('sunrise')) {
        enhancements.push('golden hour sunlight, warm ambient glow');
      } else {
        enhancements.push('beautiful natural lighting, soft shadows');
      }
    }

    // Quality & composition
    enhancements.push('highly detailed, sharp focus, 8k resolution, masterpiece');

    return `${p}, ${enhancements.join(', ')}`;
  }

  /**
   * Use local LLM to dynamically expand a prompt with artistic and composition details.
   */
  public static async enhancePromptWithLLM(
    prompt: string,
    queryLlm: (system: string, user: string) => Promise<string>
  ): Promise<string> {
    try {
      const systemPrompt =
        'You are an expert Stable Diffusion prompt designer. Given a simple image idea, expand it into a concise, vivid text-to-image prompt (max 40 words) focusing on subject appearance, environment, lighting, and camera style. Do not include introductory text, markdown, or commentary. Output ONLY the expanded prompt string.';

      const expanded = await queryLlm(systemPrompt, `Image idea: ${prompt}`);
      const cleaned = expanded.replace(/^["']|["']$/g, '').trim();
      return cleaned.length > 5 ? cleaned : this.enhancePromptFast(prompt);
    } catch (e) {
      return this.enhancePromptFast(prompt);
    }
  }
}
