import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import type { TaskItem, TaskPriority, TaskStatus, UpdateTaskInput } from '@shared/types/task.types'
import { PRIORITY_LABEL, STATUS_LABEL, CATEGORY_LABEL, KNOWN_CATEGORIES } from '@shared/types/task.types'
import type { AgentState } from '@shared/types/agent.types'
import type { OrchestratorTaskLog } from '@shared/types/orchestrator.types'
import { CLOUD_MODEL_OPTIONS, ANTHROPIC_MODEL_OPTIONS, CODEX_MODEL_OPTIONS, PROVIDER_BADGE_LABEL } from '@shared/constants/cloud-models'
import type { ValidProvider } from '@shared/constants/cloud-models'
import { useProjectStore } from '../../stores/project-store'
import { useOrchestratorStore } from '../../stores/orchestrator-store'

interface KanbanCardPopoverProps {
  task: TaskItem
  position: { top: number; left: number }
  onSave: (input: UpdateTaskInput) => void
  onClose: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
  onDispatch?: () => void
  defaultProjectId?: string
  agents: AgentState[]
  phaseHistory?: OrchestratorTaskLog[]
}

const PHASE_ICON: Record<string, string> = {
  dev: '\u2699',
  review: '\uD83D\uDC41',
  security: '\uD83D\uDEE1',
  commit: '\uD83D\uDCDD',
  push: '\uD83D\uDE80',
}

const PHASE_STATUS_CLASS: Record<string, string> = {
  pending: 'badge-ghost opacity-50',
  active: 'badge-primary',
  done: 'badge-success',
  failed: 'badge-error',
  skipped: 'badge-ghost',
}

const PHASE_STATUS_LABEL: Record<string, string> = {
  pending: 'pending',
  active: 'running',
  done: 'done',
  failed: 'failed',
  skipped: 'skipped',
}

export function KanbanCardPopover({ task, position, onSave, onClose, onMouseEnter, onMouseLeave, onDispatch, defaultProjectId, agents, phaseHistory }: KanbanCardPopoverProps) {
  const hasFocusRef = useRef(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const rafId = requestAnimationFrame(() => { setVisible(true) })
    return () => cancelAnimationFrame(rafId)
  }, [])

  const fetchTaskLogs = useOrchestratorStore((s) => s.fetchTaskLogs)
  useEffect(() => { fetchTaskLogs(task.id) }, [task.id, fetchTaskLogs])

  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [category, setCategory] = useState(task.category ?? '')
  const [note, setNote] = useState(task.note ?? '')
  const [epicName, setEpicName] = useState(task.epicName ?? '')
  const [sprintName, setSprintName] = useState(task.sprintName ?? '')
  const [sectionTargetDate, setSectionTargetDate] = useState(task.sectionTargetDate ?? '')
  const [dateTriggerFiredAt, setDateTriggerFiredAt] = useState(task.dateTriggerFiredAt ?? null)
  const [modelOverride, setModelOverride] = useState(task.modelOverride ?? '')
  const [providerOverride, setProviderOverride] = useState(task.providerOverride ?? '')
  const [requiresApproval, setRequiresApproval] = useState(task.requiresApproval ?? false)
  const [codexAvailable, setCodexAvailable] = useState(false)

  useEffect(() => {
    if (!window.agentHub?.models?.codexHealth) return
    window.agentHub.models.codexHealth()
      .then((res) => { if (res.success) setCodexAvailable(res.data.installed && res.data.authenticated) })
      .catch(() => {})
  }, [])

  const agentList = agents
  const { projects, createProject, linkRepo } = useProjectStore()

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(task.agentId ?? null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    task.projectId ?? defaultProjectId ?? null
  )
  const [showInlineCreate, setShowInlineCreate] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectCreating, setNewProjectCreating] = useState(false)

  const handleCreateAndAssign = async () => {
    setNewProjectCreating(true)
    const created = await createProject({ name: newProjectName.trim() })
    if (created) {
      await linkRepo(created.id, task.repoId)
      setSelectedProjectId(created.id)
    }
    setNewProjectName('')
    setShowInlineCreate(false)
    setNewProjectCreating(false)
  }

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
      dateTriggerFiredAt: dateTriggerFiredAt || null,
      agentId: selectedAgentId,
      projectId: selectedProjectId,
      modelOverride: modelOverride || null,
      providerOverride: (providerOverride as ValidProvider) || null,
      requiresApproval,
    })
    onClose()
  }

  const content = (
    <div
      data-testid="card-popover"
      style={{ top: position.top, left: position.left, width: 340, zIndex: 9999 }}
      className={`fixed bg-base-200 border border-base-300 rounded-xl shadow-2xl flex flex-col gap-3 p-4 max-h-[80vh] overflow-y-auto transition-all duration-[180ms] ease-out ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
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
        >
          <X size={12} />
        </button>
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
                onClick={handleCreateAndAssign}
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

      {/* Scheduling section */}
      <details className="collapse collapse-arrow bg-base-300/30 rounded-lg" open={!!(sectionTargetDate || modelOverride || requiresApproval)}>
        <summary className="collapse-title text-xs text-base-content/50 font-medium uppercase tracking-wide min-h-0 py-2 px-3">
          Scheduling
        </summary>
        <div className="collapse-content flex flex-col gap-2 px-3 pb-2">
          {/* Target Date */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-base-content/50">Target Date</label>
            <input
              type="date"
              className="input input-xs input-bordered w-full"
              value={sectionTargetDate}
              onChange={(e) => setSectionTargetDate(e.target.value)}
            />
          </div>

          {/* Model / Provider */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-base-content/50">Model Override</label>
            <select
              className="select select-xs select-bordered w-full"
              value={modelOverride ? `${providerOverride}::${modelOverride}` : ''}
              onChange={(e) => {
                const val = e.target.value
                if (!val) {
                  setModelOverride('')
                  setProviderOverride('')
                } else {
                  const [prov, ...modelParts] = val.split('::')
                  setProviderOverride(prov)
                  setModelOverride(modelParts.join('::'))
                }
              }}
            >
              <option value="">Auto (recommended)</option>
              <optgroup label="Ollama Cloud">
                {CLOUD_MODEL_OPTIONS.map((m) => (
                  <option key={m.id} value={`${m.provider}::${m.id}`}>{m.name}</option>
                ))}
              </optgroup>
              <optgroup label="Anthropic">
                {ANTHROPIC_MODEL_OPTIONS.map((m) => (
                  <option key={m.id} value={`${m.provider}::${m.id}`}>{m.name}</option>
                ))}
              </optgroup>
              {codexAvailable && (
                <optgroup label="Codex">
                  {CODEX_MODEL_OPTIONS.map((m) => (
                    <option key={m.id} value={`${m.provider}::${m.id}`}>{m.name}</option>
                  ))}
                </optgroup>
              )}
              <option value="ollama-local::">Ollama Local (auto-detect)</option>
            </select>
          </div>

          {/* Requires Approval */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="toggle toggle-xs toggle-primary"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
            />
            <span className="text-xs text-base-content/70">Requires approval</span>
          </label>

          {/* Date Trigger Fired At */}
          {dateTriggerFiredAt && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-base-content/50">Trigger Fired</label>
              <div className="text-xs text-base-content/70 px-2 py-1 bg-base-200/50 rounded">
                {new Date(dateTriggerFiredAt).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </details>

      {phaseHistory && phaseHistory.length > 0 && (
        <>
          <div className="border-t border-base-300" />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-base-content/50 font-medium uppercase tracking-wide">Orchestrator Phases</label>
            <div className="flex flex-col gap-0.5">
              {phaseHistory.map((log) => (
                <div key={log.id} className="flex items-center gap-2 text-[10px]">
                  <span className={`badge badge-xs ${PHASE_STATUS_CLASS[log.status]}`}>
                    {PHASE_ICON[log.phase]} {log.phase}
                  </span>
                  <span className="text-base-content/50">{PHASE_STATUS_LABEL[log.status]}</span>
                  {log.modelUsed && (
                    <span className="text-base-content/30">{log.modelUsed}</span>
                  )}
                  {log.completedAt && log.startedAt && (
                    <span className="text-base-content/30 ml-auto">
                      {Math.round((new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()) / 1000)}s
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

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
        {onDispatch && (
          <button
            className="btn btn-xs btn-warning mr-auto"
            onClick={() => { onClose(); onDispatch() }}
          >⚡ Dispatch</button>
        )}
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
