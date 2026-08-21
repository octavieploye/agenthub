/**
 * Category-based safety gate for orchestrator auto-dispatch.
 * Supervised categories require human presence — never auto-dispatched.
 * Unsupervised categories can run autonomously (e.g., overnight with ollama-cloud).
 */

export const SUPERVISED_CATEGORIES = new Set([
  'backend', 'frontend', 'database', 'schema', 'functionality'
])

export const UNSUPERVISED_CATEGORIES = new Set([
  'marketing', 'research', 'business', 'content'
])

/** Returns true if the category requires human supervision. null/unknown = supervised (safe default). */
export function isSupervisedCategory(category: string | null): boolean {
  if (!category) return true
  return !UNSUPERVISED_CATEGORIES.has(category)
}
