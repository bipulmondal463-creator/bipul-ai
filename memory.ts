import { MemoryCategory, MemoryItem, Language } from '../types';

const STORAGE_KEY = 'bipul_ai_memories';

// Proactive sensitive data detection to protect user privacy
const SENSITIVE_PATTERNS = [
  // Passwords and passcodes
  { regex: /(?:password|passwd|passcode|login\s+pin)\s*[:=]\s*\S+/i, label: 'Password or passcode' },
  { regex: /\bmy\s+password\s+is\s+\S+/i, label: 'Password' },
  // API keys and secret tokens
  { regex: /\b(?:api[_-]?key|secret[_-]?token|bearer\s+[a-zA-Z0-9_\-\.]+)\b/i, label: 'API Key or Bearer Token' },
  { regex: /\bsk-[a-zA-Z0-9]{20,}\b/i, label: 'AI Secret Key' },
  { regex: /\bAIza[0-9A-Za-z\-_]{35}\b/i, label: 'Google API Key' },
  // Credit and debit card numbers (13 to 19 digits formatted or unformatted)
  { regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12})\b/, label: 'Payment Card Number' },
  { regex: /\b(?:\d{4}[ -]){3}\d{4}\b/, label: 'Payment Card Number' },
  // CVV / CVC
  { regex: /\b(?:cvv|cvc|security\s*code)\s*[:=]?\s*\d{3,4}\b/i, label: 'Card Security Code (CVV)' },
  // Bank Account / NetBanking PIN
  { regex: /\b(?:atm\s*pin|bank\s*pin|netbanking\s*password)\b/i, label: 'Banking PIN or Credential' }
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
  detectedType?: string;
}

/**
 * Validates memory text against sensitive credentials, passwords, and payment details
 */
export function validateMemoryContent(text: string, language: Language = 'en'): ValidationResult {
  const trimmed = text.trim();
  if (!trimmed) {
    const errorMsg =
      language === 'hi'
        ? 'कृपया सहेजने से पहले कोई जानकारी दर्ज करें।'
        : language === 'bn'
        ? 'অনুগ্রহ করে সংরক্ষণের জন্য কিছু তথ্য লিখুন।'
        : 'Please enter a fact, preference, or instruction before saving.';
    return { valid: false, error: errorMsg };
  }

  if (trimmed.length > 500) {
    const errorMsg =
      language === 'hi'
        ? 'जानकारी 500 अक्षरों से अधिक नहीं हो सकती।'
        : language === 'bn'
        ? 'তথ্য ৫০০ অক্ষরের বেশি হতে পারে না।'
        : 'Memory text cannot exceed 500 characters.';
    return { valid: false, error: errorMsg };
  }

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.regex.test(trimmed)) {
      const errorMsg =
        language === 'hi'
          ? `गोपनीयता सुरक्षा: पासवर्ड, एपीआई की (${pattern.label}) या बैंक विवरण सहेजना वर्जित है।`
          : language === 'bn'
          ? `গোপনীয়তা সুরক্ষা: পাসওয়ার্ড, এপিআই কি (${pattern.label}) বা পেমেন্ট বিবরণ সংরক্ষণ নিষিদ্ধ।`
          : `Privacy Protection: You cannot store passwords, API keys, payment details, or credentials (${pattern.label}).`;
      return { valid: false, error: errorMsg, detectedType: pattern.label };
    }
  }

  return { valid: true };
}

/**
 * Loads memories from browser localStorage
 */
export function getStoredMemories(): MemoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to parse local memories:', err);
    return [];
  }
}

/**
 * Saves memories to browser localStorage
 */
export function saveStoredMemories(memories: MemoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
  } catch (err) {
    console.error('Failed to save memories to localStorage:', err);
  }
}

/**
 * Extracts query tokens and determines which saved memories are relevant to the user query
 */
export function filterRelevantMemories(query: string, memories: MemoryItem[]): MemoryItem[] {
  if (!memories || memories.length === 0) return [];

  const lowerQuery = query.toLowerCase().trim();

  // If user asks about their memory / profile explicitly, return all
  const memoryInspectionTriggers = [
    'remember', 'memory', 'memories', 'what do you know', 'preferences',
    'याद', 'यादें', 'मेरे बारे में', 'पसंद',
    'মনে', 'স্মৃতি', 'আমার সম্পর্কে', 'পছন্দ'
  ];

  const isAskingAboutMemories = memoryInspectionTriggers.some((trigger) =>
    lowerQuery.includes(trigger)
  );

  if (isAskingAboutMemories) {
    return memories.slice(0, 15);
  }

  // Common stop words to exclude from keyword matching
  const stopWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'to', 'for', 'of', 'with', 'about', 'as',
    'hai', 'hain', 'mein', 'ko', 'se', 'ke', 'ka', 'ki', 'aur', 'kya', 'karo', 'mujhe',
    'er', 'o', 'aar', 'ei', 'ki', 'kore', 'amake', 'amar', 'tumi', 'apni'
  ]);

  const queryWords = lowerQuery
    .replace(/[^\w\s\u0900-\u097F\u0980-\u09FF]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));

  const relevant = memories.filter((m) => {
    // Custom instructions ALWAYS apply to guide responses
    if (m.category === 'instruction') {
      return true;
    }

    const lowerMemory = m.text.toLowerCase();

    // Check if any query word appears in the memory text
    const hasWordMatch = queryWords.some((word) => lowerMemory.includes(word));
    return hasWordMatch;
  });

  // Limit to at most 10 most relevant memories to prevent context bloat
  return relevant.slice(0, 10);
}

// ---------------- Backend API Sync Helpers ----------------

export async function fetchServerMemories(): Promise<MemoryItem[] | null> {
  try {
    const res = await fetch('/api/memories');
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.memories) ? data.memories : null;
  } catch (err) {
    console.warn('Server memory endpoint unreachable, using local storage cache:', err);
    return null;
  }
}

export async function createServerMemory(
  text: string,
  category: MemoryCategory
): Promise<{ success: boolean; memory?: MemoryItem; error?: string }> {
  try {
    const res = await fetch('/api/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, category })
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Server rejected memory save' };
    }
    return { success: true, memory: data.memory };
  } catch (err: any) {
    console.warn('Server save failed, relying on local storage:', err);
    // Return success: false to signal offline/local fallback
    return { success: false, error: err.message };
  }
}

export async function updateServerMemory(
  id: string,
  text: string,
  category: MemoryCategory
): Promise<{ success: boolean; memory?: MemoryItem; error?: string }> {
  try {
    const res = await fetch(`/api/memories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, category })
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error };
    return { success: true, memory: data.memory };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteServerMemory(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/memories/${id}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function clearServerMemories(): Promise<boolean> {
  try {
    const res = await fetch('/api/memories', { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}
