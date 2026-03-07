export interface SkillItem {
  id: string
  name: string
  description: string
  category: string
  path: string
  source: 'global' | 'project'
  format?: string
}

export interface SkillExecutionResult {
  skillId: string
  output: string
  exitCode: number
  duration: number
}
