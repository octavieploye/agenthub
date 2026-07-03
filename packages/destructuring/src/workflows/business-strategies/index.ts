import type { DestructuringSubject } from '../../types/common.types.js';
import type { BusinessProfile } from '../../types/business.types.js';
import type { LLMProvider } from '../../types/agent.types.js';
import * as marketPositioner from './agents/market-positioner.js';
import * as offerArchitect from './agents/offer-architect.js';
import * as acquisitionAnalyst from './agents/acquisition-analyst.js';
import * as unitEconomist from './agents/unit-economist.js';
import * as monetizationArchitect from './agents/monetization-architect.js';

export async function runBusinessStrategies(
  subject: DestructuringSubject,
  llm: LLMProvider
): Promise<BusinessProfile> {
  const positionRaw = await llm.complete(marketPositioner.buildPrompt(subject));
  const position = marketPositioner.parseOutput(positionRaw);

  const tiersRaw = await llm.complete(offerArchitect.buildPrompt(subject, position));
  const tiers = offerArchitect.parseOutput(tiersRaw);

  const channelsRaw = await llm.complete(acquisitionAnalyst.buildPrompt(subject, tiers));
  const channels = acquisitionAnalyst.parseOutput(channelsRaw);

  const economicsRaw = await llm.complete(unitEconomist.buildPrompt(tiers, channels));
  const economics = unitEconomist.parseOutput(economicsRaw);

  const monetizationRaw = await llm.complete(monetizationArchitect.buildPrompt(tiers, economics));
  const monetization = monetizationArchitect.parseOutput(monetizationRaw);

  return {
    subject: subject.name,
    position,
    offerTiers: tiers,
    acquisitionChannels: channels,
    unitEconomics: economics,
    monetization,
  };
}
