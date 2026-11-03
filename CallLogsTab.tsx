import React, { useState } from 'react';
import { Phone, PhoneCall, Volume2, Copy, Check, Trash2, ChevronDown, ChevronUp, Play, Clock, Sparkles } from 'lucide-react';
import { CallRecord, Language } from '../types';
import { speakText, stopSpeaking } from '../utils/speech';
import { UI_TRANSLATIONS } from '../utils/i18n';

interface CallLogsTabProps {
  calls: CallRecord[];
  onDeleteCall: (id: string) => void;
  onOpenCallSimulator: () => void;
  speechRate: number;
  speechPitch: number;
  selectedVoiceUri?: string;
  currentLanguage?: Language;
}

export const CallLogsTab: React.FC<CallLogsTabProps> = ({
  calls,
  onDeleteCall,
  onOpenCallSimulator,
  speechRate,
  speechPitch,
  selectedVoiceUri,
  currentLanguage = 'en',
}) => {
  const [filterLang, setFilterLang] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(calls[0]?.id || null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const t = UI_TRANSLATIONS[currentLanguage] || UI_TRANSLATIONS.en;

  const filteredCalls = calls.filter((call) => {
    const matchesLang = filterLang === 'all' || call.language.toLowerCase() === filterLang.toLowerCase();
    const matchesSearch =
      call.callerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      call.callerNumber.includes(searchQuery) ||
      call.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLang && matchesSearch;
  });

  const handleSpeakSummary = (call: CallRecord) => {
    if (playingId === call.id) {
      stopSpeaking();
      setPlayingId(null);
      return;
    }

    setPlayingId(call.id);
    const langKey: Language =
      call.language === 'Hindi' ? 'hi' : call.language === 'Bengali' ? 'bn' : 'en';

    const speechText = `Call from ${call.callerName}. Summary: ${call.summary}`;
    speakText(speechText, langKey, speechRate, speechPitch, selectedVoiceUri, () => {
      setPlayingId(null);
    });
  };

  const handleCopySummary = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-4 pb-20 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">{t.callsTitle}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {t.callsSubtitle}
          </p>
        </div>
        <button
          onClick={onOpenCallSimulator}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-600/30 flex items-center gap-1 transition-all cursor-pointer"
        >
          <Play className="w-3 h-3 fill-current" />
          <span>{t.simulateBtn}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.searchCallsPlaceholder}
          className="w-full bg-[#0e172e] border border-[#1e305e] rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
        />

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          {[
            { id: 'all', label: t.allCallsFilter },
            { id: 'hindi', label: 'Hindi (हिंदी)' },
            { id: 'bengali', label: 'Bengali (বাংলা)' },
            { id: 'english', label: 'English' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilterLang(item.id)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                filterLang === item.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-[#0e172e] text-slate-400 hover:text-slate-200 border border-[#1e305e]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Call List */}
      {filteredCalls.length === 0 ? (
        <div className="bg-[#0e172e] border border-[#1e305e] rounded-2xl p-8 text-center space-y-3">
          <PhoneCall className="w-10 h-10 text-slate-600 mx-auto" />
          <div>
            <h3 className="text-sm font-bold text-white">{t.noCallsFound}</h3>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery
                ? 'Try a different search term or language filter'
                : t.noCallsDesc}
            </p>
          </div>
          <button
            onClick={onOpenCallSimulator}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-md transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t.launchSimBtn}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCalls.map((call) => {
            const isExpanded = expandedId === call.id;
            const isPlaying = playingId === call.id;
            const isCopied = copiedId === call.id;

            return (
              <div
                key={call.id}
                className="bg-[#0e172e] border border-[#1e305e] rounded-2xl overflow-hidden transition-all hover:border-slate-700"
              >
                {/* Collapsed Header / Summary Preview */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : call.id)}
                  className="p-3.5 cursor-pointer flex items-start justify-between gap-2"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{call.callerName}</span>
                        <span className="text-xs text-slate-400 font-mono">{call.callerNumber}</span>
                      </div>

                      {/* Unboxed metadata separated by dots */}
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                        <span className="text-blue-300 font-medium">{call.language}</span>
                        <span>·</span>
                        <span>{call.duration}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {call.timestamp}
                        </span>
                        <span>·</span>
                        <span
                          className={
                            call.urgency === 'Urgent'
                              ? 'text-red-400 font-semibold'
                              : call.urgency === 'Medium'
                              ? 'text-amber-400'
                              : 'text-slate-400'
                          }
                        >
                          {call.urgency}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button className="text-slate-400 hover:text-slate-200 p-1 cursor-pointer">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {/* AI Summary Highlight */}
                <div className="px-3.5 pb-3">
                  <div className="bg-[#121f3f] border border-[#1b2f60] rounded-xl p-2.5 text-xs text-slate-200 leading-relaxed">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-blue-300 mb-1">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-blue-400" />
                        AI Summary ({call.status})
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSpeakSummary(call);
                        }}
                        className={`flex items-center gap-1 text-[11px] transition-colors cursor-pointer ${
                          isPlaying ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-blue-300'
                        }`}
                      >
                        <Volume2 className={`w-3.5 h-3.5 ${isPlaying ? 'animate-pulse text-blue-400' : ''}`} />
                        <span>{isPlaying ? t.speaking : t.listen}</span>
                      </button>
                    </div>
                    <p>{call.summary}</p>
                  </div>
                </div>

                {/* Expanded Full Transcript and Actions */}
                {isExpanded && (
                  <div className="border-t border-[#182649] bg-[#091124] p-3.5 space-y-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-300 mb-2">{t.fullTranscriptTitle}</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {call.transcript.map((tTurn, idx) => (
                          <div
                            key={`${call.id}-turn-${idx}`}
                            className={`p-2 rounded-lg text-xs leading-relaxed ${
                              tTurn.speaker === 'AI'
                                ? 'bg-[#101b36] text-blue-200 border-l-2 border-blue-500'
                                : 'bg-[#15203b] text-slate-200 border-l-2 border-slate-500'
                            }`}
                          >
                            <span className="font-bold text-[10px] uppercase tracking-wider block mb-0.5 text-slate-400">
                              {tTurn.speaker === 'AI' ? 'Bipul AI' : call.callerName}
                            </span>
                            <p>{tTurn.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${call.callerNumber}`}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                          <span>{t.callBackBtn}</span>
                        </a>

                        <button
                          onClick={() => handleCopySummary(call.id, call.summary)}
                          className="px-3 py-1.5 bg-[#14203d] hover:bg-[#1a2b53] text-slate-300 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">{t.copied}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>{t.copySummaryBtn}</span>
                            </>
                          )}
                        </button>
                      </div>

                      <button
                        onClick={() => onDeleteCall(call.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                        title="Delete call log"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
