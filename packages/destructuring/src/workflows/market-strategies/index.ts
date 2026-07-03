import type { DestructuringSubject } from '../../types/common.types.js';
import type { MarketStrategyMap } from '../../types/market.types.js';
import type { LLMProvider } from '../../types/agent.types.js';
import * as segmentMapper from './agents/segment-mapper.js';
import * as channelStrategist from './agents/channel-strategist.js';
import * as positioningAnalyst from './agents/positioning-analyst.js';
import * as entryStrategist from './agents/entry-strategist.js';

export async function runMarketStrategies(
  subject: DestructuringSubject,
  llm: LLMProvider
): Promise<MarketStrategyMap> {
  // Step 1: Identify addressable segments
  const segmentsRaw = await llm.complete(segmentMapper.buildPrompt(subject));
  const segments = segmentMapper.parseOutput(segmentsRaw);

  // Step 2: Map discovery channels per segment
  const channelsRaw = await llm.complete(channelStrategist.buildPrompt(subject, segments));
  const channels = channelStrategist.parseOutput(channelsRaw);

  // Step 3: Analyse existing positions, find white space, design messaging
  const positioningRaw = await llm.complete(positioningAnalyst.buildPrompt(subject, segments, channels));
  const positioning = positioningAnalyst.parseOutput(positioningRaw);

  // Step 4: Synthesize into ranked go-to-market entry vectors
  const entryRaw = await llm.complete(entryStrategist.buildPrompt(segments, channels, positioning));
  const entryVectors = entryStrategist.parseOutput(entryRaw);

  return {
    subject: subject.name,
    segments,
    channels,
    positioning,
    entryVectors,
  };
}
