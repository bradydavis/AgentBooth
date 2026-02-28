import { CallSession } from './CallSession';
import { SttClient } from '../integrations/SttClient';
import { SmallestTtsClient } from '../integrations/SmallestTtsClient';
import { LlmClient } from '../integrations/LlmClient';
import { AudioConverter } from '../audio/AudioConverter';
import { redis } from '../utils/redis';
import { logger } from '../utils/logger';

export class CallOrchestrator {
  private stt: SttClient;
  private tts: SmallestTtsClient;
  private llm: LlmClient;

  constructor() {
    this.stt = new SttClient();
    this.tts = new SmallestTtsClient();
    this.llm = new LlmClient();
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

    // Speak an opening greeting immediately on connect
    const greeting = session.context
      ? `Hello! This is Leo. How can I help you today?`
      : `Hello! You've reached AgentBooth. How can I help you?`;
    await this.speakResponse(session, greeting);
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
      // No webhook — use Claude directly for intelligent responses
      try {
        logger.info(`[LLM] Getting Claude response for: "${transcript.slice(0, 50)}..."`);
        const response = await this.llm.getResponse(
          transcript,
          session.transcript,
          session.context
        );
        logger.info(`[LLM] Claude responded: "${response.slice(0, 60)}..."`);
        return response;
      } catch (err) {
        logger.error('[LLM] Claude error', err);
        return "I'm sorry, I had trouble with that. Could you say it again?";
      }
    }

    try {
      const res = await fetch(session.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AgentBooth-Call-Id': session.callId,
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
      let chunkCount = 0;

      // Twilio expects audio in small 20ms chunks (160 bytes at 8kHz mulaw)
      const MULAW_CHUNK_SIZE = 160;

      for await (const pcmChunk of pcmStream) {
        if (!session.twilioWs || session.twilioWs.readyState !== 1) {
          logger.warn('TTS: Twilio WebSocket not ready, stopping');
          break;
        }
        const mulawFull = AudioConverter.pcmToMulaw(pcmChunk);
        chunkCount++;

        // Split into 20ms slices and send each one
        for (let offset = 0; offset < mulawFull.length; offset += MULAW_CHUNK_SIZE) {
          if (!session.twilioWs || session.twilioWs.readyState !== 1) break;
          const slice = mulawFull.slice(offset, offset + MULAW_CHUNK_SIZE);
          session.twilioWs.send(JSON.stringify({
            event: 'media',
            streamSid: session.streamSid,
            media: { payload: slice.toString('base64') },
          }));
        }
      }
      logger.info(`TTS: done speaking "${text.slice(0, 40)}..." (${chunkCount} TTS responses, ${MULAW_CHUNK_SIZE}b chunks)`);
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
