interface SuggestionChipProps {
  id: string
  label: string
  sourceTag?: string
  isLoading: boolean
  onTap: (id: string) => void
  onUnpin?: (id: string) => void
}

const SOURCE_TAG_COLORS: Record<string, string> = {
  team: 'text-secondary',
  workflow: 'text-warning',
  command: 'text-info',
  project: 'text-success',
}

function SuggestionChip({ id, label, sourceTag, isLoading, onTap, onUnpin }: SuggestionChipProps): React.JSX.Element {
  const sourceTagColor = sourceTag ? (SOURCE_TAG_COLORS[sourceTag] ?? 'text-base-content/40') : 'text-base-content/40'

  return (
    <div className="relative group min-h-[44px] flex items-center">
      <button
        onClick={() => !isLoading && onTap(id)}
        disabled={isLoading}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-base-content/8 border border-base-content/12 text-[11px] text-base-content/70 hover:bg-base-content/15 hover:text-base-content transition-colors cursor-pointer disabled:opacity-50 chip-enter pr-6"
      >
        {isLoading ? (
          <span className="loading loading-spinner loading-xs" />
        ) : (
          <>
            <span>{label}</span>
            {sourceTag && (
              <span className={`text-[9px] ${sourceTagColor}`}>{sourceTag}</span>
            )}
          </>
        )}
      </button>
      {onUnpin && (
        <button
          onClick={(e) => { e.stopPropagation(); onUnpin(id) }}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center text-base-content/40 hover:text-base-content/80 hover:bg-base-content/15 transition-opacity"
          title="Remove from pinned"
        >
          ×
        </button>
      )}
    </div>
  )
}

export default SuggestionChip
