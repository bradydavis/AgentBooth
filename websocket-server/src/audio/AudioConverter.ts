/**
 * Converts between G.711 mu-law (Twilio) and linear PCM 16-bit LE (Deepgram/ElevenLabs).
 * Twilio streams: 8kHz, mono, mu-law
 * Deepgram expects: 16kHz, mono, PCM16 (we upsample)
 * ElevenLabs outputs: 22050Hz or 44100Hz PCM (we downsample to 8kHz mu-law)
 */
export class AudioConverter {
  private static readonly MULAW_BIAS = 0x84;
  private static readonly MULAW_CLIP = 32635;

  static mulawToPCM(mulawData: Buffer): Buffer {
    const pcm = Buffer.alloc(mulawData.length * 2);
    for (let i = 0; i < mulawData.length; i++) {
      let mulaw = ~mulawData[i] & 0xFF;
      const sign = mulaw & 0x80;
      const exponent = (mulaw >> 4) & 0x07;
      const mantissa = mulaw & 0x0F;
      let sample = ((mantissa << 3) + this.MULAW_BIAS) << exponent;
      sample -= this.MULAW_BIAS;
      if (sign) sample = -sample;
      pcm.writeInt16LE(Math.max(-32768, Math.min(32767, sample)), i * 2);
    }
    return pcm;
  }

  static pcmToMulaw(pcmData: Buffer): Buffer {
    const mulaw = Buffer.alloc(pcmData.length / 2);
    for (let i = 0; i < mulaw.length; i++) {
      let sample = pcmData.readInt16LE(i * 2);
      const sign = sample < 0 ? 0x80 : 0x00;
      if (sign) sample = -sample;
      if (sample > this.MULAW_CLIP) sample = this.MULAW_CLIP;
      sample += this.MULAW_BIAS;
      let exponent = 7;
      for (let exp = 0; exp < 8; exp++) {
        if (sample <= 0xFF << exp) { exponent = exp; break; }
      }
      const mantissa = (sample >> (exponent + 3)) & 0x0F;
      mulaw[i] = ~(sign | (exponent << 4) | mantissa) & 0xFF;
    }
    return mulaw;
  }

  /** Simple nearest-neighbor upsample from 8kHz to 16kHz */
  static upsample8to16(pcm8k: Buffer): Buffer {
    const out = Buffer.alloc(pcm8k.length * 2);
    for (let i = 0; i < pcm8k.length / 2; i++) {
      const sample = pcm8k.readInt16LE(i * 2);
      out.writeInt16LE(sample, i * 4);
      out.writeInt16LE(sample, i * 4 + 2);
    }
    return out;
  }

  /** Simple downsample — drop every other sample */
  static downsampleToMulaw(pcmHighRate: Buffer, inputSampleRate: number): Buffer {
    const ratio = inputSampleRate / 8000;
    const outputSamples = Math.floor(pcmHighRate.length / 2 / ratio);
    const pcm8k = Buffer.alloc(outputSamples * 2);
    for (let i = 0; i < outputSamples; i++) {
      const srcIdx = Math.floor(i * ratio);
      const sample = pcmHighRate.readInt16LE(srcIdx * 2);
      pcm8k.writeInt16LE(sample, i * 2);
    }
    return this.pcmToMulaw(pcm8k);
  }
}
