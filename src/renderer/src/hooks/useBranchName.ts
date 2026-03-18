import { useState, useEffect } from 'react'

const branchCache = new Map<string, string>()

export function useBranchName(cwd: string): string | null {
  const [branch, setBranch] = useState<string | null>(branchCache.get(cwd) ?? null)

  useEffect(() => {
    if (!cwd) return
    if (branchCache.has(cwd)) {
      setBranch(branchCache.get(cwd)!)
      return
    }
    let cancelled = false
    window.agentHub.git
      .getBranches(cwd)
      .then((res) => {
        if (cancelled) return
        if (res.success && res.data.current) {
          branchCache.set(cwd, res.data.current)
          setBranch(res.data.current)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [cwd])

  return branch
}
