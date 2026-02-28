# AgentBooth - Voice Pipeline

## Agent Assignment
**Agent 6: Voice Pipeline**

## Overview
Implement the complete voice pipeline connecting Twilio, Deepgram, and ElevenLabs with proper audio format handling.

## Integration Details

### Twilio Media Streams
- **Format**: mulaw, 8kHz, mono
- **Protocol**: WebSocket with JSON messages
- **Chunks**: 20ms audio frames

### Deepgram Streaming API
- **Format**: PCM linear16, 8kHz, mono
- **Protocol**: WebSocket
- **Features**: Real-time transcription, VAD, interim results

### ElevenLabs TTS
- **Format**: PCM linear16, 24kHz, mono (downsample to 8kHz)
- **Protocol**: WebSocket or REST
- **Features**: Streaming, low latency

## Complete Audio Flow

```typescript
// Inbound: User speaks
Twilio (mulaw 8kHz) 
  → decode base64
  → convert mulaw to PCM
  → Deepgram (PCM 8kHz)
  → transcript
  → Agent (LLM)

// Outbound: Agent responds
Agent (text)
  → ElevenLabs (PCM 24kHz)
  → resample to 8kHz
  → convert PCM to mulaw
  → encode base64
  → Twilio
```

## Implementation

```typescript
// Full voice pipeline
export class VoicePipeline {
  async processInbound(mulawBase64: string): Promise<void> {
    const mulawBuffer = Buffer.from(mulawBase64, 'base64');
    const pcmBuffer = AudioConverter.mulawToPCM(mulawBuffer);
    await this.deepgram.send(pcmBuffer);
  }
  
  async processOutbound(text: string): Promise<AsyncIterable<Buffer>> {
    const audioStream = await this.elevenlabs.textToSpeech(text);
    
    for await (const pcmChunk24k of audioStream) {
      const pcmChunk8k = this.resample(pcmChunk24k, 24000, 8000);
      const mulawChunk = AudioConverter.pcmToMulaw(pcmChunk8k);
      yield mulawChunk;
    }
  }
}
```

## Audio Resampling

```typescript
export function resample(input: Buffer, fromRate: number, toRate: number): Buffer {
  const ratio = toRate / fromRate;
  const outputLength = Math.floor(input.length * ratio / 2) * 2;
  const output = Buffer.alloc(outputLength);
  
  for (let i = 0; i < outputLength; i += 2) {
    const srcIdx = Math.floor(i / ratio);
    if (srcIdx < input.length - 1) {
      output.writeInt16LE(input.readInt16LE(srcIdx), i);
    }
  }
  
  return output;
}
```

## Acceptance Criteria

- ✅ Twilio WebSocket integration
- ✅ Deepgram streaming STT
- ✅ ElevenLabs streaming TTS
- ✅ Audio format conversions working
- ✅ Latency < 2 seconds end-to-end
