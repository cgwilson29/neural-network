/// <reference lib="webworker" />
/**
 * Runs WebLLM in a dedicated worker so the page stays responsive while the model loads and talks.
 */
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm'

const handler = new WebWorkerMLCEngineHandler()
self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg)
}
