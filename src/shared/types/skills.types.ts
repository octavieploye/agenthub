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
}

export interface SkillExecutionResult {
  skillId: string
  output: string
  exitCode: number
  duration: number
}
