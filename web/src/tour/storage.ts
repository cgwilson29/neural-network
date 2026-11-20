/** Remembers (per browser) whether the visitor has seen the tour. Works without storage, too. */
const KEY = 'qc.tour.v1'
export type TourMemory = 'done' | 'dismissed' | null

export function readTourMemory(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): TourMemory {
  try {
    const v = storage?.getItem(KEY)
    return v === 'done' || v === 'dismissed' ? v : null
  } catch {
    return null
  }
}

export function writeTourMemory(value: Exclude<TourMemory, null>, storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(KEY, value)
  } catch {
    /* private mode / blocked storage: the welcome card may show again next visit */
  }
}
