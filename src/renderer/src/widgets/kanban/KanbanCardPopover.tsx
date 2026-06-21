import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { TaskItem, TaskPriority, TaskStatus, UpdateTaskInput } from '@shared/types/task.types'
import { PRIORITY_LABEL, STATUS_LABEL, CATEGORY_LABEL, KNOWN_CATEGORIES } from '@shared/types/task.types'
import { useAgentStore } from '../../stores/agent-store'
import { useProjectStore } from '../../stores/project-store'

interface KanbanCardPopoverProps {
  task: TaskItem
  position: { top: number; left: number }
  onSave: (input: UpdateTaskInput) => void
  onClose: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
  defaultProjectId?: string
}

export function KanbanCardPopover({ task, position, onSave, onClose, onMouseEnter, onMouseLeave, defaultProjectId }: KanbanCardPopoverProps) {
  const hasFocusRef = useRef(false)
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [category, setCategory] = useState(task.category ?? '')
  const [note, setNote] = useState(task.note ?? '')
  const [epicName, setEpicName] = useState(task.epicName ?? '')
  const [sprintName, setSprintName] = useState(task.sprintName ?? '')
  const [sectionTargetDate, setSectionTargetDate] = useState(task.sectionTargetDate ?? '')

  const agents = useAgentStore((s) => s.agents)
  const agentList = Array.from(agents.values())
  const { projects, createProject, linkRepo } = useProjectStore()

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(task.agentId ?? null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    task.projectId ?? defaultProjectId ?? null
  )
  const [showInlineCreate, setShowInlineCreate] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectCreating, setNewProjectCreating] = useState(false)

  function handleSave() {
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      description: description.trim(),
      priority,
      status,
      category: category.trim() || null,
      note: note.trim() || null,
      epicName: epicName.trim() || null,
      sprintName: sprintName.trim() || null,
      sectionTargetDate: sectionTargetDate || null,
      agentId: selectedAgentId,
      projectId: selectedProjectId,
    })
    onClose()
  }

  const content = (
    <div
      data-testid="card-popover"
      style={{ top: position.top, left: position.left, width: 340, zIndex: 9999 }}
      className="fixed bg-base-200 border border-base-300 rounded-xl shadow-2xl flex flex-col gap-3 p-4 max-h-[80vh] overflow-y-auto"
      onFocus={() => { hasFocusRef.current = true }}
      onBlur={() => { hasFocusRef.current = false }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={() => { if (!hasFocusRef.current) onMouseLeave() }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-base-content/70 truncate">{task.title}</span>
        <button
          aria-label="Close popover"
          className="btn btn-xs btn-ghost h-5 min-h-0 px-1 shrink-0"
          onClick={onClose}
        >✕</button>
      </div>

      {/* Title */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-base-content/50 font-medium uppercase tracking-wide">Title</label>
        <input
          className="input input-xs input-bordered w-full"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-base-content/50 font-medium uppercase tracking-wide">Description</label>
        <textarea
          className="textarea textarea-xs textarea-bordered w-full resize-none"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a description…"
        />
      </div>

      <div className="border-t border-base-300" />

      {/* Priority + Status */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-base-content/50 font-medium uppercase tracking-wide">Priority</label>
          <select
            className="select select-xs select-bordered w-full"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value) as TaskPriority)}
          >
            <option value={1}>{PRIORITY_LABEL[1]}</option>
            <option value={2}>{PRIORITY_LABEL[2]}</option>
            <option value={3}>{PRIORITY_LABEL[3]}</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-base-content/50 font-medium uppercase tracking-wide">Status</label>
          <select
            className="select select-xs select-bordered w-full"
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
          >
            {(Object.entries(STATUS_LABEL) as [TaskStatus, string][]).map(([s, label]) => (
              <option key={s} value={s}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Agent */}
      <div className="flex flex-col gap-1">
        <label htmlFor="popover-agent" className="text-xs text-base-content/50 font-medium uppercase tracking-wide">Agent</label>
        <select
          id="popover-agent"
          aria-label="Agent"
          className="select select-xs select-bordered w-full"
          value={selectedAgentId ?? ''}
          onChange={(e) => setSelectedAgentId(e.target.value || null)}
        >
          <option value="">Unassigned</option>
          {agentList.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </div>

      {/* Project */}
      <div className="flex flex-col gap-1">
        <label htmlFor="popover-project" className="text-xs text-base-content/50 font-medium uppercase tracking-wide">Project</label>
        <select
          id="popover-project"
          aria-label="Project"
          className="select select-xs select-bordered w-full"
          value={selectedProjectId ?? ''}
          onChange={(e) => {
            if (e.target.value === '__create__') {
              setShowInlineCreate(true)
            } else {
              setSelectedProjectId(e.target.value || null)
              setShowInlineCreate(false)
            }
          }}
        >
          <option value="">No Project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
          <option value="__create__">+ New project…</option>
        </select>
        {showInlineCreate && (
          <div className="flex flex-col gap-1 pl-2 border-l-2 border-primary/30">
            <input
              className="input input-xs input-bordered w-full"
              placeholder="Project name…"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setShowInlineCreate(false); setNewProjectName('') } }}
              autoFocus
            />
            <div className="flex gap-1">
              <button
                className="btn btn-xs btn-primary flex-1"
                disabled={!newProjectName.trim() || newProjectCreating}
                onClick={async () => {
                  setNewProjectCreating(true)
                  const created = await createProject({ name: newProjectName.trim() })
                  if (created) {
                    await linkRepo(created.id, task.repoId)
                    setSelectedProjectId(created.id)
                  }
                  setNewProjectName('')
                  setShowInlineCreate(false)
                  setNewProjectCreating(false)
                }}
              >Create & assign</button>
              <button
                className="btn btn-xs btn-ghost"
                onClick={() => { setShowInlineCreate(false); setNewProjectName('') }}
              >Cancel create</button>
            </div>
          </div>
        )}
      </div>

      {/* Category */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-base-content/50 font-medium uppercase tracking-wide">Category</label>
        <input
          list="popover-cat-list"
          className="input input-xs input-bordered w-full"
          placeholder="Category…"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <datalist id="popover-cat-list">
          {KNOWN_CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
          ))}
        </datalist>
      </div>

      <div className="border-t border-base-300" />

      {/* Note */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-base-content/50 font-medium uppercase tracking-wide">Note</label>
        <textarea
          className="textarea textarea-xs textarea-bordered w-full resize-none"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note…"
        />
      </div>

      {/* Epic */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-base-content/50 font-medium uppercase tracking-wide">Epic</label>
        <input
          className="input input-xs input-bordered w-full"
          value={epicName}
          onChange={(e) => setEpicName(e.target.value)}
          placeholder="Epic name…"
        />
      </div>

      {/* Sprint */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-base-content/50 font-medium uppercase tracking-wide">Sprint</label>
        <input
          className="input input-xs input-bordered w-full"
          value={sprintName}
          onChange={(e) => setSprintName(e.target.value)}
          placeholder="Sprint name…"
        />
      </div>

      {/* Target Date */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-base-content/50 font-medium uppercase tracking-wide">Target Date</label>
        <input
          type="date"
          className="input input-xs input-bordered w-full"
          value={sectionTargetDate}
          onChange={(e) => setSectionTargetDate(e.target.value)}
        />
      </div>

      <div className="border-t border-base-300" />

      {/* Metadata */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] text-base-content/35">
          Created: {new Date(task.createdAt).toLocaleDateString()}
        </span>
        <span className="text-[10px] text-base-content/35">
          Updated: {new Date(task.updatedAt).toLocaleDateString()}
        </span>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 pt-1">
        <button className="btn btn-xs btn-ghost" onClick={onClose}>Cancel</button>
        <button
          className="btn btn-xs btn-primary"
          onClick={handleSave}
          disabled={!title.trim()}
        >Save</button>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
