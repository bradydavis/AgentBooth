import { ElevenLabsClient as ElevenLabs } from 'elevenlabs';

const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? '21m00Tcm4TlvDq8ikWAM';

export class ElevenLabsClient {
  private client: ElevenLabs;

  constructor() {
    this.client = new ElevenLabs({
      apiKey: process.env.ELEVENLABS_API_KEY!,
    });
  }

  /**
   * Returns an async generator of PCM audio chunks (mp3 → raw PCM conversion
   * happens downstream; ElevenLabs streams MP3 by default).
   *
   * For Twilio we need mu-law 8kHz. The AudioConverter handles the conversion.
   */
  async *textToSpeechStream(text: string): AsyncGenerator<Buffer> {
    const audio = await this.client.generate({
      voice: DEFAULT_VOICE_ID,
      text,
      model_id: 'eleven_turbo_v2',
      stream: true,
      output_format: 'pcm_16000', // 16kHz PCM — easier to resample than MP3
    });

    for await (const chunk of audio) {
      if (chunk instanceof Buffer) {
        yield chunk;
      } else if (chunk instanceof Uint8Array) {
        yield Buffer.from(chunk);
      }
    }
  }
}
