import { useEffect, useCallback, useMemo, useRef } from 'react'
import { useSkillsStore } from '@renderer/stores/skills-store'
import type { SkillItem } from '@shared/types/skills.types'

interface SkillsDropdownProps {
  isOpen: boolean
  onClose: () => void
  repoPath?: string
}

function groupByCategory(skills: SkillItem[]): Map<string, SkillItem[]> {
  const grouped = new Map<string, SkillItem[]>()
  for (const skill of skills) {
    const existing = grouped.get(skill.category) ?? []
    existing.push(skill)
    grouped.set(skill.category, existing)
  }
  return grouped
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

  // Fetch skills when opened
  useEffect(() => {
    if (isOpen) {
      fetchSkills(repoPath)
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
    // Delay to avoid closing immediately on the click that opened it
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
        s.name.toLowerCase().includes(lower) ||
        s.description.toLowerCase().includes(lower) ||
        s.category.toLowerCase().includes(lower)
    )
  }, [skills, searchFilter])

  const grouped = useMemo(() => groupByCategory(filteredSkills), [filteredSkills])

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
              Add .md files to ~/.claude/skills/
            </p>
          </div>
        )}

        {!loading &&
          Array.from(grouped.entries()).map(([category, categorySkills]) => (
            <div key={category} className="mb-2">
              <h3 className="text-[10px] font-bold uppercase text-base-content/40 tracking-wider px-1 py-1">
                {category}
              </h3>
              {categorySkills.map((skill) => (
                <button
                  key={skill.id}
                  data-testid={`skill-${skill.id}`}
                  onClick={() => handleExecute(skill.id)}
                  disabled={executing !== null}
                  className="dropdown-item w-full text-left disabled:opacity-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-base-content/80 font-medium flex-1 truncate">
                      {skill.name}
                    </span>
                    {executing === skill.id && (
                      <span className="loading loading-spinner loading-xs text-primary" />
                    )}
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                        skill.source === 'global'
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
                </button>
              ))}
            </div>
          ))}
      </div>

      {/* Result area */}
      {lastResult && (
        <div className="px-3 py-2 border-t border-base-content/10 shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
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
        <span className="text-[10px] text-base-content/30">~/.claude/skills/</span>
      </div>
    </div>
  )
}

export default SkillsDropdown
