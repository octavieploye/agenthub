interface ChipOverflowRowProps {
  totalCount: number
  visibleMax: number
  isExpanded: boolean
  onToggle: () => void
}

function ChipOverflowRow({ totalCount, visibleMax, isExpanded, onToggle }: ChipOverflowRowProps): React.JSX.Element | null {
  if (totalCount <= visibleMax) return null

  return (
    <div className="px-3 pb-2">
      <button
        onClick={onToggle}
        className="text-[11px] text-base-content/40 hover:text-base-content/70 cursor-pointer"
      >
        {isExpanded ? 'See less' : `See ${totalCount - visibleMax} more`}
      </button>
    </div>
  )
}

export default ChipOverflowRow
