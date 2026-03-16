import { useState } from 'react'
import { GeneralTab } from './tabs/GeneralTab'
import { NotificationsTab } from './tabs/NotificationsTab'
import { AdvancedTab } from './tabs/AdvancedTab'
import { DockerTab } from './tabs/DockerTab'

type SettingsTab = 'general' | 'notifications' | 'advanced' | 'docker'

interface SettingsPanelProps {
  onClose: () => void
}

function SettingsPanel({ onClose }: SettingsPanelProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div data-testid="settings-panel" className="card-elevated w-full max-w-md mx-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="font-semibold text-base">Settings</h2>
          <button
            data-testid="settings-close"
            className="btn-hub btn-ghost btn-xs"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        {/* Tab bar */}
        <div className="flex border-b border-base-content/10 px-4">
          {(['general', 'notifications', 'advanced', 'docker'] as SettingsTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-xs font-medium capitalize border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-base-content/50 hover:text-base-content'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {activeTab === 'general' && <GeneralTab />}
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'advanced' && <AdvancedTab />}
          {activeTab === 'docker' && <DockerTab />}
        </div>
      </div>
    </div>
  )
}

export default SettingsPanel
