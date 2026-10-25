import { ExternalLink, Mic } from "lucide-react";
import { getServerEngine } from "@/lib/engine";
import { AiSettings } from "@/components/app/AiSettings";
import { LinkButton } from "@/components/ui";

export const metadata = { title: "Settings & keys" };

export default function Settings() {
  const server = getServerEngine();
  return (
    <div>
      <div className="label flex items-center gap-2.5"><span className="h-[7px] w-[7px] bg-safety" /> Settings</div>
      <h1 className="cond mt-4 text-[clamp(56px,8vw,128px)]">Your engine.<br /><span className="text-safety">Your voice.</span></h1>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.25fr_1fr]">
        <section>
          <div className="mb-0 border-b border-ink pb-3"><h2 className="cond text-[40px]">Bring your own key</h2></div>
          <p className="mt-4 max-w-[60ch] text-[14.5px] leading-relaxed text-ink-2">
            No code, no environment variables. Paste an Anthropic key (or any OpenAI-compatible API) and every entry you dictate is structured by that model — straight from the live site.
            Currently the server default is <b className="text-ink">{server.label}</b>.
          </p>
          <div className="surface mt-6"><AiSettings /></div>
        </section>

        <section>
          <div className="border-b border-ink pb-3"><h2 className="cond text-[40px]">Dictation</h2></div>
          <div className="mt-4 space-y-5 text-[14.5px] leading-relaxed text-ink-2">
            <p>Plumbline is built to be spoken to. <b className="text-ink">Wispr Flow</b> types into any text field, so the whole app is voice-driven: dictate the entry, then dictate the answer to every question Plumbline asks.</p>
            <ol className="space-y-3">
              {[
                ["Install Wispr Flow", "Free credits with the referral link below."],
                ["Click into the entry box", "It’s focused for you when you open a new entry."],
                ["Hold your Flow hotkey and talk", "Flow removes filler words and punctuates. Plumbline detects the dictation burst and counts it."],
                ["Tap “Guide me by voice”", "Plumbline asks the next missing detail aloud — hours lost, who’s responsible — and you answer with the same hotkey."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-4 border-t border-line pt-3"><span className="font-mono text-[12px] text-safety">0{i + 1}</span><span><b className="text-ink">{t}</b><br /><span className="text-mute">{d}</span></span></li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-2 pt-2">
              <a href="https://ref.wisprflow.ai/hhg" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 bg-safety px-5 font-mono text-[12px] uppercase tracking-[0.05em] text-on-safety hover:bg-white"><Mic className="h-4 w-4" /> Get Wispr Flow <ExternalLink className="h-3.5 w-3.5" /></a>
              <LinkButton href="/app" variant="ghost">Open a project</LinkButton>
            </div>
            <p className="text-[12.5px] text-mute">No Wispr Flow? The built-in mic (Chrome / Edge) works too, with voice commands: “scratch that”, “new paragraph”, “seal entry”.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
