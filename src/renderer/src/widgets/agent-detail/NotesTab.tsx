import { useState, useEffect, useRef, useCallback } from 'react'
import {
  useNoteStore,
  selectScratchNotes,
  selectRepoNotes,
  selectGlobalNotes
} from '../../stores/note-store'
import type { AgentState } from '@shared/types/agent.types'
import type { NoteType } from '@shared/types/note.types'

interface NotesTabProps {
  agent: AgentState
}

interface NoteSectionProps {
  label: string
  content: string
  onChange: (value: string) => void
}

function NoteSection({ label, content, onChange }: NoteSectionProps): React.JSX.Element {
  return (
    <div className="flex flex-col flex-1 min-h-0 gap-1">
      <label className="text-xs font-semibold text-base-content/50 uppercase tracking-widest">
        {label}
      </label>
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write notes here..."
        className="textarea textarea-bordered flex-1 min-h-[80px] resize-none bg-base-100/50 text-sm text-base-content placeholder:text-base-content/30 border-base-content/10 focus:border-primary/40 focus:outline-none"
      />
    </div>
  )
}

export default function NotesTab({ agent }: NotesTabProps): React.JSX.Element {
  console.log('[DEBUG-RENDER] NotesTab render', performance.now().toFixed(1))
  const notes = useNoteStore((s) => s.notes)
  const fetchAllNotesOnce = useNoteStore((s) => s.fetchAllNotesOnce)
  const saveNote = useNoteStore((s) => s.saveNote)

  const [scratchContent, setScratchContent] = useState('')
  const [repoContent, setRepoContent] = useState('')
  const [globalContent, setGlobalContent] = useState('')

  const scratchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const repoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const globalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    console.log('[DEBUG-TAB] NotesTab useEffect MOUNT — calling fetchAllNotesOnce', performance.now().toFixed(1))
    fetchAllNotesOnce(agent.id, agent.cwd)
  }, [agent.id, agent.cwd, fetchAllNotesOnce])

  useEffect(() => {
    const scratch = selectScratchNotes(notes, agent.id)[0]?.content ?? ''
    setScratchContent(scratch)
  }, [notes, agent.id])

  useEffect(() => {
    const repo = selectRepoNotes(notes, agent.cwd)[0]?.content ?? ''
    setRepoContent(repo)
  }, [notes, agent.cwd])

  useEffect(() => {
    const global = selectGlobalNotes(notes)[0]?.content ?? ''
    setGlobalContent(global)
  }, [notes])

  const debounceSave = useCallback(
    (
      type: NoteType,
      content: string,
      timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
    ) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        const input: { type: NoteType; agentId?: string; repoPath?: string; content: string } = {
          type,
          content
        }
        if (type === 'scratch') input.agentId = agent.id
        if (type === 'repo') input.repoPath = agent.cwd
        saveNote(input)
      }, 500)
    },
    [agent.id, agent.cwd, saveNote]
  )

  const handleScratchChange = useCallback(
    (value: string) => {
      setScratchContent(value)
      debounceSave('scratch', value, scratchTimerRef)
    },
    [debounceSave]
  )

  const handleRepoChange = useCallback(
    (value: string) => {
      setRepoContent(value)
      debounceSave('repo', value, repoTimerRef)
    },
    [debounceSave]
  )

  const handleGlobalChange = useCallback(
    (value: string) => {
      setGlobalContent(value)
      debounceSave('global', value, globalTimerRef)
    },
    [debounceSave]
  )

  useEffect(() => {
    return () => {
      if (scratchTimerRef.current) clearTimeout(scratchTimerRef.current)
      if (repoTimerRef.current) clearTimeout(repoTimerRef.current)
      if (globalTimerRef.current) clearTimeout(globalTimerRef.current)
    }
  }, [])

  return (
    <div className="flex flex-col h-full gap-3 p-3 overflow-y-auto">
      <NoteSection
        label="Scratch Note"
        content={scratchContent}
        onChange={handleScratchChange}
      />
      <NoteSection
        label={`Repo Note — ${agent.cwd}`}
        content={repoContent}
        onChange={handleRepoChange}
      />
      <NoteSection
        label="Global Note"
        content={globalContent}
        onChange={handleGlobalChange}
      />
    </div>
  )
}
