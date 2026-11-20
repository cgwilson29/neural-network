/** The four inputs a visitor controls, and the ranges the network was trained on. */

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const
export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const
export const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17] as const
export const STAFF_MIN = 1
export const STAFF_MAX = 5
export const QUEUE_MIN = 0
export const QUEUE_MAX = 20
export const WAIT_AXIS_MAX = 330 // minutes; a little above the largest wait in the data (324)

export interface Scenario {
  hour: number // 8..17
  day: number // 0..4 (Mon..Fri)
  staff: number // 1..5
  queue: number // 0..20
}

export const DEFAULT_SCENARIO: Scenario = { hour: 9, day: 0, staff: 2, queue: 12 }

const clampInt = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)))

export function clampScenario(s: Scenario): Scenario {
  return {
    hour: clampInt(s.hour, HOURS[0], HOURS[HOURS.length - 1]),
    day: clampInt(s.day, 0, DAYS.length - 1),
    staff: clampInt(s.staff, STAFF_MIN, STAFF_MAX),
    queue: clampInt(s.queue, QUEUE_MIN, QUEUE_MAX),
  }
}

/** Model input row in the ONNX column order: (hour, dayIdx, staff, queue). */
export type InputRow = [number, number, number, number]

export function toRow(s: Scenario): InputRow {
  return [s.hour, s.day, s.staff, s.queue]
}

export function sameScenario(a: Scenario, b: Scenario): boolean {
  return a.hour === b.hour && a.day === b.day && a.staff === b.staff && a.queue === b.queue
}

/** Index into grid_predictions.json, ordered hour, day, staff, queue (10 × 5 × 5 × 21). */
export function gridIndex(hour: number, day: number, staff: number, queue: number): number {
  return (((hour - HOURS[0]) * 5 + day) * 5 + (staff - STAFF_MIN)) * 21 + (queue - QUEUE_MIN)
}

export function formatHour(h: number): string {
  if (h === 12) return '12 pm'
  return h < 12 ? `${h} am` : `${h - 12} pm`
}

export function describeScenario(s: Scenario): string {
  return `${DAY_NAMES[s.day]} at ${formatHour(s.hour)}, ${s.staff} staff on shift, ${s.queue} ${
    s.queue === 1 ? 'patient' : 'patients'
  } in the queue`
}

/** Rows for every staff level × queue length at one hour and day (5 × 21 = 105), staff-major. */
export function surfaceRows(hour: number, day: number): InputRow[] {
  const rows: InputRow[] = []
  for (let s = STAFF_MIN; s <= STAFF_MAX; s++) for (let q = QUEUE_MIN; q <= QUEUE_MAX; q++) rows.push([hour, day, s, q])
  return rows
}

/** Rows for every hour × day at one staffing level and queue (10 × 5 = 50), hour-major. */
export function weekRows(staff: number, queue: number): InputRow[] {
  const rows: InputRow[] = []
  for (const h of HOURS) for (let d = 0; d < DAYS.length; d++) rows.push([h, d, staff, queue])
  return rows
}
