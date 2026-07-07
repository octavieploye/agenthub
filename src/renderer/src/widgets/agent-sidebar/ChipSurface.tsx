import { useState, useEffect, useCallback } from 'react'
import type { SkillItem } from '@shared/types/skills.types'
import SuggestionChip from './SuggestionChip'

const DEFAULT_PINNED = ['team-ui-builder', 'dev-backend', 'dev-frontend', 'scout-backend']

// Human-readable labels for known skill IDs — used when the skill has no displayName set.
// These are what a non-tech user sees before they type anything.
const FALLBACK_DISPLAY_NAMES: Record<string, string> = {
  'team-ui-builder': 'Design & build UI',
  'dev-backend': 'Build a backend feature',
  'dev-frontend': 'Build a UI feature',
  'scout-backend': 'Explore the codebase',
  'git-commit': 'Save my work',
}

// Skills that should never appear in the chip surface — dev/ops-only tools
const CHIP_BLOCKLIST = new Set([
  'git-commit',
  'git-ops',
  'tester-backend',
  'tester-frontend',
  'sec-devops',
])

function loadPinnedIds(): string[] {
  try {
    const raw = localStorage.getItem('agenthub.pinnedSkillIds')
    if (raw) return JSON.parse(raw) as string[]
  } catch { /* ignore */ }
  return DEFAULT_PINNED
}

function savePinnedIds(ids: string[]): void {
  try {
    localStorage.setItem('agenthub.pinnedSkillIds', JSON.stringify(ids))
  } catch { /* ignore */ }
}

interface ChipSurfaceProps {
  intentText: string
  skills: SkillItem[]
  recentSkillIds: string[]
  isExpanded: boolean
  onChipTap: (skillId: string) => void
  loadingChipId: string | null
  onTotalCountChange?: (count: number) => void
}

function ChipSurface({
  intentText,
  skills,
  recentSkillIds,
  isExpanded,
  onChipTap,
  loadingChipId,
  onTotalCountChange,
}: ChipSurfaceProps): React.JSX.Element {
  const [filteredSkills, setFilteredSkills] = useState<SkillItem[]>([])
  const [pinnedIds, setPinnedIds] = useState<string[]>(loadPinnedIds)

  const handleUnpin = useCallback((skillId: string) => {
    setPinnedIds((prev) => {
      const next = prev.filter((id) => id !== skillId)
      savePinnedIds(next)
      return next
    })
  }, [])

  const isSearchMode = intentText.trim().length > 0

  // Debounced filter — 150ms when intent text has content
  useEffect(() => {
    if (!intentText.trim()) {
      // No text: show recents, or pinned IDs if no recents
      if (recentSkillIds.length > 0) {
        const recent = recentSkillIds
          .filter((id) => !CHIP_BLOCKLIST.has(id))
          .slice(0, 4)
          .map((id) => skills.find((s) => s.id === id))
          .filter((s): s is SkillItem => s !== undefined)
        setFilteredSkills(recent)
      } else {
        const fallback = pinnedIds
          .filter((id) => !CHIP_BLOCKLIST.has(id))
          .map((id) => skills.find((s) => s.id === id))
          .filter((s): s is SkillItem => s !== undefined)
        setFilteredSkills(fallback)
      }
      return
    }

    const timer = setTimeout(() => {
      const lower = intentText.toLowerCase()
      const matched = skills
        .filter((s) => !CHIP_BLOCKLIST.has(s.id))
        .filter(
          (s) =>
            (s.displayName ?? s.name).toLowerCase().includes(lower) ||
            s.name.toLowerCase().includes(lower) ||
            s.description.toLowerCase().includes(lower) ||
            s.category.toLowerCase().includes(lower)
        )
      setFilteredSkills(matched)
    }, 150)

    return () => clearTimeout(timer)
  }, [intentText, skills, recentSkillIds, pinnedIds])

  // Notify parent of total count so ChipOverflowRow can render correctly
  useEffect(() => {
    onTotalCountChange?.(filteredSkills.length)
  }, [filteredSkills.length, onTotalCountChange])

  const visibleMax = isExpanded ? 6 : 4
  const visibleChips = filteredSkills.slice(0, visibleMax)
  const showingPinned = !isSearchMode && recentSkillIds.length === 0

  if (isSearchMode && filteredSkills.length === 0) {
    return (
      <div className="px-3 pt-2 pb-1">
        <p className="text-[11px] text-base-content/40 px-1">No match — press Enter to launch</p>
      </div>
    )
  }

  return (
    <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1.5">
      {visibleChips.map((chip) => (
        <SuggestionChip
          key={chip.id}
          id={chip.id}
          label={chip.displayName ?? FALLBACK_DISPLAY_NAMES[chip.id] ?? chip.name}
          sourceTag={chip.source}
          isLoading={loadingChipId === chip.id}
          onTap={onChipTap}
          onUnpin={showingPinned ? handleUnpin : undefined}
        />
      ))}
    </div>
  )
}

export default ChipSurface
