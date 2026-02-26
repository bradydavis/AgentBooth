/**
 * Speech-to-Text client interface.
 *
 * CURRENT STATE: Stub implementation — Deepgram credentials not yet available.
 * When Deepgram access is obtained, replace the stub body of DeepgramSttClient
 * with the real @deepgram/sdk implementation while keeping the SttClient interface.
 *
 * The real implementation should:
 * - Connect to wss://api.deepgram.com/v1/listen with params:
 *   encoding=linear16, sample_rate=16000, channels=1, interim_results=true
 * - Stream sendAudio() PCM chunks to the Deepgram WebSocket
 * - Parse transcript results and call onTranscript callback
 */

export interface SttCallbacks {
  onTranscript: (text: string, isFinal: boolean) => void | Promise<void>;
  onError: (err: Error) => void;
}

export interface SttClient {
  connect(callbacks: SttCallbacks): Promise<void>;
  sendAudio(pcmData: Buffer): Promise<void>;
  disconnect(): Promise<void>;
}

/** Stub — logs inbound audio, returns simulated transcript after 3s of silence */
export class SttClient implements SttClient {
  private callbacks: SttCallbacks | null = null;
  private silenceTimer: NodeJS.Timeout | null = null;
  private audioChunkCount = 0;

  async connect(callbacks: SttCallbacks): Promise<void> {
    this.callbacks = callbacks;
    console.warn(
      '[STT] Using stub implementation — Deepgram not configured. ' +
      'Set DEEPGRAM_API_KEY to enable real transcription.'
    );
  }

  async sendAudio(pcmData: Buffer): Promise<void> {
    this.audioChunkCount++;

    // Simulate transcript every ~3s of audio (8kHz mono PCM = 16000 bytes/s)
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(async () => {
      if (this.callbacks && this.audioChunkCount > 0) {
        this.audioChunkCount = 0;
        await this.callbacks.onTranscript('Hello, this is a test transcript.', true);
      }
    }, 3000);
  }

  async disconnect(): Promise<void> {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.callbacks = null;
  }
}
