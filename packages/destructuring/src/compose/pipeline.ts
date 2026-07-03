import type { DestructuringSubject, PriorOutputs, PatternExtractionInput } from '../types/common.types.js';
import type { CompetitorMap } from '../types/competitor.types.js';
import type { BusinessProfile } from '../types/business.types.js';
import type { MarketStrategyMap } from '../types/market.types.js';
import type { MarketDynamicsMap } from '../types/dynamics.types.js';
import type { PatternReport } from '../types/patterns.types.js';
import type { LLMProvider } from '../types/agent.types.js';
import { runCompetitorStrategies } from '../workflows/competitor-strategies/index.js';
import { runBusinessStrategies } from '../workflows/business-strategies/index.js';
import { runMarketStrategies } from '../workflows/market-strategies/index.js';
import { runMarketDynamics } from '../workflows/market-dynamics/index.js';
import { runGoodAndBad } from '../workflows/good-and-bad/index.js';
import { buildHandoff, stagesFromEntry } from './handoffs.js';
import type { WorkflowStage } from './handoffs.js';

export interface PipelineResult {
  subject: DestructuringSubject;
  competitorMap?: CompetitorMap;
  businessProfile?: BusinessProfile;
  marketStrategyMap?: MarketStrategyMap;
  marketDynamicsMap?: MarketDynamicsMap;
  completedStages: WorkflowStage[];
}

export async function runFullPipeline(
  subject: DestructuringSubject,
  llm: LLMProvider
): Promise<PipelineResult> {
  return runPartialPipeline(subject, llm, 'competitor');
}

export async function runPartialPipeline(
  subject: DestructuringSubject,
  llm: LLMProvider,
  entryPoint: WorkflowStage
): Promise<PipelineResult> {
  const stages = stagesFromEntry(entryPoint).filter((s) => s !== 'patterns');
  let priorOutputs: PriorOutputs = subject.priorOutputs ?? {};
  const completedStages: WorkflowStage[] = [];

  let competitorMap: CompetitorMap | undefined = priorOutputs.competitorMap;
  let businessProfile: BusinessProfile | undefined = priorOutputs.businessProfiles?.[0];
  let marketStrategyMap: MarketStrategyMap | undefined = priorOutputs.marketStrategyMap;
  let marketDynamicsMap: MarketDynamicsMap | undefined = priorOutputs.marketDynamicsMap;

  for (const stage of stages) {
    const enrichedSubject: DestructuringSubject = { ...subject, priorOutputs };

    switch (stage) {
      case 'competitor': {
        competitorMap = await runCompetitorStrategies(enrichedSubject, llm);
        priorOutputs = buildHandoff(priorOutputs, { competitorMap });
        break;
      }
      case 'business': {
        businessProfile = await runBusinessStrategies(enrichedSubject, llm);
        priorOutputs = buildHandoff(priorOutputs, {
          businessProfiles: [businessProfile],
        });
        break;
      }
      case 'market': {
        marketStrategyMap = await runMarketStrategies(enrichedSubject, llm);
        priorOutputs = buildHandoff(priorOutputs, { marketStrategyMap });
        break;
      }
      case 'dynamics': {
        marketDynamicsMap = await runMarketDynamics(enrichedSubject, llm);
        priorOutputs = buildHandoff(priorOutputs, { marketDynamicsMap });
        break;
      }
    }
    completedStages.push(stage);
  }

  return {
    subject,
    competitorMap,
    businessProfile,
    marketStrategyMap,
    marketDynamicsMap,
    completedStages,
  };
}

export async function runPatternExtraction(
  pipelineResults: PipelineResult[],
  llm: LLMProvider,
  focusQuestion?: string
): Promise<PatternReport> {
  if (pipelineResults.length < 2) {
    throw new Error('Pattern extraction requires at least 2 pipeline results');
  }

  const input: PatternExtractionInput = {
    subjects: pipelineResults.map((r) => r.subject),
    outputs: pipelineResults.map((r) => ({
      competitorMap: r.competitorMap,
      businessProfiles: r.businessProfile ? [r.businessProfile] : undefined,
      marketStrategyMap: r.marketStrategyMap,
      marketDynamicsMap: r.marketDynamicsMap,
    })),
    focusQuestion,
  };

  return runGoodAndBad(input, llm);
}
