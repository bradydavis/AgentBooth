import type { WebSocket } from 'ws';

export interface TranscriptLine {
  speaker: 'caller' | 'agent';
  text: string;
  timestamp: number;
}

export interface CallSessionData {
  callId: string;
  boothId: string;
  agentId: string;
  phoneNumber: string;
  context: string;
  webhookUrl?: string;
}

export class CallSession {
  readonly callId: string;
  readonly boothId: string;
  readonly agentId: string;
  readonly phoneNumber: string;
  readonly context: string;
  readonly webhookUrl?: string;
  readonly startedAt: number;

  twilioWs: WebSocket | null = null;
  streamSid: string | null = null;
  isAgentSpeaking = false;
  transcript: TranscriptLine[] = [];

  constructor(data: CallSessionData) {
    this.callId = data.callId;
    this.boothId = data.boothId;
    this.agentId = data.agentId;
    this.phoneNumber = data.phoneNumber;
    this.context = data.context;
    this.webhookUrl = data.webhookUrl;
    this.startedAt = Date.now();
  }

  addTranscript(speaker: 'caller' | 'agent', text: string) {
    this.transcript.push({ speaker, text, timestamp: Date.now() });
  }

  getDurationSeconds(): number {
    return Math.floor((Date.now() - this.startedAt) / 1000);
  }
}
