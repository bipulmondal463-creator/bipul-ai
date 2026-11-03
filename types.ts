export type Language = 'en' | 'hi' | 'bn';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isDemo?: boolean;
  language?: Language;
}

export interface CallTranscriptTurn {
  speaker: 'AI' | 'Caller';
  text: string;
}

export interface CallRecord {
  id: string;
  callerName: string;
  callerNumber: string;
  timestamp: string;
  duration: string;
  language: 'English' | 'Hindi' | 'Bengali';
  urgency: 'Normal' | 'Medium' | 'Urgent';
  status: 'Message Taken' | 'Inquired' | 'Call Back Requested';
  summary: string;
  transcript: CallTranscriptTurn[];
  isSimulatedWebhook?: boolean;
}

export interface TelephonyStatus {
  connected: boolean;
  virtualNumber: string;
  provider: string;
  isGeminiConfigured?: boolean;
  isServerLive?: boolean;
  activeLiveSessions?: number;
  webhookUrls?: {
    inboundVoiceUrl: string;
    statusCallbackUrl: string;
    webSocketStreamUrl: string;
    testWebhookUrl: string;
  };
  jioForwarding: {
    unansweredCode: string;
    busyCode: string;
    unreachableCode: string;
    deactivateCode: string;
    carrier: string;
  };
  message: string;
}

export interface MissingComponentItem {
  category: string;
  component: string;
  status: 'configured' | 'missing' | 'demo_mode';
  impact: string;
  actionRequired: string;
}

export interface TelephonyDiagnostics {
  baseUrl: string;
  wsUrl: string;
  hasGemini: boolean;
  hasVirtualNumber: boolean;
  isFullyLive: boolean;
  missingList: MissingComponentItem[];
}

export type MemoryCategory = 'preference' | 'instruction' | 'fact';

export interface MemoryItem {
  id: string;
  category: MemoryCategory;
  text: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AppSettings {
  assistantName: string;
  persona: string;
  defaultLanguage: Language;
  autoSpeak: boolean;
  speechRate: number;
  speechPitch: number;
  virtualNumber: string;
  selectedVoiceUri: string;
  autoDetectCallerLang: boolean;
  memoryEnabled: boolean;
}
