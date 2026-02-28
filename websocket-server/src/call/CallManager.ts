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
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKeySid = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid) {
      logger.error('Missing TWILIO_ACCOUNT_SID');
      this.twilioClient = twilio('AC00000000000000000000000000000000', 'auth_token');
    } else if (apiKeySid && apiKeySecret) {
      // API Key auth (preferred)
      logger.info('Twilio: using API Key auth');
      this.twilioClient = twilio(apiKeySid, apiKeySecret, { accountSid });
    } else if (authToken) {
      // Simple auth token fallback
      logger.info('Twilio: using Auth Token auth');
      this.twilioClient = twilio(accountSid, authToken);
    } else {
      logger.error('Missing Twilio auth — set TWILIO_AUTH_TOKEN or TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET');
      this.twilioClient = twilio('AC00000000000000000000000000000000', 'auth_token');
    }
  }

  async initiateCall(opts: InitiateCallOptions) {
    const session = new CallSession(opts);
    this.sessions.set(opts.callId, session);

    const publicUrl = process.env.PUBLIC_URL ?? 'https://localhost:3001';
    // Clean up protocol from URL for wss://
    const wssUrl = publicUrl.replace(/^https?:\/\//, '');
    const twimlUrl = `${publicUrl}/twiml/${opts.callId}`;

    try {
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
        streamUrl: `wss://${wssUrl}/media/${opts.callId}`,
      };
    } catch (error) {
      logger.error('Failed to create Twilio call', error);
      this.sessions.delete(opts.callId);
      throw error;
    }
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
