import type { DestructuringSubject } from '../../types/common.types.js';
import type { CompetitorMap } from '../../types/competitor.types.js';
import type { LLMProvider } from '../../types/agent.types.js';
import { expandRadius } from '../../utils/geo-radius.js';
import * as competitorScanner from './agents/competitor-scanner.js';
import * as strategyExtractor from './agents/strategy-extractor.js';
import * as weaknessMapper from './agents/weakness-mapper.js';

export async function runCompetitorStrategies(
  subject: DestructuringSubject,
  llm: LLMProvider
): Promise<CompetitorMap> {
  // Step 1: Scan for competitors by geographic ring
  const scanPrompt = competitorScanner.buildPrompt(subject);
  const scanRaw = await llm.complete(scanPrompt);
  const cards = competitorScanner.parseOutput(scanRaw);

  // Step 2: Extract detailed strategies for each competitor
  const extractPrompt = strategyExtractor.buildPrompt(cards);
  const extractRaw = await llm.complete(extractPrompt);
  const profiles = strategyExtractor.parseOutput(extractRaw);

  // Step 3: Deep-dive into weaknesses
  const weaknessPrompt = weaknessMapper.buildPrompt(profiles);
  const weaknessRaw = await llm.complete(weaknessPrompt);
  const enrichedProfiles = weaknessMapper.parseOutput(weaknessRaw);

  // Organize by ring
  const rings = expandRadius(subject.geoRadius);
  const ringResults = rings.map((ring) => ({
    radius: ring.radius,
    label: ring.label,
    competitors: enrichedProfiles.filter((p) => p.geoRing === ring.radius),
  }));

  return {
    subject: subject.name,
    geoBase: subject.geoBase,
    rings: ringResults,
    totalCompetitors: enrichedProfiles.length,
  };
}
