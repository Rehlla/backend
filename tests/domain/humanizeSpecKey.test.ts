import { describe, it, expect } from 'vitest';
import { humanizeSpecKey } from '../../src/lib/humanizeSpecKey';

describe('humanizeSpecKey', () => {
  it('splits camelCase API keys into readable words', () => {
    expect(humanizeSpecKey('rangeKm')).toBe('Range Km');
    expect(humanizeSpecKey('maxSpeedKmh')).toBe('Max Speed Kmh');
    expect(humanizeSpecKey('batteryCapacityAh')).toBe('Battery Capacity Ah');
  });

  it('normalizes legacy snake_case keys the same way', () => {
    expect(humanizeSpecKey('max_speed_kmh')).toBe('Max speed kmh');
    expect(humanizeSpecKey('frame_material')).toBe('Frame material');
  });

  it('leaves single words intact and capitalizes them', () => {
    expect(humanizeSpecKey('range')).toBe('Range');
    expect(humanizeSpecKey('Range')).toBe('Range');
    expect(humanizeSpecKey('top speed')).toBe('Top speed');
  });

  it('splits before a capital that follows a digit but keeps digits glued to letters', () => {
    expect(humanizeSpecKey('wheelSizeInches')).toBe('Wheel Size Inches');
    expect(humanizeSpecKey('motor250w')).toBe('Motor250w');
  });

  it('trims stray whitespace around the key', () => {
    expect(humanizeSpecKey(' rangeKm ')).toBe('Range Km');
  });
});
