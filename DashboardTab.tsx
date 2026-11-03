import React, { useState } from 'react';
import { 
  PhoneForwarded, 
  PhoneOff, 
  Copy, 
  Check, 
  Info, 
  Radio, 
  Sparkles, 
  Play, 
  Languages, 
  ShieldCheck 
} from 'lucide-react';
import { Language, TelephonyStatus } from '../types';
import { UI_TRANSLATIONS } from '../utils/i18n';

interface DashboardTabProps {
  telephonyStatus: TelephonyStatus | null;
  onOpenCallSimulator: () => void;
  virtualNumber: string;
  onUpdateVirtualNumber: (num: string) => void;
  onNavigateToSetup?: () => void;
  currentLanguage?: Language;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  telephonyStatus,
  onOpenCallSimulator,
  virtualNumber,
  onUpdateVirtualNumber,
  onNavigateToSetup,
  currentLanguage = 'en',
}) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [editingNumber, setEditingNumber] = useState(virtualNumber);
  const [isSaved, setIsSaved] = useState(false);

  const t = UI_TRANSLATIONS[currentLanguage] || UI_TRANSLATIONS.en;
  const isConnected = Boolean(telephonyStatus?.connected || virtualNumber);
  const displayVirtualNumber = virtualNumber || '+91 80 4XXX XXXX';

  const jioCodes = [
    {
      title: currentLanguage === 'hi' ? 'उत्तर न देने पर फॉरवर्ड करें (केवल मिस्ड कॉल)' : currentLanguage === 'bn' ? 'উত্তর না দিলে ফরওয়ার্ড করুন (শুধুমাত্র মিসড কল)' : 'Forward when Unanswered (Missed Calls Only)',
      code: `*409*${virtualNumber || '<Virtual_Number>'}#`,
      description: currentLanguage === 'hi' ? 'सामान्य कॉल पहले आपके फोन पर 4-5 बार रिंग करेगी। यदि आप नहीं उठाते, केवल तभी कॉल बिपुल एआई पर जाएगी।' : currentLanguage === 'bn' ? 'ফোন আগে স্বাভাবিকভাবে রিং হবে। উত্তর না দিলে কেবল তখনই বিপুল এআই ধরবে।' : 'Rings your Jio phone normally first. ONLY forwards to Bipul AI if you do not pick up within 15-20 seconds (4-5 rings).',
      rawCode: `*409*${virtualNumber || 'XXXXXXXXXX'}#`,
      isRecommended: true
    },
    {
      title: currentLanguage === 'hi' ? 'लाइन व्यस्त होने पर फॉरवर्ड करें' : currentLanguage === 'bn' ? 'ব্যস্ত থাকলে ফরওয়ার্ড করুন' : 'Forward when Line Busy',
      code: `*404*${virtualNumber || '<Virtual_Number>'}#`,
      description: currentLanguage === 'hi' ? 'यदि आप किसी अन्य कॉल पर हों तो कॉल बिपुल एआई को रूट होगी।' : currentLanguage === 'bn' ? 'আপনি অন্য কলে থাকলে সরাসরি এআই উত্তর দেবে।' : 'Routes to Bipul AI if you are already on another phone call.',
      rawCode: `*404*${virtualNumber || 'XXXXXXXXXX'}#`
    },
    {
      title: currentLanguage === 'hi' ? 'फोन बंद या नेटवर्क न होने पर' : currentLanguage === 'bn' ? 'ফোন বন্ধ বা নেটওয়ার্ক না থাকলে' : 'Forward when Unreachable / Out of Coverage',
      code: `*402*${virtualNumber || '<Virtual_Number>'}#`,
      description: currentLanguage === 'hi' ? 'फोन स्विच ऑफ होने पर कॉलर बिपुल एआई से बात कर संदेश छोड़ सकते हैं।' : currentLanguage === 'bn' ? 'ফোন অফ থাকলেও কলার বার্তা রেখে যেতে পারবেন।' : 'Routes callers to AI if your phone is switched off or in poor network.',
      rawCode: `*402*${virtualNumber || 'XXXXXXXXXX'}#`
    },
    {
      title: currentLanguage === 'hi' ? 'सभी फॉरवर्डिंग बंद करें' : currentLanguage === 'bn' ? 'সকল ফরওয়ার্ডিং বন্ধ করুন' : 'Deactivate All Jio Call Forwarding',
      code: '*410#',
      description: currentLanguage === 'hi' ? 'कॉल फॉरवर्डिंग कभी भी निष्क्रिय करें और सामान्य रिंग पुनः चालू करें।' : currentLanguage === 'bn' ? 'যেকোনো সময় ফরওয়ার্ডিং বাতিল করে সাধারণ রিং চালু করুন।' : 'Cancels forwarding at any time and restores normal ringing.',
      rawCode: '*410#'
    }
  ];

  const handleCopyCode = (title: string, code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(title);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleSaveNumber = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateVirtualNumber(editingNumber);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-4 pb-20 space-y-4">
      {/* Title */}
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">{t.dashTitle}</h2>
        <p className="text-xs text-slate-400 mt-0.5">{t.dashSubtitle}</p>
      </div>

      {/* Connection Status Card */}
      <div
        className={`rounded-2xl p-4 border transition-all ${
          isConnected
            ? 'bg-[#0b1b36] border-blue-500/50 shadow-lg shadow-blue-900/20'
            : 'bg-[#121a2c] border-amber-500/30'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isConnected
                  ? 'bg-blue-600 text-white'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              {isConnected ? <Radio className="w-5 h-5 animate-pulse" /> : <PhoneOff className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  {t.telephonyGateway}: {isConnected ? t.statusConfigured : t.statusDisconnected}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isConnected ? `Virtual Number: ${displayVirtualNumber}` : t.cloudVirtualRequired}
              </p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#152243] text-emerald-400 border border-emerald-800/40">
                  ● Server: WebSockets Active
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#152243] text-blue-300 border border-blue-800/40">
                  /api/telephony/voice
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Clear Security Notice */}
        <div className="mt-3.5 pt-3 border-t border-slate-700/40 text-xs text-slate-300 flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="text-blue-300">{t.securityNoticeTitle}:</strong> {t.securityNoticeBody}
            </p>
          </div>
        </div>

        {onNavigateToSetup && (
          <div className="mt-3 pt-2.5 border-t border-slate-700/30 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">View 4 status cards & checklist</span>
            <button
              onClick={onNavigateToSetup}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>{t.viewCallSetupLink}</span>
              <span>→</span>
            </button>
          </div>
        )}
      </div>

      {/* Simulator Quick Action */}
      <div className="bg-gradient-to-r from-blue-900/40 via-blue-800/30 to-indigo-900/40 border border-blue-500/40 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white">{t.testSimulatorTitle}</h3>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-[260px] leading-relaxed">
              {t.testSimulatorDesc}
            </p>
          </div>
          <button
            onClick={onOpenCallSimulator}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-600/30 flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{t.simulateBtn}</span>
          </button>
        </div>
      </div>

      {/* Caller Language Auto-Detection Feature for Future Calls */}
      <div className="bg-[#0e172e] border border-[#1e305e] rounded-2xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Languages className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">Caller Language Detection (Future Real Calls)</h3>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          The future carrier telephony pipeline is designed to detect whether incoming callers speak <strong>English, Hindi, or Bengali</strong>.
        </p>
        <div className="grid grid-cols-3 gap-1.5 pt-1 text-center text-[11px]">
          <div className="bg-[#152243] p-2 rounded-xl text-slate-200 border border-[#1e305e]">
            <span className="font-semibold text-blue-300 block">English</span>
            <span className="text-[10px] text-slate-400">Natural tone</span>
          </div>
          <div className="bg-[#152243] p-2 rounded-xl text-slate-200 border border-[#1e305e]">
            <span className="font-semibold text-blue-300 block">हिंदी</span>
            <span className="text-[10px] text-slate-400">विनम्र बातचीत</span>
          </div>
          <div className="bg-[#152243] p-2 rounded-xl text-slate-200 border border-[#1e305e]">
            <span className="font-semibold text-blue-300 block">বাংলা</span>
            <span className="text-[10px] text-slate-400">সহজ সাবলীল</span>
          </div>
        </div>
      </div>

      {/* Virtual Number Configuration */}
      <div className="bg-[#0e172e] border border-[#1e305e] rounded-2xl p-4">
        <h3 className="text-sm font-bold text-white mb-1">{t.setVirtualNumTitle}</h3>
        <p className="text-xs text-slate-400 mb-3 leading-relaxed">
          {t.setVirtualNumDesc}
        </p>

        <form onSubmit={handleSaveNumber} className="flex gap-2">
          <input
            type="text"
            value={editingNumber}
            onChange={(e) => setEditingNumber(e.target.value)}
            placeholder="+91 80 4719 XXXX"
            className="flex-1 bg-[#152243] border border-[#1e305e] rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 font-mono"
          />
          <button
            type="submit"
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shrink-0 transition-colors cursor-pointer"
          >
            {isSaved ? t.savedBtn : t.saveBtn}
          </button>
        </form>
      </div>

      {/* Jio Forwarding Dial Codes */}
      <div className="bg-[#0e172e] border border-[#1e305e] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PhoneForwarded className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white">{t.jioCodesTitle}</h3>
          </div>
          <span className="text-[11px] text-slate-400">Jio 4G / 5G</span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          {t.jioCodesDesc}
        </p>

        <div className="space-y-2.5">
          {jioCodes.map((item, idx) => {
            const isCopied = copiedCode === item.title;

            return (
              <div
                key={`jio-${idx}-${item.rawCode}`}
                className={`rounded-xl p-3 flex flex-col gap-1.5 transition-all ${
                  item.isRecommended
                    ? 'bg-[#102244] border-2 border-emerald-500/50 shadow-md shadow-emerald-950/30'
                    : 'bg-[#131f3c] border border-[#1d2d55]'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-slate-200">{item.title}</span>
                    {item.isRecommended && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold px-1.5 py-0.5 rounded">
                        ★ Recommended: Unanswered Only
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopyCode(item.title, item.rawCode)}
                      className="px-2 py-1 bg-[#1e2f57] hover:bg-[#253a6b] text-blue-300 text-[11px] font-medium rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                      title="Copy dial code"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">{t.copied}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>{t.copy}</span>
                        </>
                      )}
                    </button>
                    <a
                      href={`tel:${encodeURIComponent(item.rawCode)}`}
                      className="px-2 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 text-[11px] font-medium rounded-lg transition-colors"
                    >
                      {t.dialBtn}
                    </a>
                  </div>
                </div>

                <div className="font-mono text-xs text-blue-400 font-bold bg-[#091124] px-2.5 py-1.5 rounded-lg border border-[#152243] flex items-center justify-between">
                  <span>{item.code}</span>
                </div>

                <p className="text-[11px] text-slate-400">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cloud Architecture Flow */}
      <div className="bg-[#0e172e] border border-[#1e305e] rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">{t.howAiAnswersTitle}</h3>
        </div>

        <div className="space-y-2.5 text-xs text-slate-300">
          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 border border-blue-500/40 flex items-center justify-center font-bold text-[10px] shrink-0">
              1
            </span>
            <div>
              <strong className="text-white">Caller dials your Jio Number:</strong> If you are busy, away, or don't answer in 15 seconds, Jio forwards the call.
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 border border-blue-500/40 flex items-center justify-center font-bold text-[10px] shrink-0">
              2
            </span>
            <div>
              <strong className="text-white">Cloud Telephony (Exotel/Twilio):</strong> Receives the stream and triggers the Bipul AI Webhook on your secure server.
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 border border-blue-500/40 flex items-center justify-center font-bold text-[10px] shrink-0">
              3
            </span>
            <div>
              <strong className="text-white">Language Auto-Detection:</strong> Bipul AI listens to the caller and speaks in Hindi, Bengali, or English accordingly.
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 border border-blue-500/40 flex items-center justify-center font-bold text-[10px] shrink-0">
              4
            </span>
            <div>
              <strong className="text-white">Instant Summary & Notification:</strong> The AI extracts urgency, key tasks, and writes the summary to your Call Logs tab.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
