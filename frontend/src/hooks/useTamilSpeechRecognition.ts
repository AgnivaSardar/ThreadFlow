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
  startListening: () => Promise<void>;
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
          setError('Microphone permission denied. Please allow microphone access in your browser settings.');
          isListeningRef.current = false;
          setIsListening(false);
        } else if (errType === 'audio-capture') {
          setError('Audio capture failed: No microphone detected or audio input was blocked. Ensure your microphone is plugged in, unmuted, and allowed in Windows settings.');
          isListeningRef.current = false;
          setIsListening(false);
        } else if (errType === 'network') {
          setError('Network error: Speech recognition service could not be reached. Please check your internet connection.');
          isListeningRef.current = false;
          setIsListening(false);
        } else if (errType === 'service-not-allowed') {
          setError('Speech recognition service is not allowed by this browser or network policy.');
          isListeningRef.current = false;
          setIsListening(false);
        } else if (errType === 'no-speech') {
          // Non-fatal: user paused or stayed quiet
          if (isListeningRef.current) {
            // Re-arm smoothly if still listening
            try {
              recognition.start();
            } catch {
              setIsListening(false);
              isListeningRef.current = false;
            }
          }
        } else if (errType === 'aborted') {
          // User stopped listening, ignore
          setIsListening(false);
          isListeningRef.current = false;
        } else {
          setError(`Speech recognition error: ${errType}`);
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

  const startListening = useCallback(async () => {
    setError(null);
    setInterimTranscript('');

    if (!recognitionRef.current) {
      setError('Speech recognition API is not supported in this browser.');
      return;
    }

    // Explicitly verify microphone hardware and prompt browser permission if needed
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Immediately release tracks so SpeechRecognition has dedicated device access
        stream.getTracks().forEach((track) => track.stop());
      } catch (mediaErr: any) {
        console.warn('Microphone permission / hardware check failed:', mediaErr);
        isListeningRef.current = false;
        setIsListening(false);

        if (mediaErr.name === 'NotAllowedError' || mediaErr.name === 'PermissionDeniedError') {
          setError('Microphone permission denied. Click the lock/settings icon in your browser address bar and allow microphone access.');
          return;
        } else if (mediaErr.name === 'NotFoundError' || mediaErr.name === 'DevicesNotFoundError') {
          setError('No microphone found. Please connect or enable a microphone in Windows Sound settings.');
          return;
        } else if (mediaErr.name === 'NotReadableError' || mediaErr.name === 'TrackStartError') {
          setError('Microphone is in use by another application or Windows audio device is busy.');
          return;
        } else {
          setError(`Microphone error: ${mediaErr.message || mediaErr.name || 'Unable to access audio device'}`);
          return;
        }
      }
    }

    try {
      isListeningRef.current = true;
      recognitionRef.current.lang = speechLang;
      recognitionRef.current.start();
    } catch (err: any) {
      if (err.name !== 'InvalidStateError') {
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
