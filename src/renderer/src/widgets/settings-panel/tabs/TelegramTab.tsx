// src/renderer/src/widgets/settings-panel/tabs/TelegramTab.tsx
import { useState, useEffect } from 'react'
import type { TelegramStatus, TelegramNotificationPrefs } from '@shared/types/telegram.types'

type WizardStep = 1 | 2 | 3
type TabState = 'not-connected' | 'wizard' | 'connected'

const TOKEN_PATTERN = /^\d{8,10}:AA[A-Za-z0-9_\-]{35}$/

export default function TelegramTab(): React.JSX.Element {
  const [tabState, setTabState] = useState<TabState>('not-connected')
  const [wizardStep, setWizardStep] = useState<WizardStep>(1)
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState('')
  const [status, setStatus] = useState<TelegramStatus>({ connected: false })
  const [prefs, setPrefs] = useState<TelegramNotificationPrefs>({
    notify_completed: true,
    notify_failed: true,
    notify_awaiting_approval: true,
    notify_needs_input: true,
  })
  const [waitingFirstContact, setWaitingFirstContact] = useState(false)
  const [showDisconnectModal, setShowDisconnectModal] = useState(false)
  const [testSent, setTestSent] = useState(false)

  useEffect(() => {
    window.agentHub.telegram.getStatus().then((s: TelegramStatus) => {
      setStatus(s)
      if (s.connected) {
        setTabState('connected')
        if (s.prefs) setPrefs(s.prefs)
      }
    })
    const unsubFirst = window.agentHub.telegram.onFirstContactLinked(() => {
      setWaitingFirstContact(false)
      window.agentHub.telegram.getStatus().then((s: TelegramStatus) => {
        setStatus(s)
        setTimeout(() => setTabState('connected'), 1500)
      })
    })
    return () => { unsubFirst?.() }
  }, [])

  if (tabState === 'not-connected') {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium">Get notified on your phone</p>
        <p className="text-xs text-base-content/50">
          Connect Telegram so you can receive alerts and send instructions to your agents
          from anywhere — even when your computer is locked.
        </p>
        <p className="text-xs text-base-content/40">
          No account required beyond Telegram.<br />
          Your work stays on your machine.
        </p>
        <button
          className="btn btn-sm btn-primary rounded-full w-full"
          onClick={() => { setWizardStep(1); setTabState('wizard') }}
        >
          Set up Telegram alerts
        </button>
      </div>
    )
  }

  if (tabState === 'wizard') {
    const stepLabels = ['New connection', 'Paste your connection code', "Confirm it's you"]

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={`w-2 h-2 rounded-full ${n === wizardStep ? 'bg-primary' : 'bg-base-content/20'}`}
            />
          ))}
          <span className="text-xs text-base-content/50 ml-1">
            Step {wizardStep} of 3 — {stepLabels[wizardStep - 1]}
          </span>
        </div>

        {wizardStep === 1 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Create your private bot</p>
            <p className="text-xs text-base-content/70">
              Telegram has a built-in tool that creates bots in seconds. You will do this once.
            </p>
            <ol className="text-xs text-base-content/70 space-y-1 pl-4 list-decimal">
              <li>Open Telegram and search for @BotFather</li>
              <li>Tap Start, then type /newbot</li>
              <li>Follow the prompts — choose any name and username</li>
              <li>BotFather gives you a connection code — a long text starting with numbers</li>
            </ol>
            <p className="text-xs text-base-content/50">Keep Telegram open, you will paste that code in step 2.</p>
            <div className="flex gap-2 pt-2">
              <button className="btn btn-sm btn-ghost rounded-full flex-1" onClick={() => setTabState('not-connected')}>
                Cancel
              </button>
              <button className="btn btn-sm btn-primary rounded-full flex-1" onClick={() => setWizardStep(2)}>
                I have my code →
              </button>
            </div>
          </div>
        )}

        {wizardStep === 2 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Paste your connection code</p>
            <div className="flex gap-1">
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value.trim())}
                placeholder="Paste connection code here…"
                className="input input-bordered input-sm flex-1 text-xs"
                aria-label="Telegram bot connection code"
                autoComplete="off"
                spellCheck={false}
              />
              <button className="btn btn-xs btn-ghost" onClick={() => setShowToken(!showToken)}>
                {showToken ? 'Hide' : 'Show'}
              </button>
            </div>
            {token.length > 0 && (
              <span className={`badge badge-sm ${TOKEN_PATTERN.test(token) ? 'badge-success' : 'badge-warning'}`}>
                {TOKEN_PATTERN.test(token) ? 'Looks good!' : "That doesn't look right — double-check the format"}
              </span>
            )}
            {connectError && (
              <div className="alert alert-error rounded-lg text-xs py-2">
                <span>{connectError}</span>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button className="btn btn-sm btn-ghost rounded-full flex-1" onClick={() => setWizardStep(1)}>
                ← Back
              </button>
              <button
                className="btn btn-sm btn-primary rounded-full flex-1"
                disabled={!TOKEN_PATTERN.test(token) || connecting}
                onClick={async () => {
                  setConnecting(true)
                  setConnectError('')
                  const result = await window.agentHub.telegram.saveToken(token)
                  setConnecting(false)
                  if (result.success) {
                    setWizardStep(3)
                    setWaitingFirstContact(true)
                  } else {
                    setConnectError("Couldn't reach Telegram. Check that your code is correct and try again.")
                  }
                }}
              >
                {connecting ? 'Connecting…' : 'Connect →'}
              </button>
            </div>
          </div>
        )}

        {wizardStep === 3 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">One last step — confirm it is you</p>
            <p className="text-xs text-base-content/70">
              Open Telegram and message your new bot. It is waiting for you.
            </p>
            <ol className="text-xs text-base-content/70 space-y-1 pl-4 list-decimal">
              <li>Find your bot (search by the username you chose)</li>
              <li>Tap Start or send any message</li>
            </ol>
            {waitingFirstContact ? (
              <span className="badge badge-warning badge-sm">Waiting for your first message…</span>
            ) : (
              <span className="badge badge-success badge-sm">Connected! Your account is linked.</span>
            )}
            <div className="flex gap-2 pt-2">
              <button className="btn btn-sm btn-ghost rounded-full flex-1" onClick={() => setWizardStep(2)}>
                ← Back
              </button>
              <button
                className="btn btn-sm btn-primary rounded-full flex-1"
                disabled={waitingFirstContact}
                onClick={() => setTabState('connected')}
              >
                {waitingFirstContact ? 'Waiting…' : 'Done'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // State: connected
  const prefLabels: { key: keyof TelegramNotificationPrefs; label: string }[] = [
    { key: 'notify_completed', label: 'Agent finished' },
    { key: 'notify_failed', label: 'Agent failed' },
    { key: 'notify_awaiting_approval', label: 'Agent needs approval' },
    { key: 'notify_needs_input', label: 'Agent needs your input' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Telegram alerts active</span>
        <span className="badge badge-success badge-sm">Connected</span>
      </div>
      <div className="text-xs text-base-content/50 space-y-1">
        {status.maskedUserId && <p>Your ID: {status.maskedUserId} (linked)</p>}
      </div>

      <div className="divider my-2" />

      <p className="text-xs font-bold tracking-wide text-base-content/60 uppercase">Send alerts for</p>
      <div className="space-y-2">
        {prefLabels.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="toggle toggle-sm toggle-primary"
              checked={prefs[key]}
              aria-label={label}
              onChange={async (e) => {
                const val = e.target.checked
                setPrefs((p) => ({ ...p, [key]: val }))
                await window.agentHub.telegram.setPref(key, val)
              }}
            />
            <span className="text-xs">{label}</span>
          </label>
        ))}
      </div>

      <div className="divider my-2" />

      <button
        className="btn btn-sm btn-ghost w-full"
        onClick={async () => {
          await window.agentHub.telegram.sendTest()
          setTestSent(true)
          setTimeout(() => setTestSent(false), 3000)
        }}
      >
        {testSent ? 'Sent' : 'Send a test message'}
      </button>
      <button
        className="btn btn-sm btn-ghost text-error w-full"
        onClick={() => setShowDisconnectModal(true)}
      >
        Disconnect
      </button>

      {showDisconnectModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-xs">
            <p className="text-sm">This will stop all Telegram alerts. Are you sure?</p>
            <div className="modal-action">
              <button className="btn btn-sm btn-ghost rounded-full" onClick={() => setShowDisconnectModal(false)}>
                Keep connected
              </button>
              <button
                className="btn btn-sm btn-error rounded-full"
                onClick={async () => {
                  await window.agentHub.telegram.disconnect()
                  setShowDisconnectModal(false)
                  setStatus({ connected: false })
                  setToken('')
                  setTabState('not-connected')
                }}
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
