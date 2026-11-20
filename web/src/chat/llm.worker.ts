/// <reference lib="webworker" />
/**
 * Runs WebLLM in a dedicated worker so the page stays responsive while the model loads and talks.
 */
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm'
import { installStorageBufferShim } from './gpuShim'

installStorageBufferShim((self as unknown as { navigator: { gpu?: unknown } }).navigator.gpu)

const handler = new WebWorkerMLCEngineHandler()
self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg)
}
