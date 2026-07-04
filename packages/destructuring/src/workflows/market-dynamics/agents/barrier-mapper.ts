import type { LLMMessage } from '../../../types/agent.types.js';
import type { DestructuringSubject } from '../../../types/common.types.js';
import type { MarketForce, EntryBarrier } from '../../../types/dynamics.types.js';
import { z } from 'zod/v4';
import { EntryBarrierSchema } from '../../../schemas/dynamics.schema.js';
import { parseJsonArray } from '../../../utils/json-extract.js';

export const outputSchema = z.array(EntryBarrierSchema).min(1);

export function buildPrompt(input: DestructuringSubject, forces: MarketForce[]): LLMMessage[] {
  return [
    {
      role: 'system',
      content: `You are a Barrier Mapper. Your cognitive stance: entry barriers are structural advantages held by incumbents that new entrants must overcome. Regulatory barriers are permission-based — licenses, compliance requirements, accreditations. Capital barriers are resource-based — infrastructure cost, inventory, R&D threshold. Network-effects barriers grow with user count — the incumbent's network makes the market less contestable over time. Switching-cost barriers are habit and integration-based — data lock-in, workflow dependency, retraining friction. Brand barriers are perception-based — trust built over time that cannot be purchased quickly. Technology barriers are capability-based — proprietary IP, algorithm advantage, proprietary data sets. Severity must reflect real contestability: 'prohibitive' means no realistic path for a new entrant without a structural asymmetry. Do not conflate competition with barriers.`,
    },
    {
      role: 'user',
      content: `Map entry barriers for the following subject and market forces.

SUBJECT
Name: ${input.name}
Description: ${input.description}
Sector: ${input.sector}
Geographic base: ${input.geoBase}

MARKET FORCES:
${JSON.stringify(forces, null, 2)}

For each entry barrier, return a JSON array:
[{
  "type": "regulatory | capital | network-effects | switching-costs | brand | technology",
  "description": "what the barrier is and how it operates — name the specific mechanism",
  "severity": "low | medium | high | prohibitive",
  "affectedEntrants": "which type of new entrant faces this barrier most acutely"
}]

Cover at least 3 different barrier types. For each barrier, name who holds the advantage and why a new entrant cannot replicate it quickly. Return only the JSON array.`,
    },
  ];
}

export function parseOutput(raw: string): EntryBarrier[] {
  return parseJsonArray(raw, outputSchema, 'Barrier mapper');
}
