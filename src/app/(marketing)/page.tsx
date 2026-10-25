import { Hero, Nav } from "@/components/landing/Hero";
import { Tape } from "@/components/landing/Marquee";
import { Statement } from "@/components/landing/Statement";
import { Story } from "@/components/landing/Story";
import { Ledger } from "@/components/landing/Ledger";
import { ChainPlayground } from "@/components/landing/ChainPlayground";
import { Compare, Engine, Finale } from "@/components/landing/Engine";
import { ByokSection, FlowSection } from "@/components/landing/FlowSection";

export default function Landing() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Tape />
        <Statement />
        <Story />
        <Ledger />
        <ChainPlayground />
        <Engine />
        <FlowSection />
        <ByokSection />
        <Compare />
        <Finale />
      </main>
    </>
  );
}
