import { useState } from 'react'

interface TruncatedTextProps {
  text: string
  maxLength?: number
  className?: string
}

export function TruncatedText({
  text,
  maxLength = 200,
  className = ''
}: TruncatedTextProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const needsTruncation = text.length > maxLength

  if (!needsTruncation) {
    return <span className={className}>{text}</span>
  }

  return (
    <span className={className}>
      {expanded ? text : `${text.slice(0, maxLength)}...`}
      {' '}
      <button
        className="text-info hover:text-info/80 transition-colors text-inherit font-medium"
        onClick={() => setExpanded(!expanded)}
        data-testid="truncated-toggle"
      >
        {expanded ? 'See less' : 'See more'}
      </button>
    </span>
  )
}
