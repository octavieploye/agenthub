import { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import { useSkillsStore } from '@renderer/stores/skills-store'
import type { SkillItem } from '@shared/types/skills.types'

interface SkillsDropdownProps {
  isOpen: boolean
  onClose: () => void
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

  // Sort each group by displayName/name
  for (const items of grouped.values()) {
    items.sort((a, b) => {
      const nameA = a.displayName ?? a.name
      const nameB = b.displayName ?? b.name
      return nameA.localeCompare(nameB)
    })
  }

  // Return in fixed order, then any unknown categories at the end
  const ordered: [string, SkillItem[]][] = []
  for (const cat of CATEGORY_ORDER) {
    const items = grouped.get(cat)
    if (items) {
      ordered.push([cat, items])
      grouped.delete(cat)
    }
  }
  // Append any remaining categories not in CATEGORY_ORDER
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

interface OriginPanelProps {
  label: string
  skills: SkillItem[]
  expandedSections: Set<string>
  toggleSection: (key: string) => void
  executing: string | null
  onExecute: (skillId: string) => void
  panelKey: string
  isPanelExpanded: boolean
  onTogglePanel: () => void
}

function OriginPanel({
  label,
  skills,
  expandedSections,
  toggleSection,
  executing,
  onExecute,
  panelKey,
  isPanelExpanded,
  onTogglePanel
}: OriginPanelProps): React.JSX.Element {
  const grouped = useMemo(() => sortedGroupByCategory(skills), [skills])

  return (
    <div className="mb-1" data-testid={`origin-panel-${panelKey}`}>
      {/* Origin panel header */}
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

      {/* Category sections inside panel */}
      {isPanelExpanded && (
        <div className="pl-2 mt-0.5">
          {grouped.map(([category, categorySkills]) => {
            const sectionKey = `${panelKey}:${category}`
            const isExpanded = expandedSections.has(sectionKey)
            return (
              <div key={sectionKey} className="mb-0.5">
                {/* Category header */}
                <button
                  data-testid={`section-${sectionKey}`}
                  onClick={() => toggleSection(sectionKey)}
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
                {isExpanded &&
                  categorySkills.map((skill) => (
                    <button
                      key={skill.id}
                      data-testid={`skill-${skill.id}`}
                      onClick={() => onExecute(skill.id)}
                      disabled={executing !== null}
                      title={skill.description}
                      className="dropdown-item w-full text-left disabled:opacity-50 ml-2"
                      style={{ width: 'calc(100% - 0.5rem)' }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-base-content/80 font-medium flex-1 truncate">
                          {skill.displayName ?? skill.name}
                        </span>
                        {executing === skill.id && (
                          <span className="loading loading-spinner loading-xs text-primary" />
                        )}
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
                    </button>
                  ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SkillsDropdown({ isOpen, onClose, repoPath }: SkillsDropdownProps): React.JSX.Element | null {
  const {
    skills,
    loading,
    executing,
    lastResult,
    error,
    searchFilter,
    fetchSkills,
    executeSkill,
    refreshSkills,
    setSearchFilter,
    clearResult
  } = useSkillsStore()

  const dropdownRef = useRef<HTMLDivElement>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set())
  const [initialized, setInitialized] = useState(false)

  // Fetch skills when opened
  useEffect(() => {
    if (isOpen) {
      fetchSkills(repoPath)
      setInitialized(false)
    }
  }, [isOpen, repoPath, fetchSkills])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClick)
    }, 0)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousedown', handleClick)
    }
  }, [isOpen, onClose])

  const handleExecute = useCallback(
    (skillId: string) => {
      executeSkill(skillId, repoPath)
    },
    [executeSkill, repoPath]
  )

  const handleRefresh = useCallback(() => {
    refreshSkills(repoPath)
  }, [refreshSkills, repoPath])

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
  const hasBothOrigins = hasProject && hasAgenthub

  // Initialize: expand panels and first category section when skills load
  useEffect(() => {
    if (!initialized && !loading && filteredSkills.length > 0) {
      const panels = new Set<string>()
      const sections = new Set<string>()

      if (hasProject) {
        panels.add('project')
        const firstProjectGroup = sortedGroupByCategory(projectSkills)
        if (firstProjectGroup.length > 0) {
          sections.add(`project:${firstProjectGroup[0][0]}`)
        }
      }
      if (hasAgenthub) {
        panels.add('agenthub')
        if (!hasProject) {
          const firstAhGroup = sortedGroupByCategory(agenthubSkills)
          if (firstAhGroup.length > 0) {
            sections.add(`agenthub:${firstAhGroup[0][0]}`)
          }
        }
      }

      setExpandedPanels(panels)
      setExpandedSections(sections)
      setInitialized(true)
    }
  }, [filteredSkills, loading, initialized, hasProject, hasAgenthub, projectSkills, agenthubSkills])

  // When searching: auto-expand all panels and sections
  useEffect(() => {
    if (searchFilter.trim()) {
      const panels = new Set<string>()
      const sections = new Set<string>()
      if (hasProject) {
        panels.add('project')
        for (const [cat] of sortedGroupByCategory(projectSkills)) {
          sections.add(`project:${cat}`)
        }
      }
      if (hasAgenthub) {
        panels.add('agenthub')
        for (const [cat] of sortedGroupByCategory(agenthubSkills)) {
          sections.add(`agenthub:${cat}`)
        }
      }
      setExpandedPanels(panels)
      setExpandedSections(sections)
    }
  }, [searchFilter, hasProject, hasAgenthub, projectSkills, agenthubSkills])

  const toggleSection = useCallback((sectionKey: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(sectionKey)) {
        next.delete(sectionKey)
      } else {
        next.add(sectionKey)
      }
      return next
    })
  }, [])

  const togglePanel = useCallback((panelKey: string) => {
    setExpandedPanels((prev) => {
      const next = new Set(prev)
      if (next.has(panelKey)) {
        next.delete(panelKey)
      } else {
        next.add(panelKey)
      }
      return next
    })
  }, [])

  if (!isOpen) return null

  return (
    <div
      ref={dropdownRef}
      data-testid="skills-dropdown"
      className="absolute top-full right-0 mt-1 w-80 flex flex-col dropdown-panel overflow-hidden"
    >
      {/* Search */}
      <div className="p-3 pb-2 shrink-0">
        <input
          data-testid="skills-search"
          type="text"
          placeholder="Search skills..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="input input-bordered input-sm w-full bg-base-100/50 text-sm text-base-content placeholder:text-base-content/30 border-base-content/10 focus:border-primary/40 focus:outline-none"
          autoFocus
        />
      </div>

      {/* Skills list */}
      <div className="flex-1 overflow-y-auto px-3">
        {loading && (
          <div className="flex items-center justify-center py-6">
            <span className="loading loading-dots loading-sm text-base-content/40" />
          </div>
        )}

        {!loading && filteredSkills.length === 0 && (
          <div className="text-center py-6">
            <p className="text-xs text-base-content/40">
              {skills.length === 0 ? 'No skills found' : 'No matching skills'}
            </p>
            <p className="text-[10px] text-base-content/30 mt-1">
              Add .md files to .claude/skills/
            </p>
          </div>
        )}

        {!loading && hasProject && (
          <OriginPanel
            label={hasBothOrigins ? repoLabel(repoPath) : repoLabel(repoPath)}
            skills={projectSkills}
            expandedSections={expandedSections}
            toggleSection={toggleSection}
            executing={executing}
            onExecute={handleExecute}
            panelKey="project"
            isPanelExpanded={expandedPanels.has('project')}
            onTogglePanel={() => togglePanel('project')}
          />
        )}

        {!loading && hasAgenthub && (
          <OriginPanel
            label="AGENTHUB"
            skills={agenthubSkills}
            expandedSections={expandedSections}
            toggleSection={toggleSection}
            executing={executing}
            onExecute={handleExecute}
            panelKey="agenthub"
            isPanelExpanded={expandedPanels.has('agenthub')}
            onTogglePanel={() => togglePanel('agenthub')}
          />
        )}
      </div>

      {/* Result area */}
      {lastResult && (
        <div className="px-3 py-2 border-t border-base-content/10 shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-[11px] px-1.5 py-0.5 rounded font-mono font-bold ${
                lastResult.exitCode === 0
                  ? 'bg-success/20 text-success'
                  : 'bg-error/20 text-error'
              }`}
            >
              exit {lastResult.exitCode}
            </span>
            <span className="text-[10px] text-base-content/30">
              {(lastResult.duration / 1000).toFixed(1)}s
            </span>
            <button
              onClick={clearResult}
              className="text-[10px] text-base-content/30 hover:text-base-content/60 ml-auto"
            >
              dismiss
            </button>
          </div>
          <pre className="text-[10px] font-mono text-base-content/60 max-h-16 overflow-y-auto whitespace-pre-wrap break-all">
            {lastResult.output.slice(0, 200)}
            {lastResult.output.length > 200 && '...'}
          </pre>
        </div>
      )}

      {/* Error area */}
      {error && (
        <div className="px-3 py-2 border-t border-error/20 shrink-0">
          <p className="text-[10px] text-error">{error}</p>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-base-content/10 shrink-0">
        <button
          data-testid="skills-refresh"
          onClick={handleRefresh}
          className="text-[10px] text-base-content/50 hover:text-base-content/80 transition-colors"
          title="Refresh skills"
        >
          Refresh
        </button>
        <span className="text-base-content/20">|</span>
        <span className="text-[10px] text-base-content/30">{filteredSkills.length} items</span>
      </div>
    </div>
  )
}

export default SkillsDropdown
