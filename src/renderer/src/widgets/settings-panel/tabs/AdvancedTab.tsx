import { useState, useCallback } from 'react'
import { useThemeStore } from '../../../stores/theme-store'
import { useViewStore } from '../../../stores/view-store'
import type { SettingsExport } from '@shared/types/settings.types'

export function AdvancedTab(): React.JSX.Element {
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [uiScale, setUiScale] = useState<'12px' | '14px' | '16px'>('14px')

  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const toggleSound = useViewStore((s) => s.toggleSound)
  const soundEnabled = useViewStore((s) => s.soundEnabled)
  const toggleVoice = useViewStore((s) => s.toggleVoice)
  const voiceEnabled = useViewStore((s) => s.voiceEnabled)

  const handleExport = useCallback(async () => {
    try {
      const res = await window.agentHub.settings.export()
      if (res.success && res.data) {
        const settingsData = res.data as SettingsExport
        const exportData: SettingsExport = {
          ...settingsData,
          settings: { ...settingsData.settings, theme }
        }
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
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

  // TODO: Add shell:open-path IPC channel (R7-S1 backend task)
  const handleOpenInEditor = async (): Promise<void> => {
    try {
      await (window.agentHub.system as Record<string, unknown> & { openPath?: (path: string) => Promise<void> }).openPath?.('~/.claude/CLAUDE.md')
    } catch {
      console.warn('openPath IPC not yet available')
    }
  }

  const handleResetToDefaults = (): void => {
    if (!window.confirm('Reset all settings to defaults?')) return
    setTheme('mocha')
    if (soundEnabled) toggleSound()
    if (voiceEnabled) toggleVoice()
    document.documentElement.style.fontSize = '14px'
    setUiScale('14px')
  }

  return (
    <div className="space-y-5">
      {/* Settings Sync */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-base-content/70">Settings Sync</p>
        <div className="flex gap-2">
          <button
            data-testid="settings-export"
            onClick={handleExport}
            className="btn btn-sm btn-outline flex-1"
          >
            {exportStatus === 'success' ? 'Exported!' : exportStatus === 'error' ? 'Failed' : 'Export'}
          </button>
          <button
            data-testid="settings-import"
            onClick={handleImport}
            className="btn btn-sm btn-outline flex-1"
          >
            {importStatus === 'success' ? 'Imported!' : importStatus === 'error' ? 'Failed' : 'Import'}
          </button>
        </div>
        <p className="text-xs text-base-content/40">
          Export your settings to a JSON file for backup or cross-machine sync.
        </p>
      </div>

      {/* Configuration */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-base-content/70">Configuration</p>
        <div>
          <p className="text-xs text-base-content/60 mb-1">Global Config (CLAUDE.md)</p>
          <div className="flex items-center gap-2">
            <div className="text-xs text-base-content/40 font-mono bg-base-200/30 px-3 py-1.5 rounded flex-1">
              ~/.claude/CLAUDE.md
            </div>
            <button onClick={handleOpenInEditor} className="btn btn-xs btn-outline">
              Open in Editor
            </button>
          </div>
          <p className="text-xs text-base-content/40 mt-1">
            Manage your global dos and don&apos;ts file directly. AgentHub reads this path.
          </p>
        </div>
      </div>

      {/* UI Scale */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-base-content/70">Accessibility</p>
        <div>
          <p className="text-xs font-medium mb-1">UI Scale</p>
          <div className="flex gap-1">
            {(['12px', '14px', '16px'] as const).map((size) => (
              <button
                key={size}
                onClick={() => {
                  setUiScale(size)
                  document.documentElement.style.fontSize = size
                }}
                className={`btn-hub btn-xs ${uiScale === size ? 'btn-primary' : ''}`}
              >
                {size === '12px' ? 'Small' : size === '14px' ? 'Default' : 'Large'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="space-y-2 pt-2 border-t border-base-content/10">
        <p className="text-xs font-medium text-error/70">Danger Zone</p>
        <button
          onClick={handleResetToDefaults}
          className="btn btn-xs btn-outline btn-error"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  )
}
