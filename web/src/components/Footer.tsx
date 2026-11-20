import { metrics, modelCard, SITE_LINKS } from '../lib/artifacts'
import { SOUNDTRACK } from '../content/credits'

export function Footer() {
  return (
    <footer className="footer">
      <div className="cols">
        <div>
          <h4>Data</h4>
          <p>
            <a href={SITE_LINKS.data}>clinic-wait-times.csv</a> from the CAI5735 course site:{' '}
            {metrics.dataset.rows.toLocaleString()} <strong>synthetic</strong> clinic visits. No real patients, clinics or
            hospitals are described anywhere on this page. Nothing here is medical or staffing advice.
          </p>
        </div>
        <div>
          <h4>Model</h4>
          <p>
            A {modelCard.training.parameters}-weight neural network trained with PyTorch, exported to ONNX and run in
            your browser by ONNX Runtime Web. The guide bot is Qwen3 running locally through{' '}
            <a href={SITE_LINKS.webllm}>WebLLM</a> and WebGPU.
          </p>
        </div>
        <div>
          <h4>Project</h4>
          <p>
            <a href={SITE_LINKS.repo}>Website source</a> · <a href={SITE_LINKS.notebook}>Training notebook</a> ·{' '}
            <a href={SITE_LINKS.exercise}>Assignment</a>
          </p>
          <p style={{ marginTop: 6 }}>
            Soundtrack: “{SOUNDTRACK[0].title}”, {SOUNDTRACK[0].note.toLowerCase()} Toggle it with ♫ at the top; FX ◈
            switches to calm mode.
          </p>
          <p style={{ marginTop: 6 }}>Queue Cartography · CAI5735 Health Data Exhibit · {new Date(metrics.generatedAt).getFullYear()}</p>
        </div>
      </div>
    </footer>
  )
}
