import type { LLMMessage } from '../../../types/agent.types.js';
import type { DestructuringSubject } from '../../../types/common.types.js';
import type { MarketSegment, ChannelStrategy } from '../../../types/market.types.js';
import { z } from 'zod/v4';
import { ChannelStrategySchema } from '../../../schemas/market.schema.js';

export const outputSchema = z.array(ChannelStrategySchema).min(1);

export function buildPrompt(subject: DestructuringSubject, segments: MarketSegment[]): LLMMessage[] {
  return [
    {
      role: 'system',
      content: `You are a Channel Strategist. Your cognitive stance: map discovery channels per segment with a realistic owned/earned/paid mix. Owned channels build long-term leverage but are slow; earned channels are high-trust but unpredictable; paid channels are immediate but expensive. Sequence them correctly — what you do before launch sets up what you can do at launch. Never recommend a channel without naming the exact platform, format, and mechanism by which it reaches the segment.`,
    },
    {
      role: 'user',
      content: `Design a channel strategy for the following subject and segments.

SUBJECT
Name: ${subject.name}
Description: ${subject.description}
Sector: ${subject.sector}
Geographic base: ${subject.geoBase}

SEGMENTS TO SERVE:
${JSON.stringify(segments, null, 2)}

For each channel-segment pair, return a JSON array:
[{
  "channel": "exact platform or mechanism (e.g. 'Twitter/X threads', 'Hacker News Show HN', 'LinkedIn DM outreach', 'Google Ads', 'GitHub README')",
  "type": "owned | earned | paid",
  "segment": "name of the segment this channel serves (must match a segment above)",
  "sequencing": "pre-launch | launch | post-launch",
  "rationale": "why this channel reaches this segment at this phase — name the trust/reach/cost mechanism"
}]

Include a mix of owned, earned, and paid channels. Cover pre-launch, launch, and post-launch phases. Each channel must be specific enough to execute — no generic 'social media' entries.`,
    },
  ];
}

export function parseOutput(raw: string): ChannelStrategy[] {
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Channel strategist output does not contain a JSON array');
  return outputSchema.parse(JSON.parse(jsonMatch[0]));
}
