/**
 * Text-to-Speech client — Smallest.ai Lightning TTS
 * Endpoint: https://waves-api.smallest.ai/api/v1/lightning/get_speech
 * Returns: Raw PCM audio at requested sample_rate (we request 8kHz to match Twilio)
 */

const TTS_URL = 'https://waves-api.smallest.ai/api/v1/lightning/get_speech';
const DEFAULT_VOICE_ID = process.env.SMALLEST_AI_VOICE_ID ?? 'james';

export class SmallestTtsClient {
  /**
   * Streams TTS audio as PCM chunks at 8kHz (matches Twilio's expected rate).
   * The orchestrator will convert PCM → mulaw before sending to Twilio.
   */
  async *textToSpeechStream(text: string): AsyncGenerator<Buffer> {
    const apiKey = process.env.SMALLEST_AI_API_KEY;
    if (!apiKey) throw new Error('[TTS] SMALLEST_AI_API_KEY not set');

    const response = await fetch(TTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        voice_id: DEFAULT_VOICE_ID,
        text,
        sample_rate: 8000,   // Request 8kHz directly — matches Twilio
        add_wav_header: false, // Raw PCM, no WAV header
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      throw new Error(`[TTS] Smallest.ai error: ${response.status} - ${errText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') ?? '';

    console.log(`[TTS] Response: ${buf.byteLength} bytes, type: ${contentType}, first8: ${buf.slice(0, 8).toString('hex')}`);

    if (buf.byteLength < 100) {
      console.error(`[TTS] Tiny response (error?): ${buf.toString('utf8')}`);
      return;
    }

    // Strip WAV header if present
    // Standard WAV: "RIFF" at 0, "WAVE" at 8, "fmt " at 12, "data" at 36, PCM at 44
    if (buf.length > 44 && buf.slice(0, 4).toString('ascii') === 'RIFF') {
      // Search for 'data' sub-chunk starting from offset 12 (skip RIFF+WAVE)
      let pcmStart = 44; // Default standard WAV header size
      for (let i = 12; i < Math.min(buf.length - 8, 128); i++) {
        if (buf[i] === 0x64 && buf[i+1] === 0x61 && buf[i+2] === 0x74 && buf[i+3] === 0x61) {
          // Found 'data' chunk — PCM starts 8 bytes later (4 for 'data' + 4 for size)
          pcmStart = i + 8;
          break;
        }
      }
      console.log(`[TTS] Stripped WAV header (${pcmStart}b), PCM: ${buf.byteLength - pcmStart}b`);
      yield buf.slice(pcmStart);
    } else {
      yield buf; // Already raw PCM
    }
  }
}
