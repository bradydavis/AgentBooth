import { CallSession } from './CallSession';
import { SttClient } from '../integrations/SttClient';
import { ElevenLabsClient } from '../integrations/ElevenLabsClient';
import { AudioConverter } from '../audio/AudioConverter';
import { redis } from '../utils/redis';
import { logger } from '../utils/logger';

export class CallOrchestrator {
  private stt: SttClient;
  private tts: ElevenLabsClient;

  constructor() {
    this.stt = new SttClient();
    this.tts = new ElevenLabsClient();
  }

  async setupCall(session: CallSession): Promise<void> {
    await this.stt.connect({
      onTranscript: async (text, isFinal) => {
        if (!isFinal || !text.trim()) return;
        await this.handleTranscript(session, text);
      },
      onError: (err) => logger.error('STT error', err),
    });

    logger.info(`Call ${session.callId} pipeline ready`);
  }

  async handleInboundAudio(session: CallSession, mulawBase64: string): Promise<void> {
    if (session.isAgentSpeaking) return;

    const mulawBuf = Buffer.from(mulawBase64, 'base64');
    const pcmBuf = AudioConverter.mulawToPCM(mulawBuf);
    await this.stt.sendAudio(pcmBuf);
  }

  private async handleTranscript(session: CallSession, text: string): Promise<void> {
    session.addTranscript('caller', text);

    await redis.publish(`booth:${session.boothId}:updates`, JSON.stringify({
      type: 'transcript',
      callId: session.callId,
      speaker: 'caller',
      text,
      timestamp: Date.now(),
    }));

    const agentResponse = await this.getAgentResponse(session, text);
    await this.speakResponse(session, agentResponse);
  }

  private async getAgentResponse(session: CallSession, transcript: string): Promise<string> {
    if (!session.webhookUrl) {
      // Default echo response when no webhook configured
      return `I received your message: "${transcript}". How can I help you further?`;
    }

    try {
      const res = await fetch(session.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PhoneBooth-Call-Id': session.callId,
        },
        body: JSON.stringify({
          call_id: session.callId,
          transcript,
          is_final: true,
          speaker: 'caller',
          conversation_history: session.transcript,
          context: session.context,
        }),
        signal: AbortSignal.timeout(5000),
      });

      const data = await res.json() as { response_text: string; end_call?: boolean };
      return data.response_text;
    } catch (err) {
      logger.error('Agent webhook failed', err);
      return "I'm sorry, I had trouble processing that. Could you repeat?";
    }
  }

  private async speakResponse(session: CallSession, text: string): Promise<void> {
    session.isAgentSpeaking = true;
    session.addTranscript('agent', text);

    await redis.publish(`booth:${session.boothId}:updates`, JSON.stringify({
      type: 'transcript',
      callId: session.callId,
      speaker: 'agent',
      text,
      timestamp: Date.now(),
    }));

    try {
      const pcmStream = this.tts.textToSpeechStream(text);

      for await (const pcmChunk of pcmStream) {
        if (!session.twilioWs || session.twilioWs.readyState !== 1) break;
        const mulawChunk = AudioConverter.pcmToMulaw(pcmChunk);
        session.twilioWs.send(JSON.stringify({
          event: 'media',
          streamSid: session.streamSid,
          media: { payload: mulawChunk.toString('base64') },
        }));
      }
    } catch (err) {
      logger.error('TTS error', err);
    } finally {
      session.isAgentSpeaking = false;
    }
  }

  async teardown(): Promise<void> {
    await this.stt.disconnect();
  }
}
