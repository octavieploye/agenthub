import type { PriorOutputs } from '../types/common.types.js';

export function buildHandoff(
  existing: PriorOutputs | undefined,
  update: Partial<PriorOutputs>
): PriorOutputs {
  return {
    competitorMap: update.competitorMap ?? existing?.competitorMap,
    businessProfiles: update.businessProfiles ?? existing?.businessProfiles,
    marketStrategyMap: update.marketStrategyMap ?? existing?.marketStrategyMap,
    marketDynamicsMap: update.marketDynamicsMap ?? existing?.marketDynamicsMap,
  };
}

export type WorkflowStage =
  | 'competitor'
  | 'business'
  | 'market'
  | 'dynamics'
  | 'patterns';

export const STAGE_ORDER: WorkflowStage[] = [
  'competitor',
  'business',
  'market',
  'dynamics',
  'patterns',
];

export function stagesFromEntry(entry: WorkflowStage): WorkflowStage[] {
  const startIndex = STAGE_ORDER.indexOf(entry);
  return STAGE_ORDER.slice(startIndex);
}
