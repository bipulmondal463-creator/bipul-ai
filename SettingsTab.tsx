import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Volume2, 
  Globe, 
  Shield, 
  Smartphone, 
  Check, 
  RefreshCw, 
  Play, 
  Sparkles,
  Languages,
  Brain,
  Plus,
  Trash2,
  Edit3,
  AlertTriangle,
  Lock,
  X,
  CheckCircle2,
  Info
} from 'lucide-react';
import { AppSettings, Language, MemoryCategory, MemoryItem } from '../types';
import { 
  LANGUAGE_CONFIG, 
  getAvailableVoices, 
  previewVoice, 
  stopSpeaking,
  speakText
} from '../utils/speech';
import { UI_TRANSLATIONS } from '../utils/i18n';
import { validateMemoryContent } from '../utils/memory';

interface SettingsTabProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onResetData: () => void;
  currentLanguage: Language;
  onLanguageChange: (lang: Language) => void;
  memories: MemoryItem[];
  onAddMemory: (text: string, category: MemoryCategory) => Promise<{ success: boolean; error?: string }>;
  onUpdateMemory: (id: string, text: string, category: MemoryCategory) => Promise<{ success: boolean; error?: string }>;
  onDeleteMemory: (id: string) => Promise<boolean>;
  onClearAllMemories: () => Promise<boolean>;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  onUpdateSettings,
  onResetData,
  currentLanguage,
  onLanguageChange,
  memories,
  onAddMemory,
  onUpdateMemory,
  onDeleteMemory,
  onClearAllMemories,
}) => {
  const [savedNotice, setSavedNotice] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);

  // Conversation Memory State
  const [newMemoryText, setNewMemoryText] = useState('');
  const [newMemoryCategory, setNewMemoryCategory] = useState<MemoryCategory>('preference');
  const [isSavingMemory, setIsSavingMemory] = useState(false);
  const [memoryFeedback, setMemoryFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingCategory, setEditingCategory] = useState<MemoryCategory>('preference');
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [isClearingMemories, setIsClearingMemories] = useState(false);

  const t = UI_TRANSLATIONS[currentLanguage] || UI_TRANSLATIONS.en;

  // Load voices and listen to voiceschanged event (standard in Chrome on Android)
  useEffect(() => {
    const loadVoices = () => {
      const v = getAvailableVoices();
      setVoices(v);
    };

    loadVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const triggerSaved = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const showMemoryNotice = (type: 'success' | 'error', message: string) => {
    setMemoryFeedback({ type, message });
    setTimeout(() => setMemoryFeedback(null), 3500);
  };

  const handleLangChange = (lang: Language) => {
    onLanguageChange(lang);
    onUpdateSettings({ defaultLanguage: lang });
    triggerSaved();
  };

  const handleVoiceChange = (voiceUri: string) => {
    onUpdateSettings({ selectedVoiceUri: voiceUri });
    triggerSaved();
  };

  const handlePreviewSelectedVoice = () => {
    stopSpeaking();
    setIsPreviewing(true);

    const selected = voices.find((v) => v.voiceURI === settings.selectedVoiceUri);
    if (selected) {
      previewVoice(selected, currentLanguage, settings.speechRate, settings.speechPitch, () => {
        setIsPreviewing(false);
      });
    } else {
      let sample = '';
      if (currentLanguage === 'hi') sample = 'नमस्ते! मैं बिपुल एआई की आवाज़ हूँ।';
      else if (currentLanguage === 'bn') sample = 'নমস্কার! আমি বিপুল এআই-এর ভয়েস সহকারী।';
      else sample = 'Hello! This is Bipul AI voice preview.';

      speakText(sample, currentLanguage, settings.speechRate, settings.speechPitch, undefined, () => {
        setIsPreviewing(false);
      });
    }
  };

  // Memory Handlers
  const handleToggleMemory = (enabled: boolean) => {
    onUpdateSettings({ memoryEnabled: enabled });
    triggerSaved();
  };

  // Live sensitivity check
  const sensitivityCheck = newMemoryText.trim()
    ? validateMemoryContent(newMemoryText, currentLanguage)
    : { valid: true };

  const handleCreateMemory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const validation = validateMemoryContent(newMemoryText, currentLanguage);
    if (!validation.valid) {
      showMemoryNotice('error', validation.error || t.memorySensitiveBlocked);
      return;
    }

    setIsSavingMemory(true);
    try {
      const res = await onAddMemory(newMemoryText.trim(), newMemoryCategory);
      if (res.success) {
        setNewMemoryText('');
        showMemoryNotice('success', t.memorySaveSuccess);
      } else {
        showMemoryNotice('error', res.error || 'Failed to save memory');
      }
    } catch (err: any) {
      showMemoryNotice('error', err.message || 'Error saving memory');
    } finally {
      setIsSavingMemory(false);
    }
  };

  const handleStartEdit = (item: MemoryItem) => {
    setEditingId(item.id);
    setEditingText(item.text);
    setEditingCategory(item.category);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingText('');
  };

  const handleSaveEdit = async (id: string) => {
    const validation = validateMemoryContent(editingText, currentLanguage);
    if (!validation.valid) {
      showMemoryNotice('error', validation.error || t.memorySensitiveBlocked);
      return;
    }

    try {
      const res = await onUpdateMemory(id, editingText.trim(), editingCategory);
      if (res.success) {
        setEditingId(null);
        showMemoryNotice('success', t.memoryUpdateSuccess);
      } else {
        showMemoryNotice('error', res.error || 'Failed to update memory');
      }
    } catch (err: any) {
      showMemoryNotice('error', err.message || 'Error updating memory');
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      const success = await onDeleteMemory(id);
      if (success) {
        showMemoryNotice('success', t.memoryDeleteSuccess);
      }
    } catch {
      showMemoryNotice('error', 'Could not delete memory');
    }
  };

  const handleConfirmClearAll = async () => {
    setIsClearingMemories(true);
    try {
      const success = await onClearAllMemories();
      if (success) {
        setShowClearConfirmModal(false);
        showMemoryNotice('success', t.memoryClearSuccess);
      } else {
        showMemoryNotice('error', 'Failed to clear memories');
      }
    } catch (err: any) {
      showMemoryNotice('error', err.message || 'Error clearing memories');
    } finally {
      setIsClearingMemories(false);
    }
  };

  // Filter or group voices for better UX
  const matchingVoices = voices.filter((v) => {
    const lang = v.lang.toLowerCase();
    return lang.includes('en') || lang.includes('hi') || lang.includes('bn');
  });

  const displayVoices = matchingVoices.length > 0 ? matchingVoices : voices;

  const categoryBadgeColors: Record<MemoryCategory, string> = {
    preference: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    instruction: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    fact: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
  };

  const categoryLabels: Record<MemoryCategory, string> = {
    preference: t.memoryCatPreference,
    instruction: t.memoryCatInstruction,
    fact: t.memoryCatFact
  };

  return (
    <div className="max-w-md mx-auto px-4 py-4 pb-20 space-y-4">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">{t.settingsTitle}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{t.settingsSubtitle}</p>
        </div>
        {savedNotice && (
          <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 animate-fadeIn">
            <Check className="w-3.5 h-3.5" /> Saved
          </span>
        )}
      </div>

      {/* Language Preference (English, Hindi, Bengali) */}
      <div className="bg-[#0e172e] border border-[#1e305e] rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-bold text-white">{t.defaultLangTitle}</h3>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          {t.defaultLangDesc}
        </p>

        <div className="grid grid-cols-3 gap-2 pt-1">
          {(['en', 'hi', 'bn'] as Language[]).map((lang) => {
            const isSelected = currentLanguage === lang;
            return (
              <button
                key={lang}
                onClick={() => handleLangChange(lang)}
                className={`py-2 px-2.5 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'bg-[#152243] text-slate-300 hover:text-white border border-[#1e305e]'
                }`}
              >
                <span>{LANGUAGE_CONFIG[lang].name}</span>
                <span className="text-[11px] opacity-75 font-normal">
                  {LANGUAGE_CONFIG[lang].nativeName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Voice Selection & Preview */}
      <div className="bg-[#0e172e] border border-[#1e305e] rounded-2xl p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white">{t.voiceSelectorTitle}</h3>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoSpeak}
              onChange={(e) => {
                onUpdateSettings({ autoSpeak: e.target.checked });
                triggerSaved();
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          {t.voiceSelectorDesc}
        </p>

        {/* Voice Selector Dropdown */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-400 block">
            Installed Device Voices ({voices.length} found):
          </label>
          <select
            value={settings.selectedVoiceUri || ''}
            onChange={(e) => handleVoiceChange(e.target.value)}
            className="w-full bg-[#152243] border border-[#1e305e] text-xs text-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-blue-500"
          >
            <option value="">Default System Voice (Auto-match {LANGUAGE_CONFIG[currentLanguage].name})</option>
            {displayVoices.map((v, idx) => (
              <option key={`${v.voiceURI || v.name || 'voice'}-${v.lang}-${idx}`} value={v.voiceURI}>
                {v.name} ({v.lang}) {v.default ? '★ Default' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Preview Voice Button */}
        <div className="pt-1 space-y-2">
          <button
            onClick={handlePreviewSelectedVoice}
            disabled={isPreviewing}
            className={`w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              isPreviewing
                ? 'bg-blue-600 text-white animate-pulse'
                : 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 active:scale-[0.98]'
            }`}
          >
            <Play className={`w-3.5 h-3.5 ${isPreviewing ? 'animate-spin fill-current' : 'fill-current'}`} />
            <span>{isPreviewing ? 'Speaking Sample...' : `${t.previewVoiceBtn} (${LANGUAGE_CONFIG[currentLanguage].name})`}</span>
          </button>

          {/* Quick Language Preview Chips */}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-[11px] text-slate-400 shrink-0">Listen:</span>
            {(['en', 'hi', 'bn'] as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => {
                  stopSpeaking();
                  let phrase = '';
                  if (lang === 'hi') phrase = 'नमस्ते! मैं बिपुल एआई हूँ, आपका पर्सनल असिस्टेंट।';
                  else if (lang === 'bn') phrase = 'নমস্কার! আমি বিপুল এআই, আপনার সহকারী।';
                  else phrase = 'Hello! I am Bipul AI, your personal assistant.';
                  speakText(phrase, lang, settings.speechRate, settings.speechPitch, settings.selectedVoiceUri);
                }}
                className="flex-1 py-1.5 px-2 bg-[#152243] hover:bg-[#1f315e] text-blue-300 text-xs font-medium rounded-lg border border-[#1e305e] transition-colors cursor-pointer text-center"
              >
                {lang === 'en' ? 'English' : lang === 'hi' ? 'हिंदी' : 'বাংলা'}
              </button>
            ))}
          </div>
        </div>

        {/* Speed Slider */}
        <div className="space-y-1 pt-1 border-t border-slate-700/40">
          <div className="flex justify-between text-xs text-slate-300">
            <span>Speech Rate: {settings.speechRate.toFixed(2)}x</span>
            <span className="text-slate-500">Normal 1.0x</span>
          </div>
          <input
            type="range"
            min="0.75"
            max="1.35"
            step="0.05"
            value={settings.speechRate}
            onChange={(e) => onUpdateSettings({ speechRate: parseFloat(e.target.value) })}
            onMouseUp={triggerSaved}
            onTouchEnd={triggerSaved}
            className="w-full accent-blue-600 cursor-pointer"
          />
        </div>
      </div>

      {/* ========================================================= */}
      {/* NEW: CONVERSATION MEMORY SECTION (Persistent & Isolated) */}
      {/* ========================================================= */}
      <div className="bg-[#0e172e] border border-[#1e305e] rounded-2xl p-4 space-y-4 shadow-lg shadow-black/20">
        {/* Section Header with Master Toggle */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 mt-0.5 shrink-0">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">{t.memorySectionTitle}</h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {memories.length} {t.memoryCountLabel}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                {t.memorySectionSubtitle}
              </p>
            </div>
          </div>

          {/* Master Memory On/Off Switch */}
          <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1" title={t.memoryToggleTitle}>
            <input
              type="checkbox"
              checked={settings.memoryEnabled !== false}
              onChange={(e) => handleToggleMemory(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        {/* Memory Feedback Banner (Success / Error) */}
        {memoryFeedback && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 border animate-fadeIn ${
              memoryFeedback.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
            }`}
          >
            {memoryFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="flex-1 font-medium">{memoryFeedback.message}</span>
            <button
              onClick={() => setMemoryFeedback(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Clear Storage & Privacy Notice Card */}
        <div className="bg-[#121c38] border border-[#1d2d58] rounded-xl p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-purple-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-purple-400" />
              {t.memoryStorageTitle}
            </span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              {t.memoryStorageBadge}
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            {t.memoryStorageNotice}
          </p>
        </div>

        {/* When Memory is Disabled, show a muted status card */}
        {settings.memoryEnabled === false ? (
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-center space-y-1">
            <p className="text-xs font-semibold text-slate-300">Memory is currently turned OFF</p>
            <p className="text-[11px] text-slate-500">
              Bipul AI will not recall your saved facts or instructions during chat or calls until you turn this on.
            </p>
          </div>
        ) : (
          <>
            {/* Add New Memory Form */}
            <form onSubmit={handleCreateMemory} className="bg-[#131f3e] border border-[#1e305e] rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-purple-400" />
                  {t.memoryAddTitle}
                </span>

                {/* Category Selector Chips */}
                <div className="flex items-center gap-1">
                  {(['preference', 'instruction', 'fact'] as MemoryCategory[]).map((cat) => (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => setNewMemoryCategory(cat)}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                        newMemoryCategory === cat
                          ? categoryBadgeColors[cat]
                          : 'bg-[#0f1933] text-slate-400 border-slate-700/60 hover:text-slate-200'
                      }`}
                    >
                      {categoryLabels[cat]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea */}
              <div className="relative">
                <textarea
                  rows={2}
                  value={newMemoryText}
                  onChange={(e) => setNewMemoryText(e.target.value)}
                  placeholder={t.memoryTextPlaceholder}
                  className={`w-full bg-[#0a1122] border rounded-xl p-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none transition-colors leading-relaxed ${
                    !sensitivityCheck.valid
                      ? 'border-rose-500 focus:border-rose-500'
                      : 'border-[#1f3261] focus:border-purple-500'
                  }`}
                />
              </div>

              {/* Live Sensitive Data Warning */}
              {!sensitivityCheck.valid && (
                <div className="p-2 rounded-lg bg-rose-950/60 border border-rose-500/40 text-[11px] text-rose-300 flex items-start gap-1.5 animate-fadeIn">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                  <span>{sensitivityCheck.error}</span>
                </div>
              )}

              {/* Quick Suggestion Chips */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 block font-medium">Quick suggestions (tap to use):</span>
                <div className="flex flex-wrap gap-1">
                  {[
                    t.memoryChipSuggest1,
                    t.memoryChipSuggest2,
                    t.memoryChipSuggest3,
                    t.memoryChipSuggest4
                  ].map((suggestion, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => {
                        setNewMemoryText(suggestion);
                        if (suggestion.toLowerCase().includes('keep') || suggestion.toLowerCase().includes('address')) {
                          setNewMemoryCategory('instruction');
                        } else {
                          setNewMemoryCategory('preference');
                        }
                      }}
                      className="text-[10px] px-2 py-1 bg-[#18264a] hover:bg-[#203363] text-purple-200 rounded-lg border border-[#23386d] transition-colors cursor-pointer text-left"
                    >
                      + {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-1 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingMemory || !newMemoryText.trim() || !sensitivityCheck.valid}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSavingMemory || !newMemoryText.trim() || !sensitivityCheck.valid
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                      : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30 active:scale-[0.98]'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSavingMemory ? t.memorySavingBtn : t.memorySaveBtn}</span>
                </button>
              </div>
            </form>

            {/* List of Saved Memories */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>Saved Facts & Instructions:</span>
                {memories.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowClearConfirmModal(true)}
                    className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>{t.memoryClearAllBtn}</span>
                  </button>
                )}
              </div>

              {memories.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#0c1428] border border-dashed border-[#1e305e] text-center space-y-1">
                  <Info className="w-4 h-4 text-slate-500 mx-auto" />
                  <p className="text-xs text-slate-400">{t.memoryEmptyState}</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {memories.map((mem) => {
                    const isEditing = editingId === mem.id;

                    if (isEditing) {
                      return (
                        <div
                          key={mem.id}
                          className="p-3 rounded-xl bg-[#142142] border border-purple-500/50 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-purple-300">Edit Memory</span>
                            <div className="flex items-center gap-1">
                              {(['preference', 'instruction', 'fact'] as MemoryCategory[]).map((cat) => (
                                <button
                                  type="button"
                                  key={cat}
                                  onClick={() => setEditingCategory(cat)}
                                  className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
                                    editingCategory === cat
                                      ? categoryBadgeColors[cat]
                                      : 'bg-[#0f1933] text-slate-400 border-slate-700'
                                  }`}
                                >
                                  {categoryLabels[cat]}
                                </button>
                              ))}
                            </div>
                          </div>
                          <textarea
                            rows={2}
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="w-full bg-[#0a1122] border border-[#23386d] rounded-lg p-2 text-xs text-white focus:outline-none focus:border-purple-500"
                          />
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800 text-slate-300 hover:text-white"
                            >
                              {t.memoryCancelBtn}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(mem.id)}
                              className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-purple-600 hover:bg-purple-500 text-white"
                            >
                              {t.memoryUpdateBtn}
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={mem.id}
                        className="p-3 rounded-xl bg-[#121c38] border border-[#1b2b52] hover:border-[#283e74] transition-all flex items-start justify-between gap-2.5 group"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                                categoryBadgeColors[mem.category] || categoryBadgeColors.fact
                              }`}
                            >
                              {categoryLabels[mem.category] || mem.category}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {new Date(mem.createdAt).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-200 leading-relaxed font-normal">
                            {mem.text}
                          </p>
                        </div>

                        {/* Edit & Delete Action Buttons */}
                        <div className="flex items-center gap-1 shrink-0 pt-0.5">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(mem)}
                            className="p-1.5 rounded-lg bg-[#18264a] text-slate-400 hover:text-purple-300 hover:bg-[#203363] transition-colors cursor-pointer"
                            title={t.memoryEditBtn}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(mem.id)}
                            className="p-1.5 rounded-lg bg-[#18264a] text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title={t.memoryDeleteBtn}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Caller Language Auto-Detection (Future Call Architecture) */}
      <div className="bg-[#0e172e] border border-[#1e305e] rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">{t.autoDetectLangTitle}</h3>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoDetectCallerLang}
              onChange={(e) => {
                onUpdateSettings({ autoDetectCallerLang: e.target.checked });
                triggerSaved();
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          {t.autoDetectLangDesc}
        </p>

        <div className="bg-[#131f3c] border border-[#1d2d55] rounded-xl p-2.5 text-[11px] text-slate-300 space-y-1">
          <div className="text-emerald-400 font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            <span>Supported Dialects:</span>
          </div>
          <ul className="list-disc pl-4 space-y-0.5 text-slate-400">
            <li>English (Indian English, UK, US)</li>
            <li>Hindi (मानक हिंदी, रोज़मर्रा की बोलचाल)</li>
            <li>Bengali (প্রমিত বাংলা, কলকাতা ও পশ্চিমবঙ্গীয় কথ্য রূপ)</li>
          </ul>
        </div>
      </div>

      {/* Persona Customization */}
      <div className="bg-[#0e172e] border border-[#1e305e] rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-bold text-white">{t.personaTitle}</h3>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          {t.personaDesc}
        </p>

        <textarea
          rows={3}
          value={settings.persona}
          onChange={(e) => onUpdateSettings({ persona: e.target.value })}
          onBlur={triggerSaved}
          placeholder="e.g. You are Bipul AI, an assistant for Bipul. Be polite, concise, and helpful."
          className="w-full bg-[#152243] border border-[#1e305e] rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 leading-relaxed"
        />

        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-[11px] text-slate-400">Presets:</span>
          {[
            { label: 'Professional', text: 'You are Bipul AI, a professional and courteous personal assistant for Bipul. Keep answers brief and organized.' },
            { label: 'Friendly', text: 'You are Bipul AI, a warm and friendly assistant for Bipul. Greet cheerfully and make callers feel welcome.' },
            { label: 'Executive Gatekeeper', text: 'You are Bipul AI, an executive assistant for Bipul. Verify caller identity and screen urgent inquiries.' }
          ].map((preset) => (
            <button
              key={preset.label}
              onClick={() => {
                onUpdateSettings({ persona: preset.text });
                triggerSaved();
              }}
              className="text-[11px] px-2 py-1 bg-[#152243] hover:bg-[#1f315e] text-blue-300 rounded-lg transition-colors cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Beginner Mobile Guide (Android Chrome) */}
      <div className="bg-[#0e172e] border border-[#1e305e] rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-bold text-white">{t.androidTipTitle}</h3>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          {t.androidTipDesc}
        </p>
      </div>

      {/* Security Architecture */}
      <div className="bg-[#0e172e] border border-[#1e305e] rounded-2xl p-4 space-y-2 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">{t.securityCardTitle}</h3>
        </div>
        <p className="leading-relaxed text-slate-400">
          {t.securityCardDesc}
        </p>
      </div>

      {/* Reset Data */}
      <div className="pt-2">
        <button
          onClick={onResetData}
          className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{t.resetAllDataBtn}</span>
        </button>
      </div>

      {/* CLEAR ALL MEMORIES CONFIRMATION MODAL */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0e172e] border border-[#22376b] rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>

            <div className="text-center space-y-1.5">
              <h4 className="text-sm font-bold text-white">
                {t.memoryClearModalTitle}
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                {t.memoryClearModalDesc}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                disabled={isClearingMemories}
                className="py-2 px-3 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                {t.memoryClearCancelBtn}
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAll}
                disabled={isClearingMemories}
                className="py-2 px-3 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-md shadow-rose-600/30 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isClearingMemories ? (
                  <span>Clearing...</span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.memoryClearConfirmBtn}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
