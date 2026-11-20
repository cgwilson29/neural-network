import { Fragment, type ReactNode } from 'react'
import { GUIDE_TEXT } from '../content/guide'

/** Minimal renderer for the guide's own controlled Markdown: ## headings, - lists, **bold**, paragraphs. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  )
}

export function MarkdownLite({ source }: { source: string }) {
  const blocks = source.split(/\n\s*\n/)
  const out: ReactNode[] = []
  blocks.forEach((block, bi) => {
    const lines = block.split('\n')
    let list: string[] = []
    const flush = () => {
      if (list.length) {
        out.push(
          <ul key={`ul${bi}-${out.length}`}>
            {list.map((l, i) => (
              <li key={i}>{inline(l)}</li>
            ))}
          </ul>,
        )
        list = []
      }
    }
    for (const line of lines) {
      if (line.startsWith('## ')) {
        flush()
        out.push(<h3 key={`h${bi}-${out.length}`}>{line.slice(3)}</h3>)
      } else if (line.startsWith('- ')) {
        list.push(line.slice(2))
      } else if (line.trim()) {
        flush()
        out.push(<p key={`p${bi}-${out.length}`}>{inline(line)}</p>)
      }
    }
    flush()
  })
  return <>{out}</>
}

export function GuideSection({ onOpenChat }: { onOpenChat: () => void }) {
  return (
    <section className="section" id="guide" aria-labelledby="guide-title">
      <div className="section-head">
        <div className="eyebrow">The guide</div>
        <h2 id="guide-title">What the chatbot knows: this guide and nothing else</h2>
        <p>
          The guide bot answers questions using only the text below (plus the scenario you’ve set on the map). When the
          guide doesn’t cover something, it is instructed to say so.
        </p>
        <div className="btn-row">
          <button className="btn primary" onClick={onOpenChat}>
            Ask the guide bot
          </button>
        </div>
      </div>
      <div className="card guide">
        <div className="guide-body">
          <MarkdownLite source={GUIDE_TEXT} />
        </div>
      </div>
    </section>
  )
}
