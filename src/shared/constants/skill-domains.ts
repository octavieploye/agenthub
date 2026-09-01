export const SKILL_DOMAINS = {
  'code-dev':           { label: 'Code Development' },
  'code-quality':       { label: 'Code Quality' },
  'devops':             { label: 'DevOps & Production' },
  'security':           { label: 'Security' },
  'legal':              { label: 'Legal Review' },
  'business-research':  { label: 'Business Research' },
  'business-venture':   { label: 'Business Venture' },
  'market-intel':       { label: 'Market Intelligence' },
  'content-voice':      { label: 'Content & Voice' },
  'ai-engineering':     { label: 'AI Engineering' },
  'memory':             { label: 'Memory & Knowledge' },
  'teams':              { label: 'Teams' },
  'workflows':          { label: 'Workflows' },
} as const

export type SkillDomain = keyof typeof SKILL_DOMAINS
