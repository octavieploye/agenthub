import { useState, useEffect } from 'react'
import { marked } from 'marked'
import type { HowToDoc } from '@shared/types/how-to.types'

const stripLeadingH1 = (content: string): string => {
  // The accordion header already shows the title — remove the redundant leading # heading
  return content.replace(/^\s*#[^\n]*\n?/, '')
}

interface HowToPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function HowToPanel({ isOpen, onClose }: HowToPanelProps): React.JSX.Element | null {
  const [docs, setDocs] = useState<HowToDoc[]>([])
  const [search, setSearch] = useState('')
  const [openSections, setOpenSections] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setSearch('')
    window.agentHub.system.listHowTo().then((res) => {
      if (res.success && res.data) {
        setDocs(res.data)
        // Auto-open the first section by default
        setOpenSections(res.data.length > 0 ? new Set([0]) : new Set())
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
              className={`collapse rounded-none border-b border-base-content/10 transition-opacity ${!visible ? 'opacity-40' : ''} ${isExpanded ? 'collapse-open' : 'collapse-close'}`}
            >
              <div
                role="button"
                className="collapse-title min-h-0 px-4 py-3.5 flex items-center gap-2.5 cursor-pointer hover:bg-base-content/5 transition-colors select-none"
                onClick={() => toggleSection(i)}
                aria-expanded={isExpanded}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`w-4 h-4 flex-shrink-0 text-base-content/40 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-[13px] font-semibold">{doc.title}</span>
              </div>

              {isExpanded && (
                <div
                  className="collapse-content !pb-4 text-[13px] text-base-content/75 leading-[1.7]
                    [&_h2]:text-[10px] [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-widest [&_h2]:text-base-content/40 [&_h2]:mt-4 [&_h2]:mb-2
                    [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-base-content/60
                    [&_p]:mb-3
                    [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-3 [&_ul]:space-y-1
                    [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-3 [&_ol]:space-y-1
                    [&_li]:leading-[1.6]
                    [&_code]:bg-base-300 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[11px] [&_code]:font-mono
                    [&_pre]:bg-base-300 [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:mb-3 [&_pre]:text-xs [&_pre]:overflow-x-auto [&_pre]:leading-relaxed
                    [&_table]:text-xs [&_table]:w-full [&_table]:mb-3 [&_table]:border-collapse
                    [&_th]:text-left [&_th]:pb-1.5 [&_th]:font-semibold [&_th]:border-b [&_th]:border-base-content/10 [&_th]:text-base-content/50
                    [&_td]:pr-4 [&_td]:py-1 [&_td]:align-top [&_td]:border-b [&_td]:border-base-content/5
                    [&_hr]:border-base-content/10 [&_hr]:my-4
                    [&_strong]:font-semibold [&_strong]:text-base-content/90"
                  // Content is from our own trusted filesystem — not user-supplied HTML
                  dangerouslySetInnerHTML={{ __html: marked.parse(stripLeadingH1(doc.content), { async: false }) }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
