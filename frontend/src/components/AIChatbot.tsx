import React, { useState, useEffect, useRef } from 'react';
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

export const AIChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-br-xs'
                      : 'bg-white text-slate-800 border border-slate-200/90 rounded-bl-xs'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>

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
                    className={`mt-1.5 text-[9px] text-right font-mono ${
                      msg.role === 'user' ? 'text-blue-200' : 'text-slate-400'
                    }`}
                  >
                    {msg.timestamp}
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
