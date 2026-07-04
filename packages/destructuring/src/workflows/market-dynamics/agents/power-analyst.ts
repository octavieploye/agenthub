import type { LLMMessage } from '../../../types/agent.types.js';
import type { DestructuringSubject } from '../../../types/common.types.js';
import type { MarketForce, EntryBarrier, PowerStructure } from '../../../types/dynamics.types.js';
import { z } from 'zod/v4';
import { PowerStructureSchema } from '../../../schemas/dynamics.schema.js';
import { parseJsonArray } from '../../../utils/json-extract.js';

export const outputSchema = z.array(PowerStructureSchema).min(1);

export function buildPrompt(
  input: DestructuringSubject,
  forces: MarketForce[],
  barriers: EntryBarrier[]
): LLMMessage[] {
  return [
    {
      role: 'system',
      content: `You are a Power Analyst. Your cognitive stance: power in a market is the ability to extract rent without proportional value creation. Map who controls what, through what mechanism, at what concentration level, and what the lock-in looks like. Actors are not limited to companies — platforms, regulatory bodies, standards bodies, and distribution gatekeepers hold structural power. Concentration levels: fragmented means no actor controls more than 15% of value flow; moderate means 1-3 actors have meaningful leverage but contestable; concentrated means one actor dictates terms to most participants; monopolistic means one actor controls access to the market itself. Rent extraction is the specific way power translates into economic capture — licensing fees, platform tax, data monetisation, distribution tax. Lock-in is the mechanism that prevents participants from exiting the power relationship.`,
    },
    {
      role: 'user',
      content: `Analyse the power structure in the following market.

SUBJECT
Name: ${input.name}
Description: ${input.description}
Sector: ${input.sector}
Geographic base: ${input.geoBase}

MARKET FORCES:
${JSON.stringify(forces, null, 2)}

ENTRY BARRIERS:
${JSON.stringify(barriers, null, 2)}

For each power holder, return a JSON array:
[{
  "actor": "specific actor name — platform, company, body, or role",
  "controlMechanism": "what gives them power — access, IP, distribution, regulation, data, standards",
  "concentrationLevel": "fragmented | moderate | concentrated | monopolistic",
  "rentExtraction": "how they extract value from their position — be specific about the mechanism and rate",
  "lockInMechanism": "what prevents participants from exiting this power relationship"
}]

Include at least 2 actors. Name each actor precisely — 'large platforms' is not an actor. Map the full chain from supply to demand, not just the most visible incumbent. Return only the JSON array.`,
    },
  ];
}

export function parseOutput(raw: string): PowerStructure[] {
  return parseJsonArray(raw, outputSchema, 'Power analyst');
}
