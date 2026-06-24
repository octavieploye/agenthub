import { useState, useEffect } from 'react'
import { marked } from 'marked'
import type { HowToDoc } from '@shared/types/how-to.types'

interface HowToPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function HowToPanel({ isOpen, onClose }: HowToPanelProps): React.JSX.Element | null {
  const [docs, setDocs] = useState<HowToDoc[]>([])
  const [search, setSearch] = useState('')
  const [openSections, setOpenSections] = useState<Set<number>>(new Set([0]))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setSearch('')
    window.agentHub.system.listHowTo().then((res) => {
      if (res.success && res.data) {
        setDocs(res.data)
        setOpenSections(new Set([0]))
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const term = search.trim().toLowerCase()

  const stripLeadingH1 = (content: string): string => {
    // The accordion header already shows the title — remove the redundant leading # heading
    return content.replace(/^#[^\n]*\n?/, '')
  }

  const entries = docs.map((doc, i) => {
    const titleMatch = doc.title.toLowerCase().includes(term)
    const contentMatch = doc.content.toLowerCase().includes(term)
    const visible = !term || titleMatch || contentMatch
    const forceOpen = !!(term && contentMatch)
    const isExpanded = forceOpen || (openSections.has(i) && (!term || visible))
    return { doc, i, visible, isExpanded }
  })

  const toggleSection = (i: number): void => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <>
      {/* Click-outside overlay */}
      <div
        data-testid="how-to-overlay"
        className="fixed inset-0 z-[29]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-label="AgentHub Guide"
        className="fixed right-0 top-0 h-full w-[360px] z-30 bg-base-200 border-l border-base-content/10 shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-content/10 shrink-0">
          <h2 className="text-sm font-semibold">AgentHub Guide</h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-base-content/50 hover:text-base-content/80 hover:bg-base-content/10 transition-colors text-xs"
            aria-label="Close guide"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-base-content/10 shrink-0">
          <input
            type="text"
            placeholder="Search guides…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 text-sm rounded-md bg-base-300 border border-base-content/10 outline-none focus:border-primary placeholder:text-base-content/30"
            autoFocus
          />
        </div>

        {/* Sections */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <p className="px-4 py-3 text-sm text-base-content/40">Loading…</p>
          )}

          {!loading && entries.map(({ doc, i, visible, isExpanded }) => (
            <div
              key={i}
              data-section
              className={`border-b border-base-content/10 transition-opacity ${!visible ? 'opacity-40' : ''}`}
            >
              <button
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-left hover:bg-base-content/5 transition-colors"
                onClick={() => toggleSection(i)}
                aria-expanded={isExpanded}
              >
                <span className="text-base-content/40 text-[10px] leading-none">{isExpanded ? '▾' : '▸'}</span>
                {doc.title}
              </button>

              {isExpanded && (
                <div
                  className="px-4 pb-4 text-sm text-base-content/80 leading-relaxed
                    [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:mb-2 [&_h1]:mt-1
                    [&_h2]:text-xs [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1
                    [&_h3]:text-xs [&_h3]:font-medium [&_h3]:mt-2 [&_h3]:mb-1
                    [&_p]:mb-2
                    [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2
                    [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2
                    [&_li]:mb-0.5
                    [&_code]:bg-base-300 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono
                    [&_pre]:bg-base-300 [&_pre]:rounded [&_pre]:p-2 [&_pre]:mb-2 [&_pre]:text-xs [&_pre]:overflow-x-auto
                    [&_table]:text-xs [&_table]:w-full [&_table]:mb-2
                    [&_th]:text-left [&_th]:pb-1 [&_th]:font-semibold [&_th]:border-b [&_th]:border-base-content/10
                    [&_td]:pr-3 [&_td]:py-0.5 [&_td]:align-top
                    [&_hr]:border-base-content/10 [&_hr]:my-3
                    [&_strong]:font-semibold"
                  // Content is from our own trusted filesystem — not user-supplied HTML
                  dangerouslySetInnerHTML={{ __html: marked.parse(stripLeadingH1(doc.content)) as string }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
