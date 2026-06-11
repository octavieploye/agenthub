import { useState, useEffect } from 'react'
import { useViewStore } from '../../../stores/view-store'

type PiperVoice = { id: string; lang: string; name: string; quality: string }

type TtsApi = {
  listVoices: () => Promise<{ data?: PiperVoice[] }>
}

export function VoiceTab(): React.JSX.Element {
  const ttsVolume = useViewStore((s) => s.ttsVolume)
  const ttsRate = useViewStore((s) => s.ttsRate)
  const piperVoiceId = useViewStore((s) => s.piperVoiceId)
  const setTtsVolume = useViewStore((s) => s.setTtsVolume)
  const setTtsRate = useViewStore((s) => s.setTtsRate)
  const setPiperVoiceId = useViewStore((s) => s.setPiperVoiceId)

  const [voices, setVoices] = useState<PiperVoice[]>([])

  useEffect(() => {
    const ttsApi = (window as Window & typeof globalThis & { agentHub?: { tts?: TtsApi } }).agentHub?.tts
    if (!ttsApi) return
    ttsApi.listVoices().then((result) => {
      if (result?.data) setVoices(result.data)
    }).catch(console.warn)
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-base-content/70 mb-2">Voice</p>
        <select
          data-testid="tts-voice-select"
          className="select select-sm select-bordered w-full text-xs"
          value={piperVoiceId}
          onChange={(e) => setPiperVoiceId(e.target.value)}
        >
          <option value="">System default</option>
          {voices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} ({v.lang}) — {v.quality}
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
