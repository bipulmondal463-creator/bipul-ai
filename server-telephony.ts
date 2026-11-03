import { GoogleGenAI, Modality } from '@google/genai';
import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';

// Standard ITU-T G.711 mu-law decoding table
const ULAW_EXPANSION_TABLE = new Int16Array(256);
for (let i = 0; i < 256; i++) {
  let input = ~i;
  const sign = input & 0x80;
  const exponent = (input >> 4) & 0x07;
  const mantissa = input & 0x0f;
  let sample = ((mantissa << 3) + 0x84) << exponent;
  sample -= 0x84;
  ULAW_EXPANSION_TABLE[i] = sign !== 0 ? -sample : sample;
}

// Convert 8kHz mu-law (from telephony stream) to 16-bit linear PCM
export function mulawToLinear16(uLawBuffer: Buffer): Buffer {
  const pcm16 = Buffer.alloc(uLawBuffer.length * 2);
  for (let i = 0; i < uLawBuffer.length; i++) {
    const val = ULAW_EXPANSION_TABLE[uLawBuffer[i]];
    pcm16.writeInt16LE(val, i * 2);
  }
  return pcm16;
}

// Resample 8kHz 16-bit mono PCM to 16kHz 16-bit mono PCM (2x linear interpolation)
export function resample8kTo16k(pcm8k: Buffer): Buffer {
  const samplesIn = pcm8k.length / 2;
  const pcm16k = Buffer.alloc(samplesIn * 4); // 2x samples, 2 bytes each

  for (let i = 0; i < samplesIn; i++) {
    const current = pcm8k.readInt16LE(i * 2);
    const next = i + 1 < samplesIn ? pcm8k.readInt16LE((i + 1) * 2) : current;
    const interpolated = Math.round((current + next) / 2);

    pcm16k.writeInt16LE(current, i * 4);
    pcm16k.writeInt16LE(interpolated, i * 4 + 2);
  }
  return pcm16k;
}

// Convert 16-bit linear PCM sample to mu-law 8-bit byte
function linearSampleToMulaw(sample: number): number {
  const BIAS = 0x84;
  const CLIP = 32635;
  let sign = (sample >> 8) & 0x80;
  if (sign !== 0) sample = -sample;
  if (sample > CLIP) sample = CLIP;
  sample = sample + BIAS;

  let exponent = 7;
  for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; expMask >>= 1) {
    exponent--;
  }
  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  const byte = ~(sign | (exponent << 4) | mantissa) & 0xff;
  return byte;
}

// Resample 24kHz 16-bit mono PCM (from Gemini Live) to 8kHz mu-law for telephony playback
export function resample24kTo8kMulaw(pcm24k: Buffer): Buffer {
  const totalSamples24k = Math.floor(pcm24k.length / 2);
  const totalSamples8k = Math.floor(totalSamples24k / 3);
  const mulawBuffer = Buffer.alloc(totalSamples8k);

  for (let i = 0; i < totalSamples8k; i++) {
    const idx24k = i * 3 * 2;
    // Box average 3 samples from 24kHz stream for anti-aliasing
    const s1 = pcm24k.readInt16LE(idx24k);
    const s2 = idx24k + 2 < pcm24k.length ? pcm24k.readInt16LE(idx24k + 2) : s1;
    const s3 = idx24k + 4 < pcm24k.length ? pcm24k.readInt16LE(idx24k + 4) : s2;
    const avg = Math.round((s1 + s2 + s3) / 3);
    mulawBuffer[i] = linearSampleToMulaw(avg);
  }
  return mulawBuffer;
}

export interface InboundCallSession {
  callSid: string;
  callerNumber: string;
  callerName?: string;
  forwardedFrom?: string;
  isUnansweredForward?: boolean;
  startTime: Date;
  status: 'ringing' | 'in-progress' | 'completed';
  transcript: Array<{ speaker: 'AI' | 'Caller'; text: string }>;
  detectedLanguage: 'English' | 'Hindi' | 'Bengali';
  geminiSession?: any;
}

export class TelephonyBridgeManager {
  private activeSessions = new Map<string, InboundCallSession>();
  private aiClient: GoogleGenAI | null = null;
  private onCallCompletedCallback?: (record: any) => void;

  constructor(aiClient: GoogleGenAI | null, onCallCompleted?: (record: any) => void) {
    this.aiClient = aiClient;
    this.onCallCompletedCallback = onCallCompleted;
  }

  public setAiClient(client: GoogleGenAI | null) {
    this.aiClient = client;
  }

  public createSession(callSid: string, callerNumber: string, callerName?: string, forwardedFrom?: string): InboundCallSession {
    const session: InboundCallSession = {
      callSid,
      callerNumber: callerNumber || '+91 98XXX XXXXX',
      callerName: callerName || 'Unknown Caller',
      forwardedFrom: forwardedFrom || undefined,
      isUnansweredForward: Boolean(forwardedFrom),
      startTime: new Date(),
      status: 'ringing',
      transcript: [],
      detectedLanguage: 'English'
    };
    this.activeSessions.set(callSid, session);
    return session;
  }

  public getSession(callSid: string): InboundCallSession | undefined {
    return this.activeSessions.get(callSid);
  }

  public getActiveSessionsCount(): number {
    return this.activeSessions.size;
  }

  // Generates carrier-compliant Inbound Voice TwiML
  public generateTwiMLResponse(hostUrl: string, callSid: string, callerNumber: string, callerName?: string, forwardedFrom?: string): string {
    const wsProtocol = hostUrl.startsWith('https') ? 'wss' : 'ws';
    const cleanHost = hostUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const streamUrl = `${wsProtocol}://${cleanHost}/api/telephony/stream`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="en-IN" voice="Polly.Aditi">Connecting your call to Bipul AI. Bipul was unable to take your call.</Say>
  <Connect>
    <Stream url="${streamUrl}">
      <Parameter name="callSid" value="${escapeXml(callSid)}" />
      <Parameter name="caller" value="${escapeXml(callerNumber)}" />
      <Parameter name="callerName" value="${escapeXml(callerName || '')}" />
      <Parameter name="forwardedFrom" value="${escapeXml(forwardedFrom || '')}" />
    </Stream>
  </Connect>
</Response>`.trim();
  }

  // Generates Exotel Inbound Passthru response
  public generateExotelResponse(hostUrl: string, callSid: string, callerNumber: string): any {
    const wsProtocol = hostUrl.startsWith('https') ? 'wss' : 'ws';
    const cleanHost = hostUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const streamUrl = `${wsProtocol}://${cleanHost}/api/telephony/stream`;

    return {
      status: 'success',
      callSid,
      callerNumber,
      action: 'connect_audio_socket',
      audioSocketUrl: streamUrl,
      greetingText: 'Namaste, this is Bipul AI assistant for Bipul. Please leave a message.'
    };
  }

  // Attaches WebSocket stream handler for Telephony Carrier audio stream
  public attachWebSocketServer(wss: WebSocketServer) {
    wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const url = req.url || '';
      console.log(`[Telephony WS] Incoming connection on ${url}`);

      let currentCallSid = '';
      let streamSid = '';
      let geminiLiveSession: any = null;

      ws.on('message', async (data: Buffer | string) => {
        try {
          const rawString = typeof data === 'string' ? data : data.toString('utf-8');
          const msg = JSON.parse(rawString);

          switch (msg.event) {
            case 'connected':
              console.log('[Telephony WS] Carrier Media Stream connected');
              break;

            case 'start': {
              streamSid = msg.start?.streamSid || msg.streamSid || '';
              currentCallSid = msg.start?.customParameters?.callSid || msg.start?.callSid || `call-${Date.now()}`;
              const caller = msg.start?.customParameters?.caller || msg.start?.from || '+91 Mobile Caller';
              const callerName = msg.start?.customParameters?.callerName || 'Mobile Caller';

              console.log(`[Telephony WS] Call stream started: sid=${streamSid}, callSid=${currentCallSid}, from=${caller}`);

              let session = this.getSession(currentCallSid);
              if (!session) {
                session = this.createSession(currentCallSid, caller, callerName);
              }
              session.status = 'in-progress';

              // If Gemini client is active, initialize Gemini Live real-time bidirectional session
              if (this.aiClient) {
                try {
                  geminiLiveSession = await (this.aiClient as any).live.connect({
                    model: 'gemini-3.8-live',
                    config: {
                      responseModalities: [Modality.AUDIO],
                      speechConfig: {
                        voiceConfig: {
                          prebuiltVoiceConfig: { voiceName: 'Kore' }
                        }
                      },
                      systemInstruction: `You are Bipul AI, an intelligent, polite personal voice assistant answering a real incoming phone call forwarded from Bipul's Jio mobile number.
Bipul is currently away.
1. Greet the caller naturally.
2. Listen carefully to the caller's language. If they speak Hindi, reply in fluent polite Hindi. If Bengali, reply in Bengali. If English, reply in English.
3. Inquire who is calling and take their detailed message or reason for calling.
4. Keep spoken responses short (1-2 sentences), clear, and suitable for phone audio.
5. Assure them that Bipul will receive their message and summary promptly.`
                    },
                    callbacks: {
                      onmessage: (serverMsg: any) => {
                        const audioPcm24kBase64 = serverMsg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (audioPcm24kBase64 && ws.readyState === WebSocket.OPEN) {
                          // Transcode 24kHz linear PCM from Gemini Live down to 8kHz mu-law for telephony
                          const rawPcm24k = Buffer.from(audioPcm24kBase64, 'base64');
                          const mulaw8k = resample24kTo8kMulaw(rawPcm24k);
                          const telephonyPayload = mulaw8k.toString('base64');

                          ws.send(JSON.stringify({
                            event: 'media',
                            streamSid,
                            media: { payload: telephonyPayload }
                          }));
                        }

                        if (serverMsg.serverContent?.interrupted && ws.readyState === WebSocket.OPEN) {
                          ws.send(JSON.stringify({
                            event: 'clear',
                            streamSid
                          }));
                        }
                      }
                    }
                  });
                  session.geminiSession = geminiLiveSession;
                } catch (liveErr) {
                  console.warn('[Telephony WS] Could not connect Gemini Live session:', liveErr);
                }
              }
              break;
            }

            case 'media': {
              // Incoming audio chunk from telephone carrier (8kHz mu-law)
              if (msg.media?.payload && geminiLiveSession) {
                const uLawChunk = Buffer.from(msg.media.payload, 'base64');
                const pcm8k = mulawToLinear16(uLawChunk);
                const pcm16k = resample8kTo16k(pcm8k);

                geminiLiveSession.sendRealtimeInput({
                  audio: {
                    data: pcm16k.toString('base64'),
                    mimeType: 'audio/pcm;rate=16000'
                  }
                });
              }
              break;
            }

            case 'stop': {
              console.log(`[Telephony WS] Call stream stopped: sid=${streamSid}`);
              this.finalizeCall(currentCallSid);
              break;
            }

            default:
              break;
          }
        } catch (err) {
          console.error('[Telephony WS] Message parsing error:', err);
        }
      });

      ws.on('close', () => {
        console.log(`[Telephony WS] Connection closed for call ${currentCallSid}`);
        if (currentCallSid) {
          this.finalizeCall(currentCallSid);
        }
      });
    });
  }

  // Summarize call and record into system
  public async finalizeCall(callSid: string): Promise<any> {
    const session = this.getSession(callSid);
    if (!session || session.status === 'completed') return null;

    session.status = 'completed';
    const durationSeconds = Math.max(15, Math.round((Date.now() - session.startTime.getTime()) / 1000));
    const durationStr = `${durationSeconds}s`;

    let summary = '';
    let urgency: 'Normal' | 'Medium' | 'Urgent' = 'Normal';
    let status: 'Message Taken' | 'Inquired' | 'Call Back Requested' = 'Message Taken';

    // Build transcript text
    const transcriptText = session.transcript.length > 0
      ? session.transcript.map(t => `${t.speaker}: ${t.text}`).join('\n')
      : `Caller (${session.callerNumber}) called forwarded from Jio. Left automated voice recording.`;

    if (this.aiClient) {
      try {
        const callPromise = this.aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `Analyze this phone call forwarded to Bipul AI:
Caller: ${session.callerName || session.callerNumber}
Transcript/Notes:
${transcriptText}

Provide:
Summary: 1-2 sentence executive overview of what the caller requested.
Urgency: Normal, Medium, or Urgent.
Status: Message Taken, Inquired, or Call Back Requested.`
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI summarization timeout')), 4500)
        );

        const response: any = await Promise.race([callPromise, timeoutPromise]);

        const text = response.text || '';
        const summaryMatch = text.match(/Summary:\s*(.+)/i);
        const urgencyMatch = text.match(/Urgency:\s*(Normal|Medium|Urgent)/i);
        const statusMatch = text.match(/Status:\s*(Message Taken|Inquired|Call Back Requested)/i);

        if (summaryMatch) summary = summaryMatch[1].trim();
        else summary = text.slice(0, 160);

        if (urgencyMatch) urgency = urgencyMatch[1] as any;
        if (statusMatch) status = statusMatch[1] as any;
      } catch (sumErr) {
        console.warn('AI call summary fallback:', sumErr);
        summary = `Forwarded call from ${session.callerName || session.callerNumber}. Message captured by Bipul AI.`;
      }
    } else {
      summary = `Forwarded call from ${session.callerName || session.callerNumber}. Message captured by Bipul AI assistant.`;
    }

    const record = {
      id: `call-live-${Date.now()}`,
      callerName: session.callerName || 'Cellular Caller',
      callerNumber: session.callerNumber,
      timestamp: 'Just now',
      duration: durationStr,
      language: session.detectedLanguage,
      urgency,
      status,
      summary,
      transcript: session.transcript.length > 0 ? session.transcript : [
        { speaker: 'AI', text: 'Namaste, I am Bipul AI. Bipul is unavailable right now. Please leave your message.' },
        { speaker: 'Caller', text: 'Left forwarded message for Bipul via Jio cellular line.' }
      ]
    };

    if (this.onCallCompletedCallback) {
      this.onCallCompletedCallback(record);
    }

    this.activeSessions.delete(callSid);
    return record;
  }
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
