import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useSkillsStore } from '@renderer/stores/skills-store'
import type { SkillItem } from '@shared/types/skills.types'

interface SkillsIndexPanelProps {
  isOpen: boolean
  onClose: () => void
  activeAgentId: string | null
  repoPath?: string
}

const CATEGORY_ORDER = [
  'Code Quality',
  'AI Configuration',
  'Market Intelligence',
  'Competitor Analysis',
  'Content & Voice',
  'Workflows',
  'Teams',
  'Utilities'
]

function sortedGroupByCategory(skills: SkillItem[]): [string, SkillItem[]][] {
  const grouped = new Map<string, SkillItem[]>()
  for (const skill of skills) {
    const existing = grouped.get(skill.category) ?? []
    existing.push(skill)
    grouped.set(skill.category, existing)
  }

  for (const items of grouped.values()) {
    items.sort((a, b) => {
      const nameA = a.displayName ?? a.name
      const nameB = b.displayName ?? b.name
      return nameA.localeCompare(nameB)
    })
  }

  const ordered: [string, SkillItem[]][] = []
  for (const cat of CATEGORY_ORDER) {
    const items = grouped.get(cat)
    if (items) {
      ordered.push([cat, items])
      grouped.delete(cat)
    }
  }
  for (const [cat, items] of grouped.entries()) {
    ordered.push([cat, items])
  }
  return ordered
}

function repoLabel(repoPath?: string): string {
  if (!repoPath) return 'PROJECT'
  const parts = repoPath.replace(/\/+$/, '').split('/')
  return parts[parts.length - 1]?.toUpperCase() || 'PROJECT'
}

interface OriginSectionProps {
  label: string
  skills: SkillItem[]
  panelKey: string
  isPanelExpanded: boolean
  onTogglePanel: () => void
  expandedCategories: Set<string>
  onToggleCategory: (key: string) => void
  activeAgentId: string | null
  sentSkillId: string | null
  insertedSkillId: string | null
  tooltipSkillId: string | null
  onSend: (skill: SkillItem) => void
  onInsert: (skill: SkillItem) => void
  onTooltipEnter: (id: string) => void
  onTooltipLeave: () => void
}

function OriginSection({
  label,
  skills,
  panelKey,
  isPanelExpanded,
  onTogglePanel,
  expandedCategories,
  onToggleCategory,
  activeAgentId,
  sentSkillId,
  insertedSkillId,
  tooltipSkillId,
  onSend,
  onInsert,
  onTooltipEnter,
  onTooltipLeave
}: OriginSectionProps): React.JSX.Element {
  const grouped = useMemo(() => sortedGroupByCategory(skills), [skills])

  return (
    <div className="mb-2" data-testid={`origin-panel-${panelKey}`}>
      {/* Origin header */}
      <button
        data-testid={`origin-toggle-${panelKey}`}
        onClick={onTogglePanel}
        className="w-full flex items-center gap-2 px-2 py-2 rounded bg-base-content/5 hover:bg-base-content/10 transition-colors"
      >
        <span
          className={`text-[10px] text-base-content/50 transition-transform ${isPanelExpanded ? 'rotate-90' : ''}`}
        >
          &#9654;
        </span>
        <span className="text-[11px] font-bold uppercase text-base-content/60 tracking-wider flex-1 text-left">
          {label}
        </span>
        <span className="text-[10px] text-base-content/30 bg-base-content/10 px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
          {skills.length}
        </span>
      </button>

      {isPanelExpanded && (
        <div className="pl-1 mt-1">
          {grouped.map(([category, categorySkills]) => {
            const catKey = `${panelKey}:${category}`
            const isExpanded = expandedCategories.has(catKey)
            return (
              <div key={catKey} className="mb-1">
                {/* Category header */}
                <button
                  data-testid={`section-${catKey}`}
                  onClick={() => onToggleCategory(catKey)}
                  className="w-full flex items-center gap-1.5 px-1 py-1.5 rounded hover:bg-base-content/5 transition-colors"
                >
                  <span
                    className={`text-[10px] text-base-content/40 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  >
                    &#9654;
                  </span>
                  <span className="text-[10px] font-bold uppercase text-base-content/40 tracking-wider flex-1 text-left">
                    {category}
                  </span>
                  <span className="text-[10px] text-base-content/30 bg-base-content/5 px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                    {categorySkills.length}
                  </span>
                </button>

                {/* Skill items */}
                {isExpanded && (
                  <div className="flex flex-col gap-0.5 pl-2">
                    {categorySkills.map((skill) => (
                      <div key={skill.id} className="relative group rounded-md hover:bg-base-content/5 transition-colors">
                        <div className="px-2 pt-2 pb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-base-content/80 flex-1 truncate">
                              {skill.displayName ?? skill.name}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                                skill.source === 'team'
                                  ? 'bg-secondary/10 text-secondary'
                                  : skill.source === 'workflow'
                                    ? 'bg-warning/10 text-warning'
                                    : skill.source === 'command'
                                      ? 'bg-info/10 text-info'
                                      : 'bg-success/10 text-success'
                              }`}
                            >
                              {skill.source}
                            </span>
                          </div>
                          {skill.description && (
                            <p className="text-[10px] text-base-content/40 mt-0.5 truncate">
                              {skill.description}
                            </p>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 px-2 pb-1.5">
                          <button
                            data-testid={`skill-send-${skill.id}`}
                            onClick={() => onSend(skill)}
                            disabled={!activeAgentId}
                            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 active:bg-primary/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Send to agent and execute"
                          >
                            {sentSkillId === skill.id ? (
                              <span className="text-success">sent</span>
                            ) : (
                              <>
                                <SendIcon />
                                Send
                              </>
                            )}
                          </button>
                          <button
                            data-testid={`skill-insert-${skill.id}`}
                            onClick={() => onInsert(skill)}
                            disabled={!activeAgentId}
                            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-base-content/8 text-base-content/60 hover:bg-base-content/12 hover:text-base-content/80 active:bg-base-content/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Insert into prompt (edit before sending)"
                          >
                            {insertedSkillId === skill.id ? (
                              <span className="text-success">added</span>
                            ) : (
                              <>
                                <InsertIcon />
                                + Prompt
                              </>
                            )}
                          </button>

                          {skill.description && (
                            <div className="relative ml-auto">
                              <button
                                data-testid={`skill-info-${skill.id}`}
                                onMouseEnter={() => onTooltipEnter(skill.id)}
                                onMouseLeave={onTooltipLeave}
                                className="p-0.5 rounded text-base-content/30 hover:text-base-content/60 hover:bg-base-content/5 transition-colors"
                                aria-label={`Info for ${skill.displayName ?? skill.name}`}
                              >
                                <InfoIcon />
                              </button>

                              {tooltipSkillId === skill.id && (
                                <div className="absolute right-0 bottom-6 w-56 p-3 rounded-lg bg-base-300 border border-base-content/15 shadow-xl z-[400] pointer-events-none">
                                  <p className="text-xs font-semibold text-base-content mb-1">{skill.displayName ?? skill.name}</p>
                                  <p className="text-[11px] text-base-content/70 leading-relaxed">
                                    {skill.description}
                                  </p>
                                  {skill.format && (
                                    <span className="mt-2 inline-block text-[10px] px-1.5 py-0.5 rounded bg-base-content/10 text-base-content/50 font-mono">
                                      .{skill.format}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function SkillsIndexPanel({
  isOpen,
  onClose,
  activeAgentId,
  repoPath,
}: SkillsIndexPanelProps): React.JSX.Element | null {
  const { skills, loading, searchFilter, fetchSkills, setSearchFilter } = useSkillsStore()
  const [sentSkillId, setSentSkillId] = useState<string | null>(null)
  const [insertedSkillId, setInsertedSkillId] = useState<string | null>(null)
  const [tooltipSkillId, setTooltipSkillId] = useState<string | null>(null)
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set())
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [initialized, setInitialized] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    fetchSkills(repoPath)
    setSearchFilter('')
    setInitialized(false)
    setTimeout(() => searchRef.current?.focus(), 50)
  }, [isOpen, repoPath, fetchSkills, setSearchFilter])

  // Escape to close
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const filteredSkills = useMemo(() => {
    if (!searchFilter.trim()) return skills
    const lower = searchFilter.toLowerCase()
    return skills.filter(
      (s) =>
        (s.displayName ?? s.name).toLowerCase().includes(lower) ||
        s.name.toLowerCase().includes(lower) ||
        s.description.toLowerCase().includes(lower) ||
        s.category.toLowerCase().includes(lower)
    )
  }, [skills, searchFilter])

  // Split by origin
  const projectSkills = useMemo(
    () => filteredSkills.filter((s) => s.origin === 'project'),
    [filteredSkills]
  )
  const agenthubSkills = useMemo(
    () => filteredSkills.filter((s) => s.origin === 'agenthub'),
    [filteredSkills]
  )

  const hasProject = projectSkills.length > 0
  const hasAgenthub = agenthubSkills.length > 0

  // Initialize: expand panels and first category when skills load
  useEffect(() => {
    if (!initialized && !loading && filteredSkills.length > 0) {
      const panels = new Set<string>()
      const cats = new Set<string>()

      if (hasProject) {
        panels.add('project')
        const firstGroup = sortedGroupByCategory(projectSkills)
        if (firstGroup.length > 0) cats.add(`project:${firstGroup[0][0]}`)
      }
      if (hasAgenthub) {
        panels.add('agenthub')
        if (!hasProject) {
          const firstGroup = sortedGroupByCategory(agenthubSkills)
          if (firstGroup.length > 0) cats.add(`agenthub:${firstGroup[0][0]}`)
        }
      }

      setExpandedPanels(panels)
      setExpandedCategories(cats)
      setInitialized(true)
    }
  }, [filteredSkills, loading, initialized, hasProject, hasAgenthub, projectSkills, agenthubSkills])

  // Search: auto-expand everything
  useEffect(() => {
    if (searchFilter.trim()) {
      const panels = new Set<string>()
      const cats = new Set<string>()
      if (hasProject) {
        panels.add('project')
        for (const [cat] of sortedGroupByCategory(projectSkills)) cats.add(`project:${cat}`)
      }
      if (hasAgenthub) {
        panels.add('agenthub')
        for (const [cat] of sortedGroupByCategory(agenthubSkills)) cats.add(`agenthub:${cat}`)
      }
      setExpandedPanels(panels)
      setExpandedCategories(cats)
    }
  }, [searchFilter, hasProject, hasAgenthub, projectSkills, agenthubSkills])

  const togglePanel = useCallback((key: string) => {
    setExpandedPanels((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const toggleCategory = useCallback((key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const handleSendSkill = useCallback(
    (skill: SkillItem) => {
      if (!activeAgentId) return
      window.agentHub.agents.sendInput(activeAgentId, '/' + skill.id + '\r')
      setSentSkillId(skill.id)
      setTimeout(() => setSentSkillId(null), 1200)
    },
    [activeAgentId]
  )

  const handleInsertSkill = useCallback(
    (skill: SkillItem) => {
      if (!activeAgentId) return
      window.agentHub.agents.sendInput(activeAgentId, '/' + skill.id)
      setInsertedSkillId(skill.id)
      setTimeout(() => setInsertedSkillId(null), 1200)
    },
    [activeAgentId]
  )

  if (!isOpen) return null

  return (
    <div
      data-testid="skills-index-panel"
      className="fixed inset-0 z-[300] flex"
      role="dialog"
      aria-modal="true"
      aria-label="Skills Index"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — slides in from right */}
      <div className="relative ml-auto h-full w-80 flex flex-col panel-glass border-l border-base-content/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-base-content/10 shrink-0">
          <SkillsIcon />
          <h2 className="text-sm font-semibold text-base-content flex-1">Skills Index</h2>
          <span className="text-[10px] text-base-content/30 font-mono">⌘L</span>
          <button
            onClick={onClose}
            className="p-1 rounded text-base-content/40 hover:text-base-content/80 hover:bg-base-content/5 transition-colors"
            aria-label="Close skills panel"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 shrink-0">
          <input
            ref={searchRef}
            data-testid="skills-index-search"
            type="text"
            placeholder="Search skills..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="input input-bordered input-sm w-full bg-base-100/50 text-sm text-base-content placeholder:text-base-content/30 border-base-content/10 focus:border-primary/40 focus:outline-none"
          />
        </div>

        {/* No active agent warning */}
        {!activeAgentId && (
          <div className="mx-3 mb-2 px-3 py-2 rounded bg-warning/10 border border-warning/20 shrink-0">
            <p className="text-[11px] text-warning">No active agent — select an agent first</p>
          </div>
        )}

        {/* Skill list */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <span className="loading loading-dots loading-sm text-base-content/40" />
            </div>
          )}

          {!loading && filteredSkills.length === 0 && (
            <div className="text-center py-8">
              <p className="text-xs text-base-content/40">
                {skills.length === 0 ? 'No skills found' : 'No matching skills'}
              </p>
              <p className="text-[10px] text-base-content/30 mt-1">Add .md files to .claude/skills/</p>
            </div>
          )}

          {!loading && hasProject && (
            <OriginSection
              label={repoLabel(repoPath)}
              skills={projectSkills}
              panelKey="project"
              isPanelExpanded={expandedPanels.has('project')}
              onTogglePanel={() => togglePanel('project')}
              expandedCategories={expandedCategories}
              onToggleCategory={toggleCategory}
              activeAgentId={activeAgentId}
              sentSkillId={sentSkillId}
              insertedSkillId={insertedSkillId}
              tooltipSkillId={tooltipSkillId}
              onSend={handleSendSkill}
              onInsert={handleInsertSkill}
              onTooltipEnter={setTooltipSkillId}
              onTooltipLeave={() => setTooltipSkillId(null)}
            />
          )}

          {!loading && hasAgenthub && (
            <OriginSection
              label="AGENTHUB"
              skills={agenthubSkills}
              panelKey="agenthub"
              isPanelExpanded={expandedPanels.has('agenthub')}
              onTogglePanel={() => togglePanel('agenthub')}
              expandedCategories={expandedCategories}
              onToggleCategory={toggleCategory}
              activeAgentId={activeAgentId}
              sentSkillId={sentSkillId}
              insertedSkillId={insertedSkillId}
              tooltipSkillId={tooltipSkillId}
              onSend={handleSendSkill}
              onInsert={handleInsertSkill}
              onTooltipEnter={setTooltipSkillId}
              onTooltipLeave={() => setTooltipSkillId(null)}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-base-content/10 shrink-0 flex items-center gap-2">
          <span className="text-[10px] text-base-content/30 flex-1">Send executes · + Prompt to edit first</span>
          <span className="text-[10px] text-base-content/30 font-mono">{filteredSkills.length} skills</span>
        </div>
      </div>
    </div>
  )
}

function SkillsIcon(): React.JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}

function CloseIcon(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function InfoIcon(): React.JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

function SendIcon(): React.JSX.Element {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function InsertIcon(): React.JSX.Element {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  )
}
