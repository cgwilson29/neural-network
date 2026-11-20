import { useEffect, useRef, useState } from 'react'
import { useChat } from '../chat/useChat'
import { CHAT_MODELS, pickModelId, type ChatTier } from '../chat/models'
import { RECORDED_QA } from '../content/recordedAnswers'

export const SUGGESTED_QUESTIONS = [
  'Where did your data come from?',
  'How did your model compare with the baseline?',
  'How well did this model work on a dataset you never tested?',
]

function RecordedAnswers() {
  return (
    <div className="recorded">
      <p className="sub" style={{ marginBottom: 8 }}>
        Recorded answers from our chatbot tests (the live bot, checked against the guide):
      </p>
      {RECORDED_QA.map((qa) => (
        <details key={qa.q}>
          <summary>{qa.q}</summary>
          <p>{qa.a}</p>
          <p className="meta">{qa.meta}</p>
        </details>
      ))}
    </div>
  )
}

export function ChatDock({ open, onOpenChange, scenarioText }: { open: boolean; onOpenChange: (o: boolean) => void; scenarioText: string }) {
  const chat = useChat(scenarioText)
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const { phase, gpu, progress, error, messages, tier, setTier, cached } = chat

  useEffect(() => {
    if (open) {
      chat.check()
      panelRef.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onOpenChange(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  const send = (q: string) => {
    if (!q.trim()) return
    chat.ask(q)
    setDraft('')
  }

  const busy = phase === 'generating'
  const modelId = gpu ? pickModelId(tier, gpu.f16) : null

  return (
    <>
      {!open && (
        <button className="chat-launcher" onClick={() => onOpenChange(true)} aria-haspopup="dialog" aria-label="Ask the guide bot">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 5h16v10H9l-5 4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
          <span className="launcher-long">Ask the guide bot</span>
          <span className="launcher-short">Ask</span>
        </button>
      )}
      {open && (
        <div className="chat-panel" role="dialog" aria-label="Guide bot" ref={panelRef} tabIndex={-1}>
          <header className="chat-head">
            <div>
              <strong>Guide bot</strong>
              <span className="chat-status">
                {phase === 'ready' || phase === 'generating'
                  ? `Running in your browser · ${CHAT_MODELS[tier].label.split(' · ')[1]}`
                  : 'Answers only from the exhibit guide'}
              </span>
            </div>
            <button className="icon-btn" onClick={() => onOpenChange(false)} aria-label="Close chat">
              ✕
            </button>
          </header>

          <div className="chat-body" ref={listRef}>
            {(phase === 'idle' || phase === 'checking') && <p className="sub">Checking whether this device supports WebGPU…</p>}

            {phase === 'unsupported' && (
              <>
                <div className="notice">
                  <strong>Chat isn’t available on this device.</strong>
                  {gpu?.problems.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                  <p>Everything else in the exhibit works normally.</p>
                </div>
                <RecordedAnswers />
              </>
            )}

            {phase === 'gated' && gpu && (
              <div className="gate">
                <p>
                  The guide bot is a small language model that runs <strong>entirely on your device</strong> with WebGPU.
                  Nothing is downloaded until you choose <strong>Enable chat</strong>. After the first download it is
                  cached by your browser.
                </p>
                <fieldset className="model-pick">
                  <legend>Model</legend>
                  {(Object.keys(CHAT_MODELS) as ChatTier[]).map((t) => (
                    <label key={t} className={tier === t ? 'on' : ''}>
                      <input type="radio" name="tier" value={t} checked={tier === t} onChange={() => setTier(t)} />
                      <span>
                        <strong>{CHAT_MODELS[t].label}</strong>
                        <span className="meta">
                          {cached[t] ? 'Already downloaded · loads from cache' : `~${CHAT_MODELS[t].downloadMB} MB download`} ·{' '}
                          {CHAT_MODELS[t].detail}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                {gpu.notes.map((n) => (
                  <p key={n} className="meta">
                    ⓘ {n}
                  </p>
                ))}
                <button className="btn primary" onClick={chat.enable}>
                  Enable chat
                </button>
                <p className="meta">Model build: {modelId}</p>
              </div>
            )}

            {phase === 'loading' && (
              <div className="loading" aria-live="polite">
                <p>
                  <strong>Loading {CHAT_MODELS[tier].label}…</strong>
                </p>
                <div
                  className="progress"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress.fraction * 100)}
                >
                  <span style={{ width: `${Math.max(2, progress.fraction * 100)}%` }} />
                </div>
                <p className="meta num">
                  {Math.round(progress.fraction * 100)}% · {progress.text}
                </p>
                <p className="meta">You can keep exploring the exhibit while this loads.</p>
              </div>
            )}

            {phase === 'error' && (
              <>
                <div className="notice">
                  <strong>Chat couldn’t start.</strong>
                  <p>{error}</p>
                  <div className="btn-row">
                    <button className="btn" onClick={chat.enable}>
                      Try again
                    </button>
                    {tier === 'standard' && (
                      <button
                        className="btn"
                        onClick={() => {
                          setTier('lite')
                          chat.setPhase('gated')
                        }}
                      >
                        Use the Lite model
                      </button>
                    )}
                  </div>
                  <p>The rest of the exhibit is unaffected.</p>
                </div>
                <RecordedAnswers />
              </>
            )}

            {(phase === 'ready' || phase === 'generating') && (
              <>
                {messages.length === 0 && (
                  <div className="chat-empty">
                    <p className="sub">Try one of these, or ask your own question about the exhibit:</p>
                  </div>
                )}
                <ul className="msgs" aria-live="polite">
                  {messages.map((m) => (
                    <li key={m.id} className={`msg ${m.role}${m.refusal ? ' refusal' : ''}`}>
                      {m.content || (m.role === 'assistant' ? <span className="typing">thinking…</span> : null)}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {(phase === 'ready' || phase === 'generating') && (
            <footer className="chat-foot">
              <div className="suggest">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button key={q} className="chip-btn" disabled={busy} onClick={() => send(q)}>
                    {q}
                  </button>
                ))}
              </div>
              <form
                className="chat-input"
                onSubmit={(e) => {
                  e.preventDefault()
                  send(draft)
                }}
              >
                <label htmlFor="chat-q" className="visually-hidden">
                  Your question
                </label>
                <input
                  id="chat-q"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ask about the data, model or results…"
                  autoComplete="off"
                  disabled={busy}
                />
                {busy ? (
                  <button type="button" className="btn" onClick={chat.stop}>
                    Stop
                  </button>
                ) : (
                  <button type="submit" className="btn primary" disabled={!draft.trim()}>
                    Send
                  </button>
                )}
              </form>
              <div className="chat-tools">
                <button className="link-btn" onClick={chat.clearConversation} disabled={busy}>
                  Clear conversation
                </button>
                <button className="link-btn" onClick={chat.forgetModel} disabled={busy}>
                  Remove downloaded model
                </button>
                <span className="meta">Small models make mistakes. Check answers against the page.</span>
              </div>
            </footer>
          )}
        </div>
      )}
    </>
  )
}
