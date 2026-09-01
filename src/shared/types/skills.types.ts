export interface SkillManifest {
  version: number
  domain: string
  type: 'skill' | 'team' | 'workflow' | 'command'
  complexity: 'simple' | 'moderate' | 'complex'
  securitySensitive: boolean
  triggers: Array<{ pattern: string; weight: number }>
  resources: {
    minContextWindow: number
    estimatedTokens: number
    preferredTier: 'frontier' | 'expert' | 'capable' | 'efficient'
  }
  requires: string[]
  produces: string[]
  composableWith: string[]
  targetRepos: string[]
  targetDomains: string[]
}

export interface SkillItem {
  id: string
  name: string
  displayName?: string
  description: string
  category: string
  path: string
  source: 'project' | 'team' | 'workflow' | 'command'
  origin: 'project' | 'agenthub'
  format?: string
  command?: string
  manifest?: SkillManifest
}

export interface SkillExecutionResult {
  skillId: string
  output: string
  exitCode: number
  duration: number
}
