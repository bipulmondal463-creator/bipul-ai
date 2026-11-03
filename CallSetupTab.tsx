import React, { useState, useEffect } from 'react';
import { 
  PhoneOff, 
  Radio, 
  Server, 
  Sparkles, 
  CheckCircle2, 
  Circle, 
  Play, 
  AlertTriangle, 
  ShieldCheck, 
  ArrowRight,
  RotateCcw,
  Copy,
  Check,
  Send,
  Loader2,
  FileText
} from 'lucide-react';
import { Language, TelephonyDiagnostics, TelephonyStatus } from '../types';
import { UI_TRANSLATIONS } from '../utils/i18n';

interface CallSetupTabProps {
  onOpenCallSimulator: () => void;
  onNavigateToDashboard: () => void;
  currentLanguage?: Language;
  telephonyStatus?: TelephonyStatus | null;
  onNavigateToCalls?: () => void;
}

const CHECKLIST_KEY = 'bipul_ai_setup_checklist';

const CHECKLIST_BY_LANG: Record<Language, Array<{ id: string; title: string; desc: string }>> = {
  en: [
    { id: 'step-1', title: 'Register with an Indian Cloud Telephony Provider', desc: 'Create an account on Exotel, Twilio (India), or Tata Smartflo to handle carrier voice traffic.' },
    { id: 'step-2', title: 'Acquire an Indian Virtual Number (+91)', desc: 'Obtain a dedicated 10-digit virtual landline or mobile number from your telephony provider with TRAI KYC.' },
    { id: 'step-3', title: 'Deploy Secure Backend Server with WebSockets', desc: 'Host server.ts on Cloud Run or Render with HTTPS and WSS enabled.' },
    { id: 'step-4', title: 'Configure GEMINI_API_KEY in Server Environment', desc: 'Securely inject your API key into backend environment variables (never expose in client code).' },
    { id: 'step-5', title: 'Bind Inbound Voice Webhook URL', desc: 'Set voice webhook to https://<app-url>/api/telephony/voice and media stream to wss://<app-url>/api/telephony/stream.' },
    { id: 'step-6', title: 'Manually Activate Jio Forwarding via Phone Dialer', desc: 'Dial *409*<Virtual_Number># on your Jio SIM to forward calls when unanswered.' },
    { id: 'step-7', title: 'Perform Live Verification Call', desc: 'Call your Jio SIM from another device, let it ring 15s, and verify Bipul AI answers.' },
  ],
  hi: [
    { id: 'step-1', title: 'क्लाउड टेलीफोनी प्रोवाइडर पर अकाउंट बनाएं', desc: 'Exotel, Twilio India या Tata Smartflo पर अकाउंट रजिस्टर करें।' },
    { id: 'step-2', title: 'भारतीय वर्चुअल नंबर (+91) प्राप्त करें', desc: 'कॉल फॉरवर्डिंग प्राप्त करने के लिए प्रोवाइडर से 10 अंकों का वर्चुअल नंबर लें।' },
    { id: 'step-3', title: 'सुरक्षित बैकएंड सर्वर डिप्लॉय करें', desc: 'server.ts को HTTPS और WSS के साथ लाइव होस्ट करें।' },
    { id: 'step-4', title: 'GEMINI_API_KEY एनवायरनमेंट में जोड़ें', desc: 'प्राइवेट एपीआई की को बैकएंड में सुरक्षित रखें, ब्राउज़र कोड में नहीं।' },
    { id: 'step-5', title: 'टेलीफोनी वॉयस वेबहुक लिंक करें', desc: 'टेलीफोनी डैशबोर्ड में वॉयस वेबहुक यूआरएल https://<domain>/api/telephony/voice सेट करें।' },
    { id: 'step-6', title: 'फोन डायलर से जियो फॉरवर्डिंग शुरू करें', desc: 'फोन न उठने पर कॉल फॉरवर्ड करने के लिए *409*<VirtualNumber># डायल करें।' },
    { id: 'step-7', title: 'लाइव टेस्टिंग कॉल करके पुष्टि करें', desc: 'दूसरे फोन से अपने जियो नंबर पर कॉल करें और चेक करें कि एआई कॉल उठाता है।' },
  ],
  bn: [
    { id: 'step-1', title: 'ভারতীয় ক্লাউড টেলিফোনি প্ল্যাটফর্মে অ্যাকাউন্ট খুলুন', desc: 'Exotel, Twilio India বা Tata Smartflo-তে রেজিস্টার করুন।' },
    { id: 'step-2', title: 'একটি ভারতীয় ভার্চুয়াল নম্বর (+91) নিন', desc: 'ইনকামিং কল রিসিভ করার জন্য একটি ১০ ডিজিটের ভার্চুয়াল নম্বর সংগ্রহ করুন।' },
    { id: 'step-3', title: 'সিকিউর ব্যাকএন্ড সার্ভার ডিপ্লয় করুন', desc: 'server.ts কোডটি ক্লাউডে HTTPS এবং WSS সহ হোস্ট করুন।' },
    { id: 'step-4', title: 'GEMINI_API_KEY সার্ভার ভ্যারিয়েবলে যুক্ত করুন', desc: 'এপিআই কি ব্যাকএন্ডে রাখুন, ব্রাউজার ফ্রন্টএন্ডে কখনো নয়।' },
    { id: 'step-5', title: 'টেলিফোনি ভয়েস ওয়েবহুক ইউআরএল সেট করুন', desc: 'টেলিফোনি প্রোভাইডারে https://<domain>/api/telephony/voice সেট করুন।' },
    { id: 'step-6', title: 'ফোন ডায়ালারে জিও ফরওয়ার্ডিং কোড ডায়াল করুন', desc: 'মিসড কল ফরওয়ার্ড করতে নিজের ফোনে *409*<VirtualNumber># ডায়াল করুন।' },
    { id: 'step-7', title: 'অন্য ফোন থেকে টেস্ট কল করে নিশ্চিত হন', desc: 'অন্য একটি ফোন থেকে নিজের জিও সিমে কল করে এআই উত্তর দিচ্ছে কিনা পরীক্ষা করুন।' },
  ]
};

export const CallSetupTab: React.FC<CallSetupTabProps> = ({
  onOpenCallSimulator,
  onNavigateToDashboard,
  currentLanguage = 'en',
  telephonyStatus,
  onNavigateToCalls
}) => {
  const t = UI_TRANSLATIONS[currentLanguage] || UI_TRANSLATIONS.en;

  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(CHECKLIST_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [diagnostics, setDiagnostics] = useState<TelephonyDiagnostics | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState<any | null>(null);

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const fetchDiagnostics = async () => {
    try {
      const res = await fetch('/api/telephony/missing-components');
      if (res.ok) {
        const data = await res.json();
        setDiagnostics(data);
      }
    } catch (e) {
      console.warn('Could not load diagnostics:', e);
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem(CHECKLIST_KEY, JSON.stringify(completedSteps));
    } catch {
      // ignore
    }
  }, [completedSteps]);

  const toggleStep = (id: string) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const resetChecklist = () => {
    setCompletedSteps({});
    try {
      localStorage.removeItem(CHECKLIST_KEY);
    } catch {
      // ignore
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedUrl(label);
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  const handleTriggerTestWebhook = async () => {
    setIsTestingWebhook(true);
    setWebhookTestResult(null);

    try {
      const sampleNames = {
        en: 'Vikram Mehta (Client)',
        hi: 'विक्रम मेहता (क्लाइंट)',
        bn: 'বিক্রম মেহতা (ক্লায়েন্ট)'
      };
      const sampleTopics = {
        en: 'Reviewing contract terms for Q3 deliverables and urgent callback requested',
        hi: 'कल सुबह की क्लाइंट मीटिंग और कॉन्ट्रैक्ट एग्रीमेंट के संबंध में संदेश',
        bn: 'আগামীকালের নতুন ক্লায়েন্ট মিটিং ও প্রজেক্ট কনট্রাক্ট সংক্রান্ত বার্তা'
      };

      const res = await fetch('/api/telephony/test-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callerName: sampleNames[currentLanguage] || sampleNames.en,
          callerNumber: '+91 98200 45678',
          callerTopic: sampleTopics[currentLanguage] || sampleTopics.en,
          language: currentLanguage
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setWebhookTestResult(data.callRecord);
      } else {
        setWebhookTestResult({ error: data.error || 'Webhook test failed' });
      }
    } catch (err: any) {
      setWebhookTestResult({ error: err.message || 'Network error' });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const currentSteps = CHECKLIST_BY_LANG[currentLanguage] || CHECKLIST_BY_LANG.en;
  const completedCount = currentSteps.filter((s) => completedSteps[s.id]).length;
  const progressPercent = Math.round((completedCount / currentSteps.length) * 100);

  // Status computation
  const isJioForwardingActive = Boolean(telephonyStatus?.connected && telephonyStatus?.virtualNumber && completedSteps['step-6']);
  const isTelephoneServiceActive = Boolean(telephonyStatus?.connected);
  const isBackendActive = Boolean(telephonyStatus?.isServerLive);
  const isAiVoiceDemo = !telephonyStatus?.isGeminiConfigured;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://bipul-ai.app';
  const inboundVoiceUrl = telephonyStatus?.webhookUrls?.inboundVoiceUrl || `${currentOrigin}/api/telephony/voice`;
  const statusCallbackUrl = telephonyStatus?.webhookUrls?.statusCallbackUrl || `${currentOrigin}/api/telephony/status-callback`;
  const streamUrl = telephonyStatus?.webhookUrls?.webSocketStreamUrl || `${currentOrigin.replace(/^http/, 'ws')}/api/telephony/stream`;

  return (
    <div className="max-w-md mx-auto px-4 py-4 pb-24 space-y-4">
      {/* Title & Overview */}
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">{t.setupTitle}</h2>
        <p className="text-xs text-slate-400 mt-0.5">{t.setupSubtitle}</p>
      </div>

      {/* Critical Status Banner */}
      <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-3.5 space-y-2">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200/90 leading-relaxed">
            <strong className="text-amber-300 font-semibold block mb-0.5">
              {t.setupAlertTitle}
            </strong>
            {t.setupAlertBody}
          </div>
        </div>
      </div>

      {/* The 4 Required Status Cards */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-0.5">
          {t.integrationStatusTitle}
        </h3>

        {/* 1. Jio conditional call forwarding */}
        <div className="bg-[#0e172e] border border-[#1e305e] rounded-2xl p-4 transition-all">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                isJioForwardingActive
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                  : 'bg-red-950/60 text-red-400 border border-red-800/50'
              }`}>
                {isJioForwardingActive ? <CheckCircle2 className="w-4 h-4" /> : <PhoneOff className="w-4 h-4" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">{t.card1Title}</h4>
                </div>
                <div className="flex items-center gap-1.5 text-xs mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${isJioForwardingActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <span className={`font-semibold ${isJioForwardingActive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isJioForwardingActive ? 'Forwarding Verified' : t.card1Status}
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-400">
                    {isJioForwardingActive ? 'Jio SIM Linked' : 'Carrier inactive'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-300 mt-2.5 leading-relaxed pl-12">
            {t.card1Desc}
          </p>
        </div>

        {/* 2. Telephone service */}
        <div className="bg-[#0e172e] border border-[#1e305e] rounded-2xl p-4 transition-all">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                isTelephoneServiceActive
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                  : 'bg-red-950/60 text-red-400 border border-red-800/50'
              }`}>
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">{t.card2Title}</h4>
                </div>
                <div className="flex items-center gap-1.5 text-xs mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${isTelephoneServiceActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <span className={`font-semibold ${isTelephoneServiceActive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isTelephoneServiceActive ? 'Connected (+91 Virtual Number)' : t.card2Status}
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-400">
                    {isTelephoneServiceActive ? telephonyStatus?.virtualNumber : 'No virtual number linked'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-300 mt-2.5 leading-relaxed pl-12">
            {t.card2Desc}
          </p>
        </div>

        {/* 3. Secure AI backend */}
        <div className="bg-[#0e172e] border border-[#1e305e] rounded-2xl p-4 transition-all">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                isBackendActive
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                  : 'bg-red-950/60 text-red-400 border border-red-800/50'
              }`}>
                <Server className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">{t.card3Title}</h4>
                </div>
                <div className="flex items-center gap-1.5 text-xs mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${isBackendActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <span className={`font-semibold ${isBackendActive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isBackendActive ? 'Active (Express + WebSockets)' : t.card3Status}
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-400">
                    {isBackendActive ? 'Port 3000 / Webhook ready' : 'Cloud webhook unlinked'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-300 mt-2.5 leading-relaxed pl-12">
            {isBackendActive
              ? 'Backend server is running on the server side with WebSocket streaming and voice webhooks enabled. Secrets are protected.'
              : t.card3Desc}
          </p>
        </div>

        {/* 4. AI voice assistant */}
        <div className="bg-[#0e172e] border border-[#1e305e] rounded-2xl p-4 transition-all">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                !isAiVoiceDemo
                  ? 'bg-blue-950/60 text-blue-400 border border-blue-800/50'
                  : 'bg-amber-950/60 text-amber-400 border border-amber-800/50'
              }`}>
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">{t.card4Title}</h4>
                </div>
                <div className="flex items-center gap-1.5 text-xs mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${!isAiVoiceDemo ? 'bg-blue-400' : 'bg-amber-400'}`} />
                  <span className={`font-semibold ${!isAiVoiceDemo ? 'text-blue-400' : 'text-amber-400'}`}>
                    {!isAiVoiceDemo ? 'Gemini Live Configured' : t.card4Status}
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-400">
                    {!isAiVoiceDemo ? 'gemini-3.8-live / 16kHz PCM' : 'Browser simulation mode'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-300 mt-2.5 leading-relaxed pl-12">
            {!isAiVoiceDemo 
              ? 'Server has GEMINI_API_KEY injected for low-latency bidirectional speech and call auto-summarization.' 
              : t.card4Desc}
          </p>
        </div>
      </div>

      {/* Telephony Webhook Endpoints & Configuration */}
      <div className="bg-[#0e172e] border border-[#1e305e] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white">Telephony Provider Webhook Binding</h3>
          </div>
          <span className="text-[11px] text-emerald-400 font-mono bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
            Live Endpoint
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Configure these URLs in your <strong>Exotel</strong> or <strong>Twilio India</strong> console to route incoming phone calls to Bipul AI:
        </p>

        <div className="space-y-2 pt-1 font-mono text-xs">
          {/* Voice Webhook */}
          <div className="bg-[#131f3c] border border-[#1d2d55] rounded-xl p-2.5 flex items-center justify-between gap-2">
            <div className="overflow-hidden">
              <span className="text-[10px] text-slate-400 font-sans block">Inbound Voice Webhook (POST):</span>
              <span className="text-blue-300 text-[11px] truncate block">{inboundVoiceUrl}</span>
            </div>
            <button
              onClick={() => handleCopy(inboundVoiceUrl, 'voice')}
              className="px-2.5 py-1.5 bg-[#1e2f57] hover:bg-[#253a6b] text-blue-200 rounded-lg shrink-0 flex items-center gap-1 transition-colors cursor-pointer text-[11px]"
            >
              {copiedUrl === 'voice' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUrl === 'voice' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Media Stream WebSocket */}
          <div className="bg-[#131f3c] border border-[#1d2d55] rounded-xl p-2.5 flex items-center justify-between gap-2">
            <div className="overflow-hidden">
              <span className="text-[10px] text-slate-400 font-sans block">Bidirectional Media Stream (WSS):</span>
              <span className="text-indigo-300 text-[11px] truncate block">{streamUrl}</span>
            </div>
            <button
              onClick={() => handleCopy(streamUrl, 'ws')}
              className="px-2.5 py-1.5 bg-[#1e2f57] hover:bg-[#253a6b] text-indigo-200 rounded-lg shrink-0 flex items-center gap-1 transition-colors cursor-pointer text-[11px]"
            >
              {copiedUrl === 'ws' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUrl === 'ws' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Status Callback */}
          <div className="bg-[#131f3c] border border-[#1d2d55] rounded-xl p-2.5 flex items-center justify-between gap-2">
            <div className="overflow-hidden">
              <span className="text-[10px] text-slate-400 font-sans block">Call Status Callback (POST):</span>
              <span className="text-slate-300 text-[11px] truncate block">{statusCallbackUrl}</span>
            </div>
            <button
              onClick={() => handleCopy(statusCallbackUrl, 'status')}
              className="px-2.5 py-1.5 bg-[#1e2f57] hover:bg-[#253a6b] text-slate-200 rounded-lg shrink-0 flex items-center gap-1 transition-colors cursor-pointer text-[11px]"
            >
              {copiedUrl === 'status' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUrl === 'status' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Backend Integration Diagnostics & Missing Components */}
      {diagnostics?.missingList && (
        <div className="bg-[#0e172e] border border-[#1e305e] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Missing Components Breakdown</h3>
            <span className="text-[11px] text-slate-400 font-mono">
              {diagnostics.missingList.filter(c => c.status === 'configured').length} / {diagnostics.missingList.length} ready
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Status of all components required before Bipul AI can answer real incoming phone calls:
          </p>

          <div className="space-y-2 pt-1">
            {diagnostics.missingList.map((item, idx) => (
              <div
                key={`comp-${idx}`}
                className="bg-[#131f3c] border border-[#1d2d55] rounded-xl p-3 space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">{item.component}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    item.status === 'configured'
                      ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/40'
                      : item.status === 'demo_mode'
                      ? 'bg-amber-950/70 text-amber-400 border border-amber-800/40'
                      : 'bg-red-950/70 text-red-400 border border-red-800/40'
                  }`}>
                    {item.status === 'configured' ? 'Configured' : item.status === 'demo_mode' ? 'Demo Mode' : 'Not Connected'}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">{item.impact}</p>
                <div className="text-[11px] text-blue-300/90 font-mono bg-[#091124] p-1.5 rounded border border-[#17264c]">
                  👉 {item.actionRequired}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Server Webhook Tester */}
      <div className="bg-[#0e172e] border border-blue-500/30 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white">Test Inbound Telephony Webhook</h3>
          </div>
          <span className="text-[10px] text-blue-300 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/40 font-mono">
            Safe Test
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Simulate a real incoming telephone call webhook payload hitting your backend. Tests the AI greeting, language routing, and auto-summarizer without an active carrier line:
        </p>

        <button
          onClick={handleTriggerTestWebhook}
          disabled={isTestingWebhook}
          className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          {isTestingWebhook ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processing Webhook & Generating Summary...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Send Simulated Carrier Inbound Webhook</span>
            </>
          )}
        </button>

        {webhookTestResult && (
          <div className="bg-[#131f3c] border border-blue-500/40 rounded-xl p-3 space-y-2 mt-2">
            {webhookTestResult.error ? (
              <div className="text-xs text-red-400">
                ❌ {webhookTestResult.error}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Webhook Processed Successfully!
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">{webhookTestResult.callerNumber}</span>
                </div>
                <div className="text-xs text-slate-200 bg-[#091124] p-2 rounded-lg border border-[#1e2f57]">
                  <strong className="text-blue-300 block mb-0.5">AI Generated Summary:</strong>
                  {webhookTestResult.summary}
                </div>
                {onNavigateToCalls && (
                  <button
                    onClick={onNavigateToCalls}
                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer pt-1"
                  >
                    <span>View this call in Call Logs tab</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Prominent Interactive Call Simulator */}
      <div className="bg-gradient-to-r from-blue-900/40 via-blue-800/30 to-indigo-900/40 border border-blue-500/40 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <Play className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{t.testDemoTitle}</h3>
              <p className="text-xs text-slate-300">Interactive Browser Voice Simulator</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          {t.testDemoDesc}
        </p>

        <button
          onClick={onOpenCallSimulator}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>{t.testDemoBtn}</span>
        </button>
      </div>

      {/* Setup Checklist */}
      <div className="bg-[#0e172e] border border-[#1e305e] rounded-2xl p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">{t.checklistTitle}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{t.checklistSubtitle}</p>
          </div>
          <button
            onClick={resetChecklist}
            className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors cursor-pointer"
            title="Reset checklist progress"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{t.resetChecklistBtn}</span>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>{completedCount} / {currentSteps.length} {t.progressLabel}</span>
            <span className="font-semibold text-blue-400">{progressPercent}%</span>
          </div>
          <div className="w-full h-2 bg-[#152243] rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Checklist Items */}
        <div className="space-y-2 pt-1">
          {currentSteps.map((item, index: number) => {
            const isDone = Boolean(completedSteps[item.id]);

            return (
              <div
                key={item.id}
                onClick={() => toggleStep(item.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                  isDone
                    ? 'bg-blue-950/30 border-blue-600/40 text-slate-200'
                    : 'bg-[#131f3c] border-[#1d2d55] text-slate-300 hover:border-slate-600'
                }`}
              >
                <button
                  type="button"
                  className="mt-0.5 shrink-0 text-slate-400 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleStep(item.id);
                  }}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-500 hover:text-slate-300" />
                  )}
                </button>

                <div className="flex-1 select-none">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-mono text-slate-500">Step {index + 1}</span>
                    <span className="text-slate-600">·</span>
                    <h4 className={`text-xs font-semibold ${isDone ? 'text-white line-through opacity-80' : 'text-slate-200'}`}>
                      {item.title}
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Safety Notice & Guardrails */}
      <div className="bg-[#0e172e] border border-[#1e305e] rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">TRAI Regulatory & Security Guardrails</h3>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          <strong>No Automatic Forwarding:</strong> Cellular carrier forwarding cannot be enabled automatically by any website or app. It requires you to consciously dial the MMI code (*409*...) on your physical Android phone dialer.
        </p>
        <p className="text-xs text-slate-400 leading-relaxed">
          <strong>Indian Telecom Compliance (TRAI/DoT):</strong> To legally route cellular voice traffic through virtual numbers in India, enterprise KYC verification with a registered provider (Exotel or Twilio India) is mandatory.
        </p>
        <button
          onClick={onNavigateToDashboard}
          className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors pt-1 cursor-pointer"
        >
          <span>View Jio Dial Codes in Dashboard</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
