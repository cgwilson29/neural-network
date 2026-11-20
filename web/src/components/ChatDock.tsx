import { useEffect, useRef, useState } from 'react'
import { useChat, type ChatMessage } from '../chat/useChat'
import type { EngineKind } from '../chat/models'
import { RECORDED_QA } from '../content/recordedAnswers'
import { useExhibit } from '../state/store'

export const SUGGESTED_QUESTIONS = [
  'Where did your data come from?',
  'How did your model compare with the baseline?',
  'How well did this model work on a dataset you never tested?',
]

const ENGINE: Record<EngineKind, { title: string; desc: string }> = {
  webllm: { title: 'WebLLM · on your GPU', desc: 'A small language model runs on your graphics chip with WebLLM.' },
  wllama: {
    title: 'CPU mode · llama.cpp (not WebLLM)',
    desc: 'A smaller model runs on your processor with wllama. Slower, and not WebLLM, but works where WebLLM can’t.',
  },
  search: { title: 'Guide search · no AI', desc: 'Shows the matching guide text instantly. Nothing to download; never makes things up.' },
}

function sourceTag(m: ChatMessage): string {
  if (m.source === 'webllm') return `WebLLM · ${m.modelLabel}`
  if (m.source === 'wllama') return `CPU mode · ${m.modelLabel} · not WebLLM`
  return `Guide search · not AI-generated${m.from ? ` · from “${m.from}”` : ''}`
}

function RecordedAnswers() {
  return (
    <details className="recorded">
      <summary>Recorded answers from our chatbot tests</summary>
      {RECORDED_QA.map((qa) => (
        <details key={qa.q}>
          <summary>{qa.q}</summary>
          <p>{qa.a}</p>
          <p className="meta">{qa.meta}</p>
        </details>
      ))}
    </details>
  )
}

export function ChatDock({ scenarioText }: { scenarioText: string }) {
  const open = useExhibit((s) => s.chatOpen)
  const setOpen = useExhibit((s) => s.setChatOpen)
  const chat = useChat(scenarioText)
  const [draft, setDraft] = useState('')
  const [setupOpen, setSetupOpen] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const { phase, choice, engineKind, modelKey, modelChoices, progress, error, messages, cached, activeInfo } = chat

  useEffect(() => {
    if (open) {
      chat.start()
      panelRef.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  const send = (q: string) => {
    if (!q.trim()) return
    if (messages.length === 0) setSetupOpen(false)
    chat.ask(q)
    setDraft('')
  }

  const busy = phase === 'generating'
  const modelReady = phase === 'ready' || phase === 'generating'
  const loading = phase === 'loading' || phase === 'checking'
  const badge = activeInfo
    ? activeInfo.kind === 'webllm'
      ? `WebLLM · ${activeInfo.label}`
      : `CPU mode · ${activeInfo.label} · not WebLLM`
    : 'Guide search · not AI'

  return (
    <>
      {!open && (
        <button className="chat-launcher" data-tour="chat" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label="Ask the guide bot">
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
              <span className={`engine-badge ${activeInfo?.kind ?? 'search'}`}>{badge}</span>
            </div>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close chat">
              ✕
            </button>
          </header>

          <div className="chat-body" ref={listRef}>
            {phase === 'probing' && <p className="sub">Checking what this browser can run…</p>}

            {/* Model setup: which engine, which model, Enable. Collapses once the conversation starts. */}
            {choice && !modelReady && !loading && (
              <section className="setup" aria-label="Chat setup">
                {!setupOpen && messages.length > 0 ? (
                  <button className="link-btn" onClick={() => setSetupOpen(true)}>
                    Answers are coming from guide search. Set up AI chat ▾
                  </button>
                ) : (
                  <>
                    <p className="reason">{choice.reason}</p>
                    <fieldset className="model-pick">
                      <legend>Chat engine</legend>
                      {choice.available.map((k) => (
                        <label key={k} className={engineKind === k ? 'on' : ''}>
                          <input type="radio" name="engine" checked={engineKind === k} onChange={() => chat.selectEngine(k)} />
                          <span>
                            <strong>
                              {ENGINE[k].title}
                              {k === choice.tier ? ' · recommended' : ''}
                            </strong>
                            <span className="meta">{ENGINE[k].desc}</span>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    {engineKind !== 'search' && (
                      <>
                        {modelChoices.length > 1 && (
                          <fieldset className="model-pick">
                            <legend>Model</legend>
                            {modelChoices.map((m) => (
                              <label key={m.key} className={modelKey === m.key ? 'on' : ''}>
                                <input type="radio" name="model" checked={modelKey === m.key} onChange={() => chat.setModelKey(m.key)} />
                                <span>
                                  <strong>{m.label}</strong>
                                  <span className="meta">{cached[m.key] ? 'Already downloaded' : `~${m.downloadMB} MB download`}</span>
                                </span>
                              </label>
                            ))}
                          </fieldset>
                        )}
                        <button className="btn primary" onClick={chat.enable}>
                          Enable chat
                          {modelChoices[0] && (
                            <span className="btn-meta">
                              {modelChoices.find((m) => m.key === modelKey)?.label} ·{' '}
                              {cached[modelKey] ? 'cached' : `~${modelChoices.find((m) => m.key === modelKey)?.downloadMB} MB`}
                            </span>
                          )}
                        </button>
                        <p className="meta">Nothing downloads until you click. Until the model is ready, guide search answers your questions.</p>
                      </>
                    )}
                    {error && (
                      <div className="notice" role="alert">
                        <strong>Chat couldn’t start.</strong>
                        <p>{error}</p>
                      </div>
                    )}
                    <details className="why">
                      <summary>Why this mode?</summary>
                      <ul>
                        {choice.facts.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                    </details>
                  </>
                )}
              </section>
            )}

            {loading && (
              <div className="loading" aria-live="polite">
                <p>
                  <strong>{phase === 'checking' ? 'Checking the model answers correctly…' : `Loading ${modelChoices.find((m) => m.key === modelKey)?.label ?? 'model'}…`}</strong>
                </p>
                <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.fraction * 100)}>
                  <span style={{ width: `${Math.max(2, progress.fraction * 100)}%` }} />
                </div>
                <p className="meta num">
                  {Math.round(progress.fraction * 100)}% · {progress.text}
                </p>
                <p className="meta">Ask away meanwhile: guide search answers instantly.</p>
              </div>
            )}

            {modelReady && (
              <p className="status-line">
                <span className="dot ok" /> Ready: {activeInfo?.label} {activeInfo?.kind === 'webllm' ? 'via WebLLM on your GPU' : 'on your CPU (not WebLLM)'}
              </p>
            )}

            {messages.length === 0 && phase !== 'probing' && (
              <div className="chat-empty">
                <p className="sub">Ask about the data, the model or its results, or try a suggestion below.</p>
                <RecordedAnswers />
              </div>
            )}

            <ul className="msgs" aria-live="polite">
              {messages.map((m) => (
                <li key={m.id} className={`msg ${m.role}${m.refusal ? ' refusal' : ''}${m.source === 'search' ? ' search' : ''}`}>
                  {m.content || (m.role === 'assistant' ? <span className="typing">thinking…</span> : null)}
                  {m.role === 'assistant' && <span className="src-tag">{sourceTag(m)}</span>}
                </li>
              ))}
            </ul>
          </div>

          <footer className="chat-foot">
            <div className="suggest">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button key={q} className="chip-btn" disabled={busy || phase === 'probing'} onClick={() => send(q)}>
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
                disabled={busy || phase === 'probing'}
              />
              {busy ? (
                <button type="button" className="btn" onClick={chat.stop}>
                  Stop
                </button>
              ) : (
                <button type="submit" className="btn primary" disabled={!draft.trim() || phase === 'probing'}>
                  Send
                </button>
              )}
            </form>
            <div className="chat-tools">
              <button className="link-btn" onClick={chat.clearConversation} disabled={busy}>
                Clear conversation
              </button>
              {modelReady && (
                <button className="link-btn" onClick={chat.forgetModel} disabled={busy}>
                  Remove downloaded model
                </button>
              )}
              <span className="meta">Small models make mistakes. Check answers against the page.</span>
            </div>
          </footer>
        </div>
      )}
    </>
  )
}
