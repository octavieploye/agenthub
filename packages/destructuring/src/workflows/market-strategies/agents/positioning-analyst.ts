import type { LLMMessage } from '../../../types/agent.types.js';
import type { DestructuringSubject } from '../../../types/common.types.js';
import type { MarketSegment, ChannelStrategy, PositioningAnalysis } from '../../../types/market.types.js';
import { PositioningAnalysisSchema } from '../../../schemas/market.schema.js';
import { parseJsonObject } from '../../../utils/json-extract.js';

export const outputSchema = PositioningAnalysisSchema;

export function buildPrompt(
  subject: DestructuringSubject,
  segments: MarketSegment[],
  channels: ChannelStrategy[]
): LLMMessage[] {
  const competitorContext = subject.priorOutputs?.competitorMap
    ? `\nCOMPETITOR MAP (from prior analysis):\n${JSON.stringify(subject.priorOutputs.competitorMap, null, 2)}`
    : '\nNo competitor map available — infer positions from subject description and sector.';

  return [
    {
      role: 'system',
      content: `You are a Positioning Analyst. Your cognitive stance: map where existing players stand on the perceptual battlefield, then locate the white space — the position that no one owns. A good position is not a tagline; it is a structural claim that is both true and hard to copy. Your messaging architecture must make the white space claimable in a single sentence.`,
    },
    {
      role: 'user',
      content: `Analyse the positioning landscape for the following subject.

SUBJECT
Name: ${subject.name}
Description: ${subject.description}
Sector: ${subject.sector}
Geographic base: ${subject.geoBase}
${competitorContext}

SEGMENTS:
${JSON.stringify(segments, null, 2)}

CHANNELS:
${JSON.stringify(channels, null, 2)}

Return as JSON:
{
  "existingPositions": [
    { "competitor": "competitor name", "position": "how they are positioned — their core claim in one sentence" }
  ],
  "whiteSpace": "the position that is unclaimed — specific, structural, and defensible",
  "messagingArchitecture": "a one-sentence message that claims the white space — not a tagline, a structural truth about what makes this different"
}

Map at least 3 existing positions. The white space must be specific — not 'AI-powered' or 'easy to use'.`,
    },
  ];
}

export function parseOutput(raw: string): PositioningAnalysis {
  return parseJsonObject(raw, outputSchema, 'Positioning analyst');
}
