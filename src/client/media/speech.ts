// Browser speech recognition is optional; iPhone keyboard dictation remains the fallback.
import { useEffect, useRef, useState } from 'preact/hooks';

interface SpeechResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechEvent {
  results: ArrayLike<SpeechResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

export function useDictation(onText: (text: string) => void, focus: () => void) {
  const [active, setActive] = useState(false);
  const [fallback, setFallback] = useState(false);
  const current = useRef<Recognition | null>(null);
  const callback = useRef(onText);
  callback.current = onText;

  const cancel = () => {
    const recognition = current.current;
    current.current = null;
    recognition?.abort();
    setActive(false);
  };
  useEffect(
    () => () => {
      const recognition = current.current;
      current.current = null;
      recognition?.abort();
    },
    [],
  );

  const toggle = (text: string) => {
    if (current.current) {
      current.current.stop();
      return;
    }
    const Speech = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
    if (!Speech) {
      setFallback(true);
      focus();
      return;
    }
    const recognition = new Speech();
    recognition.lang = 'es-MX';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      if (current.current !== recognition) return;
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(' ');
      callback.current([text.trim(), transcript.trim()].filter(Boolean).join(' '));
    };
    recognition.onerror = () => {
      if (current.current !== recognition) return;
      current.current = null;
      setActive(false);
      setFallback(true);
      focus();
    };
    recognition.onend = () => {
      if (current.current !== recognition) return;
      current.current = null;
      setActive(false);
    };
    current.current = recognition;
    setFallback(false);
    setActive(true);
    try {
      recognition.start();
    } catch {
      current.current = null;
      setActive(false);
      setFallback(true);
      focus();
    }
  };
  return { active, fallback, toggle, cancel };
}
