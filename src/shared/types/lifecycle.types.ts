export interface LayerDistribution {
  layer: string
  total_records: number
  active_records: number
  archived_records: number
  qdrant_vector_count: number | null
  avg_relevance_score: number | null
}

export type LifecycleHealthStatus = 'healthy' | 'warning' | 'critical'

export interface LifecycleMetrics {
  total_records: number
  active_records: number
  archived_records: number
  layers: LayerDistribution[]
  last_cycle_at: string | null
  health_status: LifecycleHealthStatus
  measured_at: string
}

export interface LifecycleHistoryEntry {
  id: string
  status: string
  started_at: string
  completed_at: string | null
  episodic_processed: number
  patterns_promoted: number
  records_decayed: number
  records_archived: number
  error: string | null
}

export interface ArchivedRecord {
  id: string
  original_table: string
  original_id: string
  layer: string
  payload: Record<string, unknown>
  relevance_score: number
  archived_at: string
  archive_reason: string
  provenance: Record<string, unknown> | null
}

export interface ArchivedPage {
  records: ArchivedRecord[]
  total: number
  page: number
  page_size: number
}

export interface PolicyUpdateRequest {
  max_inactive_days?: number
  min_confidence?: number
  min_access_count?: number
  enabled?: boolean
}

export interface PolicyResponse {
  layer: string
  max_inactive_days: number
  min_confidence: number | null
  min_access_count: number
  enabled: boolean
  updated_at: string
}

export interface LifecycleRunResult {
  run_id: string
  status: string
  started_at: string
  completed_at: string | null
  records_archived: number
  shadow_deleted: number | null
  layers_processed: string[] | null
  error: string | null
}

export interface RestoreResult {
  restored_id: string
  original_table: string
  layer: string
  restored_at: string
}
