import { useState } from 'react'
import { useViewStore } from '../../../stores/view-store'
import { useNotificationStore } from '../../../stores/notification-store'

export function NotificationsTab(): React.JSX.Element {
  const soundEnabled = useViewStore((s) => s.soundEnabled)
  const toggleSound = useViewStore((s) => s.toggleSound)
  const voiceEnabled = useViewStore((s) => s.voiceEnabled)
  const toggleVoice = useViewStore((s) => s.toggleVoice)
  const ttsVolume = useViewStore((s) => s.ttsVolume)
  const setTtsVolume = useViewStore((s) => s.setTtsVolume)
  const desktopNotificationsEnabled = useNotificationStore((s) => s.desktopNotificationsEnabled)
  const toggleDesktopNotifications = useNotificationStore((s) => s.toggleDesktopNotifications)
  const [atmosphereEnabled, setAtmosphereEnabled] = useState(true)

  const handleToggleAtmosphere = (enabled: boolean): void => {
    setAtmosphereEnabled(enabled)
    if (!enabled) {
      document.documentElement.style.setProperty('--noise', '0')
      document.documentElement.style.setProperty('--depth', '0')
    } else {
      document.documentElement.style.removeProperty('--noise')
      document.documentElement.style.removeProperty('--depth')
    }
  }

  const handleTestSound = (): void => {
    new Audio('/sounds/bridge-beep.wav').play().catch(() => {})
  }

  const handleTestDesktop = (): void => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Test', { body: 'Desktop notification test' })
    }
  }

  const handleTestVoice = (): void => {
    window.speechSynthesis.speak(new SpeechSynthesisUtterance('Agent task complete'))
  }

  return (
    <div className="space-y-4">
      {/* Sound alerts */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={soundEnabled}
              onChange={() => toggleSound()}
            />
            <div>
              <p className="text-sm font-medium">Sound alerts</p>
              <p className="text-xs text-base-content/50">Play sounds when agents need attention</p>
            </div>
          </div>
          <button className="btn-hub btn-xs btn-ghost text-xs" onClick={handleTestSound}>
            Test
          </button>
        </div>
      </div>

      {/* Desktop notifications */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={desktopNotificationsEnabled}
              onChange={() => toggleDesktopNotifications()}
            />
            <div>
              <p className="text-sm font-medium">Desktop notifications</p>
              <p className="text-xs text-base-content/50">Show system banners for important events</p>
            </div>
          </div>
          <button className="btn-hub btn-xs btn-ghost text-xs" onClick={handleTestDesktop}>
            Test
          </button>
        </div>
      </div>

      {/* Voice announcements */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={voiceEnabled}
              onChange={() => toggleVoice()}
            />
            <div>
              <p className="text-sm font-medium">Voice announcements</p>
              <p className="text-xs text-base-content/50">Speak critical alerts aloud</p>
            </div>
          </div>
          <button className="btn-hub btn-xs btn-ghost text-xs" onClick={handleTestVoice}>
            Test
          </button>
        </div>
        {voiceEnabled && (
          <label className="flex flex-col gap-1 pl-9">
            <span className="text-xs text-base-content/60">Volume</span>
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

      {/* Background effects */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            className="toggle toggle-sm"
            checked={atmosphereEnabled}
            onChange={(e) => handleToggleAtmosphere(e.target.checked)}
          />
          <div>
            <p className="text-sm font-medium">Background effects</p>
            <p className="text-xs text-base-content/50">Grain texture and vignette depth</p>
          </div>
        </div>
      </div>
    </div>
  )
}
