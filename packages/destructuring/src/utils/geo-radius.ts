import type { GeoRadius, GeoRing } from '../types/common.types.js';

const RING_ORDER: GeoRadius[] = ['local', 'national', 'continental', 'worldwide'];

const RING_LABELS: Record<GeoRadius, string> = {
  local: 'Local / city / same-niche direct',
  national: 'Regional / national',
  continental: 'Continental (EU, APAC, etc.)',
  worldwide: 'Worldwide',
};

export function ringOrder(): GeoRadius[] {
  return [...RING_ORDER];
}

export function expandRadius(maxRadius: GeoRadius): GeoRing[] {
  const maxIndex = RING_ORDER.indexOf(maxRadius);
  return RING_ORDER.slice(0, maxIndex + 1).map((radius) => ({
    radius,
    label: RING_LABELS[radius],
  }));
}

export function isWithinRadius(ring: GeoRadius, maxRadius: GeoRadius): boolean {
  return RING_ORDER.indexOf(ring) <= RING_ORDER.indexOf(maxRadius);
}
