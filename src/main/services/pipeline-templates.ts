// ─── Pipeline Template Types ──────────────────────────────────────────────

export interface PipelinePhase {
  id: string
  skillId: string
  role: string
  modelTier: 'frontier' | 'expert' | 'capable' | 'efficient'
  dependsOn: string[]
  requiresApproval: boolean
}

export interface PipelineTemplate {
  id: string
  name: string
  triggers: Array<{ domain: string; complexity: 'simple' | 'moderate' | 'complex' }>
  phases: PipelinePhase[]
  estimatedTokens: number
  securityGated: boolean
}

// ─── Static Templates ─────────────────────────────────────────────────────

export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    id: 'dev-simple',
    name: 'Dev — Simple',
    triggers: [{ domain: 'code-dev', complexity: 'simple' }],
    phases: [
      {
        id: 'impl',
        skillId: 'team-dev-loop',
        role: 'Implementation',
        modelTier: 'capable',
        dependsOn: [],
        requiresApproval: false,
      },
      {
        id: 'review',
        skillId: 'test-integrity-review',
        role: 'Review',
        modelTier: 'capable',
        dependsOn: ['impl'],
        requiresApproval: false,
      },
    ],
    estimatedTokens: 30000,
    securityGated: false,
  },

  {
    id: 'dev-standard',
    name: 'Dev — Standard',
    triggers: [{ domain: 'code-dev', complexity: 'moderate' }],
    phases: [
      {
        id: 'impl',
        skillId: 'team-dev-loop',
        role: 'Implementation',
        modelTier: 'expert',
        dependsOn: [],
        requiresApproval: false,
      },
      {
        id: 'review',
        skillId: 'full-code-review',
        role: 'Review',
        modelTier: 'expert',
        dependsOn: ['impl'],
        requiresApproval: true,
      },
      {
        id: 'commit',
        skillId: 'git-commit',
        role: 'Commit',
        modelTier: 'capable',
        dependsOn: ['review'],
        requiresApproval: false,
      },
    ],
    estimatedTokens: 70000,
    securityGated: false,
  },

  {
    id: 'dev-complex',
    name: 'Dev — Complex',
    triggers: [{ domain: 'code-dev', complexity: 'complex' }],
    phases: [
      {
        id: 'plan',
        skillId: 'team-impl-lead',
        role: 'Planning',
        modelTier: 'frontier',
        dependsOn: [],
        requiresApproval: false,
      },
      {
        id: 'impl',
        skillId: 'team-dev-loop',
        role: 'Implementation',
        modelTier: 'frontier',
        dependsOn: ['plan'],
        requiresApproval: false,
      },
      {
        id: 'review',
        skillId: 'full-code-review',
        role: 'Review',
        modelTier: 'frontier',
        dependsOn: ['impl'],
        requiresApproval: true,
      },
      {
        id: 'commit',
        skillId: 'git-commit',
        role: 'Commit',
        modelTier: 'capable',
        dependsOn: ['review'],
        requiresApproval: false,
      },
    ],
    estimatedTokens: 160000,
    securityGated: false,
  },

  {
    id: 'security-audit',
    name: 'Security Audit',
    triggers: [
      { domain: 'security', complexity: 'simple' },
      { domain: 'security', complexity: 'moderate' },
      { domain: 'security', complexity: 'complex' },
    ],
    phases: [
      {
        id: 'audit',
        skillId: 'team-threat-defense',
        role: 'Threat Audit',
        modelTier: 'frontier',
        dependsOn: [],
        requiresApproval: true,
      },
      {
        id: 'insider',
        skillId: 'sec-insider-threat',
        role: 'Insider Threat Review',
        modelTier: 'expert',
        dependsOn: ['audit'],
        requiresApproval: false,
      },
      {
        id: 'commit',
        skillId: 'git-commit',
        role: 'Commit',
        modelTier: 'capable',
        dependsOn: ['insider'],
        requiresApproval: false,
      },
    ],
    estimatedTokens: 90000,
    securityGated: true,
  },

  {
    id: 'business-research',
    name: 'Business Research',
    triggers: [
      { domain: 'business-research', complexity: 'simple' },
      { domain: 'business-research', complexity: 'moderate' },
      { domain: 'business-research', complexity: 'complex' },
    ],
    phases: [
      {
        id: 'research',
        skillId: 'team-business',
        role: 'Research',
        modelTier: 'expert',
        dependsOn: [],
        requiresApproval: false,
      },
      {
        id: 'strategy',
        skillId: 'external-source-to-strategy',
        role: 'Strategy Synthesis',
        modelTier: 'capable',
        dependsOn: ['research'],
        requiresApproval: false,
      },
    ],
    estimatedTokens: 50000,
    securityGated: false,
  },

  {
    id: 'brainstorm-to-ship',
    name: 'Brainstorm to Ship',
    triggers: [{ domain: 'content-voice', complexity: 'complex' }],
    phases: [
      {
        id: 'brainstorm',
        skillId: 'team-brainstorm',
        role: 'Brainstorm',
        modelTier: 'expert',
        dependsOn: [],
        requiresApproval: false,
      },
      {
        id: 'sprint',
        skillId: 'team-sprint-planner',
        role: 'Sprint Planning',
        modelTier: 'frontier',
        dependsOn: ['brainstorm'],
        requiresApproval: true,
      },
      {
        id: 'impl',
        skillId: 'team-dev-loop',
        role: 'Implementation',
        modelTier: 'expert',
        dependsOn: ['sprint'],
        requiresApproval: false,
      },
    ],
    estimatedTokens: 120000,
    securityGated: false,
  },

  {
    id: 'market-intel',
    name: 'Market Intelligence',
    triggers: [
      { domain: 'market-intel', complexity: 'simple' },
      { domain: 'market-intel', complexity: 'moderate' },
      { domain: 'market-intel', complexity: 'complex' },
    ],
    phases: [
      {
        id: 'research',
        skillId: 'team-business',
        role: 'Research',
        modelTier: 'expert',
        dependsOn: [],
        requiresApproval: false,
      },
      {
        id: 'analysis',
        skillId: 'team-stats',
        role: 'Statistical Analysis',
        modelTier: 'expert',
        dependsOn: ['research'],
        requiresApproval: false,
      },
    ],
    estimatedTokens: 60000,
    securityGated: false,
  },

  {
    id: 'content',
    name: 'Content Production',
    triggers: [
      { domain: 'content-voice', complexity: 'simple' },
      { domain: 'content-voice', complexity: 'moderate' },
    ],
    phases: [
      {
        id: 'write',
        skillId: 'team-content-engine',
        role: 'Content Writing',
        modelTier: 'capable',
        dependsOn: [],
        requiresApproval: false,
      },
    ],
    estimatedTokens: 25000,
    securityGated: false,
  },

  {
    id: 'legal-review',
    name: 'Legal Review',
    triggers: [
      { domain: 'legal', complexity: 'simple' },
      { domain: 'legal', complexity: 'moderate' },
      { domain: 'legal', complexity: 'complex' },
    ],
    phases: [
      {
        id: 'legal',
        skillId: 'team-legal-guardian',
        role: 'Legal Review',
        modelTier: 'frontier',
        dependsOn: [],
        requiresApproval: true,
      },
    ],
    estimatedTokens: 80000,
    securityGated: true,
  },

  {
    id: 'full-review',
    name: 'Full Code Review',
    triggers: [
      { domain: 'code-quality', complexity: 'simple' },
      { domain: 'code-quality', complexity: 'moderate' },
      { domain: 'code-quality', complexity: 'complex' },
    ],
    phases: [
      {
        id: 'review',
        skillId: 'full-code-review',
        role: 'Code Review',
        modelTier: 'frontier',
        dependsOn: [],
        requiresApproval: true,
      },
      {
        id: 'sec',
        skillId: 'team-threat-defense',
        role: 'Security Scan',
        modelTier: 'expert',
        dependsOn: ['review'],
        requiresApproval: false,
      },
      {
        id: 'commit',
        skillId: 'git-commit',
        role: 'Commit',
        modelTier: 'capable',
        dependsOn: ['sec'],
        requiresApproval: false,
      },
    ],
    estimatedTokens: 100000,
    securityGated: true,
  },

  {
    id: 'ai-engineering',
    name: 'AI Engineering',
    triggers: [
      { domain: 'ai-engineering', complexity: 'simple' },
      { domain: 'ai-engineering', complexity: 'moderate' },
      { domain: 'ai-engineering', complexity: 'complex' },
    ],
    phases: [
      {
        id: 'impl',
        skillId: 'team-dev-loop',
        role: 'Implementation',
        modelTier: 'expert',
        dependsOn: [],
        requiresApproval: false,
      },
      {
        id: 'review',
        skillId: 'team-ai-expert',
        role: 'AI Expert Review',
        modelTier: 'expert',
        dependsOn: ['impl'],
        requiresApproval: false,
      },
    ],
    estimatedTokens: 75000,
    securityGated: false,
  },

  {
    id: 'memory-ops',
    name: 'Memory Operations',
    triggers: [
      { domain: 'memory', complexity: 'simple' },
      { domain: 'memory', complexity: 'moderate' },
      { domain: 'memory', complexity: 'complex' },
    ],
    phases: [
      {
        id: 'write',
        skillId: 'anamnesis-write',
        role: 'Memory Write',
        modelTier: 'capable',
        dependsOn: [],
        requiresApproval: false,
      },
    ],
    estimatedTokens: 15000,
    securityGated: false,
  },
]
