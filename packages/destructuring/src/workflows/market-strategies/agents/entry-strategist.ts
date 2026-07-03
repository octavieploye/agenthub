import type { LLMMessage } from '../../../types/agent.types.js';
import type { MarketSegment, ChannelStrategy, PositioningAnalysis, EntryVector } from '../../../types/market.types.js';
import { z } from 'zod/v4';
import { EntryVectorSchema } from '../../../schemas/market.schema.js';

export const outputSchema = z.array(EntryVectorSchema).min(1);

export function buildPrompt(
  segments: MarketSegment[],
  channels: ChannelStrategy[],
  positioning: PositioningAnalysis
): LLMMessage[] {
  return [
    {
      role: 'system',
      content: `You are an Entry Strategist. Your cognitive stance: synthesize segments, channels, and positioning into ranked go-to-market entry vectors. An entry vector is a specific combination of segment + channel + positioning claim + timing that creates the highest probability of initial traction. Rank by expected return vs. risk, not by ambition. The first entry vector should be executable within 30 days with zero paid budget. Each vector must be specific enough to hand to an operator on Monday.`,
    },
    {
      role: 'user',
      content: `Synthesize the following analysis into ranked go-to-market entry vectors.

SEGMENTS:
${JSON.stringify(segments, null, 2)}

CHANNELS:
${JSON.stringify(channels, null, 2)}

POSITIONING:
${JSON.stringify(positioning, null, 2)}

Return a ranked JSON array (highest priority first):
[{
  "name": "entry vector name — short, actionable label",
  "segment": "target segment name",
  "channel": "specific channel to activate",
  "sequencing": "when to execute — 'immediate', 'week 2', 'post-traction', etc.",
  "rationale": "why this combination gives the highest probability of traction at this stage",
  "riskLevel": "low | medium | high"
}]

The first vector must be executable immediately with minimal resources. Include at least 3 vectors. Name risks explicitly — do not hide failure modes.`,
    },
  ];
}

export function parseOutput(raw: string): EntryVector[] {
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Entry strategist output does not contain a JSON array');
  return outputSchema.parse(JSON.parse(jsonMatch[0]));
}
