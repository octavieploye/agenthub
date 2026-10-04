/** Shared-brain decisions and project status as read from Anamnesis (dependency-free: main + renderer). */

export type DecisionDomain =
  | 'code'
  | 'business'
  | 'marketing'
  | 'strategy'
  | 'client'
  | 'legal'
  | 'operations'

export type DecisionStatus =
  | 'draft'
  | 'pending'
  | 'in_progress'
  | 'done'
  | 'rejected'
  | 'cancelled'
  | 'superseded'

/** One row of Anamnesis `GET /decisions` (snake_case as sent on the wire). */
export interface DecisionItem {
  id: string
  project_id: string
  domain: DecisionDomain
  title: string
  summary: string | null
  rationale: string | null
  status: DecisionStatus
  owner_entity: string
  decided_by: string | null
  created_at: string
  updated_at: string
  decided_at: string | null
  supersedes_id: string | null
  ethical_review_id: string | null
}

/** One row of Anamnesis `GET /projects/{id}/status`. */
export interface ProjectStatusItem {
  project_id: string
  domain: DecisionDomain
  state: string
  summary: string | null
  updated_by: string | null
  updated_at: string
}

/** Project identity resolved by name from Anamnesis `GET /projects/{name}`. */
export interface ProjectRef {
  id: string
  name: string
  tier: string
}

/** `ProjectRef.tier` of a project that is archived: it has no live decisions to show. */
export const ARCHIVE_TIER = 'archive'

/** Outcome of loading a repo's decisions: data, or the reason there is none. */
export type DecisionsResult =
  | { state: 'ok'; decisions: DecisionItem[]; statuses: ProjectStatusItem[] }
  | { state: 'standalone' | 'maintenance' | 'unauthorized' | 'unavailable' }

/** User-facing label for each decision status. */
export const DECISION_STATUS_LABELS: Record<DecisionStatus, string> = {
  draft: 'Draft',
  pending: 'Needs more data',
  in_progress: 'In progress',
  done: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  superseded: 'Replaced'
}
