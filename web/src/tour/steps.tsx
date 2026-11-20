/**
 * The onboarding tour: ~10 steps, several of which advance when the visitor actually does the thing
 * ("learn by doing"). Text uses the live predictions, so numbers always match the map.
 */
import type { ReactNode } from 'react'
import type { Placement } from '@floating-ui/dom'
import { DEFAULT_SCENARIO } from '../lib/domain'
import { metrics } from '../lib/artifacts'
import type { CorePredictions } from '../lib/useCorePredictions'
import { useExhibit } from '../state/store'

type Exhibit = ReturnType<typeof useExhibit.getState>

export interface TourStep {
  id: string
  /** CSS selector of the element to spotlight. */
  target: string
  title: string
  body: (core: CorePredictions) => ReactNode
  placement?: Placement
  /** Dock the popover in a corner instead of next to the target (for full-screen targets). */
  dock?: boolean
  scroll?: 'top' | 'center' | 'start'
  onEnter?: () => void
  /** Learn-by-doing: the step completes when this returns true. */
  action?: {
    hint: string
    done: (now: Exhibit, atStart: Exhibit) => boolean
    doneText: (core: CorePredictions, atStart: Exhibit) => ReactNode
  }
  final?: boolean
}

const min = (x: number) => `${Math.round(x)} min`

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'map',
    target: '[data-tour="map"]',
    title: 'This is a map of waiting',
    dock: true,
    scroll: 'top',
    onEnter: () => {
      const s = useExhibit.getState()
      s.setScenario(DEFAULT_SCENARIO)
      s.clearPin()
      s.setPointFilter('hour')
      s.focusVisit(null)
    },
    body: () => (
      <>
        Height and color show the wait a neural network predicts for every combination of <strong>staff on shift</strong>{' '}
        and <strong>patients in the queue</strong>. Glowing lines join equal waits, every 30 minutes. Drag to orbit, scroll
        to zoom.
      </>
    ),
  },
  {
    id: 'readout',
    target: '[data-tour="readout"]',
    title: 'Your clinic’s predicted wait',
    placement: 'right',
    scroll: 'top',
    body: (c) => (
      <>
        Right now: Monday 9 am, 2 staff, 12 patients waiting → <strong>{min(c.scenarioWait)}</strong>. The typical range
        is how far off the network usually is. The baseline is what you’d get by always guessing the median wait.
      </>
    ),
  },
  {
    id: 'staff',
    target: '[data-tour="staff"]',
    title: 'Try it: add a staff member',
    placement: 'right',
    scroll: 'top',
    body: () => <>Click a bigger number. The glowing beacon on the map slides down the slope as the wait drops.</>,
    action: {
      hint: 'Waiting for you to change the staff…',
      done: (now, start) => now.scenario.staff !== start.scenario.staff,
      doneText: (c, start) => {
        const before = c.staffCurve[start.scenario.staff - 1]
        const diff = before - c.scenarioWait
        return (
          <>
            {c.scenario.staff} staff → <strong>{min(c.scenarioWait)}</strong> ({diff >= 0 ? `${Math.round(diff)} min shorter` : `${Math.round(-diff)} min longer`}).
          </>
        )
      },
    },
  },
  {
    id: 'queue',
    target: '[data-tour="queue"]',
    title: 'Now make the line longer',
    placement: 'right',
    scroll: 'top',
    body: () => <>Drag the queue slider. Each extra patient costs roughly 15 minutes, divided by the staff on shift.</>,
    action: {
      hint: 'Waiting for the queue to change by 2 or more…',
      done: (now, start) => Math.abs(now.scenario.queue - start.scenario.queue) >= 2,
      doneText: (c) => (
        <>
          {c.scenario.queue} patients with {c.scenario.staff} staff → <strong>{min(c.scenarioWait)}</strong>.
        </>
      ),
    },
  },
  {
    id: 'dots',
    target: '[data-tour="legend"]',
    title: 'Real test visits float above and below',
    placement: 'left',
    scroll: 'top',
    body: () => (
      <>
        Each white dot is one of the 300 visits the network never saw during training, at its actual wait. The thin stem
        joins it to the prediction: short stems mean small errors. Use <strong>Test visits shown</strong> to see more.
      </>
    ),
  },
  {
    id: 'pin',
    target: '[data-tour="pin"]',
    title: 'Pin a scenario to compare',
    placement: 'right',
    scroll: 'top',
    body: () => <>Pin this clinic, then change anything: both beacons stay on the map and the Discovery section compares them.</>,
    action: {
      hint: 'Click “Pin to compare”…',
      done: (now) => now.pinned !== null,
      doneText: () => <>Pinned. Change a control later and the amber beacon stays put.</>,
    },
  },
  {
    id: 'discovery',
    target: '[data-tour="discovery-curve"]',
    title: 'The discovery: diminishing returns',
    placement: 'top',
    scroll: 'center',
    body: (c) => {
      const q = c.scenario.queue
      return (
        <>
          At {q} patients, going from 1 to 2 staff saves <strong>{min(c.staffCurve[0] - c.staffCurve[1])}</strong>; going from
          4 to 5 saves just <strong>{min(c.staffCurve[3] - c.staffCurve[4])}</strong>. The network worked that curve out from
          examples alone.
        </>
      )
    },
  },
  {
    id: 'evaluation',
    target: '[data-tour="tiles"]',
    title: 'How good is it?',
    placement: 'bottom',
    scroll: 'center',
    body: () => (
      <>
        On 300 visits locked away until the end, the network is off by <strong>{metrics.headline.nnMae.toFixed(1)} min</strong> on
        average; always guessing the median is off by {metrics.headline.baselineMae.toFixed(0)}. Scroll down for its biggest
        miss and why.
      </>
    ),
  },
  {
    id: 'xray',
    target: '[data-tour="xray"]',
    title: 'Look inside the network',
    placement: 'top',
    scroll: 'center',
    body: () => <>Every circle is a neuron. They light up live for your clinic, straight from the model running in your browser.</>,
  },
  {
    id: 'chat',
    target: '[data-tour="chat"]',
    title: 'Ask the guide bot',
    placement: 'bottom-end',
    scroll: 'center',
    final: true,
    body: () => (
      <>
        It answers from the exhibit’s guide and runs entirely on your device. It uses WebLLM on your GPU where the
        browser allows, a smaller CPU model where it doesn’t, and instant guide search everywhere. Nothing downloads until
        you choose <strong>Enable chat</strong>.
      </>
    ),
  },
]
