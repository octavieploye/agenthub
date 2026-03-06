export interface SearchResult {
  type: 'agent' | 'task' | 'repo' | 'terminal'
  id: string
  title: string
  subtitle: string
  score: number
}
