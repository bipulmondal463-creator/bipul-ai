import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, Send, Sparkles, X, Check, Languages, AlertCircle } from 'lucide-react';
import { CallRecord, CallTranscriptTurn, Language } from '../types';
import { 
  LANGUAGE_CONFIG, 
  createSpeechRecognizer, 
  isSpeechRecognitionSupported, 
  speakText, 
  stopSpeaking,
  detectLanguage 
} from '../utils/speech';
import { UI_TRANSLATIONS } from '../utils/i18n';

interface CallSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveCallRecord: (record: CallRecord) => void;
  defaultLanguage: Language;
  speechRate: number;
  speechPitch: number;
  selectedVoiceUri?: string;
  autoDetectCallerLang?: boolean;
}

export const CallSimulatorModal: React.FC<CallSimulatorModalProps> = ({
  isOpen,
  onClose,
  onSaveCallRecord,
  defaultLanguage,
  speechRate,
  speechPitch,
  selectedVoiceUri,
  autoDetectCallerLang = true,
}) => {
  const [callState, setCallState] = useState<'ringing' | 'active' | 'summarizing' | 'completed'>('ringing');
  const [callerName, setCallerName] = useState('Anil Sharma (Client)');
  const [callerNumber, setCallerNumber] = useState('+91 98200 11223');
  const [selectedLang, setSelectedLang] = useState<Language>(defaultLanguage);
  const [isAutoDetect, setIsAutoDetect] = useState(autoDetectCallerLang);
  const [detectedBadge, setDetectedBadge] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState<CallTranscriptTurn[]>([]);
  const [callerInput, setCallerInput] = useState('');
  const [isAiReplying, setIsAiReplying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [summaryResult, setSummaryResult] = useState<CallRecord | null>(null);

  const durationTimerRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const t = UI_TRANSLATIONS[selectedLang] || UI_TRANSLATIONS.en;

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, isAiReplying]);

  // Duration timer when call is active
  useEffect(() => {
    if (callState === 'active') {
      durationTimerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    }
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, [callState]);

  // Reset and clean speech when closed
  useEffect(() => {
    if (!isOpen) {
      stopSpeaking();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      setCallState('ringing');
      setTranscript([]);
      setDuration(0);
      setSummaryResult(null);
      setDetectedBadge(null);
    } else {
      setSelectedLang(defaultLanguage);
    }
  }, [isOpen, defaultLanguage]);

  if (!isOpen) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerCall = async () => {
    setCallState('active');

    // AI greeting based on chosen language
    let greeting = '';
    if (selectedLang === 'hi') {
      greeting = 'नमस्ते! मैं बिपुल एआई हूँ, बिपुल का पर्सनल असिस्टेंट। बिपul अभी फोन नहीं उठा पा रहे हैं। मैं आपका क्या संदेश नोट करूँ?';
    } else if (selectedLang === 'bn') {
      greeting = 'নমস্কার! আমি বিপুল এআই, বিপুল বাবুর সহকারী। উনি এখন কথা বলতে পারছেন না। আপনার কি কোনো জরুরি বার্তা আছে?';
    } else {
      greeting = 'Hello! I am Bipul AI, personal voice assistant for Bipul. He is currently away. How can I assist you, or may I take a message?';
    }

    const aiTurn: CallTranscriptTurn = { speaker: 'AI', text: greeting };
    setTranscript([aiTurn]);
    speakText(greeting, selectedLang, speechRate, speechPitch, selectedVoiceUri);
  };

  const handleSendCallerTurn = async (textToSend?: string) => {
    const text = textToSend || callerInput.trim();
    if (!text || isAiReplying) return;

    setCallerInput('');
    stopSpeaking();

    // Language Auto-Detection
    let currentCallLang = selectedLang;
    if (isAutoDetect) {
      const detected = detectLanguage(text);
      if (detected !== selectedLang) {
        currentCallLang = detected;
        setSelectedLang(detected);
        setDetectedBadge(`Auto-switched to ${LANGUAGE_CONFIG[detected].name}`);
        setTimeout(() => setDetectedBadge(null), 3000);
      }
    }

    const userTurn: CallTranscriptTurn = { speaker: 'Caller', text };
    const updatedTranscript = [...transcript, userTurn];
    setTranscript(updatedTranscript);
    setIsAiReplying(true);

    try {
      const res = await fetch('/api/call-simulate/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callerMessage: text,
          language: currentCallLang,
          callerName,
          callTranscript: updatedTranscript
        })
      });
      const data = await res.json();
      const reply = data.reply || 'I have noted your message for Bipul.';

      const aiTurn: CallTranscriptTurn = { speaker: 'AI', text: reply };
      setTranscript((prev) => [...prev, aiTurn]);
      speakText(reply, currentCallLang, speechRate, speechPitch, selectedVoiceUri);
    } catch {
      const fallbackReply = currentCallLang === 'hi'
        ? 'जी, मैंने आपका संदेश नोट कर लिया है और बिपुल को तुरंत भेज दिया है।'
        : currentCallLang === 'bn'
        ? 'আমি আপনার বার্তাটি লিখে রেখেছি এবং বিপুল বাবুকে জানিয়ে দেব।'
        : 'Thank you, I have recorded your message and notified Bipul.';
      const aiTurn: CallTranscriptTurn = { speaker: 'AI', text: fallbackReply };
      setTranscript((prev) => [...prev, aiTurn]);
      speakText(fallbackReply, currentCallLang, speechRate, speechPitch, selectedVoiceUri);
    } finally {
      setIsAiReplying(false);
    }
  };

  const toggleMic = () => {
    if (!isSpeechRecognitionSupported()) return;

    if (isRecording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsRecording(false);
      return;
    }

    stopSpeaking();
    const recognizer = createSpeechRecognizer(
      selectedLang,
      (text) => {
        setIsRecording(false);
        handleSendCallerTurn(text);
      },
      () => setIsRecording(false),
      () => setIsRecording(false)
    );

    if (recognizer) {
      recognitionRef.current = recognizer;
      recognizer.start();
      setIsRecording(true);
    }
  };

  const handleEndCall = async () => {
    stopSpeaking();
    setCallState('summarizing');

    try {
      const res = await fetch('/api/call-simulate/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          callerName,
          callerNumber,
          language: selectedLang
        })
      });
      const data = await res.json();
      const record: CallRecord = data.record || {
        id: `call-${Date.now()}`,
        callerName,
        callerNumber,
        timestamp: 'Just now',
        duration: `${duration}s`,
        language: selectedLang === 'hi' ? 'Hindi' : selectedLang === 'bn' ? 'Bengali' : 'English',
        urgency: 'Medium',
        status: 'Message Taken',
        summary: 'Caller reached Bipul AI and left a message to call back regarding their query.',
        transcript
      };

      setSummaryResult(record);
      onSaveCallRecord(record);
      setCallState('completed');
    } catch {
      const fallbackRecord: CallRecord = {
        id: `call-${Date.now()}`,
        callerName,
        callerNumber,
        timestamp: 'Just now',
        duration: `${duration}s`,
        language: selectedLang === 'hi' ? 'Hindi' : selectedLang === 'bn' ? 'Bengali' : 'English',
        urgency: 'Normal',
        status: 'Message Taken',
        summary: `Caller ${callerName} left a message with Bipul AI.`,
        transcript
      };
      setSummaryResult(fallbackRecord);
      onSaveCallRecord(fallbackRecord);
      setCallState('completed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 animate-fadeIn">
      <div className="bg-[#0b1329] border border-[#1e305e] rounded-3xl w-full max-w-sm overflow-hidden flex flex-col max-h-[92vh] shadow-2xl">
        {/* Modal Header */}
        <div className="p-3 bg-[#070c18] border-b border-[#152243] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t.simNotice}</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-800/60 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Clear Demo Disclaimer Banner */}
        <div className="bg-amber-950/40 px-3 py-1.5 border-b border-amber-600/30 text-[11px] text-amber-300/90 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>{t.simDemoDisclaimer}</span>
        </div>

        {/* STATE 1: RINGING */}
        {callState === 'ringing' && (
          <div className="p-5 text-center flex flex-col items-center justify-between flex-1">
            <div className="space-y-4 my-auto w-full">
              <div className="w-18 h-18 rounded-full bg-blue-600/20 border-2 border-blue-500/40 flex items-center justify-center mx-auto call-ring shadow-xl shadow-blue-600/30">
                <Phone className="w-8 h-8 text-blue-400" />
              </div>

              <div>
                <span className="text-[11px] uppercase tracking-wider text-blue-400 font-bold">
                  Simulated Jio Forwarded Call
                </span>
                <h3 className="text-xl font-bold text-white mt-1">{callerName}</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{callerNumber}</p>
              </div>

              {/* Language Selection & Auto-Detection */}
              <div className="bg-[#101b36] border border-[#1d2d55] rounded-xl p-3 text-left space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-300">
                    {t.simCallerLang}
                  </label>
                  <button
                    onClick={() => setIsAutoDetect(!isAutoDetect)}
                    className={`text-[10px] px-2 py-0.5 rounded font-semibold transition-colors flex items-center gap-1 ${
                      isAutoDetect
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    <Languages className="w-2.5 h-2.5" />
                    <span>Auto-Detect: {isAutoDetect ? 'ON' : 'OFF'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {(['en', 'hi', 'bn'] as Language[]).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => {
                        setSelectedLang(lang);
                      }}
                      className={`py-1.5 px-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        selectedLang === lang
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-[#152243] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {lang === 'en' ? 'English' : lang === 'hi' ? 'हिंदी' : 'বাংলা'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Answer / Decline Buttons */}
            <div className="w-full pt-4 flex items-center justify-around">
              <button
                onClick={onClose}
                className="flex flex-col items-center gap-1.5 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <div className="w-13 h-13 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/40">
                  <PhoneOff className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium">{t.simDecline}</span>
              </button>

              <button
                onClick={handleAnswerCall}
                className="flex flex-col items-center gap-1.5 text-emerald-400 hover:text-emerald-300 cursor-pointer"
              >
                <div className="w-13 h-13 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/40 animate-pulse">
                  <Phone className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium">{t.simAnswer}</span>
              </button>
            </div>
          </div>
        )}

        {/* STATE 2: ACTIVE CALL */}
        {callState === 'active' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Top Call Bar */}
            <div className="bg-[#0e172e] p-2.5 text-center border-b border-[#1e305e]">
              <div className="text-sm font-bold text-white">{callerName}</div>
              <div className="flex items-center justify-center gap-1.5 text-xs text-blue-400 font-mono font-medium">
                <span>Demo Call · {formatDuration(duration)}</span>
                <span>·</span>
                <span className="text-slate-400">{LANGUAGE_CONFIG[selectedLang].name}</span>
              </div>
              {detectedBadge && (
                <div className="text-[10px] text-emerald-400 font-semibold mt-0.5 animate-fadeIn">
                  {detectedBadge}
                </div>
              )}
            </div>

            {/* Live Dialog Stream */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {transcript.map((tTurn, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl text-xs leading-relaxed max-w-[88%] ${
                    tTurn.speaker === 'AI'
                      ? 'bg-[#152243] text-blue-100 self-start border border-[#1e305e]'
                      : 'bg-blue-600 text-white self-end ml-auto'
                  }`}
                >
                  <div className="text-[10px] opacity-75 font-bold mb-0.5">
                    {tTurn.speaker === 'AI' ? 'Bipul AI (Demo Voice)' : 'Caller'}
                  </div>
                  <div>{tTurn.text}</div>
                </div>
              ))}

              {isAiReplying && (
                <div className="bg-[#152243] border border-[#1e305e] p-2 rounded-xl text-xs text-blue-300 inline-flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  <span>Bipul AI is speaking...</span>
                </div>
              )}
              <div ref={transcriptEndRef} />
            </div>

            {/* Roleplay Caller Input Bar */}
            <div className="p-2.5 bg-[#070c18] border-t border-[#152243] space-y-2">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={toggleMic}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                    isRecording ? 'bg-red-600 text-white mic-active' : 'bg-[#101b36] text-blue-400 border border-[#1e305e]'
                  }`}
                  title="Speak as Caller (Mic)"
                >
                  <Mic className="w-4 h-4" />
                </button>
                <input
                  type="text"
                  value={callerInput}
                  onChange={(e) => setCallerInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendCallerTurn()}
                  placeholder={`Speak or type in English, Hindi, or Bengali...`}
                  className="flex-1 bg-[#101b36] border border-[#1e305e] rounded-xl px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none"
                />
                <button
                  onClick={() => handleSendCallerTurn()}
                  disabled={!callerInput.trim() || isAiReplying}
                  className="w-9 h-9 bg-blue-600 disabled:opacity-50 text-white rounded-xl flex items-center justify-center cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* End Call Button */}
              <button
                onClick={handleEndCall}
                className="w-full py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-red-600/30 cursor-pointer"
              >
                <PhoneOff className="w-4 h-4" />
                <span>{t.simEndCall}</span>
              </button>
            </div>
          </div>
        )}

        {/* STATE 3: SUMMARIZING */}
        {callState === 'summarizing' && (
          <div className="p-8 text-center my-auto space-y-3">
            <div className="w-12 h-12 rounded-full bg-blue-600/30 text-blue-400 border border-blue-500/40 flex items-center justify-center mx-auto animate-pulse">
              <Sparkles className="w-6 h-6 animate-spin" />
            </div>
            <h3 className="text-base font-bold text-white">Generating AI Call Summary</h3>
            <p className="text-xs text-slate-400">
              Analyzing transcript in {LANGUAGE_CONFIG[selectedLang].name}, extracting key messages, and logging summary...
            </p>
          </div>
        )}

        {/* STATE 4: COMPLETED SUMMARY */}
        {callState === 'completed' && summaryResult && (
          <div className="p-5 overflow-y-auto space-y-3 flex-1 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                <Check className="w-5 h-5" />
              </div>

              <div className="text-center">
                <h3 className="text-base font-bold text-white">{t.simLoggedTitle}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Demo call logged to Call History
                </p>
              </div>

              <div className="bg-[#101b36] border border-[#1e305e] rounded-xl p-3 text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-400 pb-1.5 border-b border-slate-700/40">
                  <span className="font-semibold text-white">{summaryResult.callerName}</span>
                  <span className="text-blue-300">{summaryResult.language} · {summaryResult.urgency}</span>
                </div>
                <div>
                  <strong className="text-blue-400 block mb-0.5">Summary:</strong>
                  <p className="text-slate-200 leading-relaxed">{summaryResult.summary}</p>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-colors cursor-pointer"
            >
              {t.simViewLogs}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
