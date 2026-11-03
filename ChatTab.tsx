import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Mic,
  MicOff,
  Volume2,
  Copy,
  Check,
  Sparkles,
  AlertCircle,
  X,
  Pause,
  Play,
  Square,
  MessageSquare,
  Radio
} from 'lucide-react';
import { ChatMessage, Language } from '../types';
import {
  LANGUAGE_CONFIG,
  isSpeechRecognitionSupported,
  createSpeechRecognizer,
  requestMicrophonePermission,
  speakText,
  stopSpeaking
} from '../utils/speech';
import { UI_TRANSLATIONS } from '../utils/i18n';

interface ChatTabProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, options?: { skipAutoSpeak?: boolean }) => Promise<string | void>;
  isLoading: boolean;
  currentLanguage: Language;
  onLanguageChange: (lang: Language) => void;
  autoSpeak: boolean;
  speechRate: number;
  speechPitch: number;
  selectedVoiceUri?: string;
  onOpenCallSimulator: () => void;
}

export const ChatTab: React.FC<ChatTabProps> = ({
  messages,
  onSendMessage,
  isLoading,
  currentLanguage,
  speechRate,
  speechPitch,
  selectedVoiceUri,
  onOpenCallSimulator,
}) => {
  // Regular text/mic input states
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [reviewHint, setReviewHint] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);

  // Voice Conversation Mode states
  const [isVoiceModeActive, setIsVoiceModeActive] = useState(false);
  const [voiceModeState, setVoiceModeState] = useState<'listening' | 'thinking' | 'speaking' | 'paused'>('listening');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceAiSpeech, setVoiceAiSpeech] = useState('');

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const baseTextRef = useRef<string>('');

  const isVoiceModeActiveRef = useRef(false);
  const isPausedRef = useRef(false);
  const voiceRecognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const voiceAccumulatedRef = useRef<string>('');

  const t = UI_TRANSLATIONS[currentLanguage] || UI_TRANSLATIONS.en;
  const hasSpeechRec = isSpeechRecognitionSupported();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, isVoiceModeActive]);

  // Clean up all speech recognition & audio on unmount
  useEffect(() => {
    return () => {
      isVoiceModeActiveRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (voiceRecognitionRef.current) {
        try {
          voiceRecognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      stopSpeaking();
    };
  }, []);

  // ----------------------------------------------------
  // STANDARD CHAT & SINGLE-TURN MIC INPUT
  // ----------------------------------------------------
  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;
    const text = inputText.trim();
    setInputText('');
    setReviewHint(false);
    setInterimTranscript('');
    await onSendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMicClick = async () => {
    // If speech recognition is unsupported, do NOT pretend to recognize speech!
    if (!hasSpeechRec) {
      setSpeechError(t.micUnsupportedMsg);
      setTimeout(() => setSpeechError(null), 5000);
      return;
    }

    // If currently recording, stop listening cleanly
    if (isRecording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsRecording(false);
      setInterimTranscript('');
      inputRef.current?.focus();
      if (inputText.trim()) {
        setReviewHint(true);
        setTimeout(() => setReviewHint(false), 5000);
      }
      return;
    }

    // Clear previous alerts
    setSpeechError(null);
    setReviewHint(false);
    stopSpeaking();

    // Check / request microphone permission
    const perm = await requestMicrophonePermission();
    if (!perm.granted) {
      if (perm.error === 'not-allowed') {
        setSpeechError(t.micPermissionDeniedMsg);
      } else if (perm.error === 'unsupported') {
        setSpeechError(t.micUnsupportedMsg);
      } else {
        setSpeechError(t.micPermissionDeniedMsg);
      }
      return;
    }

    // Save existing text in input box so newly spoken words append seamlessly
    baseTextRef.current = inputText.trim();

    // Start speech recognition in the currently selected language
    const recognizer = createSpeechRecognizer(
      currentLanguage,
      (transcript, isFinal) => {
        const base = baseTextRef.current;
        const fullText = base ? `${base} ${transcript}` : transcript;
        setInputText(fullText);
        setInterimTranscript(transcript);

        if (isFinal) {
          setReviewHint(true);
        }
      },
      (err: any) => {
        console.warn('Speech recognition error event:', err);
        setIsRecording(false);
        setInterimTranscript('');

        if (err.error === 'not-allowed' || err.error === 'service-not-allowed') {
          setSpeechError(t.micPermissionDeniedMsg);
        } else if (err.error === 'no-speech') {
          setSpeechError(t.micNoSpeechMsg);
          setTimeout(() => setSpeechError(null), 4000);
        } else if (err.error !== 'aborted') {
          setSpeechError(t.micNoSpeechMsg);
          setTimeout(() => setSpeechError(null), 4000);
        }
      },
      () => {
        setIsRecording(false);
        setInterimTranscript('');
        setTimeout(() => {
          inputRef.current?.focus();
        }, 150);
        if (inputText.trim()) {
          setReviewHint(true);
          setTimeout(() => setReviewHint(false), 5000);
        }
      },
      { continuous: true, interimResults: true }
    );

    if (recognizer) {
      recognitionRef.current = recognizer;
      try {
        recognizer.start();
        setIsRecording(true);
      } catch (e: any) {
        console.warn('Failed to start recognizer:', e);
        setIsRecording(false);
      }
    }
  };

  // ----------------------------------------------------
  // VOICE CONVERSATION MODE (HANDS-FREE CONTINUOUS LOOP)
  // ----------------------------------------------------
  const handleStartVoiceMode = async () => {
    if (!hasSpeechRec) {
      setSpeechError(t.micUnsupportedMsg);
      setTimeout(() => setSpeechError(null), 5000);
      return;
    }

    setSpeechError(null);
    stopSpeaking();

    // Request microphone permission
    const perm = await requestMicrophonePermission();
    if (!perm.granted) {
      if (perm.error === 'not-allowed') {
        setSpeechError(t.micPermissionDeniedMsg);
      } else {
        setSpeechError(t.micUnsupportedMsg);
      }
      return;
    }

    // Activate Voice Conversation Mode
    isVoiceModeActiveRef.current = true;
    isPausedRef.current = false;
    setIsVoiceModeActive(true);
    setVoiceModeState('listening');
    setVoiceTranscript('');
    setVoiceAiSpeech('');

    startVoiceListeningTurn();
  };

  const startVoiceListeningTurn = () => {
    if (!isVoiceModeActiveRef.current || isPausedRef.current) return;

    stopSpeaking();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    setVoiceModeState('listening');
    setVoiceTranscript('');
    voiceAccumulatedRef.current = '';

    const recognizer = createSpeechRecognizer(
      currentLanguage,
      (transcript, isFinal) => {
        if (!isVoiceModeActiveRef.current || isPausedRef.current) return;

        voiceAccumulatedRef.current = transcript;
        setVoiceTranscript(transcript);

        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        // Natural pause detection: after user pauses speaking, submit automatically
        if (isFinal) {
          silenceTimerRef.current = setTimeout(() => {
            if (voiceAccumulatedRef.current.trim() && isVoiceModeActiveRef.current && !isPausedRef.current) {
              submitVoiceTurn(voiceAccumulatedRef.current.trim());
            }
          }, 900);
        } else {
          silenceTimerRef.current = setTimeout(() => {
            if (voiceAccumulatedRef.current.trim() && isVoiceModeActiveRef.current && !isPausedRef.current) {
              submitVoiceTurn(voiceAccumulatedRef.current.trim());
            }
          }, 1800);
        }
      },
      (err: any) => {
        console.warn('Voice mode recognition error:', err);
        if (err.error === 'not-allowed' || err.error === 'service-not-allowed') {
          setSpeechError(t.micPermissionDeniedMsg);
          handleStopVoiceMode();
        } else if (err.error === 'no-speech') {
          // If silence timeout occurred in Chrome, restart listening seamlessly if still active
          if (isVoiceModeActiveRef.current && !isPausedRef.current) {
            setTimeout(() => {
              if (isVoiceModeActiveRef.current && !isPausedRef.current) {
                startVoiceListeningTurn();
              }
            }, 300);
          }
        }
      },
      () => {
        // Recognition completed: submit speech if captured and not submitted yet
        if (voiceAccumulatedRef.current.trim() && isVoiceModeActiveRef.current && !isPausedRef.current) {
          submitVoiceTurn(voiceAccumulatedRef.current.trim());
        } else if (isVoiceModeActiveRef.current && !isPausedRef.current && voiceModeState === 'listening') {
          // If ended with no words, keep listening turn open
          setTimeout(() => {
            if (isVoiceModeActiveRef.current && !isPausedRef.current) {
              startVoiceListeningTurn();
            }
          }, 300);
        }
      },
      { continuous: false, interimResults: true }
    );

    if (recognizer) {
      voiceRecognitionRef.current = recognizer;
      try {
        recognizer.start();
      } catch (err: any) {
        console.warn('Failed to start continuous recognizer:', err);
      }
    }
  };

  const submitVoiceTurn = async (text: string) => {
    if (!text.trim() || !isVoiceModeActiveRef.current || isPausedRef.current) return;

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (voiceRecognitionRef.current) {
      try {
        voiceRecognitionRef.current.abort();
      } catch {
        // ignore
      }
    }

    setVoiceModeState('thinking');

    try {
      // Send speech to existing AI chat system (skip standard autoSpeak so voice mode controls playback loop)
      const reply = await onSendMessage(text, { skipAutoSpeak: true });
      const aiResponse = typeof reply === 'string' && reply.trim() ? reply : 'I am here to assist you.';

      // If user paused or stopped while waiting for reply, do not speak
      if (!isVoiceModeActiveRef.current || isPausedRef.current) return;

      setVoiceAiSpeech(aiResponse);
      setVoiceModeState('speaking');

      // Automatically speak the AI response using text-to-speech
      speakText(aiResponse, currentLanguage, speechRate, speechPitch, selectedVoiceUri, () => {
        // After response finishes speaking, allow the user to speak again
        if (isVoiceModeActiveRef.current && !isPausedRef.current) {
          setTimeout(() => {
            if (isVoiceModeActiveRef.current && !isPausedRef.current) {
              startVoiceListeningTurn();
            }
          }, 450);
        }
      });
    } catch (err) {
      console.warn('Voice mode AI send error:', err);
      if (isVoiceModeActiveRef.current && !isPausedRef.current) {
        setTimeout(() => {
          if (isVoiceModeActiveRef.current && !isPausedRef.current) {
            startVoiceListeningTurn();
          }
        }, 1000);
      }
    }
  };

  const handleTogglePauseVoiceMode = () => {
    if (voiceModeState === 'paused') {
      // Resume conversation
      isPausedRef.current = false;
      setVoiceModeState('listening');
      startVoiceListeningTurn();
    } else {
      // Pause conversation (do not listen when paused!)
      isPausedRef.current = true;
      setVoiceModeState('paused');
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (voiceRecognitionRef.current) {
        try {
          voiceRecognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      stopSpeaking();
    }
  };

  const handleStopVoiceMode = () => {
    // Stop voice mode completely (do not listen when stopped!)
    isVoiceModeActiveRef.current = false;
    isPausedRef.current = false;
    setIsVoiceModeActive(false);
    setVoiceTranscript('');
    setVoiceAiSpeech('');

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (voiceRecognitionRef.current) {
      try {
        voiceRecognitionRef.current.abort();
      } catch {
        // ignore
      }
    }
    stopSpeaking();
  };

  const handleManualDoneSpeaking = () => {
    if (voiceTranscript.trim()) {
      submitVoiceTurn(voiceTranscript.trim());
    }
  };

  // ----------------------------------------------------
  // HELPERS
  // ----------------------------------------------------
  const handleSpeakMessage = (msgId: string, text: string, lang?: Language) => {
    if (playingMessageId === msgId) {
      stopSpeaking();
      setPlayingMessageId(null);
      return;
    }
    setPlayingMessageId(msgId);
    speakText(text, lang || currentLanguage, speechRate, speechPitch, selectedVoiceUri, () => {
      setPlayingMessageId(null);
    });
  };

  const handleQuickPreviewVoice = () => {
    stopSpeaking();
    setIsPreviewingVoice(true);
    let phrase = '';
    if (currentLanguage === 'hi') {
      phrase = 'नमस्ते! मैं बिपुल एआई हूँ, आपका पर्सनल वॉयस व कॉल असिस्टेंट। मैं आपकी सहायता के लिए तैयार हूँ।';
    } else if (currentLanguage === 'bn') {
      phrase = 'নমস্কার! আমি বিপুল এআই, আপনার ব্যক্তিগত ভয়েস ও কল সহকারী। আজ আপনাকে কীভাবে সাহায্য করতে পারি?';
    } else {
      phrase = 'Hello! I am Bipul AI, your friendly, helpful, and intelligent personal voice assistant.';
    }
    speakText(phrase, currentLanguage, speechRate, speechPitch, selectedVoiceUri, () => {
      setIsPreviewingVoice(false);
    });
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const quickPrompts: Record<Language, string[]> = {
    en: [
      'What can you do for Bipul?',
      'Draft a polite message for a caller',
      'Explain Jio call forwarding setup',
      'Summarize today\'s calls'
    ],
    hi: [
      'आप बिपुल की क्या-क्या मदद कर सकते हैं?',
      'क्लाइंट के लिए एक विनम्र संदेश लिखो',
      'जियो पर कॉल फॉरवर्डिंग कैसे चालू करें?',
      'हाल ही में आए कॉल्स की जानकारी दें'
    ],
    bn: [
      'আপনি বিপুল বাবুর কী কী কাজ করতে পারেন?',
      'একটি দরকারি বার্তা গুছিয়ে লিখে দিন',
      'জিও ফোনে কল ফরওয়ার্ডিং কীভাবে করব?',
      'সাম্প্রতিক কলগুলোর সারাংশ দেখান'
    ]
  };

  return (
    <div className="flex flex-col h-[calc(100vh-112px)] max-w-md mx-auto relative">
      {/* Top Notice & Voice Mode / Preview Action Bar */}
      <div className="bg-[#0e172e] border-b border-[#1e305e] px-3 py-2 flex items-center justify-between text-xs text-slate-300 gap-1">
        <div className="flex items-center gap-1.5 overflow-hidden shrink-1">
          <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="truncate">
            {t.speakingIn} <strong className="text-blue-300">{LANGUAGE_CONFIG[currentLanguage].nativeName}</strong>
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Prominent Start Voice Conversation Mode Button */}
          <button
            onClick={handleStartVoiceMode}
            className="text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-sm shadow-blue-600/30 active:scale-95 transition-all cursor-pointer border border-blue-400/30"
            title="Start hands-free continuous voice conversation"
          >
            <Radio className="w-3.5 h-3.5 text-blue-200 animate-pulse" />
            <span className="whitespace-nowrap">{t.startVoiceModeBtn}</span>
          </button>

          {/* Quick 1-Tap Voice Preview Button */}
          <button
            onClick={handleQuickPreviewVoice}
            disabled={isPreviewingVoice}
            className={`text-xs px-2 py-1 rounded-lg font-medium flex items-center gap-1 transition-all cursor-pointer ${
              isPreviewingVoice
                ? 'bg-blue-600 text-white animate-pulse'
                : 'bg-[#152243] hover:bg-[#1f315e] text-blue-300 border border-blue-500/30'
            }`}
            title="Preview AI Voice Sample"
          >
            <Volume2 className={`w-3.5 h-3.5 ${isPreviewingVoice ? 'animate-bounce text-white' : 'text-blue-400'}`} />
            <span className="hidden sm:inline">{isPreviewingVoice ? t.speaking : t.voicePreviewBtn}</span>
          </button>

          {/* Test Call Simulator Trigger */}
          <button
            onClick={onOpenCallSimulator}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 active:scale-95 transition-transform cursor-pointer px-2 py-1 bg-blue-600/20 rounded-lg border border-blue-500/30"
          >
            <span>{t.testCallBtn}</span>
            <span className="text-[10px] text-blue-300 font-mono">Demo</span>
          </button>
        </div>
      </div>

      {/* Voice Conversation Mode Full-Screen / Overlay Panel */}
      {isVoiceModeActive && (
        <div className="absolute inset-0 z-30 bg-[#070c18]/95 backdrop-blur-md flex flex-col justify-between p-4 animate-in fade-in zoom-in-95 duration-200">
          {/* Header in Voice Mode */}
          <div className="flex items-center justify-between border-b border-[#1e305e] pb-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  voiceModeState === 'paused' ? 'bg-amber-400' : 'bg-blue-400'
                }`} />
                <span className={`relative inline-flex rounded-full h-3 w-3 ${
                  voiceModeState === 'paused' ? 'bg-amber-500' : 'bg-blue-500'
                }`} />
              </span>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>{t.voiceModeTitle}</span>
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.2 rounded font-mono">
                    {LANGUAGE_CONFIG[currentLanguage].nativeName}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">{t.voiceModeDesc}</p>
              </div>
            </div>

            <button
              onClick={handleStopVoiceMode}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              title="Close Voice Mode"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Center Orb & Animated Feedback */}
          <div className="flex-1 flex flex-col items-center justify-center my-auto py-6 text-center space-y-6">
            {/* Animated Dynamic Visualizer Circle */}
            <div className="relative flex items-center justify-center">
              {/* Pulsing Outer Rings */}
              {voiceModeState === 'listening' && (
                <>
                  <div className="w-36 h-36 rounded-full bg-blue-600/20 animate-ping absolute duration-1000" />
                  <div className="w-44 h-44 rounded-full border border-blue-500/30 animate-pulse absolute" />
                </>
              )}
              {voiceModeState === 'speaking' && (
                <>
                  <div className="w-36 h-36 rounded-full bg-emerald-600/20 animate-ping absolute duration-1000" />
                  <div className="w-44 h-44 rounded-full border border-emerald-500/30 animate-pulse absolute" />
                </>
              )}
              {voiceModeState === 'thinking' && (
                <div className="w-36 h-36 rounded-full bg-indigo-600/25 animate-pulse absolute" />
              )}

              {/* Main Glowing Circle */}
              <div
                className={`w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-2xl relative transition-all duration-300 ${
                  voiceModeState === 'listening'
                    ? 'bg-gradient-to-tr from-blue-600 to-cyan-500 shadow-blue-500/40 ring-4 ring-blue-400/30'
                    : voiceModeState === 'speaking'
                    ? 'bg-gradient-to-tr from-emerald-600 to-teal-400 shadow-emerald-500/40 ring-4 ring-emerald-400/30'
                    : voiceModeState === 'thinking'
                    ? 'bg-gradient-to-tr from-indigo-700 to-purple-600 shadow-indigo-500/40 animate-pulse'
                    : 'bg-gradient-to-tr from-amber-700 to-amber-600 shadow-amber-500/30 ring-4 ring-amber-400/20'
                }`}
              >
                {voiceModeState === 'listening' && (
                  <Mic className="w-10 h-10 text-white animate-pulse" />
                )}
                {voiceModeState === 'speaking' && (
                  <Volume2 className="w-10 h-10 text-white animate-bounce" />
                )}
                {voiceModeState === 'thinking' && (
                  <Sparkles className="w-10 h-10 text-white animate-spin duration-3000" />
                )}
                {voiceModeState === 'paused' && (
                  <Pause className="w-10 h-10 text-white" />
                )}
              </div>
            </div>

            {/* Status Text & Sound Waves */}
            <div className="space-y-2 max-w-xs">
              <div className="text-base font-bold text-white flex items-center justify-center gap-2">
                <span>
                  {voiceModeState === 'listening' && t.voiceModeListening}
                  {voiceModeState === 'thinking' && t.voiceModeThinking}
                  {voiceModeState === 'speaking' && t.voiceModeSpeaking}
                  {voiceModeState === 'paused' && t.voiceModePaused}
                </span>

                {/* Animated Equalizer Wave Bars */}
                {voiceModeState === 'speaking' && (
                  <span className="flex items-center gap-1">
                    <span className="w-1 h-3 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-5 bg-teal-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-4 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                )}
                {voiceModeState === 'listening' && (
                  <span className="flex items-center gap-1">
                    <span className="w-1 h-3 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-5 bg-cyan-200 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                    <span className="w-1 h-3 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
                  </span>
                )}
              </div>

              {/* Live Speech Subtitle Box */}
              {voiceModeState === 'listening' && (
                <div className="min-h-[48px] px-3 py-2 bg-[#0e172e] border border-[#1e305e] rounded-xl text-xs text-blue-200 flex items-center justify-center">
                  <span className="italic">
                    {voiceTranscript ? `"${voiceTranscript}"` : t.micSpeakHint}
                  </span>
                </div>
              )}

              {voiceModeState === 'speaking' && (
                <div className="min-h-[48px] max-h-24 overflow-y-auto px-3 py-2 bg-[#0e172e] border border-emerald-500/30 rounded-xl text-xs text-emerald-100 flex items-center justify-center text-left">
                  <span>"{voiceAiSpeech}"</span>
                </div>
              )}

              {/* Done Speaking / Send immediately button */}
              {voiceModeState === 'listening' && voiceTranscript.trim() && (
                <button
                  onClick={handleManualDoneSpeaking}
                  className="mt-2 text-xs px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-1.5 mx-auto active:scale-95 transition-all cursor-pointer shadow-md shadow-blue-600/30"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{t.voiceModeDoneSpeaking}</span>
                </button>
              )}
            </div>
          </div>

          {/* Bottom Voice Mode Control Bar (Pause, Stop, Text Switch) */}
          <div className="border-t border-[#1e305e] pt-3.5 pb-1 flex items-center justify-around gap-3">
            {/* Pause / Resume Button */}
            <button
              onClick={handleTogglePauseVoiceMode}
              className={`flex-1 py-3 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                voiceModeState === 'paused'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 active:scale-95'
                  : 'bg-[#152243] hover:bg-[#1f315e] text-blue-200 border border-blue-500/30 active:scale-95'
              }`}
              title={voiceModeState === 'paused' ? t.voiceModeResumeBtn : t.voiceModePauseBtn}
            >
              {voiceModeState === 'paused' ? (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>{t.voiceModeResumeBtn}</span>
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4" />
                  <span>{t.voiceModePauseBtn}</span>
                </>
              )}
            </button>

            {/* Stop Voice Mode Button */}
            <button
              onClick={handleStopVoiceMode}
              className="flex-1 py-3 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-600/30 active:scale-95 transition-all cursor-pointer"
              title={t.voiceModeStopBtn}
            >
              <Square className="w-4 h-4 fill-white" />
              <span>{t.voiceModeStopBtn}</span>
            </button>
          </div>
        </div>
      )}

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3.5">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isPlaying = playingMessageId === msg.id;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full`}
            >
              {/* Header Label */}
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1 px-1">
                <span className="font-semibold text-slate-300">
                  {isUser ? t.you : t.bipulAi}
                </span>
                <span>·</span>
                <span>{msg.timestamp}</span>
                {msg.isDemo && (
                  <>
                    <span>·</span>
                    <span className="text-amber-400 font-medium">{t.demoReply}</span>
                  </>
                )}
              </div>

              {/* Message Bubble */}
              <div
                className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed max-w-[88%] break-words shadow-sm ${
                  isUser
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-br-xs'
                    : 'bg-[#101b36] text-slate-100 border border-[#1d2d55] rounded-bl-xs'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Actions for Assistant Bubble */}
                {!isUser && (
                  <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-slate-700/40 text-[11px] text-slate-400">
                    <button
                      onClick={() => handleSpeakMessage(msg.id, msg.content, msg.language)}
                      className={`flex items-center gap-1 hover:text-blue-300 transition-colors cursor-pointer ${
                        isPlaying ? 'text-blue-400 font-semibold' : ''
                      }`}
                    >
                      <Volume2 className={`w-3.5 h-3.5 ${isPlaying ? 'animate-pulse text-blue-400' : ''}`} />
                      <span>{isPlaying ? t.speaking : t.listen}</span>
                    </button>
                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="flex items-center gap-1 hover:text-blue-300 transition-colors cursor-pointer"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">{t.copied}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>{t.copy}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex flex-col items-start max-w-full">
            <div className="text-[10px] text-slate-400 mb-1 px-1 font-semibold">
              {t.thinking}
            </div>
            <div className="bg-[#101b36] border border-[#1d2d55] rounded-2xl rounded-bl-xs px-4 py-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      {messages.length <= 4 && !isVoiceModeActive && (
        <div className="px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {quickPrompts[currentLanguage].map((prompt, i) => (
            <button
              key={i}
              onClick={() => onSendMessage(prompt)}
              className="text-xs whitespace-nowrap bg-[#0e172e] hover:bg-[#152243] border border-[#1e305e] text-slate-300 px-3 py-1.5 rounded-full transition-colors shrink-0 cursor-pointer active:scale-95"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Speech Error Banner (Permission denied, unsupported, or microphone error) */}
      {speechError && (
        <div className="mx-3.5 mb-2 px-3 py-2 bg-red-950/90 border border-red-700/70 rounded-xl text-xs text-red-200 flex items-start gap-2 shadow-lg z-40">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 leading-snug">
            <span>{speechError}</span>
          </div>
          <button
            onClick={() => setSpeechError(null)}
            className="text-red-400 hover:text-white p-0.5 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Review & Edit Hint Banner (Shown after speech is converted to text via regular mic) */}
      {reviewHint && inputText && !isRecording && (
        <div className="mx-3.5 mb-2 px-3 py-1.5 bg-emerald-950/80 border border-emerald-600/40 rounded-xl text-xs text-emerald-200 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{t.micReviewHint}</span>
          </div>
          <button
            onClick={() => setReviewHint(false)}
            className="text-emerald-400 hover:text-white p-0.5 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Active Listening Soundwave Banner (Single-turn Mic Input) */}
      {isRecording && (
        <div className="mx-3.5 mb-2 px-3.5 py-2.5 bg-blue-950/90 border border-blue-500/60 rounded-xl flex items-center justify-between text-xs text-blue-100 shadow-xl shadow-blue-900/30">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="relative flex items-center justify-center">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping absolute" />
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 relative" />
            </div>
            <div className="flex flex-col overflow-hidden">
              <div className="font-semibold text-blue-200 flex items-center gap-1.5">
                <span>{t.micListeningBadge} {LANGUAGE_CONFIG[currentLanguage].nativeName}</span>
                <span className="flex items-center gap-0.5">
                  <span className="w-1 h-2.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-3.5 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
              <span className="text-[11px] text-slate-300 truncate">
                {interimTranscript ? `"${interimTranscript}"` : t.micSpeakHint}
              </span>
            </div>
          </div>
          <button
            onClick={handleMicClick}
            className="text-[11px] font-bold text-white px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 active:scale-95 transition-all cursor-pointer shrink-0 ml-2 shadow-sm"
          >
            {t.stopListening}
          </button>
        </div>
      )}

      {/* Input Bar with Clearly Visible Microphone Button Beside Input Box */}
      <div className="p-3 bg-[#070c18] border-t border-[#152243]">
        <div className="flex items-center gap-2">
          {/* Message Input Box with Clear Button */}
          <div className="flex-1 flex items-center bg-[#0e172e] border border-[#1e305e] rounded-2xl px-3 py-1 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/40 transition-all min-h-[44px]">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                if (reviewHint) setReviewHint(false);
              }}
              onKeyDown={handleKeyDown}
              placeholder={isRecording ? `${t.micListeningBadge} ${LANGUAGE_CONFIG[currentLanguage].nativeName}...` : LANGUAGE_CONFIG[currentLanguage].placeholder}
              disabled={isLoading}
              className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 py-1.5 focus:outline-none"
            />
            {inputText && !isRecording && (
              <button
                type="button"
                onClick={() => {
                  setInputText('');
                  inputRef.current?.focus();
                }}
                className="text-slate-500 hover:text-slate-300 p-1.5 rounded-full cursor-pointer transition-colors shrink-0"
                title="Clear input"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Clearly Visible Microphone Button Beside Input Box (44x44px for Android Touch) */}
          <button
            type="button"
            onClick={handleMicClick}
            aria-label={isRecording ? t.micStopBtnTitle : t.micBtnTitle}
            disabled={isLoading}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all cursor-pointer ${
              isRecording
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/50 ring-4 ring-red-500/30 animate-pulse'
                : !hasSpeechRec
                ? 'bg-[#121c35] text-slate-500 border border-[#1e305e] hover:border-slate-600'
                : 'bg-[#152243] hover:bg-blue-600/25 text-blue-400 hover:text-blue-300 border border-blue-500/40 shadow-sm active:scale-95'
            }`}
            title={
              !hasSpeechRec
                ? t.micUnsupportedMsg
                : isRecording
                ? t.micStopBtnTitle
                : t.micBtnTitle
            }
          >
            {isRecording ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className={`w-5 h-5 ${!hasSpeechRec ? 'text-slate-500' : 'text-blue-400'}`} />
            )}
          </button>

          {/* Send Button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputText.trim() || isLoading}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
              inputText.trim() && !isLoading
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 cursor-pointer active:scale-95'
                : 'bg-[#0e172e] text-slate-600 border border-[#1e305e] cursor-not-allowed opacity-60'
            }`}
            title={t.sendMessageTitle}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
