import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { apiRequest } from '../services/api';
import { useTamilSpeechRecognition } from '../hooks/useTamilSpeechRecognition';
import {
  Sparkle,
  Sparkles,
  X,
  Send,
  Mic,
  MicOff,
  RotateCcw,
  Bot,
  User,
  Copy,
  Check,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  showQuickPrompts?: boolean;
}

const QUICK_PROMPTS = [
  'What is the status of my active orders?',
  'How do I log shift output?',
  'Which orders are delayed or at risk?',
  'How does the Air Freight Simulator work?',
];

const getTextContent = (node: any): string => {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getTextContent).join('');
  if (node.props && node.props.children) return getTextContent(node.props.children);
  return '';
};

const preprocessMarkdown = (raw: string): string => {
  if (!raw) return '';

  let text = raw;

  // 1. Convert unicode bullets (•, ●, ▪, etc.) to standard markdown list syntax "- "
  text = text.replace(/^([ \t]*)[•●▪▫][ \t]*/gm, '$1- ');

  // 2. Ensure blank line before bullet or numbered list starts if preceded by normal text
  text = text.replace(/([^\n])\n([ \t]*[-*+]\s+)/g, '$1\n\n$2');
  text = text.replace(/([^\n])\n([ \t]*\d+\.\s+)/g, '$1\n\n$2');

  // 3. Highlight status indicators if not already enclosed in **
  text = text.replace(
    /(?<!\*\*)\b(Critical Deficit|Extra Caution|On Track|Completed|\bRED\b|\bAMBER\b|\bGREEN\b)(?!\*\*)/g,
    '**$1**'
  );

  return text;
};

const AIMarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const processed = useMemo(() => preprocessMarkdown(content), [content]);

  return (
    <div className="text-xs leading-relaxed text-slate-800 break-words space-y-1.5 font-normal">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed text-slate-800">{children}</p>,
          ul: ({ children }) => (
            <ul className="my-2 space-y-1.5 list-disc pl-4 text-slate-800 marker:text-indigo-500">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 space-y-1.5 list-decimal pl-4 text-slate-800 marker:text-indigo-600 font-medium">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed pl-0.5">{children}</li>,
          strong: ({ children, ...props }) => {
            const text = getTextContent(children).trim();
            if (/\b(Critical Deficit|RED)\b/i.test(text)) {
              return (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 mx-0.5 shadow-3xs"
                  {...props}
                >
                  {children}
                </span>
              );
            }
            if (/\b(Extra Caution|AMBER)\b/i.test(text)) {
              return (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 mx-0.5 shadow-3xs"
                  {...props}
                >
                  {children}
                </span>
              );
            }
            if (/\b(On Track|GREEN|Completed)\b/i.test(text)) {
              return (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 mx-0.5 shadow-3xs"
                  {...props}
                >
                  {children}
                </span>
              );
            }
            return (
              <strong className="font-bold text-slate-900" {...props}>
                {children}
              </strong>
            );
          },
          em: ({ children }) => <em className="italic text-slate-700">{children}</em>,
          h1: ({ children }) => <h1 className="text-sm font-bold text-slate-900 mt-2.5 mb-1 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xs font-bold text-slate-900 mt-2 mb-1 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="text-xs font-semibold text-slate-900 mt-1.5 mb-0.5 first:mt-0">{children}</h3>,
          code: ({ inline, className, children, ...props }: any) => {
            return inline ? (
              <code
                className="bg-slate-100 text-indigo-700 px-1 py-0.5 rounded font-mono text-[11px] font-semibold border border-slate-200"
                {...props}
              >
                {children}
              </code>
            ) : (
              <pre className="bg-slate-900 text-slate-100 p-2.5 rounded-lg overflow-x-auto text-[11px] font-mono my-2 border border-slate-800">
                <code {...props}>{children}</code>
              </pre>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-indigo-500 pl-2.5 py-1 my-2 italic text-slate-600 bg-indigo-50/40 rounded-r">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 underline font-medium hover:text-indigo-800"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2 rounded-lg border border-slate-200 shadow-3xs">
              <table className="min-w-full divide-y divide-slate-200 text-[11px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-slate-100 text-slate-800 font-semibold">{children}</thead>,
          tbody: ({ children }) => <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>,
          th: ({ children }) => <th className="px-2 py-1.5 text-left text-slate-800 font-semibold">{children}</th>,
          td: ({ children }) => <td className="px-2 py-1.5 text-slate-700">{children}</td>,
          hr: () => <hr className="my-2 border-slate-200" />,
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
};

export const AIChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I am ThreadFlow AI. How can I help you?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      showQuickPrompts: true,
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Speech recognition hook for voice input
  const {
    isListening,
    isSupported: isSpeechSupported,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
  } = useTamilSpeechRecognition('en-IN');

  // Sync speech transcript into input box
  useEffect(() => {
    if (transcript) {
      setInputMessage((prev) => {
        const trimmed = prev.trim();
        return trimmed ? `${trimmed} ${transcript}` : transcript;
      });
      resetTranscript();
    }
  }, [transcript, resetTranscript]);

  // Auto-scroll messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    if (isListening) {
      stopListening();
    }

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const historyPayload = messages.slice(-4).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await apiRequest<{
        success: boolean;
        data: { reply: string; grounded: boolean };
      }>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: text,
          history: historyPayload,
        }),
      });

      const replyContent =
        res.data?.reply ||
        'I received your request but encountered an unexpected error. Please ask again.';

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: replyContent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorReply =
        err?.message ||
        'Unable to reach ThreadFlow AI assistant. Please check network connection and try again.';

      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ ${errorReply}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleVoice = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <>
      {/* Floating Circle Button at Right-Bottom (Minimal circular icon only) */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle ThreadFlow AI"
          className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 cursor-pointer active:scale-95 ${
            isOpen
              ? 'bg-slate-900 text-white rotate-90 ring-4 ring-slate-300'
              : 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 text-white hover:scale-110 ring-4 ring-blue-200/80 shadow-blue-500/30'
          }`}
        >
          {isOpen ? (
            <X className="w-6 h-6 stroke-[2.5]" />
          ) : (
            <Sparkle className="w-7 h-7 text-white" />
          )}
        </button>
      </div>

      {/* Floating Chat Window Drawer */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-32px)] sm:w-[400px] max-w-[400px] h-[540px] max-h-[80vh] bg-white rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden animate-fadeIn">
          {/* Header - ThreadFlow AI only */}
          <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600/80 border border-indigo-400/40 flex items-center justify-center">
                <Bot className="w-4 h-4 text-sky-200" />
              </div>
              <h3 className="font-black text-sm tracking-wide text-white">ThreadFlow AI</h3>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setMessages([
                    {
                      id: 'welcome',
                      role: 'assistant',
                      content: 'Hello! I am ThreadFlow AI. How can I help you?',
                      timestamp: new Date().toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      }),
                      showQuickPrompts: true,
                    },
                  ])
                }
                title="Reset conversation"
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close"
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-600 to-sky-600 flex items-center justify-center shrink-0 text-white shadow-xs mt-1">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[88%] rounded-2xl p-3 text-xs leading-relaxed shadow-3xs ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-br-xs whitespace-pre-wrap'
                      : 'bg-white text-slate-800 border border-slate-200/90 rounded-bl-xs'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <div>{msg.content}</div>
                  ) : (
                    <AIMarkdownRenderer content={msg.content} />
                  )}

                  {/* Beneath the greeting: Quick click capsules */}
                  {msg.showQuickPrompts && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-slate-100">
                      {QUICK_PROMPTS.map((prompt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSend(prompt)}
                          disabled={isLoading}
                          className="px-2.5 py-1 rounded-full bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 border border-indigo-200/80 text-[11px] font-semibold transition-all cursor-pointer text-left shadow-3xs active:scale-95"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  )}

                  <div
                    className={`mt-2 pt-1 border-t flex items-center justify-between text-[9px] ${
                      msg.role === 'user'
                        ? 'border-blue-500/40 text-blue-200'
                        : 'border-slate-100 text-slate-400'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        className="inline-flex items-center gap-1 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer py-0.5 px-1 rounded hover:bg-slate-50 font-medium"
                        title="Copy message"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-2.5 h-2.5 text-emerald-600" />
                            <span className="text-emerald-600 font-semibold">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-2.5 h-2.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span />
                    )}
                    <span className="font-mono">{msg.timestamp}</span>
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0 text-slate-700 shadow-xs mt-1">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 italic p-2">
                <Sparkles className="w-4 h-4 text-indigo-600 animate-spin" />
                <span>Thinking...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Voice Indicator if listening */}
          {isListening && (
            <div className="px-3 py-1.5 bg-rose-50 border-t border-rose-200 flex items-center justify-between text-xs text-rose-700 animate-pulse font-bold">
              <span className="flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-rose-600 animate-bounce" />
                Listening... Speak now
              </span>
              <button
                type="button"
                onClick={stopListening}
                className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-rose-200 hover:bg-rose-300 text-rose-900 cursor-pointer"
              >
                Stop
              </button>
            </div>
          )}

          {/* Input & Voice Controls Footer */}
          <div className="p-3 bg-white border-t border-slate-200">
            <div className="flex items-center gap-2">
              {/* Voice Speak Button */}
              {isSpeechSupported && (
                <button
                  type="button"
                  onClick={toggleVoice}
                  title={isListening ? 'Stop recording' : 'Speak to AI'}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                    isListening
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200'
                  }`}
                >
                  {isListening ? (
                    <MicOff className="w-4 h-4 text-white" />
                  ) : (
                    <Mic className="w-4 h-4 text-slate-700" />
                  )}
                </button>
              )}

              {/* Text Input */}
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about ThreadFlow..."
                disabled={isLoading}
                className="flex-1 text-xs font-medium bg-slate-100 text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:bg-white focus:border-indigo-500 transition-all placeholder:text-slate-400"
              />

              {/* Send Button */}
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!inputMessage.trim() || isLoading}
                aria-label="Send message"
                className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
