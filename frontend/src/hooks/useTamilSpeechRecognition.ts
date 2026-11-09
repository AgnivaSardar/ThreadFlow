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
  const isListeningRef = useRef<boolean>(false);
  const restartTimeoutRef = useRef<any>(null);

  // Initialize SpeechRecognition instance
  useEffect(() => {
    const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
    const SpeechRec = win?.SpeechRecognition || win?.webkitSpeechRecognition;

    if (!SpeechRec) {
      setIsSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = speechLang;
      // Using continuous = false with auto-rearm is substantially more stable in Chromium
      // on Windows and prevents the infamous 'audio-capture' buffer drop error.
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        isListeningRef.current = true;
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
        const errType = event.error;

        if (errType === 'not-allowed') {
          setError(
            'Microphone access blocked. In Windows Settings (Win + I → Privacy & security → Microphone), ensure "Let desktop apps access your microphone" is turned ON.'
          );
          isListeningRef.current = false;
          setIsListening(false);
        } else if (errType === 'audio-capture') {
          setError(
            'Audio capture failed: Windows is blocking Chrome from accessing the microphone (Permission denied by system), or no microphone is plugged in. In Windows Settings (Win + I → Privacy & security → Microphone), turn ON "Let desktop apps access your microphone".'
          );
          isListeningRef.current = false;
          setIsListening(false);
        } else if (errType === 'network') {
          setError(
            'Speech recognition network error: Google speech service could not be reached. Please check your internet connection.'
          );
          isListeningRef.current = false;
          setIsListening(false);
        } else if (errType === 'service-not-allowed') {
          setError('Speech recognition service is not allowed by this browser or network policy.');
          isListeningRef.current = false;
          setIsListening(false);
        } else if (errType === 'no-speech') {
          setError('No speech was detected. Please try speaking closer to your microphone.');
        } else if (errType === 'aborted') {
          isListeningRef.current = false;
          setIsListening(false);
        } else {
          setError(`Speech recognition notice: ${errType}`);
          isListeningRef.current = false;
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        setInterimTranscript('');
        // If the user hasn't explicitly stopped listening, smoothly re-arm recognition
        if (isListeningRef.current) {
          restartTimeoutRef.current = setTimeout(() => {
            if (isListeningRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch {
                setIsListening(false);
                isListeningRef.current = false;
              }
            }
          }, 200);
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
    } catch (e: any) {
      console.warn('SpeechRecognition initialization error:', e);
      setIsSupported(false);
    }

    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore cleanup abort
        }
      }
    };
  }, [speechLang]);

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

  const startListening = useCallback(() => {
    setError(null);
    setInterimTranscript('');

    if (!recognitionRef.current) {
      setError('Speech recognition API is not supported in this browser.');
      return;
    }

    try {
      isListeningRef.current = true;
      recognitionRef.current.lang = speechLang;
      recognitionRef.current.start();
    } catch (err: any) {
      if (err.name !== 'InvalidStateError') {
        console.warn('SpeechRecognition start error:', err);
        setError(`Failed to start microphone: ${err.message || 'Start failed'}`);
        isListeningRef.current = false;
        setIsListening(false);
      }
    }
  }, [speechLang]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
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
