import type { IssueSeverity } from '@shared/types/orchestrator.types'

const SEVERITY_PATTERNS: { severity: IssueSeverity; keywords: string[] }[] = [
  {
    severity: 'critical',
    keywords: [
      'vulnerability',
      'injection',
      'data loss',
      'data leak',
      'sovereignty violation',
      'xss',
      'csrf',
      'remote code execution',
      'rce'
    ]
  },
  {
    severity: 'high',
    keywords: [
      'breaking change',
      'api contract',
      'test failure',
      'auth bypass',
      'privilege escalation',
      'race condition'
    ]
  },
  {
    severity: 'medium',
    keywords: [
      'tech debt',
      'performance',
      'missing test',
      'hardcoded',
      'refactor',
      'coupling',
      'todo'
    ]
  },
  {
    severity: 'low',
    keywords: [
      'code style',
      'naming',
      'comment',
      'documentation',
      'optimization',
      'whitespace',
      'formatting'
    ]
  }
]

export function classifyIssueSeverity(description: string, category: string): IssueSeverity {
  const combined = `${description} ${category}`.toLowerCase()

  for (const { severity, keywords } of SEVERITY_PATTERNS) {
    for (const keyword of keywords) {
      if (combined.includes(keyword)) {
        return severity
      }
    }
  }

  return 'medium'
}
