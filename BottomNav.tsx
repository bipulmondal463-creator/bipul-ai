import React from 'react';
import { MessageSquare, PhoneForwarded, ClipboardList, PhoneCall, Sliders } from 'lucide-react';
import { Language } from '../types';
import { UI_TRANSLATIONS } from '../utils/i18n';

export type TabId = 'chat' | 'dashboard' | 'setup' | 'calls' | 'settings';

interface BottomNavProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  callCount: number;
  currentLanguage: Language;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  callCount,
  currentLanguage,
}) => {
  const t = UI_TRANSLATIONS[currentLanguage] || UI_TRANSLATIONS.en;

  const tabs = [
    {
      id: 'chat' as TabId,
      label: t.tabChat,
      icon: MessageSquare,
    },
    {
      id: 'dashboard' as TabId,
      label: t.tabDashboard,
      icon: PhoneForwarded,
    },
    {
      id: 'setup' as TabId,
      label: t.tabSetup,
      icon: ClipboardList,
    },
    {
      id: 'calls' as TabId,
      label: t.tabCalls,
      icon: PhoneCall,
      badge: callCount > 0 ? callCount : undefined,
    },
    {
      id: 'settings' as TabId,
      label: t.tabSettings,
      icon: Sliders,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-[#070c18]/95 backdrop-blur-lg border-t border-[#152243] safe-bottom px-1 py-1">
      <div className="max-w-md mx-auto grid grid-cols-5 gap-0.5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center py-2 px-0.5 rounded-xl transition-all relative ${
                isActive
                  ? 'text-blue-400 bg-blue-500/10 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {tab.badge && (
                  <span className="absolute -top-1.5 -right-2.5 bg-blue-600 text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center border border-[#070c18]">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] sm:text-[11px] mt-1 tracking-tight truncate max-w-full font-medium">
                {tab.label}
              </span>
              {isActive && (
                <div className="w-1 h-1 rounded-full bg-blue-400 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
