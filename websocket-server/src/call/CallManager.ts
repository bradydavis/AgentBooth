import twilio from 'twilio';
import { CallSession } from './CallSession';
import { logger } from '../utils/logger';

interface InitiateCallOptions {
  callId: string;
  boothId: string;
  agentId: string;
  phoneNumber: string;
  context: string;
  webhookUrl?: string;
}

export class CallManager {
  private sessions = new Map<string, CallSession>();
  private twilioClient: twilio.Twilio;

  constructor() {
    this.twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );
  }

  async initiateCall(opts: InitiateCallOptions) {
    const session = new CallSession(opts);
    this.sessions.set(opts.callId, session);

    const publicUrl = process.env.PUBLIC_URL ?? 'https://localhost:3001';
    const twimlUrl = `${publicUrl}/twiml/${opts.callId}`;

    const call = await this.twilioClient.calls.create({
      to: opts.phoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER!,
      url: twimlUrl,
      statusCallback: `${publicUrl}/api/call-status/${opts.callId}`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
    });

    logger.info(`Twilio call created: ${call.sid} for callId: ${opts.callId}`);

    return {
      success: true,
      twilioCallSid: call.sid,
      streamUrl: `${publicUrl.replace('https', 'wss')}/media/${opts.callId}`,
    };
  }

  getSession(callId: string): CallSession | undefined {
    return this.sessions.get(callId);
  }

  removeSession(callId: string) {
    this.sessions.delete(callId);
  }

  activeCallCount(): number {
    return this.sessions.size;
  }
}
