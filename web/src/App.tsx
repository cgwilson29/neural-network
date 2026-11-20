import { useCallback, useEffect } from 'react'
import { TopBar } from './components/TopBar'
import { Hero } from './components/Hero'
import { DiscoverySection } from './components/DiscoverySection'
import { EvaluationSection } from './components/EvaluationSection'
import { NetworkXRay } from './components/NetworkXRay'
import { GuideSection } from './components/GuideSection'
import { ChatDock } from './components/ChatDock'
import { Footer } from './components/Footer'
import { useCorePredictions } from './lib/useCorePredictions'
import { warmUp } from './lib/predictor'
import { describeScenario } from './lib/domain'
import { liveScenarioSummary } from './chat/prompt'
import { useExhibit } from './state/store'
import { TourOverlay } from './tour/TourOverlay'
import { WelcomeCard } from './tour/WelcomeCard'
import { useTour } from './tour/useTour'
import { DataRain, FxRoot, ScanlineOverlay, useRandomGlitch } from './fx/Effects'
import { Ticker } from './fx/Ticker'
import { BootSequence } from './fx/BootSequence'
import { Soundtrack } from './fx/Soundtrack'

export default function App() {
  const core = useCorePredictions()
  const setChatOpen = useExhibit((s) => s.setChatOpen)

  useEffect(() => {
    // Load ONNX Runtime after first paint; the precomputed table covers the meantime.
    const id = window.setTimeout(warmUp, 50)
    return () => window.clearTimeout(id)
  }, [])
  useRandomGlitch()

  // Offer the tour to first-time visitors once the boot sequence (if any) is over.
  const afterBoot = useCallback(() => {
    window.setTimeout(() => useTour.getState().showWelcomeIfNew(), 600)
  }, [])

  const scenarioText = liveScenarioSummary(describeScenario(core.scenario), core.scenarioWait, core.plusOneWait)

  return (
    <>
      <a className="skip-link" href="#discovery">
        Skip to the findings
      </a>
      <FxRoot />
      <Soundtrack />
      <DataRain />
      <TopBar ticker={<Ticker core={core} />} />
      <main>
        <Hero core={core} />
        <DiscoverySection core={core} />
        <EvaluationSection />
        <section className="section" id="xray" aria-labelledby="xray-title">
          <div className="section-head">
            <div className="eyebrow">Inside the network</div>
            <h2 id="xray-title">Watch the neurons respond to your clinic</h2>
            <p>
              Change the controls at the top and this diagram updates: the same 17 → 16 → 8 → 1 network that draws the
              map, with each neuron’s live activation for your scenario.
            </p>
          </div>
          <NetworkXRay core={core} />
        </section>
        <GuideSection onOpenChat={() => setChatOpen(true)} />
      </main>
      <Footer />
      <ChatDock scenarioText={scenarioText} />
      <WelcomeCard />
      <BootSequence onDone={afterBoot} />
      <ScanlineOverlay />
      <TourOverlay core={core} />
    </>
  )
}
