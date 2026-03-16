import { useState, useCallback, useEffect } from 'react'
import type { VoiceStatusResult } from '@shared/types/voice.types'
import type { DockerStatus } from '@shared/types/docker.types'
import { useThemeStore } from '../../stores/theme-store'
import { useViewStore } from '../../stores/view-store'
import { useNotificationStore } from '../../stores/notification-store'
import type { SettingsExport } from '@shared/types/settings.types'

interface SettingsPanelProps {
  onClose: () => void
}

function SettingsPanel({ onClose }: SettingsPanelProps): React.JSX.Element {
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [voiceInputEnabled, setVoiceInputEnabled] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatusResult | null>(null)
  const [dockerEnabled, setDockerEnabled] = useState(false)
  const [dockerCpus, setDockerCpus] = useState(2)
  const [dockerMemoryGb, setDockerMemoryGb] = useState(4)
  const [dockerTtlDays, setDockerTtlDays] = useState(7)
  const [dockerNetworkMode, setDockerNetworkMode] = useState<'host' | 'none'>('host')
  const [dockerStatus, setDockerStatus] = useState<DockerStatus | null>(null)
  const [buildLog, setBuildLog] = useState<string[]>([])
  const [isBuilding, setIsBuilding] = useState(false)

  useEffect(() => {
    window.agentHub.voice.status().then((res) => {
      if (res.success) setVoiceStatus(res.data)
    })
    window.agentHub.settings.getAll().then((res) => {
      if (res.success) {
        if (res.data['voice.enabled'] === 'true') {
          setVoiceInputEnabled(true)
        }
        if (res.data['docker.enabled'] === 'true') setDockerEnabled(true)
        if (res.data['docker.cpus']) setDockerCpus(Number(res.data['docker.cpus'] ?? '2'))
        if (res.data['docker.memoryGb']) setDockerMemoryGb(Number(res.data['docker.memoryGb'] ?? '4'))
        if (res.data['docker.ttlDays']) setDockerTtlDays(Number(res.data['docker.ttlDays'] ?? '7'))
        if (res.data['docker.networkMode'] === 'none' || res.data['docker.networkMode'] === 'host') {
          setDockerNetworkMode(res.data['docker.networkMode'] as 'host' | 'none')
        }
      }
    })
    window.agentHub.docker.status().then((res) => {
      if (res.success) setDockerStatus(res.data)
    }).catch(() => {})
  }, [])

  const handleRebuild = useCallback(async () => {
    setIsBuilding(true)
    setBuildLog([])
    const unsubscribe = window.agentHub.docker.onBuildProgress((line) => {
      setBuildLog((prev) => [...prev, line])
    })
    try {
      await window.agentHub.docker.rebuild()
    } catch {
      // ignore
    } finally {
      unsubscribe()
      setIsBuilding(false)
      window.agentHub.docker.status().then((res) => {
        if (res.success) setDockerStatus(res.data)
      }).catch(() => {})
    }
  }, [])
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const soundEnabled = useViewStore((s) => s.soundEnabled)
  const toggleSound = useViewStore((s) => s.toggleSound)
  const voiceEnabled = useViewStore((s) => s.voiceEnabled)
  const ttsVolume = useViewStore((s) => s.ttsVolume)
  const toggleVoice = useViewStore((s) => s.toggleVoice)
  const setTtsVolume = useViewStore((s) => s.setTtsVolume)
  const desktopNotificationsEnabled = useNotificationStore((s) => s.desktopNotificationsEnabled)
  const toggleDesktopNotifications = useNotificationStore((s) => s.toggleDesktopNotifications)

  const themes = [
    'deep-space',
    'ember',
    'matrix',
    'arctic',
    'twilight',
    'jade',
    'carbon'
  ] as const

  const handleExport = useCallback(async () => {
    try {
      const res = await window.agentHub.settings.export()
      if (res.success && res.data) {
        // Include current theme in the export
        const settingsData = res.data as SettingsExport
        const exportData: SettingsExport = {
          ...settingsData,
          settings: { ...settingsData.settings, theme }
        }
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: 'application/json'
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `agenthub-settings-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
        setExportStatus('success')
        setTimeout(() => setExportStatus('idle'), 2000)
      }
    } catch {
      setExportStatus('error')
      setTimeout(() => setExportStatus('idle'), 2000)
    }
  }, [theme])

  const handleImport = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const parsed = JSON.parse(text) as Partial<SettingsExport>
        if (!parsed.settings || typeof parsed.settings !== 'object') {
          setImportStatus('error')
          setTimeout(() => setImportStatus('idle'), 2000)
          return
        }
        const data: SettingsExport = {
          version: parsed.version ?? '1.0',
          exportedAt: parsed.exportedAt ?? new Date().toISOString(),
          settings: parsed.settings
        }
        const res = await window.agentHub.settings.import(data)
        if (res.success) {
          // Apply theme if present in imported settings
          if (parsed.settings.theme) {
            setTheme(parsed.settings.theme as Parameters<typeof setTheme>[0])
          }
          setImportStatus('success')
          setTimeout(() => setImportStatus('idle'), 2000)
        } else {
          setImportStatus('error')
          setTimeout(() => setImportStatus('idle'), 2000)
        }
      } catch {
        setImportStatus('error')
        setTimeout(() => setImportStatus('idle'), 2000)
      }
    }
    input.click()
  }, [setTheme])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        data-testid="settings-panel"
        className="panel-glass w-full max-w-md mx-4 p-6 rounded-xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">Settings</h2>
          <button
            data-testid="settings-close"
            className="btn btn-sm btn-ghost btn-circle"
            onClick={onClose}
          >
            X
          </button>
        </div>

        {/* Notifications — unified section for all alert layers */}
        <div className="form-control gap-3 mb-6">
          <label className="label">
            <span className="label-text font-semibold">Notifications</span>
          </label>

          {/* Layer 3: Sound — high+ priority events */}
          <label className="label cursor-pointer justify-start gap-3">
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={soundEnabled}
              onChange={() => toggleSound()}
            />
            <span className="label-text text-sm">Sound alerts (high+ priority)</span>
          </label>

          {/* Layer 2: Desktop — medium+ priority events */}
          <label className="label cursor-pointer justify-start gap-3">
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={desktopNotificationsEnabled}
              onChange={() => toggleDesktopNotifications()}
            />
            <span className="label-text text-sm">Desktop notifications (medium+ priority)</span>
          </label>

          {/* Layer 4: Voice TTS — critical events only */}
          <label className="label cursor-pointer justify-start gap-3">
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={voiceEnabled}
              onChange={() => toggleVoice()}
            />
            <span className="label-text text-sm">Voice TTS (critical only, off by default)</span>
          </label>
          {voiceEnabled && (
            <label className="label flex-col items-start gap-1">
              <span className="label-text text-xs text-base-content/60">TTS Volume</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={ttsVolume}
                onChange={(e) => setTtsVolume(parseFloat(e.target.value))}
                className="range range-xs w-full"
              />
            </label>
          )}
        </div>

        {/* Voice Input */}
        <div className="form-control gap-3 mb-6">
          <label className="label">
            <span className="label-text font-semibold">Voice Input</span>
          </label>
          <label className="label cursor-pointer justify-start gap-3">
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={voiceInputEnabled}
              onChange={(e) => {
                setVoiceInputEnabled(e.target.checked)
                window.agentHub.settings.set('voice.enabled', String(e.target.checked))
              }}
            />
            <span className="label-text text-sm">Enable voice input (Cmd+E)</span>
          </label>
          {voiceStatus?.status === 'unavailable' && voiceStatus.reason === 'model-missing' && (
            <p className="text-xs text-warning">
              Whisper model not found. Place ggml-small.bin in app data models/ directory.
            </p>
          )}
          {voiceStatus?.status === 'unavailable' && voiceStatus.reason === 'binary-missing' && (
            <p className="text-xs text-error">
              whisper-cli binary not found in resources/bin/
            </p>
          )}
          {voiceStatus?.status === 'unavailable' && voiceStatus.reason === 'mic-denied' && (
            <p className="text-xs text-error">
              Mic access denied — enable in System Preferences &gt; Privacy &gt; Microphone
            </p>
          )}
        </div>

        {/* Docker Isolation */}
        <div className="form-control gap-3 mb-6">
          <div className="flex items-center justify-between">
            <label className="label"><span className="label-text font-semibold">Docker Isolation</span></label>
            <input
              type="checkbox"
              className="toggle toggle-sm toggle-primary"
              checked={dockerEnabled}
              onChange={(e) => {
                setDockerEnabled(e.target.checked)
                window.agentHub.settings.set('docker.enabled', String(e.target.checked))
              }}
            />
          </div>

          {/* Status row */}
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${dockerStatus?.available ? 'bg-success' : 'bg-error'}`} />
            <span className="text-base-content/60">
              {dockerStatus?.available ? `Docker ${dockerStatus.version ?? ''} — ${dockerStatus.imageReady ? 'image ready' : 'image not built'}` : 'Docker not available'}
            </span>
          </div>

          {/* Resource controls — only show when docker available */}
          {dockerStatus?.available && (
            <>
              {/* CPU slider: 1-8 */}
              <label className="label flex-col items-start gap-1">
                <span className="label-text text-xs text-base-content/60">CPU cores: {dockerCpus}</span>
                <input type="range" min={1} max={8} step={1} value={dockerCpus} onChange={e => { setDockerCpus(Number(e.target.value)); window.agentHub.settings.set('docker.cpus', e.target.value) }} className="range range-xs w-full" />
              </label>

              {/* Memory slider: 1-16 GB */}
              <label className="label flex-col items-start gap-1">
                <span className="label-text text-xs text-base-content/60">Memory: {dockerMemoryGb} GB</span>
                <input type="range" min={1} max={16} step={1} value={dockerMemoryGb} onChange={e => { setDockerMemoryGb(Number(e.target.value)); window.agentHub.settings.set('docker.memoryGb', e.target.value) }} className="range range-xs w-full" />
              </label>

              {/* TTL input */}
              <label className="label flex-col items-start gap-1">
                <span className="label-text text-xs text-base-content/60">Container TTL (days)</span>
                <input type="number" min={1} max={90} value={dockerTtlDays} onChange={e => { setDockerTtlDays(Number(e.target.value)); window.agentHub.settings.set('docker.ttlDays', e.target.value) }} className="input input-xs input-bordered w-24 bg-base-200/50" />
              </label>

              {/* Network mode */}
              <label className="label cursor-pointer justify-start gap-3">
                <input type="checkbox" className="toggle toggle-xs" checked={dockerNetworkMode === 'none'} onChange={e => { const v = e.target.checked ? 'none' : 'host'; setDockerNetworkMode(v); window.agentHub.settings.set('docker.networkMode', v) }} />
                <span className="label-text text-xs">Strict network isolation (--network=none, local models only)</span>
              </label>

              {/* Image info + rebuild */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-base-content/40">Image: {dockerStatus?.imageTag}</span>
                <button disabled={isBuilding} onClick={handleRebuild} className="btn btn-xs btn-outline">
                  {isBuilding ? 'Building...' : 'Rebuild Image'}
                </button>
              </div>

              {/* Build log */}
              {buildLog.length > 0 && (
                <div className="bg-base-300/50 rounded p-2 max-h-24 overflow-y-auto font-mono text-[10px] text-base-content/60 space-y-0.5">
                  {buildLog.slice(-20).map((line, i) => <div key={i}>{line}</div>)}
                </div>
              )}
            </>
          )}
        </div>

        {/* Theme selector */}
        <div className="mb-6">
          <label className="text-xs font-medium text-base-content/70 mb-2 block">Theme</label>
          <div className="grid grid-cols-4 gap-2">
            {themes.map((t) => (
              <button
                key={t}
                data-testid={`theme-${t}`}
                onClick={() => setTheme(t)}
                className={`px-2 py-1.5 rounded text-xs capitalize transition-colors ${
                  theme === t
                    ? 'bg-primary text-primary-content font-medium'
                    : 'bg-base-200/50 hover:bg-base-200'
                }`}
              >
                {t.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Export/Import */}
        <div className="space-y-3">
          <label className="text-xs font-medium text-base-content/70 block">Settings Sync</label>
          <div className="flex gap-3">
            <button
              data-testid="settings-export"
              onClick={handleExport}
              className="btn btn-sm btn-outline flex-1"
            >
              {exportStatus === 'success'
                ? 'Exported!'
                : exportStatus === 'error'
                  ? 'Failed'
                  : 'Export'}
            </button>
            <button
              data-testid="settings-import"
              onClick={handleImport}
              className="btn btn-sm btn-outline flex-1"
            >
              {importStatus === 'success'
                ? 'Imported!'
                : importStatus === 'error'
                  ? 'Failed'
                  : 'Import'}
            </button>
          </div>
          <p className="text-xs text-base-content/40">
            Export your settings to a JSON file for backup or cross-machine sync.
          </p>
        </div>

        {/* CLAUDE.md path display */}
        <div className="mt-6 pt-4 border-t border-base-content/10">
          <label className="text-xs font-medium text-base-content/70 mb-1 block">
            Global Config (CLAUDE.md)
          </label>
          <div className="text-xs text-base-content/40 font-mono bg-base-200/30 px-3 py-2 rounded">
            ~/.claude/CLAUDE.md
          </div>
          <p className="text-xs text-base-content/40 mt-1">
            Manage your global dos and don&apos;ts file directly. AgentHub reads this path.
          </p>
        </div>
      </div>
    </div>
  )
}

export default SettingsPanel
