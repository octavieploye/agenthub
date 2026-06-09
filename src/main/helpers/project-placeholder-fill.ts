import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface PlaceholderValues {
  name:          string
  description:   string
  backend:       string
  frontend:      string
  database:      string
  infra:         string
  keyFiles:      Array<{ path: string; desc: string }>
  projectRules:  string[]
  securityRules: string[]
  neverRules:    string[]
}

export function parseReadme(content: string): { name: string; description: string } {
  const lines = content.split('\n')
  let name = ''
  let description = ''
  let foundH1 = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (!foundH1 && trimmed.startsWith('# ')) {
      name = trimmed.replace(/^#\s+/, '')
      foundH1 = true
      continue
    }
    if (foundH1 && trimmed && !trimmed.startsWith('#')) {
      description = trimmed
      break
    }
  }

  return { name, description }
}

export function parseDevelopmentPlan(content: string): { stack: { backend: string; frontend: string; database: string; infra: string } } {
  const stack = { backend: '', frontend: '', database: '', infra: '' }
  const lines = content.split('\n')
  let inStackSection = false
  let inCodeBlock = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('```')) { inCodeBlock = !inCodeBlock }
    if (!inCodeBlock && trimmed.startsWith('#')) {
      const heading = trimmed.replace(/^#+\s*/, '').toLowerCase()
      inStackSection = heading.includes('stack')
    }
    if (inStackSection && !inCodeBlock) {
      const tableMatch = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/)
      if (tableMatch) {
        const label = tableMatch[1].trim().toLowerCase()
        const value = tableMatch[2].trim()
        if (/^[-:]+$/.test(value) || label === 'layer' || label === 'technology') continue
        if (label.includes('backend') || label.includes('api'))  stack.backend  = stack.backend  || value
        if (label.includes('frontend') || label.includes('ui'))  stack.frontend = stack.frontend || value
        if (label.includes('database') || label.includes('db'))  stack.database = stack.database || value
        if (label.includes('infra') || label.includes('deploy')) stack.infra    = stack.infra    || value
      }
    }
  }

  return { stack }
}

export function parseConstraints(content: string): { security: string[]; never: string[]; general: string[] } {
  const security: string[] = []
  const never: string[]    = []
  const general: string[]  = []

  const SECURITY_KEYWORDS = ['secret', 'credential', 'auth', 'token', 'encrypt',
                              'direct', 'access', 'permission', 'isolation', 'llm']
  const NEVER_KEYWORDS    = ['never', 'must not', 'cannot', 'no direct', 'no raw',
                              'no hardcoded', 'no ai self']

  let inConstraints = false
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.match(/^#+\s*key constraints/i)) { inConstraints = true; continue }
    if (inConstraints && trimmed.startsWith('#')) break
    if (!inConstraints) continue

    const itemMatch = trimmed.match(/^(?:\d+\.|[-*])\s+(.+)/)
    if (!itemMatch) continue

    const text  = itemMatch[1].trim()
    const lower = text.toLowerCase()

    if (NEVER_KEYWORDS.some(k => lower.includes(k)))    never.push(text)
    else if (SECURITY_KEYWORDS.some(k => lower.includes(k))) security.push(text)
    else general.push(text)
  }

  return { security, never, general }
}

export function scanKeyFiles(projectPath: string): Array<{ path: string; desc: string }> {
  const candidates = [
    { rel: 'README.md',           desc: 'project overview and entry point' },
    { rel: 'DEVELOPMENT-PLAN.md', desc: 'full architecture, build phases, and constraints' },
    { rel: 'docs/',               desc: 'documentation directory' },
    { rel: 'docs/context.md',     desc: 'project context and decisions' },
    { rel: 'sprints/',            desc: 'per-role sprint plans' },
    { rel: 'docs/sprints/',       desc: 'per-role sprint plans' },
    { rel: 'src/',                desc: 'source code' },
    { rel: 'backend/',            desc: 'backend services' },
    { rel: 'frontend/',           desc: 'frontend application' },
    { rel: 'brain_core/',         desc: 'core engine / rule system' },
  ]

  return candidates
    .filter(c => existsSync(join(projectPath, c.rel)))
    .map(c => ({ path: c.rel, desc: c.desc }))
    .slice(0, 6)
}

export function buildReplacements(v: PlaceholderValues): Record<string, string> {
  const keyFilesBlock = v.keyFiles.length > 0
    ? v.keyFiles.map(f => `- \`${f.path}\` — ${f.desc}`).join('\n')
    : '- Add key file paths here'

  const projectRulesBlock = v.projectRules.length > 0
    ? v.projectRules.map(r => `- ${r}`).join('\n')
    : '- Add project-specific rules here'

  const securityRulesBlock = v.securityRules.length > 0
    ? v.securityRules.map(r => `- ${r}`).join('\n')
    : '- Add project-specific security rules here'

  const neverRulesBlock = v.neverRules.length > 0
    ? v.neverRules.map(r => `- ${r}`).join('\n')
    : '- Add project-specific never rules here'

  return {
    '[PROJECT_NAME]':         v.name        || '[PROJECT NAME]',
    '[PROJECT_DESCRIPTION]':  v.description || '[one-line description]',
    '[STACK_BACKEND]':        v.backend     || '[e.g. Node.js / Python / Go]',
    '[STACK_FRONTEND]':       v.frontend    || '[e.g. React / Angular / None]',
    '[STACK_DATABASE]':       v.database    || '[e.g. PostgreSQL / SQLite]',
    '[STACK_INFRA]':          v.infra       || '[e.g. Docker / Vercel / None]',
    '[KEY_FILES_BLOCK]':      keyFilesBlock,
    '[PROJECT_RULES_BLOCK]':  projectRulesBlock,
    '[SECURITY_RULES_BLOCK]': securityRulesBlock,
    '[NEVER_RULES_BLOCK]':    neverRulesBlock,
    '[main context file]':    v.keyFiles[0]?.path ?? 'README.md',
  }
}

export function fillPlaceholders(content: string, replacements: Record<string, string>): string {
  let out = content
  for (const [key, val] of Object.entries(replacements)) {
    if (val) out = out.split(key).join(val)
  }
  return out
}

export function extractProjectDetails(projectPath: string): PlaceholderValues {
  const extracted: PlaceholderValues = {
    name: '', description: '',
    backend: '', frontend: '', database: '', infra: '',
    keyFiles: [],
    projectRules: [], securityRules: [], neverRules: [],
  }

  const readmePath  = join(projectPath, 'README.md')
  const devplanPath = join(projectPath, 'DEVELOPMENT-PLAN.md')

  if (existsSync(readmePath)) {
    const parsed = parseReadme(readFileSync(readmePath, 'utf8'))
    extracted.name        = parsed.name
    extracted.description = parsed.description
  }

  extracted.keyFiles = scanKeyFiles(projectPath)

  if (existsSync(devplanPath)) {
    const content = readFileSync(devplanPath, 'utf8')
    const parsed  = parseDevelopmentPlan(content)
    extracted.backend  = parsed.stack.backend
    extracted.frontend = parsed.stack.frontend
    extracted.database = parsed.stack.database
    extracted.infra    = parsed.stack.infra

    const constraints       = parseConstraints(content)
    extracted.projectRules  = constraints.general
    extracted.securityRules = constraints.security
    extracted.neverRules    = constraints.never
  }

  return extracted
}
