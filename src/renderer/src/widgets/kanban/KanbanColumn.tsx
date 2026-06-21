import React, { useState, useRef } from 'react'
import type { TaskItem, TaskStatus, TaskCategory, TaskPriority } from '@shared/types/task.types'
import { CATEGORY_LABEL, KNOWN_CATEGORIES } from '@shared/types/task.types'
import type { RepoConfig } from '@shared/types/config.types'

interface KanbanColumnProps {
  status: TaskStatus
  label: string
  tasks: TaskItem[]
  collapsed: boolean
  repos: RepoConfig[]
  onToggleCollapse: () => void
  onCardDrop: (taskId: string, toStatus: TaskStatus) => void
  onAddTask: (title: string, repoId: string, category: TaskCategory | null, priority: TaskPriority, note: string | null) => Promise<void>
  children: React.ReactNode
}

export function KanbanColumn({
  status,
  label,
  tasks,
  collapsed,
  repos,
  onToggleCollapse,
  onCardDrop,
  onAddTask,
  children,
}: KanbanColumnProps) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [repoId, setRepoId] = useState(repos[0]?.id ?? '')
  const [category, setCategory] = useState<TaskCategory | null>(null)
  const [priority, setPriority] = useState<TaskPriority>(3)
  const [note, setNote] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('taskId')
    if (taskId) onCardDrop(taskId, status)
  }

  function openForm() {
    setAdding(true)
    setRepoId(repos[0]?.id ?? '')
    setCategory(null)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function cancelForm() {
    setAdding(false)
    setTitle('')
    setCategory(null)
    setPriority(3)
    setNote('')
  }

  async function submitForm() {
    const trimmed = title.trim()
    if (!trimmed || !repoId) return
    await onAddTask(trimmed, repoId, category, priority, note.trim() || null)
    setTitle('')
    setCategory(null)
    setPriority(3)
    setNote('')
    setAdding(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); submitForm() }
    if (e.key === 'Escape') cancelForm()
  }

  return (
    <div
      className="flex flex-col min-w-[200px] max-w-[260px] bg-base-200 rounded-lg"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer select-none"
        onClick={onToggleCollapse}
      >
        <span className="font-semibold text-sm">{label}</span>
        <span className="badge badge-sm">{tasks.length}</span>
      </div>
      {!collapsed && (
        <div className="flex flex-col gap-2 p-2 min-h-[80px]">
          {children}
          {adding ? (
            <div className="flex flex-col gap-1 mt-1">
              <input
                ref={inputRef}
                type="text"
                className="input input-xs input-bordered w-full"
                placeholder="Task title…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <div className="flex gap-1">
                <input
                  list={`cat-${status}`}
                  className="input input-xs input-bordered flex-1"
                  placeholder="Category…"
                  value={category ?? ''}
                  onChange={(e) => setCategory(e.target.value || null)}
                />
                <datalist id={`cat-${status}`}>
                  {KNOWN_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                  ))}
                </datalist>
                <select
                  className="select select-xs select-bordered"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value) as TaskPriority)}
                >
                  <option value={1}>High</option>
                  <option value={2}>Medium</option>
                  <option value={3}>Low</option>
                </select>
                {repos.length > 1 && (
                  <select
                    className="select select-xs select-bordered flex-1"
                    value={repoId}
                    onChange={(e) => setRepoId(e.target.value)}
                  >
                    {repos.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <input
                type="text"
                className="input input-xs input-bordered w-full"
                placeholder="Note / path (hover to see)…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex gap-1 justify-end">
                <button className="btn btn-xs btn-ghost" onClick={cancelForm}>Cancel</button>
                <button className="btn btn-xs btn-primary" onClick={submitForm} disabled={!title.trim() || !repoId}>Add</button>
              </div>
            </div>
          ) : (
            <button
              className="btn btn-xs btn-ghost w-full text-base-content/40 hover:text-base-content/70 mt-1"
              onClick={openForm}
            >
              + Add task
            </button>
          )}
        </div>
      )}
    </div>
  )
}
