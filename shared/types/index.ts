/** Shared types used across mcp-server, websocket-server, and frontend */

export type UserTier = 'free' | 'pro' | 'team';
export type BoothType = 'free' | 'dedicated';
export type BoothStatus = 'idle' | 'occupied' | 'ringing';
export type CallStatus = 'queued' | 'ringing' | 'in_progress' | 'completed' | 'failed' | 'canceled';

export interface QueueItem {
  callId: string;
  agentId: string;
  phoneNumber: string;
  context: string;
  webhookUrl?: string;
  maxDuration?: number;
  requestedAt: number;
}

export interface BoothState {
  status: BoothStatus;
  currentCallId?: string;
  currentAgent?: string;
  callStartedAt?: number;
  queueSize: number;
}

export interface RedisUpdate {
  type: 'booth_status' | 'queue_update' | 'transcript' | 'call_end';
  boothId: string;
  timestamp: number;
}

export interface TranscriptUpdate extends RedisUpdate {
  type: 'transcript';
  callId: string;
  speaker: 'caller' | 'agent';
  text: string;
  isFinal: boolean;
}

export interface QueueUpdate extends RedisUpdate {
  type: 'queue_update';
  queue: QueueItem[];
  queueLength: number;
}

export interface BoothStatusUpdate extends RedisUpdate {
  type: 'booth_status';
  status: BoothStatus;
  currentCall?: {
    callId: string;
    agentId: string;
    phoneNumber: string;
    durationSeconds: number;
  };
}

/** Agent webhook request (WebSocket server → agent) */
export interface AgentWebhookRequest {
  call_id: string;
  transcript: string;
  is_final: boolean;
  speaker: 'caller' | 'agent';
  timestamp: number;
  conversation_history: Array<{ speaker: 'caller' | 'agent'; text: string; timestamp: number }>;
  context: string;
}

/** Agent webhook response */
export interface AgentWebhookResponse {
  response_text: string;
  end_call?: boolean;
}

/** MCP → WebSocket server: initiate call */
export interface InitiateCallRequest {
  callId: string;
  boothId: string;
  agentId: string;
  phoneNumber: string;
  context: string;
  webhookUrl?: string;
}

export interface InitiateCallResponse {
  success: boolean;
  twilioCallSid?: string;
  streamUrl?: string;
  error?: string;
}
