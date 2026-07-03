import type { LLMMessage } from '../../../types/agent.types.js';
import type { DestructuringSubject } from '../../../types/common.types.js';
import type { MarketForce } from '../../../types/dynamics.types.js';
import { z } from 'zod/v4';
import { MarketForceSchema } from '../../../schemas/dynamics.schema.js';

export const outputSchema = z.array(MarketForceSchema).min(1);

export function buildPrompt(input: DestructuringSubject): LLMMessage[] {
  const segmentContext = input.priorOutputs?.marketStrategyMap
    ? `\nSEGMENT MAP (from prior analysis):\n${JSON.stringify(input.priorOutputs.marketStrategyMap.segments, null, 2)}`
    : '\nNo segment map available — infer forces from subject description and sector.';

  const competitorContext = input.priorOutputs?.competitorMap
    ? `\nCOMPETITOR MAP (from prior analysis):\n${JSON.stringify(input.priorOutputs.competitorMap, null, 2)}`
    : '';

  return [
    {
      role: 'system',
      content: `You are a Force Analyst. Your cognitive stance: apply a four-force model to map market dynamics. Pull forces draw customers toward the market or specific solutions — identify the desire, the trigger, and the urgency. Friction forces slow adoption or switching — identify what creates inertia and who benefits from it. Competitive forces are players who contest the same demand — map substitutes, not just direct rivals. Amplifier forces accelerate existing trends — regulatory tailwinds, platform dependencies, and network effects that multiply any force in the market. Name the mechanism, not the category. Strength must reflect real structural weight, not perceived importance.`,
    },
    {
      role: 'user',
      content: `Analyse the market forces for the following subject using the four-force model.

SUBJECT
Name: ${input.name}
Description: ${input.description}
Sector: ${input.sector}
Geographic base: ${input.geoBase}
${segmentContext}
${competitorContext}

For each force, return a JSON array:
[{
  "type": "pull | friction | competitive | amplifier",
  "name": "short name for the force",
  "description": "what the force is and how it operates in this market",
  "strength": <integer 1-10, where 10 is market-defining>,
  "affectedSegments": ["segment name 1", "segment name 2"]
}]

Include at least one of each force type. Do not list forces without naming the mechanism — 'network effects' is not a force, 'Discord server creates switching costs for developer communities' is. Return only the JSON array.`,
    },
  ];
}

export function parseOutput(raw: string): MarketForce[] {
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Force analyst output does not contain a JSON array');
  return outputSchema.parse(JSON.parse(jsonMatch[0]));
}
