import { Language } from '../types';

export const LANGUAGE_CONFIG: Record<
  Language,
  {
    name: string;
    nativeName: string;
    bcp47: string;
    sampleGreeting: string;
    placeholder: string;
  }
> = {
  en: {
    name: 'English',
    nativeName: 'English',
    bcp47: 'en-IN',
    sampleGreeting: 'Hello! I am Bipul AI, your personal voice and call assistant. How can I help you today?',
    placeholder: 'Ask Bipul AI or tap mic to speak...'
  },
  hi: {
    name: 'Hindi',
    nativeName: 'हिंदी',
    bcp47: 'hi-IN',
    sampleGreeting: 'नमस्ते! मैं बिपुल एआई हूँ, आपका पर्सनल वॉयस और कॉल असिस्टेंट। आज मैं आपकी क्या सहायता करूँ?',
    placeholder: 'कुछ पूछें या बोलने के लिए माइक दबाएँ...'
  },
  bn: {
    name: 'Bengali',
    nativeName: 'বাংলা',
    bcp47: 'bn-IN',
    sampleGreeting: 'নমস্কার! আমি বিপুল এআই, আপনার ব্যক্তিগত ভয়েস ও কল সহকারী। আজ আপনাকে কীভাবে সাহায্য করতে পারি?',
    placeholder: 'কিছু জিজ্ঞাসা করুন বা মাইকে কথা বলুন...'
  }
};

/**
 * Check if browser supports speech recognition
 */
export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
}

/**
 * Check if browser supports speech synthesis
 */
export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Get available browser voices (listens to voiceschanged event)
 */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSynthesisSupported()) return [];
  return window.speechSynthesis.getVoices();
}

/**
 * Clean text from markdown formatting for natural TTS speaking
 */
export function sanitizeForSpeech(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/\[(.*?)\]/g, '')
    .replace(/#+\s/g, '')
    .replace(/`{1,3}.*?`{1,3}/g, '')
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .trim();
}

/**
 * Detect language from text (Bengali, Hindi, or English)
 * Used for future real-call auto-detection & Call Simulator
 */
export function detectLanguage(text: string): Language {
  if (!text) return 'en';

  // 1. Bengali Unicode block \u0980-\u09FF
  if (/[\u0980-\u09FF]/.test(text)) {
    return 'bn';
  }

  // 2. Devanagari (Hindi) Unicode block \u0900-\u097F
  if (/[\u0900-\u097F]/.test(text)) {
    return 'hi';
  }

  // 3. Romanized Bengali keywords
  const lower = text.toLowerCase();
  const bengaliWords = ['nomoshkar', 'namaskar', 'kemon', 'achen', 'bhalo', 'bolchi', 'khobor', 'amar', 'apnar', 'shunte', 'ekta', 'dorkar'];
  for (const w of bengaliWords) {
    if (new RegExp(`\\b${w}\\b`, 'i').test(lower)) return 'bn';
  }

  // 4. Romanized Hindi keywords
  const hindiWords = ['namaste', 'kaise', 'kya', 'haan', 'nahi', 'aap', 'hum', 'mujhe', 'bol', 'raha', 'batao', 'baat', 'karni', 'kripya'];
  for (const w of hindiWords) {
    if (new RegExp(`\\b${w}\\b`, 'i').test(lower)) return 'hi';
  }

  return 'en';
}

/**
 * Speak text using Web Speech API with voice selection support
 */
export function speakText(
  text: string,
  lang: Language = 'en',
  rate: number = 1.0,
  pitch: number = 1.0,
  voiceUri?: string,
  onEnd?: () => void
): void {
  if (!isSpeechSynthesisSupported()) {
    if (onEnd) onEnd();
    return;
  }

  try {
    window.speechSynthesis.cancel();

    const clean = sanitizeForSpeech(text);
    if (!clean) {
      if (onEnd) onEnd();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(clean);
    const targetBcp = LANGUAGE_CONFIG[lang].bcp47;
    utterance.lang = targetBcp;
    utterance.rate = Math.max(0.7, Math.min(1.5, rate));
    utterance.pitch = Math.max(0.7, Math.min(1.4, pitch));

    const voices = window.speechSynthesis.getVoices();

    // 1. If explicit voiceUri selected, find matching voice
    if (voiceUri) {
      const selected = voices.find((v) => v.voiceURI === voiceUri || v.name === voiceUri);
      if (selected) {
        utterance.voice = selected;
      }
    }

    // 2. If no voice or voice was not found, pick best match for target language
    if (!utterance.voice && voices.length > 0) {
      const langPrefix = targetBcp.split('-')[0];
      const match = voices.find(
        (v) =>
          v.lang.toLowerCase() === targetBcp.toLowerCase() ||
          v.lang.toLowerCase().replace('_', '-').startsWith(langPrefix)
      );
      if (match) {
        utterance.voice = match;
      }
    }

    if (onEnd) {
      utterance.onend = () => onEnd();
      utterance.onerror = () => onEnd();
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Speech synthesis error:', err);
    if (onEnd) onEnd();
  }
}

/**
 * Preview a specific voice with a short natural phrase
 */
export function previewVoice(
  voice: SpeechSynthesisVoice,
  lang: Language = 'en',
  rate: number = 1.0,
  pitch: number = 1.0,
  onEnd?: () => void
): void {
  if (!isSpeechSynthesisSupported()) {
    if (onEnd) onEnd();
    return;
  }

  let phrase = '';
  if (lang === 'hi' || voice.lang.startsWith('hi')) {
    phrase = 'नमस्ते, मैं बिपुल एआई की आवाज़ हूँ।';
  } else if (lang === 'bn' || voice.lang.startsWith('bn')) {
    phrase = 'নমস্কার, আমি বিপুল এআই-এর ভয়েস সহকারী।';
  } else {
    phrase = 'Hello, this is Bipul AI voice preview.';
  }

  speakText(phrase, lang, rate, pitch, voice.voiceURI, onEnd);
}

/**
 * Stop currently active speech
 */
export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

/**
 * Request microphone permission from user via standard browser MediaDevices API
 */
export async function requestMicrophonePermission(): Promise<{ granted: boolean; error?: string }> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (!isSpeechRecognitionSupported()) {
      return { granted: false, error: 'unsupported' };
    }
    return { granted: true };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Stop tracks immediately so the microphone is released for speech recognition
    stream.getTracks().forEach((track) => track.stop());
    return { granted: true };
  } catch (err: any) {
    console.warn('Microphone permission error:', err);
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return { granted: false, error: 'not-allowed' };
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return { granted: false, error: 'no-device' };
    }
    return { granted: false, error: err.name || 'unknown' };
  }
}

/**
 * Creates a configured SpeechRecognition instance
 */
export function createSpeechRecognizer(
  lang: Language,
  onResult: (transcript: string, isFinal?: boolean) => void,
  onError: (err: any) => void,
  onEnd: () => void,
  options?: { interimResults?: boolean; continuous?: boolean }
): any {
  if (!isSpeechRecognitionSupported()) return null;

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  recognition.continuous = options?.continuous ?? true;
  recognition.interimResults = options?.interimResults ?? true;
  recognition.lang = LANGUAGE_CONFIG[lang].bcp47;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event: any) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const part = event.results[i][0]?.transcript || '';
      if (event.results[i].isFinal) {
        finalTranscript += part;
      } else {
        interimTranscript += part;
      }
    }

    const currentText = finalTranscript || interimTranscript;
    const isFinal = Boolean(finalTranscript && !interimTranscript);
    if (currentText) {
      onResult(currentText.trim(), isFinal);
    }
  };

  recognition.onerror = (event: any) => {
    onError(event);
  };

  recognition.onend = () => {
    onEnd();
  };

  return recognition;
}
