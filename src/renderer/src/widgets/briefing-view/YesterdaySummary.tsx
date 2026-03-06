import type { YesterdaySummary as YesterdaySummaryType } from '@shared/types/task.types'

interface YesterdaySummaryProps {
  summary: YesterdaySummaryType
}

function formatSummaryLine(summary: YesterdaySummaryType): string {
  const parts: string[] = []
  if (summary.completed > 0) parts.push(`${summary.completed} completed`)
  if (summary.tested > 0) parts.push(`${summary.tested} tested`)
  if (summary.bugsResolved > 0) parts.push(`${summary.bugsResolved} bugs resolved`)
  return parts.length > 0 ? parts.join(', ') : 'No activity'
}

function YesterdaySummary({ summary }: YesterdaySummaryProps): React.JSX.Element {
  return (
    <div data-testid="yesterday-summary" className="text-xs text-base-content/40 mt-2">
      Yesterday: {formatSummaryLine(summary)}
    </div>
  )
}

export default YesterdaySummary
export { formatSummaryLine }
