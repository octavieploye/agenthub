export interface ParsedTaskVoice {
  title: string
  description: string
  priority: 1 | 2 | 3
}

export interface ParsedBugVoice {
  message: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  filePath: string
  errorType: string
}

/**
 * Parse voice transcription into task fields.
 * Recognizes markers: "title:", "priority:", "description:" (case-insensitive)
 * If no markers found, entire text becomes description with P3 priority.
 * Priority aliases: p1/priority 1/critical → 1, p2/priority 2/high → 2, p3/priority 3/medium/low → 3
 */
export function parseTaskVoice(text: string): ParsedTaskVoice {
  const result: ParsedTaskVoice = { title: '', description: '', priority: 3 }

  // Try to extract priority first (from anywhere in text)
  const priorityMatch = text.match(/\b(?:priority\s*[:.]?\s*)?(?:p\s*(\d))\b/i)
    || text.match(/\bpriority\s*[:.]?\s*(\d)\b/i)
  if (priorityMatch) {
    const p = parseInt(priorityMatch[1], 10)
    if (p >= 1 && p <= 3) result.priority = p as 1 | 2 | 3
  }

  // Check if text has structured markers
  const hasTitle = /\btitle\s*[:.]?\s/i.test(text)
  const hasDescription = /\bdescription\s*[:.]?\s/i.test(text)

  if (hasTitle || hasDescription) {
    // Extract title section
    const titleMatch = text.match(/\btitle\s*[:.]?\s*(.*?)(?=\b(?:priority|description|$))/is)
    if (titleMatch) result.title = titleMatch[1].trim()

    // Extract description section
    const descMatch = text.match(/\bdescription\s*[:.]?\s*(.*?)(?=\b(?:priority|title|$))/is)
    if (descMatch) result.description = descMatch[1].trim()

    // If only title marker exists and no description marker, everything after title (minus priority) is title
    if (hasTitle && !hasDescription && !result.title) {
      result.title = text.replace(/\btitle\s*[:.]?\s*/i, '').replace(/\b(?:priority\s*[:.]?\s*)?p?\s*\d\b/gi, '').trim()
    }

    // If only description marker, everything is description
    if (!hasTitle && hasDescription && !result.description) {
      result.description = text.replace(/\bdescription\s*[:.]?\s*/i, '').replace(/\b(?:priority\s*[:.]?\s*)?p?\s*\d\b/gi, '').trim()
    }
  } else {
    // No markers — entire text is description, no title
    const cleaned = text.replace(/\b(?:priority\s*[:.]?\s*)?p?\s*\d\b/gi, '').trim()
    result.description = cleaned
  }

  // Clean up quotes around values
  result.title = result.title.replace(/^["']|["']$/g, '').trim()
  result.description = result.description.replace(/^["']|["']$/g, '').trim()

  return result
}

/**
 * Parse voice transcription into bug fields.
 * Recognizes: "severity:", "file:", "file path:", "type:", "error type:", "description:"/"message:"
 * Default: severity medium, error type runtime_error
 * Severity aliases: critical/p1 → critical, high/p2 → high, medium/p3 → medium, low/p4 → low
 */
export function parseBugVoice(text: string): ParsedBugVoice {
  const result: ParsedBugVoice = { message: '', severity: 'medium', filePath: '', errorType: 'runtime_error' }

  // Extract severity
  const sevMatch = text.match(/\bseverity\s*[:.]?\s*(critical|high|medium|low)\b/i)
    || text.match(/\b(critical|high|medium|low)\s+(?:severity|priority|bug)\b/i)
  if (sevMatch) {
    result.severity = sevMatch[1].toLowerCase() as typeof result.severity
  } else {
    const pMatch = text.match(/\bp\s*([1-4])\b/i)
    if (pMatch) {
      const map: Record<string, typeof result.severity> = { '1': 'critical', '2': 'high', '3': 'medium', '4': 'low' }
      result.severity = map[pMatch[1]] || 'medium'
    }
  }

  // Extract file path
  const fileMatch = text.match(/\b(?:file\s*(?:path)?|path)\s*[:.]?\s*([^\s,]+(?:\/[^\s,]+)*)/i)
  if (fileMatch) result.filePath = fileMatch[1].trim()

  // Extract error type
  const typeMatch = text.match(/\b(?:error\s*)?type\s*[:.]?\s*(test[_ ]failure|compile[_ ]error|runtime[_ ]error|lint[_ ]error|type[_ ]error|other)\b/i)
  if (typeMatch) result.errorType = typeMatch[1].toLowerCase().replace(' ', '_')

  // Extract message/description
  const msgMatch = text.match(/\b(?:description|message|bug)\s*[:.]?\s*(.*?)(?=\b(?:severity|file|path|type|priority|$))/is)
  if (msgMatch && msgMatch[1].trim()) {
    result.message = msgMatch[1].trim().replace(/^["']|["']$/g, '')
  } else {
    // No markers — clean out extracted parts and use rest as message
    let cleaned = text
    if (sevMatch) cleaned = cleaned.replace(sevMatch[0], '')
    if (fileMatch) cleaned = cleaned.replace(fileMatch[0], '')
    if (typeMatch) cleaned = cleaned.replace(typeMatch[0], '')
    cleaned = cleaned.replace(/\bp\s*[1-4]\b/gi, '').replace(/\s+/g, ' ').trim()
    result.message = cleaned.replace(/^["']|["']$/g, '')
  }

  return result
}
