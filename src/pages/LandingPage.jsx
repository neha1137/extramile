import Footer from "../components/Footer";
import Hero from "../components/Hero";
import Competition from "../components/Competition";
import StartupEcosystem from "../components/StartupEcosystem";
import Impact from "../components/Impact";
import Partners from "../components/Partners";
import Contact from "../components/Contact";
import Navbar from "../components/Navbar";
import Stars from "../components/Stars";
import MotionSection from "../components/MotionSection";
import ScrollScene from "../components/ScrollScene";

const scenes = [
  { component: Competition, chapter: "START", index: "01", strength: 1.15 },
  { component: StartupEcosystem, chapter: "CONNECT", index: "02", strength: 1.3 },
  { component: Impact, chapter: "AMPLIFY", index: "03", strength: 0.95 },
  { component: Partners, chapter: "EXPAND", index: "04", strength: 0.85 },
  { component: Contact, chapter: "CONTINUE", index: "05", strength: 1.1 },
];

export default function LandingPage() {
  return (
    <div className="page">
      <Stars />
      <Navbar />

      <main>
        <Hero />

        {scenes.map(({ component: Scene, chapter, index, strength }) => (
          <ScrollScene
            key={chapter}
            chapter={chapter}
            index={index}
            strength={strength}
          >
            <MotionSection
              delay={index === "01" ? 0 : 45}
              intensity={index === "03" || index === "04" ? "soft" : "strong"}
            >
              <Scene />
            </MotionSection>
          </ScrollScene>
        ))}
      </main>

      <Footer />
    </div>
  );
}
