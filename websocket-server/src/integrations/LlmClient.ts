/**
 * LLM Client — Anthropic Claude for real-time voice conversations
 * Uses claude-3-5-haiku for lowest latency (critical for voice UX)
 */

import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_SYSTEM = `You are a helpful AI assistant speaking on a phone call via AgentBooth.
Keep responses SHORT and conversational — 1-3 sentences max.
Do not use markdown, bullet points, or formatting. Speak naturally.
You are on a real phone call, so be warm, clear, and concise.`;

export class LlmClient {
  private client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('[LLM] ANTHROPIC_API_KEY not set');
    this.client = new Anthropic({ apiKey });
  }

  async getResponse(
    transcript: string,
    history: Array<{ speaker: string; text: string }>,
    context?: string
  ): Promise<string> {
    const systemPrompt = context
      ? `${context}\n\n${DEFAULT_SYSTEM}`
      : DEFAULT_SYSTEM;

    // Convert call history to Anthropic message format
    const messages: Anthropic.MessageParam[] = history
      .slice(-10) // Keep last 10 turns to avoid token bloat
      .map((turn) => ({
        role: turn.speaker === 'caller' ? 'user' : 'assistant',
        content: turn.text,
      }));

    // Make sure the last message is from the caller
    if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
      messages.push({ role: 'user', content: transcript });
    }

    const response = await this.client.messages.create({
      model: 'claude-3-5-haiku-20241022', // Fastest Claude — best for real-time voice
      max_tokens: 150,                     // Keep it short for voice
      system: systemPrompt,
      messages,
    });

    const text = response.content[0];
    if (text.type !== 'text') throw new Error('[LLM] Unexpected response type');

    return text.text.trim();
  }
}
