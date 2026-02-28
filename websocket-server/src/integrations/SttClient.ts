/**
 * Speech-to-Text client — Smallest.ai Pulse STT (WebSocket streaming)
 * Endpoint: wss://waves-api.smallest.ai/api/v1/pulse/get_text
 * Expects: PCM16 16kHz mono audio chunks
 * Returns: JSON { transcript, is_final, session_id }
 */

import WebSocket from 'ws';
import { AudioConverter } from '../audio/AudioConverter';

export interface SttCallbacks {
  onTranscript: (text: string, isFinal: boolean) => void | Promise<void>;
  onError: (err: Error) => void;
}

export interface SttClientInterface {
  connect(callbacks: SttCallbacks): Promise<void>;
  sendAudio(pcmData: Buffer): Promise<void>;
  disconnect(): Promise<void>;
}

export class SttClient implements SttClientInterface {
  private ws: WebSocket | null = null;
  private callbacks: SttCallbacks | null = null;

  async connect(callbacks: SttCallbacks): Promise<void> {
    this.callbacks = callbacks;

    const apiKey = process.env.SMALLEST_AI_API_KEY;
    if (!apiKey) {
      const err = new Error('[STT] SMALLEST_AI_API_KEY not set');
      callbacks.onError(err);
      return;
    }

    const url = new URL('wss://waves-api.smallest.ai/api/v1/pulse/get_text');
    url.searchParams.append('language', 'en');
    url.searchParams.append('encoding', 'linear16');
    url.searchParams.append('sample_rate', '16000');

    this.ws = new WebSocket(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    return new Promise((resolve, reject) => {
      this.ws!.on('open', () => {
        console.log('[STT] Connected to Smallest.ai Pulse STT');
        resolve();
      });

      this.ws!.on('message', async (data: WebSocket.RawData) => {
        try {
          const msg = JSON.parse(data.toString());
          // Only fire on non-empty transcripts
          if (msg.transcript && msg.transcript.trim() && this.callbacks) {
            await this.callbacks.onTranscript(msg.transcript, msg.is_final ?? true);
          }
        } catch {
          // Ignore malformed messages
        }
      });

      this.ws!.on('error', (err) => {
        console.error('[STT] WebSocket error:', err.message);
        if (this.callbacks) this.callbacks.onError(err);
        reject(err);
      });

      this.ws!.on('close', () => {
        console.log('[STT] Disconnected from Smallest.ai Pulse STT');
      });
    });
  }

  async sendAudio(pcm8kData: Buffer): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    // Twilio gives us 8kHz PCM; Smallest.ai wants 16kHz — upsample
    const pcm16k = AudioConverter.upsample8to16(pcm8kData);
    this.ws.send(pcm16k);
  }

  async disconnect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'end' }));
      } catch {}
      this.ws.close();
    }
    this.ws = null;
    this.callbacks = null;
  }
}
