import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.css';

interface CodeBlockProps {
  language?: string;
  value: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const cleanLang = (language || 'code').toLowerCase().replace('language-', '');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const getHighlightedCode = () => {
    try {
      if (cleanLang && hljs.getLanguage(cleanLang)) {
        return hljs.highlight(value, { language: cleanLang }).value;
      }
      return hljs.highlightAuto(value).value;
    } catch {
      return value;
    }
  };

  return (
    <div className="relative my-3 rounded-lg overflow-hidden border border-slate-700/60 bg-[#161a24] text-xs font-mono shadow-md">
      {/* Code Header */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#1f2433] border-b border-slate-700/50 text-slate-400">
        <span className="uppercase text-[11px] font-semibold tracking-wider text-emerald-400">
          {cleanLang}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-[11px]"
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Code</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body */}
      <pre className="p-3.5 overflow-x-auto text-slate-200 leading-relaxed font-mono select-text">
        <code
          dangerouslySetInnerHTML={{ __html: getHighlightedCode() }}
        />
      </pre>
    </div>
  );
};
