import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { BottomNav, TabId } from './components/BottomNav';
import { ChatTab } from './components/ChatTab';
import { DashboardTab } from './components/DashboardTab';
import { CallSetupTab } from './components/CallSetupTab';
import { CallLogsTab } from './components/CallLogsTab';
import { SettingsTab } from './components/SettingsTab';
import { CallSimulatorModal } from './components/CallSimulatorModal';
import { 
  AppSettings, 
  CallRecord, 
  ChatMessage, 
  Language, 
  MemoryCategory, 
  MemoryItem, 
  TelephonyStatus 
} from './types';
import { LANGUAGE_CONFIG, speakText, stopSpeaking } from './utils/speech';
import { 
  getStoredMemories, 
  saveStoredMemories, 
  filterRelevantMemories, 
  fetchServerMemories, 
  createServerMemory, 
  updateServerMemory, 
  deleteServerMemory, 
  clearServerMemories,
  validateMemoryContent
} from './utils/memory';

const DEFAULT_SETTINGS: AppSettings = {
  assistantName: 'Bipul AI',
  persona: 'You are Bipul AI, an intelligent personal voice and call assistant created for Bipul. You speak naturally, concisely, and helpfully. Keep answers short and polite.',
  defaultLanguage: 'en',
  autoSpeak: true,
  speechRate: 1.0,
  speechPitch: 1.0,
  virtualNumber: '',
  selectedVoiceUri: '',
  autoDetectCallerLang: true,
  memoryEnabled: true
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('bipul_ai_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [currentLanguage, setCurrentLanguage] = useState<Language>(settings.defaultLanguage);
  const [telephonyStatus, setTelephonyStatus] = useState<TelephonyStatus | null>(null);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [isCallSimulatorOpen, setIsCallSimulatorOpen] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Persistent Conversation Memory State
  const [memories, setMemories] = useState<MemoryItem[]>(() => getStoredMemories());

  // Initial messages
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome-1',
      role: 'assistant',
      content: LANGUAGE_CONFIG[settings.defaultLanguage].sampleGreeting,
      timestamp: 'Just now',
      language: settings.defaultLanguage
    }
  ]);

  // Load Telephony Status, Call Logs, and Server Memories on boot
  useEffect(() => {
    fetchTelephonyStatus();
    fetchCalls();
    loadMemories();
  }, []);

  // Sync settings changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('bipul_ai_settings', JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  // Sync memories changes to localStorage cache
  useEffect(() => {
    saveStoredMemories(memories);
  }, [memories]);

  const loadMemories = async () => {
    const serverMems = await fetchServerMemories();
    if (serverMems && serverMems.length > 0) {
      setMemories(serverMems);
      saveStoredMemories(serverMems);
    }
  };

  const fetchTelephonyStatus = async () => {
    try {
      const res = await fetch('/api/telephony/status');
      if (res.ok) {
        const data = await res.json();
        setTelephonyStatus(data);
      }
    } catch (err) {
      console.warn('Could not load telephony status:', err);
    }
  };

  const fetchCalls = async () => {
    try {
      const res = await fetch('/api/calls');
      if (res.ok) {
        const data = await res.json();
        if (data.calls) setCalls(data.calls);
      }
    } catch (err) {
      console.warn('Could not load calls:', err);
    }
  };

  // Switch App Language dynamically
  const handleLanguageChange = (newLang: Language) => {
    if (newLang === currentLanguage) return;

    stopSpeaking();
    setCurrentLanguage(newLang);

    let switchNote = '';
    if (newLang === 'hi') {
      switchNote = 'भाषा बदलकर हिंदी (हिंदी) कर दी गई है। मैं आपकी किस प्रकार मदद कर सकता हूँ?';
    } else if (newLang === 'bn') {
      switchNote = 'ভাষা পরিবর্তন করে বাংলা করা হয়েছে। আমি কীভাবে আপনাকে সাহায্য করতে পারি?';
    } else {
      switchNote = 'Language switched to English. How can I assist you today?';
    }

    const switchMsg: ChatMessage = {
      id: `lang-switch-${Date.now()}`,
      role: 'assistant',
      content: switchNote,
      timestamp: 'Just now',
      language: newLang
    };
    setMessages((prev) => [...prev, switchMsg]);
    if (settings.autoSpeak) {
      speakText(switchNote, newLang, settings.speechRate, settings.speechPitch, settings.selectedVoiceUri);
    }
  };

  // Memory Operations
  const handleAddMemory = async (
    text: string,
    category: MemoryCategory
  ): Promise<{ success: boolean; error?: string }> => {
    // 1. Validate sensitive information
    const validation = validateMemoryContent(text, currentLanguage);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // 2. Attempt server storage
    const serverResult = await createServerMemory(text, category);
    let newMemItem: MemoryItem;

    if (serverResult.success && serverResult.memory) {
      newMemItem = serverResult.memory;
    } else {
      // Local fallback with isolated device storage
      newMemItem = {
        id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        category,
        text,
        createdAt: new Date().toISOString()
      };
    }

    // 3. Update state and localStorage
    setMemories((prev) => {
      const updated = [newMemItem, ...prev];
      saveStoredMemories(updated);
      return updated;
    });

    return { success: true };
  };

  const handleUpdateMemory = async (
    id: string,
    text: string,
    category: MemoryCategory
  ): Promise<{ success: boolean; error?: string }> => {
    const validation = validateMemoryContent(text, currentLanguage);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    await updateServerMemory(id, text, category);

    setMemories((prev) => {
      const updated = prev.map((m) =>
        m.id === id ? { ...m, text, category, updatedAt: new Date().toISOString() } : m
      );
      saveStoredMemories(updated);
      return updated;
    });

    return { success: true };
  };

  const handleDeleteMemory = async (id: string): Promise<boolean> => {
    await deleteServerMemory(id);
    setMemories((prev) => {
      const updated = prev.filter((m) => m.id !== id);
      saveStoredMemories(updated);
      return updated;
    });
    return true;
  };

  const handleClearAllMemories = async (): Promise<boolean> => {
    await clearServerMemories();
    setMemories([]);
    saveStoredMemories([]);
    return true;
  };

  // Send Message with Memory Context Injection
  const handleSendMessage = async (userText: string, options?: { skipAutoSpeak?: boolean }): Promise<string> => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      language: currentLanguage
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    // Only inject memories if memory is enabled by the user
    const memoryIsActive = settings.memoryEnabled !== false;
    const relevantMemories = memoryIsActive ? filterRelevantMemories(userText, memories) : [];

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          language: currentLanguage,
          persona: settings.persona,
          memories: relevantMemories,
          memoryEnabled: memoryIsActive
        })
      });

      if (!res.ok) throw new Error('Backend failed');

      const data = await res.json();
      setIsBackendConnected(!data.isDemo);

      const aiReply = data.reply || 'I am here to assist you.';
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: aiReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isDemo: data.isDemo,
        language: currentLanguage
      };

      setMessages((prev) => [...prev, aiMsg]);

      if (settings.autoSpeak && !options?.skipAutoSpeak) {
        speakText(aiReply, currentLanguage, settings.speechRate, settings.speechPitch, settings.selectedVoiceUri);
      }
      return aiReply;
    } catch (err: any) {
      console.warn('Chat error, using fallback:', err);
      setIsBackendConnected(false);

      const lower = userText.toLowerCase();
      let fallbackText = '';

      // Memory inspection fallback in offline/demo mode
      if (
        memoryIsActive &&
        memories.length > 0 &&
        (lower.includes('remember') || lower.includes('memory') || lower.includes('याद') || lower.includes('মনে'))
      ) {
        const bulletList = memories.map((m) => `• ${m.text}`).join('\n');
        if (currentLanguage === 'hi') {
          fallbackText = `मुझे आपकी ये बातें याद हैं:\n${bulletList}`;
        } else if (currentLanguage === 'bn') {
          fallbackText = `আমার আপনার এই বিষয়গুলো মনে আছে:\n${bulletList}`;
        } else {
          fallbackText = `Here is what I remember about you:\n${bulletList}`;
        }
      } else if (currentLanguage === 'hi') {
        fallbackText = `नमस्ते! मैंने आपका संदेश प्राप्त किया: "${userText}". यह ऑफलाइन डेमो मोड है। जब आप जियो नंबर को कनेक्ट करेंगे, तो मैं असली कॉल और वॉयस मैसेज हैंडल करूँगा।`;
      } else if (currentLanguage === 'bn') {
        fallbackText = `নমস্কার! আপনার বার্তা পেয়েছি: "${userText}". এটি অফলাইন ডেমো মোড। জিও সিম ফরওয়ার্ডিং যুক্ত হলে আমি সরাসরি কল রিসিভ করব।`;
      } else {
        fallbackText = `Hello! I received your message: "${userText}". Running in demo mode. Connect Jio call forwarding and backend to enable live automated calls.`;
      }

      const fallbackMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: fallbackText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isDemo: true,
        language: currentLanguage
      };

      setMessages((prev) => [...prev, fallbackMsg]);
      if (settings.autoSpeak && !options?.skipAutoSpeak) {
        speakText(fallbackText, currentLanguage, settings.speechRate, settings.speechPitch, settings.selectedVoiceUri);
      }
      return fallbackText;
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const handleUpdateVirtualNumber = (num: string) => {
    setSettings((prev) => ({ ...prev, virtualNumber: num }));
  };

  const handleDeleteCall = async (id: string) => {
    setCalls((prev) => prev.filter((c) => c.id !== id));
    try {
      await fetch(`/api/calls/${id}`, { method: 'DELETE' });
    } catch {
      // ignore
    }
  };

  const handleSaveSimulatedCall = (record: CallRecord) => {
    setCalls((prev) => [record, ...prev]);
    // Switch to calls tab so the user can inspect the generated summary
    setActiveTab('calls');
  };

  const handleResetData = () => {
    stopSpeaking();
    setSettings(DEFAULT_SETTINGS);
    setCurrentLanguage('en');
    localStorage.removeItem('bipul_ai_settings');
    fetchCalls();
  };

  return (
    <div className="min-h-screen bg-[#070c18] text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Mobile App Header */}
      <Header
        currentLanguage={currentLanguage}
        onLanguageChange={handleLanguageChange}
        autoSpeak={settings.autoSpeak}
        onToggleAutoSpeak={() =>
          handleUpdateSettings({ autoSpeak: !settings.autoSpeak })
        }
        isBackendConnected={isBackendConnected}
        onNavigateToSetup={() => setActiveTab('setup')}
      />

      {/* Main Tab View Container */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {activeTab === 'chat' && (
          <ChatTab
            messages={messages}
            isLoading={isLoading}
            onSendMessage={handleSendMessage}
            onOpenCallSimulator={() => setIsCallSimulatorOpen(true)}
            currentLanguage={currentLanguage}
            onLanguageChange={handleLanguageChange}
            speechRate={settings.speechRate}
            speechPitch={settings.speechPitch}
            selectedVoiceUri={settings.selectedVoiceUri}
            autoSpeak={settings.autoSpeak}
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardTab
            telephonyStatus={telephonyStatus}
            onOpenCallSimulator={() => setIsCallSimulatorOpen(true)}
            virtualNumber={settings.virtualNumber}
            onUpdateVirtualNumber={handleUpdateVirtualNumber}
            onNavigateToSetup={() => setActiveTab('setup')}
            currentLanguage={currentLanguage}
          />
        )}

        {activeTab === 'setup' && (
          <CallSetupTab
            onOpenCallSimulator={() => setIsCallSimulatorOpen(true)}
            onNavigateToDashboard={() => setActiveTab('dashboard')}
            currentLanguage={currentLanguage}
            telephonyStatus={telephonyStatus}
            onNavigateToCalls={() => {
              fetchCalls();
              setActiveTab('calls');
            }}
          />
        )}

        {activeTab === 'calls' && (
          <CallLogsTab
            calls={calls}
            onDeleteCall={handleDeleteCall}
            onOpenCallSimulator={() => setIsCallSimulatorOpen(true)}
            speechRate={settings.speechRate}
            speechPitch={settings.speechPitch}
            selectedVoiceUri={settings.selectedVoiceUri}
            currentLanguage={currentLanguage}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onResetData={handleResetData}
            currentLanguage={currentLanguage}
            onLanguageChange={handleLanguageChange}
            memories={memories}
            onAddMemory={handleAddMemory}
            onUpdateMemory={handleUpdateMemory}
            onDeleteMemory={handleDeleteMemory}
            onClearAllMemories={handleClearAllMemories}
          />
        )}
      </main>

      {/* Bottom Tab Navigation Bar with 5 tabs */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        callCount={calls.length}
        currentLanguage={currentLanguage}
      />

      {/* Interactive Call-Answering Simulator Modal */}
      <CallSimulatorModal
        isOpen={isCallSimulatorOpen}
        onClose={() => setIsCallSimulatorOpen(false)}
        onSaveCallRecord={handleSaveSimulatedCall}
        defaultLanguage={currentLanguage}
        speechRate={settings.speechRate}
        speechPitch={settings.speechPitch}
        selectedVoiceUri={settings.selectedVoiceUri}
        autoDetectCallerLang={settings.autoDetectCallerLang}
      />
    </div>
  );
}
