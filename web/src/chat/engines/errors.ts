export function describeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/quota|NO_DEVICE_SPACE|QuotaExceeded/i.test(msg))
    return 'Your browser ran out of storage space for the model. Free some space, pick a smaller model, or avoid private windows.'
  if (/fetch|network|Failed to fetch|NetworkError|Load failed/i.test(msg))
    return 'The model download was interrupted. Check your connection and try again.'
  if (/device.*lost|DeviceLost|out of memory|OOM|Out of memory/i.test(msg))
    return 'The device ran out of memory. Close other heavy tabs or pick a smaller model.'
  if (/sanity/i.test(msg)) return msg
  return `The chat model could not start: ${msg.slice(0, 220)}`
}

export class SanityError extends Error {
  constructor(answer: string) {
    super(
      `Sanity check failed: the model loaded but answered a simple guide question incorrectly ("${answer.slice(0, 80)}"). This browser's GPU may be computing incorrectly; CPU mode is safer here.`,
    )
    this.name = 'SanityError'
  }
}
