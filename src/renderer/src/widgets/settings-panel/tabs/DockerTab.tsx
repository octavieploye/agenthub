import { useState, useCallback, useEffect } from 'react'
import type { DockerStatus } from '@shared/types/docker.types'

export function DockerTab(): React.JSX.Element {
  const [dockerEnabled, setDockerEnabled] = useState(false)
  const [dockerCpus, setDockerCpus] = useState(2)
  const [dockerMemoryGb, setDockerMemoryGb] = useState(4)
  const [dockerTtlDays, setDockerTtlDays] = useState(7)
  const [dockerNetworkMode, setDockerNetworkMode] = useState<'host' | 'none'>('host')
  const [dockerStatus, setDockerStatus] = useState<DockerStatus | null>(null)
  const [buildLog, setBuildLog] = useState<string[]>([])
  const [isBuilding, setIsBuilding] = useState(false)

  useEffect(() => {
    window.agentHub.settings.getAll().then((res) => {
      if (res.success) {
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

  return (
    <div className="form-control gap-3">
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
          {dockerStatus?.available
            ? `Docker ${dockerStatus.version ?? ''} — ${dockerStatus.imageReady ? 'image ready' : 'image not built'}`
            : 'Docker not available'}
        </span>
      </div>

      {/* Resource controls — only show when docker available */}
      {dockerStatus?.available && (
        <>
          {/* CPU slider: 1-8 */}
          <label className="label flex-col items-start gap-1">
            <span className="label-text text-xs text-base-content/60">CPU cores: {dockerCpus}</span>
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={dockerCpus}
              onChange={(e) => {
                setDockerCpus(Number(e.target.value))
                window.agentHub.settings.set('docker.cpus', e.target.value)
              }}
              className="range range-xs w-full"
            />
          </label>

          {/* Memory slider: 1-16 GB */}
          <label className="label flex-col items-start gap-1">
            <span className="label-text text-xs text-base-content/60">Memory: {dockerMemoryGb} GB</span>
            <input
              type="range"
              min={1}
              max={16}
              step={1}
              value={dockerMemoryGb}
              onChange={(e) => {
                setDockerMemoryGb(Number(e.target.value))
                window.agentHub.settings.set('docker.memoryGb', e.target.value)
              }}
              className="range range-xs w-full"
            />
          </label>

          {/* TTL input */}
          <label className="label flex-col items-start gap-1">
            <span className="label-text text-xs text-base-content/60">Container TTL (days)</span>
            <input
              type="number"
              min={1}
              max={90}
              value={dockerTtlDays}
              onChange={(e) => {
                setDockerTtlDays(Number(e.target.value))
                window.agentHub.settings.set('docker.ttlDays', e.target.value)
              }}
              className="input input-xs input-bordered w-24 bg-base-200/50"
            />
          </label>

          {/* Network mode */}
          <label className="label cursor-pointer justify-start gap-3">
            <input
              type="checkbox"
              className="toggle toggle-xs toggle-primary"
              checked={dockerNetworkMode === 'none'}
              onChange={(e) => {
                const v = e.target.checked ? 'none' : 'host'
                setDockerNetworkMode(v)
                window.agentHub.settings.set('docker.networkMode', v)
              }}
            />
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
  )
}
