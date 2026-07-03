import { describe, it, expect } from 'vitest';
import { expandRadius, isWithinRadius, ringOrder } from '../utils/geo-radius.js';

describe('ringOrder', () => {
  it('returns all four radii in micro-to-macro order', () => {
    expect(ringOrder()).toEqual(['local', 'national', 'continental', 'worldwide']);
  });
});

describe('expandRadius', () => {
  it('returns only local for local radius', () => {
    const rings = expandRadius('local');
    expect(rings).toHaveLength(1);
    expect(rings[0].radius).toBe('local');
  });

  it('returns local + national for national radius', () => {
    const rings = expandRadius('national');
    expect(rings).toHaveLength(2);
    expect(rings.map((r) => r.radius)).toEqual(['local', 'national']);
  });

  it('returns all four for worldwide radius', () => {
    const rings = expandRadius('worldwide');
    expect(rings).toHaveLength(4);
  });

  it('includes labels for each ring', () => {
    const rings = expandRadius('continental');
    rings.forEach((ring) => {
      expect(ring.label).toBeTruthy();
      expect(typeof ring.label).toBe('string');
    });
  });
});

describe('isWithinRadius', () => {
  it('local is within all radii', () => {
    expect(isWithinRadius('local', 'local')).toBe(true);
    expect(isWithinRadius('local', 'worldwide')).toBe(true);
  });

  it('worldwide is not within local', () => {
    expect(isWithinRadius('worldwide', 'local')).toBe(false);
  });

  it('continental is within worldwide', () => {
    expect(isWithinRadius('continental', 'worldwide')).toBe(true);
  });

  it('continental is not within national', () => {
    expect(isWithinRadius('continental', 'national')).toBe(false);
  });
});
