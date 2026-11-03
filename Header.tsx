import React from 'react';
import { Volume2, VolumeX, Sparkles } from 'lucide-react';
import { Language } from '../types';
import { LANGUAGE_CONFIG, stopSpeaking } from '../utils/speech';
import { UI_TRANSLATIONS } from '../utils/i18n';

interface HeaderProps {
  currentLanguage: Language;
  onLanguageChange: (lang: Language) => void;
  autoSpeak: boolean;
  onToggleAutoSpeak: () => void;
  isBackendConnected: boolean;
  onNavigateToSetup?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentLanguage,
  onLanguageChange,
  autoSpeak,
  onToggleAutoSpeak,
  isBackendConnected,
  onNavigateToSetup,
}) => {
  const t = UI_TRANSLATIONS[currentLanguage] || UI_TRANSLATIONS.en;

  return (
    <header className="sticky top-0 z-30 bg-[#070c18]/90 backdrop-blur-md border-b border-[#152243] px-3.5 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 via-blue-500 to-sky-400 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-600/30 shrink-0">
          B
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-base font-bold text-white tracking-tight">{t.appTitle}</h1>
            <span className="text-[10px] text-blue-400 font-medium flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5 text-blue-400" /> {t.assistantBadge}
            </span>
          </div>
          <button
            onClick={onNavigateToSetup}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer text-left"
            title={t.setupSubtitle}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isBackendConnected ? 'bg-blue-400' : 'bg-amber-400'}`} />
            <span>{isBackendConnected ? t.aiLive : t.demoMode}</span>
            <span className="text-slate-600">·</span>
            <span className="text-amber-400 hover:underline">{t.setupPending}</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Language Quick Switcher Segmented Control */}
        <div className="flex items-center bg-[#0e172e] border border-[#1e305e] rounded-lg p-0.5">
          {(['en', 'hi', 'bn'] as Language[]).map((lang) => {
            const isActive = currentLanguage === lang;
            return (
              <button
                key={lang}
                onClick={() => {
                  stopSpeaking();
                  onLanguageChange(lang);
                }}
                className={`px-2 py-1 text-xs font-semibold rounded-md transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={`Switch language to ${LANGUAGE_CONFIG[lang].name}`}
              >
                {lang === 'en' ? 'EN' : lang === 'hi' ? 'हिंदी' : 'বাংলা'}
              </button>
            );
          })}
        </div>

        {/* Audio Speech Mute/Unmute Toggle */}
        <button
          onClick={onToggleAutoSpeak}
          className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
            autoSpeak
              ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
              : 'bg-[#0e172e] border-[#1e305e] text-slate-500 hover:text-slate-400'
          }`}
          title={autoSpeak ? 'Voice output enabled' : 'Voice output muted'}
        >
          {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
