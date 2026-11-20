/** Credits for media used on the site (shown in the footer and README; unit-tested for completeness). */
export interface MediaCredit {
  title: string
  creator: string
  license: string
  source: string
  note: string
}

export const SOUNDTRACK: MediaCredit[] = [
  {
    title: 'Neon Cartography',
    creator: 'Queue Cartography project (original composition in code)',
    license: 'Same terms as this repository’s source code — no third-party samples or recordings',
    source: 'https://github.com/cgwilson29/neural-network/blob/main/web/src/fx/synth.ts',
    note: 'Synthwave loop synthesized live in your browser with the Web Audio API; nothing is downloaded.',
  },
]
