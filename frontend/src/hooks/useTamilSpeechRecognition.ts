import { useState, useEffect, useRef, useCallback } from 'react';

// Declarations for browser SpeechRecognition API
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export type SpeechLanguage = 'ta-IN' | 'hi-IN' | 'en-IN';

export const SUPPORTED_SPEECH_LANGUAGES: { code: SpeechLanguage; label: string; native: string }[] = [
  { code: 'ta-IN', label: 'Tamil', native: 'தமிழ்' },
  { code: 'en-IN', label: 'English', native: 'English' },
  { code: 'hi-IN', label: 'Hindi', native: 'हिंदी' },
];

export interface SpeechRecognitionHook {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  speechLang: SpeechLanguage;
  setSpeechLang: (lang: SpeechLanguage) => void;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useTamilSpeechRecognition(initialLang: SpeechLanguage = 'ta-IN'): SpeechRecognitionHook {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [speechLang, setSpeechLangState] = useState<SpeechLanguage>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('threadflow_speech_lang') as SpeechLanguage;
      if (saved && ['ta-IN', 'en-IN', 'hi-IN'].includes(saved)) {
        return saved;
      }
    }
    return initialLang || 'ta-IN';
  });

  const recognitionRef = useRef<any>(null);

  // Check initial browser support
  useEffect(() => {
    const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
    const SpeechRec = win?.SpeechRecognition || win?.webkitSpeechRecognition;
    if (!SpeechRec) {
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore cleanup abort
        }
      }
    };
  }, []);

  const setSpeechLang = useCallback((lang: SpeechLanguage) => {
    setSpeechLangState(lang);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('threadflow_speech_lang', lang);
      } catch {}
    }
    if (recognitionRef.current) {
      recognitionRef.current.lang = lang;
    }
  }, []);

  // Instantiate SpeechRecognition on demand directly inside user gesture
  const startListening = useCallback(() => {
    setError(null);
    setInterimTranscript('');

    const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
    const SpeechRec = win?.SpeechRecognition || win?.webkitSpeechRecognition;

    if (!SpeechRec) {
      setError('Speech recognition is not supported in this browser.');
      setIsSupported(false);
      return;
    }

    try {
      // Abort any prior running instance cleanly
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      const recognition = new SpeechRec();
      recognition.lang = speechLang;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let finalTrans = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalTrans += item[0].transcript + ' ';
          } else {
            currentInterim += item[0].transcript;
          }
        }

        if (finalTrans) {
          setTranscript((prev) => (prev ? `${prev} ${finalTrans.trim()}` : finalTrans.trim()));
        }
        setInterimTranscript(currentInterim);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition notice:', event.error);
        if (event.error === 'not-allowed') {
          setError('Microphone permission denied. Please allow microphone access in your browser.');
        } else if (event.error === 'audio-capture') {
          setError('Audio capture failed: Unable to capture audio from microphone. Please ensure microphone is connected and unmuted.');
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setError(`Speech recognition error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.warn('SpeechRecognition start error:', err);
      setError(`Failed to start microphone: ${err.message || 'Start failed'}`);
      setIsListening(false);
    }
  }, [speechLang]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    error,
    speechLang,
    setSpeechLang,
    startListening,
    stopListening,
    resetTranscript,
  };
}
