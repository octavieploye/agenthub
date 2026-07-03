import type { LLMMessage } from '../../../types/agent.types.js';
import type { PatternExtractionInput } from '../../../types/common.types.js';
import type { ExtractedPattern, PatternReport } from '../../../types/patterns.types.js';
import { z } from 'zod/v4';

const SynthesisOutputSchema = z.object({
  blindSpots: z.array(z.string()),
  synthesis: z.string().min(1),
});

export const outputSchema = SynthesisOutputSchema;

export function buildPrompt(
  input: PatternExtractionInput,
  goodPatterns: ExtractedPattern[],
  badPatterns: ExtractedPattern[],
  neutralPatterns: ExtractedPattern[]
): LLMMessage[] {
  const focusSection = input.focusQuestion
    ? `\nFOCUS QUESTION: ${input.focusQuestion}`
    : '';

  return [
    {
      role: 'system',
      content: `You are a Synthesis Writer. Your cognitive stance: synthesis is not summary. Do not list what the analysts found — explain what it means together. The pattern landscape is a system: good patterns enable each other, bad patterns reinforce each other, neutral patterns are terrain. Blind spots are as important as findings — what is absent across all subjects is a signal too. Name what is structurally missing, what no one in the space is doing, and why. The synthesis must read as insight, not inventory.`,
    },
    {
      role: 'user',
      content: `Write a synthesis of the pattern analysis across ${input.subjects.length} subjects.${focusSection}

SUBJECTS:
${input.subjects.map((s) => `- ${s.name} (${s.sector}, ${s.geoBase})`).join('\n')}

GOOD PATTERNS (${goodPatterns.length}):
${JSON.stringify(goodPatterns, null, 2)}

BAD PATTERNS (${badPatterns.length}):
${JSON.stringify(badPatterns, null, 2)}

NEUTRAL/CONTEXT-DEPENDENT PATTERNS (${neutralPatterns.length}):
${JSON.stringify(neutralPatterns, null, 2)}

Return a JSON object:
{
  "blindSpots": [
    "what is absent across all subjects that represents a structural gap or opportunity",
    "another missing pattern worth naming"
  ],
  "synthesis": "3-5 sentence narrative that explains what the pattern landscape means as a whole — not a list, a coherent analytical statement about the space these subjects compete in"
}

blindSpots must name specific strategic or structural absences — not generic observations. synthesis must be analytical prose, not bullet points. Return only the JSON object.`,
    },
  ];
}

export function parseOutput(
  raw: string,
  input: PatternExtractionInput,
  goodPatterns: ExtractedPattern[],
  badPatterns: ExtractedPattern[],
  neutralPatterns: ExtractedPattern[]
): PatternReport {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Synthesis writer output does not contain a JSON object');

  const parsed = outputSchema.parse(JSON.parse(jsonMatch[0]));

  return {
    focusQuestion: input.focusQuestion,
    subjectCount: input.subjects.length,
    goodPatterns,
    badPatterns,
    neutralPatterns,
    blindSpots: parsed.blindSpots,
    synthesis: parsed.synthesis,
  };
}
