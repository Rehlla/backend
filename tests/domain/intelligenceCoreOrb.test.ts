import { afterEach, describe, expect, it } from 'vitest';
import { ORB_STATE_META } from '../../src/lib/dahabOrbScene';
import { ORB_STATE_LABEL, type OrbState } from '../../src/components/intelligence-core/types';
import { voiceSupport } from '../../src/components/intelligence-core/VoiceControl';

const STATES: OrbState[] = [
  'idle', 'listening', 'thinking', 'responding', 'action',
  'success', 'warning', 'error', 'confirm', 'alert',
];

describe('Intelligence Core — orb state machine (no motion-only meaning)', () => {
  it('defines all ten states with labels and render tuning', () => {
    for (const s of STATES) {
      expect(ORB_STATE_LABEL[s], `label for ${s}`).toBeTruthy();
      const meta = ORB_STATE_META(s);
      expect(meta.speed, `speed for ${s}`).toBeGreaterThan(0);
      expect(meta.glow, `glow for ${s}`).toBeGreaterThan(0);
    }
  });

  it('error state is calm (no strobe-class speed)', () => {
    // Seizure safety: error must not be the fastest state.
    expect(ORB_STATE_META('error').speed).toBeLessThan(ORB_STATE_META('thinking').speed);
  });
});

describe('Intelligence Core — voice abstraction degrades safely', () => {
  afterEach(() => {
    // jsdom has no SpeechRecognition; support() must report honestly.
    void 0;
  });

  it('reports support flags without throwing', () => {
    const s = voiceSupport();
    expect(typeof s.stt).toBe('boolean');
    expect(typeof s.tts).toBe('boolean');
  });
});
