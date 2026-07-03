import type { DestructuringSubject } from '../../types/common.types.js';
import type { MarketDynamicsMap } from '../../types/dynamics.types.js';
import type { LLMProvider } from '../../types/agent.types.js';
import * as forceAnalyst from './agents/force-analyst.js';
import * as barrierMapper from './agents/barrier-mapper.js';
import * as powerAnalyst from './agents/power-analyst.js';
import * as trendExtractor from './agents/trend-extractor.js';

export async function runMarketDynamics(
  subject: DestructuringSubject,
  llm: LLMProvider
): Promise<MarketDynamicsMap> {
  // Step 1: Map market forces (pull/friction/competitive/amplifier)
  const forcesRaw = await llm.complete(forceAnalyst.buildPrompt(subject));
  const forces = forceAnalyst.parseOutput(forcesRaw);

  // Step 2: Map entry barriers by type with severity assessment
  const barriersRaw = await llm.complete(barrierMapper.buildPrompt(subject, forces));
  const barriers = barrierMapper.parseOutput(barriersRaw);

  // Step 3: Analyse power structure — who controls what, concentration, rent extraction, lock-in
  const powerRaw = await llm.complete(powerAnalyst.buildPrompt(subject, forces, barriers));
  const powerStructure = powerAnalyst.parseOutput(powerRaw);

  // Step 4: Extract structural trends 12-36 months with confidence level
  const trendsRaw = await llm.complete(trendExtractor.buildPrompt(subject, forces, barriers, powerStructure));
  const trends = trendExtractor.parseOutput(trendsRaw);

  return {
    subject: subject.name,
    forces,
    barriers,
    powerStructure,
    trends,
  };
}
