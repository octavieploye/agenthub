import { useState, useEffect } from 'react'
import { useViewStore } from '../../../stores/view-store'

export function VoiceTab(): React.JSX.Element {
  const ttsVolume = useViewStore((s) => s.ttsVolume)
  const ttsRate = useViewStore((s) => s.ttsRate)
  const ttsVoiceURI = useViewStore((s) => s.ttsVoiceURI)
  const setTtsVolume = useViewStore((s) => s.setTtsVolume)
  const setTtsRate = useViewStore((s) => s.setTtsRate)
  const setTtsVoiceURI = useViewStore((s) => s.setTtsVoiceURI)

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    const load = (): void => {
      const available = window.speechSynthesis.getVoices()
      if (available.length > 0) setVoices(available)
    }
    load()
    window.speechSynthesis.onvoiceschanged = load
    return () => {
      window.speechSynthesis.onvoiceschanged = null
    }
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-base-content/70 mb-2">Voice</p>
        <select
          data-testid="tts-voice-select"
          className="select select-sm select-bordered w-full text-xs"
          value={ttsVoiceURI}
          onChange={(e) => setTtsVoiceURI(e.target.value)}
        >
          <option value="">System default</option>
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="text-xs font-medium text-base-content/70 mb-2">
          Volume — {Math.round(ttsVolume * 100)}%
        </p>
        <input
          data-testid="tts-volume-slider"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={ttsVolume}
          onChange={(e) => setTtsVolume(parseFloat(e.target.value))}
          className="range range-xs w-full"
        />
      </div>

      <div>
        <p className="text-xs font-medium text-base-content/70 mb-2">
          Speed — {ttsRate.toFixed(1)}x
        </p>
        <input
          data-testid="tts-rate-slider"
          type="range"
          min={0.5}
          max={2}
          step={0.1}
          value={ttsRate}
          onChange={(e) => setTtsRate(parseFloat(e.target.value))}
          className="range range-xs w-full"
        />
        <div className="flex justify-between text-[10px] text-base-content/40 mt-0.5">
          <span>0.5×</span>
          <span>1.0×</span>
          <span>2.0×</span>
        </div>
      </div>

      <p className="text-[10px] text-base-content/40">
        Voice mode (Off / Speak Up / Always On) is set per agent via the icon on each agent card.
      </p>
    </div>
  )
}
