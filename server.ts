import http from 'http';
import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { WebSocketServer } from 'ws';
import crypto from 'crypto';
import { TelephonyBridgeManager } from './server-telephony.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Persistent In-Memory & File-backed Memory Storage
interface ServerMemoryItem {
  id: string;
  category: 'preference' | 'instruction' | 'fact';
  text: string;
  createdAt: string;
  updatedAt?: string;
}

const MEMORIES_FILE = path.join(__dirname, 'memories.json');
let serverMemories: ServerMemoryItem[] = [];

try {
  if (fs.existsSync(MEMORIES_FILE)) {
    const raw = fs.readFileSync(MEMORIES_FILE, 'utf-8');
    serverMemories = JSON.parse(raw);
  }
} catch (e) {
  serverMemories = [];
}

function persistMemoriesToFile() {
  try {
    fs.writeFileSync(MEMORIES_FILE, JSON.stringify(serverMemories, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not persist memories to file:', err);
  }
}

// In-memory call records
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
  transcript: Array<{ speaker: 'AI' | 'Caller'; text: string }>;
  isSimulatedWebhook?: boolean;
}

let callRecords: CallRecord[] = [
  {
    id: 'call-1',
    callerName: 'Rajesh Sharma',
    callerNumber: '+91 98301 23456',
    timestamp: 'Today, 11:20 AM',
    duration: '48s',
    language: 'Hindi',
    urgency: 'Medium',
    status: 'Call Back Requested',
    summary: 'राजेश जी ने कल दोपहर 2 बजे की क्लाइंट मीटिंग के समय को री-शेड्यूल करने के लिए कॉल किया था। उन्होंने बिपुल से 4 बजे से पहले कॉल बैक करने का अनुरोध किया है।',
    transcript: [
      { speaker: 'AI', text: 'नमस्ते! मैं बिपुल एआई हूँ, बिपुल का पर्सनल असिस्टेंट। बिपुल अभी फोन नहीं उठा पा रहे हैं। क्या मैं कोई संदेश ले सकता हूँ?' },
      { speaker: 'Caller', text: 'हाँ नमस्ते, मैं राजेश बात कर रहा हूँ। कल दोपहर की 2 बजे वाली मीटिंग 3:30 बजे शिफ्ट करनी है। बिपुल से कहिए मुझे कॉल करें।' },
      { speaker: 'AI', text: 'जी राजेश जी, मैंने आपका संदेश नोट कर लिया है: मीटिंग 3:30 बजे शिफ्ट करने के बारे में। मैं बिपुल को तुरंत सूचित कर दूँगा। धन्यवाद!' }
    ]
  },
  {
    id: 'call-2',
    callerName: 'Ananya Sen',
    callerNumber: '+91 94330 98765',
    timestamp: 'Today, 09:45 AM',
    duration: '35s',
    language: 'Bengali',
    urgency: 'Normal',
    status: 'Message Taken',
    summary: 'অনন্যা সেন নতুন প্রজেক্টের ডকুমেন্টেশন ইমেইলে পাঠিয়েছেন বলে জানালেন। বিপুল বাবুকে ড্রাফ্টটি চেক করে ফিডব্যাক দিতে অনুরোধ করেছেন।',
    transcript: [
      { speaker: 'AI', text: 'নমস্কার! আমি বিপুল এআই, বিপুল বাবুর সহকারী। উনি এখন ব্যস্ত আছেন। আপনার কি কোনো দরকারি বার্তা আছে?' },
      { speaker: 'Caller', text: 'হ্যাঁ, আমি অনন্যা। বিপুল বাবুকে বলবেন প্রজেক্ট রিপোর্টটা ইমেইলে পাঠিয়ে দিয়েছি, সময় পেলে একবার দেখে নিতে।' },
      { speaker: 'AI', text: 'অবশ্যই অনন্যা দেবী, আমি বিপুল বাবুকে জানিয়ে দেব যাতে উনি ইমেইলটি দেখে নেন। আপনার দিনটি শুভ হোক।' }
    ]
  },
  {
    id: 'call-3',
    callerName: 'David Miller',
    callerNumber: '+1 (415) 555-0192',
    timestamp: 'Yesterday, 06:15 PM',
    duration: '52s',
    language: 'English',
    urgency: 'Urgent',
    status: 'Call Back Requested',
    summary: 'David called regarding API deployment keys and staging server access. Requested urgent phone callback this evening.',
    transcript: [
      { speaker: 'AI', text: 'Hello! I am Bipul AI, personal assistant to Bipul. He is unable to take your call right now. May I take a message?' },
      { speaker: 'Caller', text: 'Hi, this is David. We have an issue with the staging deployment credentials. Could Bipul please call me back as soon as he is free?' },
      { speaker: 'AI', text: 'I understand David, I have flagged this as urgent regarding staging credentials and sent Bipul a priority alert with your number.' }
    ]
  }
];

// Server-side Gemini initialization
const rawKey = process.env.GEMINI_API_KEY;
const geminiApiKey = rawKey && rawKey.trim() !== '' && rawKey !== 'MY_GEMINI_API_KEY' ? rawKey : null;
let aiClient: GoogleGenAI | null = null;

if (geminiApiKey) {
  aiClient = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

// Telephony WebSocket Server and Bridge Manager
const wss = new WebSocketServer({ noServer: true });
const telephonyManager = new TelephonyBridgeManager(aiClient, (newRecord: CallRecord) => {
  callRecords.unshift(newRecord);
});

// Attach WebSocket upgrade handler
server.on('upgrade', (request, socket, head) => {
  const pathname = request.url ? new URL(request.url, `http://${request.headers.host}`).pathname : '';
  if (pathname === '/api/telephony/stream') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

telephonyManager.attachWebSocketServer(wss);

function getBaseHostUrl(req: Request): string {
  const envUrl = process.env.APP_URL;
  if (envUrl && envUrl.startsWith('http')) {
    return envUrl.replace(/\/$/, '');
  }
  const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  return `${protocol}://${host}`;
}

// 1. Enhanced Telephony Status & Diagnostics Endpoint
app.get('/api/telephony/status', (req: Request, res: Response) => {
  const virtualNumber = process.env.TELEPHONY_VIRTUAL_NUMBER || null;
  const isConnected = Boolean(virtualNumber);
  const baseUrl = getBaseHostUrl(req);
  const wsUrl = baseUrl.replace(/^http/, 'ws');
  const provider = process.env.TELEPHONY_PROVIDER || (isConnected ? 'exotel' : 'simulated');

  res.json({
    connected: isConnected,
    virtualNumber: virtualNumber || '+91 80 4XXX XXXX (Pending Setup)',
    provider: isConnected ? (provider.toUpperCase() + ' (India DID)') : 'Simulated / Not Connected',
    isGeminiConfigured: Boolean(geminiApiKey),
    isServerLive: true,
    activeLiveSessions: telephonyManager.getActiveSessionsCount(),
    webhookUrls: {
      inboundVoiceUrl: `${baseUrl}/api/telephony/voice`,
      statusCallbackUrl: `${baseUrl}/api/telephony/status-callback`,
      webSocketStreamUrl: `${wsUrl}/api/telephony/stream`,
      testWebhookUrl: `${baseUrl}/api/telephony/test-webhook`
    },
    jioForwarding: {
      unansweredCode: `*409*${virtualNumber || '<Virtual_Number>'}#`,
      busyCode: `*404*${virtualNumber || '<Virtual_Number>'}#`,
      unreachableCode: `*402*${virtualNumber || '<Virtual_Number>'}#`,
      deactivateCode: '*410#',
      carrier: 'Reliance Jio 4G/5G'
    },
    message: isConnected
      ? 'Telephony gateway is connected and listening for Jio forwarded calls.'
      : 'Android mobile OS restricts apps from directly grabbing cellular audio without carrier forwarding. Setup an Indian virtual number on Exotel/Twilio to go fully live.'
  });
});

// Diagnostics endpoint detailing missing components for full cellular production
app.get('/api/telephony/missing-components', (req: Request, res: Response) => {
  const baseUrl = getBaseHostUrl(req);
  const wsUrl = baseUrl.replace(/^http/, 'ws');
  const hasGemini = Boolean(geminiApiKey);
  const hasVirtualNumber = Boolean(process.env.TELEPHONY_VIRTUAL_NUMBER);
  const hasAccountSid = Boolean(process.env.TELEPHONY_ACCOUNT_SID);
  const hasAuthToken = Boolean(process.env.TELEPHONY_AUTH_TOKEN);

  const missingList: Array<{
    category: string;
    component: string;
    status: 'configured' | 'missing' | 'demo_mode';
    impact: string;
    actionRequired: string;
  }> = [
    {
      category: 'Carrier Routing',
      component: 'Indian Virtual Number (DID) via Exotel or Twilio India',
      status: hasVirtualNumber ? 'configured' : 'missing',
      impact: 'Without a cloud DID (+91 80 / +91 11 / +91 22), Jio cannot forward unanswered cellular calls to the cloud.',
      actionRequired: 'Register on Exotel (exotel.com) or Twilio India and complete TRAI KYC verification to purchase an Indian Virtual Number.'
    },
    {
      category: 'Cloud Telephony Gateway',
      component: 'Provider Voice Inbound Webhook Binding',
      status: hasAccountSid && hasAuthToken ? 'configured' : 'missing',
      impact: 'Telephony provider needs to know where to direct incoming voice audio packets.',
      actionRequired: `In your Exotel/Twilio console, set the Voice Inbound Webhook URL to: ${baseUrl}/api/telephony/voice and Status Callback to: ${baseUrl}/api/telephony/status-callback`
    },
    {
      category: 'Real-time Audio Engine',
      component: 'Gemini Live Session Engine (gemini-3.8-live)',
      status: hasGemini ? 'configured' : 'demo_mode',
      impact: hasGemini ? 'Full low-latency speech-to-speech audio streaming active.' : 'Running in browser/simulated voice mode. Spoken responses will use fallback speech engine.',
      actionRequired: hasGemini ? 'No action needed: GEMINI_API_KEY is configured.' : 'Add your GEMINI_API_KEY in the AI Studio Secrets panel.'
    },
    {
      category: 'Audio Transcoding Pipeline',
      component: 'ITU-T G.711 mu-law (8kHz) <-> PCM16 (16kHz/24kHz) Transcoder',
      status: 'configured',
      impact: 'Translates cellular phone line audio codec into high-fidelity AI audio stream.',
      actionRequired: 'Integrated in server-telephony.ts module on this server.'
    },
    {
      category: 'Carrier Forwarding',
      component: 'Manual Jio Conditional Call Forwarding (*409*)',
      status: 'missing',
      impact: 'Your Android phone must instruct Jio to forward unanswered calls to the cloud virtual number.',
      actionRequired: 'Dial *409*<Virtual_Number># manually on your phone dialer once the virtual number is active. Never activate automatically.'
    }
  ];

  res.json({
    baseUrl,
    wsUrl,
    hasGemini,
    hasVirtualNumber,
    isFullyLive: hasGemini && hasVirtualNumber && hasAccountSid,
    missingList
  });
});

// Telephony Webhook Security & Signature Validation
function validateTelephonyWebhook(req: Request): { valid: boolean; reason?: string } {
  const authToken = process.env.TELEPHONY_AUTH_TOKEN || process.env.TELEPHONY_WEBHOOK_SECRET;

  // In demo or dev mode with no token configured, pass through with warning
  if (!authToken || authToken.trim() === '') {
    return { valid: true, reason: 'unconfigured_demo_mode' };
  }

  // Allow explicit internal simulation requests
  if (req.headers['x-bipul-simulation'] === 'true' || req.path.includes('test-webhook')) {
    return { valid: true, reason: 'internal_simulation' };
  }

  const twilioSignature = req.headers['x-twilio-signature'] as string | undefined;
  const exotelToken = (req.headers['x-exotel-token'] || req.headers['authorization']) as string | undefined;

  if (twilioSignature) {
    try {
      const url = getBaseHostUrl(req) + req.originalUrl;
      const params = req.body || {};
      const sortedKeys = Object.keys(params).sort();
      let dataToSign = url;
      for (const key of sortedKeys) {
        dataToSign += `${key}${params[key]}`;
      }
      const expectedSig = crypto.createHmac('sha1', authToken).update(dataToSign).digest('base64');
      if (crypto.timingSafeEqual(Buffer.from(twilioSignature), Buffer.from(expectedSig))) {
        return { valid: true };
      }
      return { valid: false, reason: 'invalid_twilio_signature' };
    } catch {
      return { valid: false, reason: 'signature_verification_error' };
    }
  }

  if (exotelToken) {
    if (exotelToken === authToken || exotelToken === `Bearer ${authToken}`) {
      return { valid: true };
    }
    return { valid: false, reason: 'invalid_exotel_token' };
  }

  return { valid: false, reason: 'missing_telephony_signature' };
}

// 2. Real Telephony Inbound Voice Webhook (TwiML & Exotel)
app.post('/api/telephony/voice', (req: Request, res: Response) => {
  const authCheck = validateTelephonyWebhook(req);
  if (!authCheck.valid) {
    console.warn(`[Telephony Webhook] Rejected unauthorized call: ${authCheck.reason}`);
    return res.status(403).json({ error: 'Unauthorized telephony request', reason: authCheck.reason });
  }

  const callerNumber = (req.body.From || req.body.CallFrom || req.body.caller || req.query.From || '+91 Mobile Caller') as string;
  const callerName = (req.body.CallerName || req.body.callerName || 'Cellular Caller') as string;
  const callSid = (req.body.CallSid || req.body.callSid || `call-${Date.now()}`) as string;
  const forwardedFrom = (req.body.ForwardedFrom || req.body.DialWhomNumber || req.query.ForwardedFrom || null) as string | null;
  const provider = (process.env.TELEPHONY_PROVIDER || 'twilio').toLowerCase();
  const hostUrl = getBaseHostUrl(req);

  console.log(`[Telephony Webhook] Inbound call received from ${callerNumber} (ForwardedFrom: ${forwardedFrom || 'Direct/Jio'}, CallSid: ${callSid})`);

  telephonyManager.createSession(callSid, callerNumber, callerName, forwardedFrom || undefined);

  if (provider === 'exotel') {
    const exotelResponse = telephonyManager.generateExotelResponse(hostUrl, callSid, callerNumber);
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(exotelResponse);
  } else {
    // Twilio Voice / Programmable Voice TwiML
    const twiml = telephonyManager.generateTwiMLResponse(hostUrl, callSid, callerNumber, callerName, forwardedFrom || undefined);
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(twiml);
  }
});

// 3. Telephony Status Callback Webhook
app.post('/api/telephony/status-callback', async (req: Request, res: Response) => {
  const callSid = (req.body.CallSid || req.body.callSid) as string;
  const callStatus = (req.body.CallStatus || req.body.status || 'completed') as string;
  console.log(`[Telephony Status Webhook] CallSid: ${callSid}, Status: ${callStatus}`);

  if (callSid) {
    await telephonyManager.finalizeCall(callSid);
  }
  return res.status(200).json({ status: 'ok' });
});

// 4. Test Inbound Webhook (Safe live-testing trigger without an external paid carrier line)
app.post('/api/telephony/test-webhook', async (req: Request, res: Response) => {
  try {
    const {
      callerName = 'Suresh Patil',
      callerNumber = '+91 98200 11223',
      callerTopic = 'Urgent update regarding the vendor contract signing tomorrow morning',
      language = 'en'
    } = req.body;

    const callSid = `sim-webhook-${Date.now()}`;
    const session = telephonyManager.createSession(callSid, callerNumber, callerName);

    // Pre-populate simulated transcript matching requested topic & language
    if (language === 'hi') {
      session.detectedLanguage = 'Hindi';
      session.transcript = [
        { speaker: 'AI', text: 'नमस्ते! मैं बिपुल एआई हूँ, बिपुल का पर्सनल असिस्टेंट। बिपुल अभी उपलब्ध नहीं हैं। क्या मैं कोई संदेश ले सकता हूँ?' },
        { speaker: 'Caller', text: `नमस्ते, मैं ${callerName} बोल रहा हूँ। ${callerTopic}। कृपया बिपul से कहिए कि वे मुझे जल्द कॉल बैक करें।` },
        { speaker: 'AI', text: 'जी मैंने आपका संदेश सुरक्षित रूप से दर्ज कर लिया है। मैं बिपुल को तुरंत इसकी प्राथमिकता समरी भेज दूँगा। धन्यवाद!' }
      ];
    } else if (language === 'bn') {
      session.detectedLanguage = 'Bengali';
      session.transcript = [
        { speaker: 'AI', text: 'নমস্কার! আমি বিপুল এআই, বিপুল বাবুর ব্যক্তিগত সহকারী। উনি এখন কথা বলতে পারছেন না। আপনার কোনো জরুরি বার্তা আছে?' },
        { speaker: 'Caller', text: `হ্যাঁ, আমি ${callerName}। ${callerTopic}। বিপুল বাবুকে একবার কল করতে বলবেন।` },
        { speaker: 'AI', text: 'অবশ্যই, আমি আপনার বার্তাটি নোট করেছি এবং বিপুল বাবুকে গুরুত্ব সহকারে জানিয়ে দিচ্ছি।' }
      ];
    } else {
      session.detectedLanguage = 'English';
      session.transcript = [
        { speaker: 'AI', text: 'Hello! This is Bipul AI, personal assistant to Bipul. Bipul is currently away from the phone. May I take your message?' },
        { speaker: 'Caller', text: `Hi, this is ${callerName}. ${callerTopic}. Could Bipul give me a call back when free?` },
        { speaker: 'AI', text: 'Understood. I have recorded your message and flagged it for Bipul with your phone number. Have a good day!' }
      ];
    }

    const record = await telephonyManager.finalizeCall(callSid);
    return res.status(200).json({
      success: true,
      message: 'Telephony webhook executed successfully. Call parsed, transcribed, and summarized.',
      callRecord: record
    });
  } catch (err: any) {
    console.error('Test webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// 5. Chat Completion Route
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { messages, language = 'en', persona, memories = [], memoryEnabled = true } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const langDirective =
      language === 'hi'
        ? 'LANGUAGE REQUIREMENT: HINDI (हिंदी). Respond naturally, warmly, and politely in fluent Hindi using Devanagari script. Use clear, conversational phrasing that sounds pleasant when spoken aloud. If the user used Hinglish/Romanized Hindi, understand it perfectly and reply in clean Devanagari Hindi.'
        : language === 'bn'
        ? 'LANGUAGE REQUIREMENT: BENGALI (বাংলা). Respond naturally, warmly, and politely in fluent conversational Bengali using Bengali script. Use clear, helpful phrasing that sounds natural when spoken aloud. If the user used Banglish/Romanized Bengali, understand it perfectly and reply in clean Bengali script.'
        : 'LANGUAGE REQUIREMENT: ENGLISH. Respond in a friendly, intelligent, clear, and professional conversational tone in natural English.';

    const defaultPersona = persona || 'You are Bipul AI, a warm, helpful, friendly, and intelligent personal AI assistant created for Bipul. You assist Bipul with daily questions, drafting messages, checking call summaries, organizing tasks, and handling telephone interactions.';

    const memoryDirective = (memoryEnabled && Array.isArray(memories) && memories.length > 0)
      ? `\n\nUSER'S SAVED MEMORIES & PREFERENCES:
The following facts, preferences, and custom instructions were explicitly saved by the user. You MUST incorporate them naturally whenever relevant to the conversation:
${memories.map((m: any) => `- [${(m.category || 'FACT').toUpperCase()}]: ${m.text}`).join('\n')}
Do NOT recite all memories unprompted, but apply them accurately when answering questions or following guidelines.`
      : '';

    const systemInstruction = `${defaultPersona}

${langDirective}${memoryDirective}

KEY GUIDELINES FOR HIGH QUALITY ASSISTANCE:
1. Be friendly, courteous, and genuinely helpful.
2. Provide direct, informative, well-structured answers.
3. Keep answers concise (1-3 paragraphs or bullet points) so they are easy to read on mobile and pleasant to listen to through voice synthesis.
4. If asked about phone calls or Jio forwarding, clearly explain the system and remind the user that real calls require cloud telephony integration.
5. If the user asks you to draft a message, solve a problem, or explain something, do so with high accuracy and clarity.
6. When relevant user memories are provided, respect user preferences and custom instructions.`;

    if (aiClient) {
      // Use Gemini 3.8 Flash
      const conversationText = messages
        .map((m: { role: string; content: string }) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: conversationText,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      const reply = response.text || 'I am ready to assist you.';
      return res.json({
        reply,
        isDemo: false,
        model: 'gemini-3.8-flash'
      });
    }

    // High quality offline fallback generator when GEMINI_API_KEY is not configured
    const lastUserMsg = messages[messages.length - 1]?.content || '';
    const lower = lastUserMsg.toLowerCase();
    let fallbackReply = '';

    const isAskingAboutMemory =
      lower.includes('remember') ||
      lower.includes('memory') ||
      lower.includes('memories') ||
      lower.includes('what do you know') ||
      lower.includes('preference') ||
      lower.includes('याद') ||
      lower.includes('यादें') ||
      lower.includes('पसंद') ||
      lower.includes('মনে') ||
      lower.includes('স্মৃতি');

    if (isAskingAboutMemory && memoryEnabled && Array.isArray(memories) && memories.length > 0) {
      const memoryBullets = memories.map((m: any) => `• ${m.text}`).join('\n');
      if (language === 'hi') {
        fallbackReply = `मुझे आपकी ये बातें याद हैं:\n${memoryBullets}\n\nमैं इन प्राथमिकताओं को अपनी बातचीत में ध्यान में रखूँगा।`;
      } else if (language === 'bn') {
        fallbackReply = `আমার আপনার এই বিষয়গুলো মনে আছে:\n${memoryBullets}\n\nআমি প্রতিটি কথোপকথনে এই পছন্দগুলো মনে রাখব।`;
      } else {
        fallbackReply = `Here is what I remember about you:\n${memoryBullets}\n\nI will remember and apply these preferences during our conversations!`;
      }
    } else if (language === 'hi') {
      if (lower.includes('नमस्ते') || lower.includes('hello') || lower.includes('hi') || lower.includes('kaise')) {
        fallbackReply = 'नमस्ते! मैं बिपुल एआई हूँ, आपका पर्सनल वॉयस व कॉल असिस्टेंट। मैं आपकी किस प्रकार मदद कर सकता हूँ? आप मुझसे कोई भी सवाल पूछ सकते हैं या कॉल समरी चेक कर सकते हैं।';
      } else if (lower.includes('कॉल') || lower.includes('call') || lower.includes('jio') || lower.includes('जियो')) {
        fallbackReply = 'जियो कॉल फॉरवर्डिंग के लिए आप *409*<Virtual_Number># कोड का इस्तेमाल कर सकते हैं। जब कोई वर्चुअल नंबर कनेक्ट होगा, तो आपके फोन न उठाने पर मैं कॉलर्स से बात करूँगा और आपको यहाँ समरी दूँगा।';
      } else {
        fallbackReply = `मैंने आपका संदेश नोट कर लिया: "${lastUserMsg}"। मैं आपकी सहायता के लिए तैयार हूँ। जब क्लाउड बैकएंड पूरी तरह कनेक्ट हो जाएगा, तो मैं और भी तेज़ी से लाइव जवाब दूँगा।`;
      }
    } else if (language === 'bn') {
      if (lower.includes('নমস্কার') || lower.includes('hello') || lower.includes('hi') || lower.includes('kemon')) {
        fallbackReply = 'নমস্কার! আমি বিপুল এআই, আপনার ব্যক্তিগত সহকারী। আজ আপনাকে কীভাবে সাহায্য করতে পারি? আপনি আমাকে যেকোনো প্রশ্ন করতে পারেন বা কল সামারি দেখতে পারেন।';
      } else if (lower.includes('কল') || lower.includes('call') || lower.includes('jio') || lower.includes('জিও')) {
        fallbackReply = 'জিও কল ফরওয়ার্ড করার জন্য কোড হলো *409*<Virtual_Number>#। ক্লাউড ভার্চুয়াল নম্বর সংযুক্ত হলে, আপনার ব্যস্ততার সময় আমি বাংলায় কলারদের বার্তা রেকর্ড করব।';
      } else {
        fallbackReply = `আমি আপনার বার্তাটি পেয়েছি: "${lastUserMsg}"। আমি আপনার সেবায় প্রস্তুত। ক্লাউড সার্ভার যুক্ত থাকলে আমি আরও দ্রুত তথ্য সরবরাহ করব।`;
      }
    } else {
      if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
        fallbackReply = 'Hello! I am Bipul AI, your friendly and intelligent personal assistant. How can I help you today? Feel free to ask a question, test voice input, or check your call logs.';
      } else if (lower.includes('call') || lower.includes('jio') || lower.includes('forward')) {
        fallbackReply = 'For Jio conditional forwarding, dial *409*<Virtual_Number># on your phone. When a cloud number is connected, I will greet callers, take messages, and summarize them right here.';
      } else {
        fallbackReply = `I received your message: "${lastUserMsg}". I am Bipul AI, ready to help you with voice commands, summaries, and answering tasks. In demo mode, voice input and synthesis work right in your browser!`;
      }
    }

    return res.json({
      reply: fallbackReply,
      isDemo: true,
      note: 'Demo mode active. Add GEMINI_API_KEY in environment for full generative AI.'
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to process chat message',
      isDemo: true
    });
  }
});

// 6. Simulated Call Turn (for testing the call-answering flow)
app.post('/api/call-simulate/turn', async (req: Request, res: Response) => {
  try {
    const { callerMessage, language = 'en', callerName = 'Caller', callTranscript = [] } = req.body;

    const langName = language === 'hi' ? 'Hindi (Devanagari)' : language === 'bn' ? 'Bengali (বাংলা)' : 'English';

    const systemInstruction = `You are Bipul AI, answering an incoming telephone call forwarded from Bipul's mobile phone because Bipul is currently unavailable.
Your role:
1. Greet the caller politely and warmly in ${langName}.
2. Inform them that Bipul is currently away or busy.
3. Ask who is calling and what urgent query or message they would like to leave for Bipul.
4. Keep each response concise (1-2 sentences), natural, and realistic for a telephone conversation.
5. If they leave a message, confirm receipt and reassure them that Bipul will receive their message promptly.`;

    if (aiClient) {
      const historyStr = callTranscript
        .map((t: { speaker: string; text: string }) => `${t.speaker}: ${t.text}`)
        .join('\n');
      const prompt = `${historyStr}\nCaller: ${callerMessage}\nAI:`;

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.6
        }
      });

      return res.json({ reply: response.text || 'Thank you, I will pass this message to Bipul.' });
    }

    // Fallback response for simulator
    if (language === 'hi') {
      return res.json({
        reply: `जी, मैंने आपका संदेश नोट कर लिया है। जैसे ही बिपुल उपलब्ध होंगे, मैं उन्हें तुरंत आपका संदेश दे दूँगा। धन्यवाद!`
      });
    } else if (language === 'bn') {
      return res.json({
        reply: `ধন্যবাদ, আমি আপনার বার্তাটি যত্নসহকারে লিখে রেখেছি। বিপুল বাবু ফিরে আসলেই আমি ওনাকে জানিয়ে দেব।`
      });
    } else {
      return res.json({
        reply: `Got it. I have noted down your message and will notify Bipul as soon as he is available. Thank you for calling!`
      });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 7. Summarize Call Route
app.post('/api/call-simulate/summarize', async (req: Request, res: Response) => {
  try {
    const { transcript, callerName, callerNumber, language = 'en' } = req.body;

    if (!transcript || !Array.isArray(transcript)) {
      return res.status(400).json({ error: 'Transcript array is required' });
    }

    const conversationText = transcript
      .map((t: { speaker: string; text: string }) => `${t.speaker}: ${t.text}`)
      .join('\n');

    let summary = '';
    let urgency: 'Normal' | 'Medium' | 'Urgent' = 'Normal';
    let status: 'Message Taken' | 'Inquired' | 'Call Back Requested' = 'Message Taken';

    if (aiClient) {
      const prompt = `Analyze this forwarded phone conversation taken by Bipul AI on behalf of Bipul:
${conversationText}

Provide a concise 1-2 sentence executive summary of what the caller wanted, and indicate urgency (Normal, Medium, or Urgent) and status (Message Taken, Inquired, or Call Back Requested).
Language of summary: ${language === 'hi' ? 'Hindi' : language === 'bn' ? 'Bengali' : 'English'}.

Format:
Summary: <1-2 sentences>
Urgency: <Normal|Medium|Urgent>
Status: <Message Taken|Inquired|Call Back Requested>`;

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt
      });

      const text = response.text || '';
      const summaryMatch = text.match(/Summary:\s*(.+)/i);
      const urgencyMatch = text.match(/Urgency:\s*(Normal|Medium|Urgent)/i);
      const statusMatch = text.match(/Status:\s*(Message Taken|Inquired|Call Back Requested)/i);

      if (summaryMatch) summary = summaryMatch[1].trim();
      else summary = text.slice(0, 180);

      if (urgencyMatch) urgency = urgencyMatch[1] as any;
      if (statusMatch) status = statusMatch[1] as any;
    } else {
      if (language === 'hi') {
        summary = `${callerName || 'कॉलर'} ने कॉल किया और बिपुल के लिए संदेश छोड़ा। बिपुल को सूचित किया गया।`;
      } else if (language === 'bn') {
        summary = `${callerName || 'কলার'} কল করেছিলেন এবং বিপুল বাবুর জন্য বার্তা রেখে গেছেন।`;
      } else {
        summary = `${callerName || 'Caller'} called regarding an update and left a message for Bipul to follow up.`;
      }
    }

    const newRecord: CallRecord = {
      id: `call-${Date.now()}`,
      callerName: callerName || 'Unknown Caller',
      callerNumber: callerNumber || '+91 98XXX XXXXX',
      timestamp: 'Just now',
      duration: '40s',
      language: language === 'hi' ? 'Hindi' : language === 'bn' ? 'Bengali' : 'English',
      urgency,
      status,
      summary,
      transcript
    };

    callRecords.unshift(newRecord);
    return res.json({ record: newRecord });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 8. Call History
app.get('/api/calls', (_req: Request, res: Response) => {
  res.json({ calls: callRecords });
});

// 9. Delete a call
app.delete('/api/calls/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  callRecords = callRecords.filter(c => c.id !== id);
  res.json({ success: true });
});

// 10. Memory CRUD Endpoints
app.get('/api/memories', (_req: Request, res: Response) => {
  res.json({
    memories: serverMemories,
    storage: 'server-persistent',
    isolated: true
  });
});

app.post('/api/memories', (req: Request, res: Response) => {
  try {
    const { text, category } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Memory text is required' });
    }

    const trimmed = text.trim();
    if (trimmed.length > 500) {
      return res.status(400).json({ error: 'Memory text cannot exceed 500 characters' });
    }

    // Proactive check against sensitive credentials
    const sensitiveRegex = /(?:password|passwd|passcode|secret[_-]?key|bearer\s+[a-zA-Z0-9_\-\.]|api[_-]?key|cvv|atm\s*pin|\b(?:\d{4}[ -]?){3}\d{4}\b)/i;
    if (sensitiveRegex.test(trimmed)) {
      return res.status(400).json({
        error: 'Privacy Protection: Passwords, API keys, payment details, or sensitive credentials cannot be stored.'
      });
    }

    const newMem: ServerMemoryItem = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      category: ['preference', 'instruction', 'fact'].includes(category) ? category : 'fact',
      text: trimmed,
      createdAt: new Date().toISOString()
    };

    serverMemories.unshift(newMem);
    persistMemoriesToFile();
    return res.status(201).json({ success: true, memory: newMem });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/memories/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { text, category } = req.body;

    const idx = serverMemories.findIndex(m => m.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Memory not found' });
    }

    if (text) {
      const trimmed = text.trim();
      const sensitiveRegex = /(?:password|passwd|passcode|secret[_-]?key|bearer\s+[a-zA-Z0-9_\-\.]|api[_-]?key|cvv|atm\s*pin|\b(?:\d{4}[ -]?){3}\d{4}\b)/i;
      if (sensitiveRegex.test(trimmed)) {
        return res.status(400).json({
          error: 'Privacy Protection: Passwords, API keys, payment details, or sensitive credentials cannot be stored.'
        });
      }
      serverMemories[idx].text = trimmed;
    }

    if (category && ['preference', 'instruction', 'fact'].includes(category)) {
      serverMemories[idx].category = category;
    }

    serverMemories[idx].updatedAt = new Date().toISOString();
    persistMemoriesToFile();
    return res.json({ success: true, memory: serverMemories[idx] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/memories/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  serverMemories = serverMemories.filter(m => m.id !== id);
  persistMemoriesToFile();
  return res.json({ success: true });
});

app.delete('/api/memories', (_req: Request, res: Response) => {
  serverMemories = [];
  persistMemoriesToFile();
  return res.json({ success: true, message: 'All memories cleared' });
});

// Dev / Prod Vite Handler
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Bipul AI server running on http://0.0.0.0:${PORT} with WebSocket stream support`);
  });
}

startServer();
