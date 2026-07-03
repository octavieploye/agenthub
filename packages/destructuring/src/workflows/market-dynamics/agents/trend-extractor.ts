import type { LLMMessage } from '../../../types/agent.types.js';
import type { DestructuringSubject } from '../../../types/common.types.js';
import type { MarketForce, EntryBarrier, PowerStructure, TrendVector } from '../../../types/dynamics.types.js';
import { z } from 'zod/v4';
import { TrendVectorSchema } from '../../../schemas/dynamics.schema.js';

export const outputSchema = z.array(TrendVectorSchema).min(1);

export function buildPrompt(
  input: DestructuringSubject,
  forces: MarketForce[],
  barriers: EntryBarrier[],
  powerStructure: PowerStructure[]
): LLMMessage[] {
  return [
    {
      role: 'system',
      content: `You are a Trend Extractor. Your cognitive stance: structural trends are directional shifts in markets that are already underway — not predictions, not speculation. A trend has a time horizon (12, 24, or 36 months), a direction (growing, stable, declining, or volatile), a measurable impact on the market being analysed, and a confidence level grounded in evidence. Growing means the trend is gaining momentum and will reshape the market. Stable means it is present but not accelerating. Declining means it is reversing. Volatile means direction is unclear and depends on external resolution events (regulation, technology breakthrough, geopolitical event). Confidence is high when the trend is backed by observable data; medium when directional but contested; low when speculative or dependent on contingent events. Do not extrapolate from noise. Do not name trends as forces — forces are structural; trends are directional shifts over time.`,
    },
    {
      role: 'user',
      content: `Extract structural trends for the following market over a 12-36 month horizon.

SUBJECT
Name: ${input.name}
Description: ${input.description}
Sector: ${input.sector}
Geographic base: ${input.geoBase}

MARKET FORCES:
${JSON.stringify(forces, null, 2)}

ENTRY BARRIERS:
${JSON.stringify(barriers, null, 2)}

POWER STRUCTURE:
${JSON.stringify(powerStructure, null, 2)}

For each structural trend, return a JSON array:
[{
  "name": "trend name — concise, specific",
  "direction": "growing | stable | declining | volatile",
  "timeHorizon": "12mo | 24mo | 36mo",
  "impact": "how this trend reshapes market forces, barriers, or power structures named above",
  "confidence": "high | medium | low"
}]

Include at least 3 trends spanning different time horizons. Each trend must be traceable to evidence in the market, sector, or geographic base provided. Name the impact in terms of what changes in the market as a result — not just that the trend exists. Return only the JSON array.`,
    },
  ];
}

export function parseOutput(raw: string): TrendVector[] {
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Trend extractor output does not contain a JSON array');
  return outputSchema.parse(JSON.parse(jsonMatch[0]));
}
