"use client";

import { useRef, useState } from "react";
import { briefHtml, briefMarkdown } from "@/lib/brief";
import type { ScoutEvent, ScoutResult, TraceStep } from "@/lib/types";
import {
  ActivationPanel,
  AudiencePanel,
  BrandBoard,
  ComparePanel,
  PitchDeck,
  points,
  subtypeLabel,
  TraceList,
} from "./results";

const EXAMPLES = [
  { label: "Chelsea FC", query: "Chelsea FC", compare: "" },
  { label: "LA Dodgers", query: "LA Dodgers", compare: "" },
  { label: "Coachella", query: "Coachella", compare: "" },
  { label: "SmartLess", query: "SmartLess", compare: "" },
];

type RequestBody = {
  query: string;
  compareQuery?: string;
  city?: string;
  entityId?: string;
};

export function ScoutDesk() {
  const [query, setQuery] = useState("Chelsea FC");
  const [compare, setCompare] = useState("");
  const [city, setCity] = useState("");
  const [entityId, setEntityId] = useState<string | undefined>();
  const [steps, setSteps] = useState<TraceStep[]>([]);
  const [result, setResult] = useState<ScoutResult | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  async function scout(body: RequestBody) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setError(null);
    setCopied(false);
    setResult(null);
    setSelectedId(null);
    setSteps([]);
    setLiveMessage("Scout started.");
    try {
      const response = await fetch("/api/scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Scout failed.");
      }
      await readEvents(response, (event) => {
        if (event.type === "step") {
          setSteps((current) => {
            const next = current.filter((step) => step.id !== event.step.id);
            next.push(event.step);
            next.sort((a, b) => a.cue.localeCompare(b.cue));
            return next;
          });
          setLiveMessage(`${event.step.cue} ${event.step.title}: ${event.step.status}.`);
        } else if (event.type === "result") {
          setResult(event.result);
          setSteps(event.result.trace);
          setSelectedId(event.result.brands[0]?.id ?? null);
          setLiveMessage(
            event.result.needsConfirmation
              ? "Search needs a confirmation."
              : `Board ready for ${event.result.property.name}.`,
          );
        } else {
          setError(event.message);
          setLiveMessage(event.message);
        }
      });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Scout failed.");
    } finally {
      if (abortRef.current === controller) setRunning(false);
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    void scout({
      query,
      compareQuery: compare.trim() || undefined,
      city: city.trim() || undefined,
      entityId,
    });
  }

  const leader = result?.brands[0];

  return (
    <main className="shell">
      <p className="sr" aria-live="polite">
        {liveMessage}
      </p>
      <header className="topbar">
        <div className="mark">
          <div className="mark-badge" aria-hidden="true">
            SF
          </div>
          <div className="word">
            SponsorFit
            <small>Sponsorship desk</small>
          </div>
        </div>
        <nav className="top-links" aria-label="Sections">
          <a href="#board">Board</a>
          <a href="#audience">Audience</a>
          <a href="#pitches">Pitches</a>
        </nav>
      </header>

      <section className={result ? "hero compact" : "hero"}>
        <p className="eyebrow">Qloo Taste AI for sponsorship teams</p>
        <h1>
          The room already has a <span>favorite brand.</span>
        </h1>
        <p className="lede">
          Name a team, creator, artist, or event. SponsorFit resolves it in Qloo, ranks the brands that audience
          over-indexes on, and writes the pitch from those signals alone.
        </p>
        {result || running ? null : (
          <ol className="steps-preview">
            <li>
              <strong>01</strong> Resolve the property
            </li>
            <li>
              <strong>02</strong> Rank brand fit
            </li>
            <li>
              <strong>03</strong> Brief the top names
            </li>
          </ol>
        )}
      </section>

      <section className="desk" aria-label="Scout a property">
        <form className="form" onSubmit={onSubmit}>
          <label className="field">
            <span>Property</span>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setEntityId(undefined);
              }}
              placeholder="Chelsea FC"
              aria-label="Property"
              required
              maxLength={80}
            />
          </label>
          <label className="field">
            <span>Compare with</span>
            <input
              value={compare}
              onChange={(event) => setCompare(event.target.value)}
              placeholder="LA Dodgers"
              aria-label="Compare with"
              maxLength={80}
            />
          </label>
          <label className="field">
            <span>Activation city</span>
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Optional"
              aria-label="Activation city"
              maxLength={80}
            />
          </label>
          <button className="scout-btn" type="submit" disabled={running}>
            {running ? "Scouting" : "Scout"}
          </button>
        </form>
        <div className="chips">
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              className="chip"
              onClick={() => {
                setQuery(example.query);
                setCompare("");
                setEntityId(undefined);
                void scout({ query: example.query });
              }}
            >
              <strong>{example.label}</strong>
            </button>
          ))}
          <button
            type="button"
            className="chip"
            onClick={() => {
              setQuery("Chelsea FC");
              setCompare("LA Dodgers");
              setEntityId(undefined);
              void scout({ query: "Chelsea FC", compareQuery: "LA Dodgers" });
            }}
          >
            <strong>Chelsea vs Dodgers</strong>
            <em>compare</em>
          </button>
        </div>

        {error ? (
          <div className="alert" role="alert">
            <p>{error}</p>
          </div>
        ) : null}

        {result ? (
          <div className="banner">
            <div>
              <span className={result.source === "demo" ? "badge demo" : "badge live"}>
                <i />
                {result.source === "demo" ? "Demo data" : "Live Qloo data"}
              </span>
              <ul className="warnings">
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </section>

      <div className="work">
        <TraceList steps={steps} />
        <div>
          {result?.needsConfirmation ? (
            <section className="panel">
              <div className="panel-head">
                <h2>Which entity?</h2>
                <p className="kicker">Qloo search returned close names.</p>
              </div>
              <div className="alts" style={{ padding: 14 }}>
                {result.alternatives.map((entity) => (
                  <button
                    key={entity.id}
                    type="button"
                    className="alt"
                    onClick={() => {
                      setQuery(entity.name);
                      setEntityId(entity.id);
                      void scout({
                        query: entity.name,
                        entityId: entity.id,
                        compareQuery: compare.trim() || undefined,
                        city: city.trim() || undefined,
                      });
                    }}
                  >
                    {entity.name}
                    <span className="sub">
                      {subtypeLabel(entity.subtype)}
                      {entity.disambiguation ? ` · ${entity.disambiguation}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {result && !result.needsConfirmation ? (
            <>
              <div className="dossier" id="board">
                <div>
                  <h2>{result.property.name}</h2>
                  <p>
                    {subtypeLabel(result.property.subtype)}
                    {result.property.disambiguation ? ` · ${result.property.disambiguation}` : ""}
                    {result.property.description ? ` ${result.property.description}` : ""}
                  </p>
                </div>
                <div className="leader">
                  <span>Lead fit</span>
                  <b>{points(leader?.fit)}</b>
                  <span>{leader?.name ?? "No scored brand"}</span>
                </div>
              </div>
              <BrandBoard brands={result.brands} selectedId={selectedId} onSelect={setSelectedId} />
              <div className="split" id="audience">
                <AudiencePanel audience={result.audience} taste={result.taste} />
                <ActivationPanel activation={result.activation} />
              </div>
              {result.compare ? <ComparePanel compare={result.compare} /> : null}
              <PitchDeck pitches={result.pitches} />
              <div className="actions">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    void navigator.clipboard.writeText(briefMarkdown(result)).then(
                    () => setCopied(true),
                    () => setError("Clipboard is unavailable. Download the brief instead."),
                  );
                  }}
                >
                  {copied ? "Copied" : "Copy brief"}
                </button>
                <button type="button" className="ghost" onClick={() => download(result, "md")}>
                  Download Markdown
                </button>
                <button type="button" className="ghost" onClick={() => download(result, "html")}>
                  Download one-page HTML
                </button>
              </div>
            </>
          ) : null}

          {running && !result ? (
            <section className="panel">
              <div className="panel-head">
                <h2>In the room</h2>
              </div>
              <p className="formula">The trace on the left is the agent. The board lands when the last cue closes.</p>
            </section>
          ) : null}

          {!result && !running ? (
            <section className="panel">
              <div className="panel-head">
                <h2 id="board">Empty desk</h2>
              </div>
              <p className="formula">
                Judges can open Chelsea FC or the LA Dodgers with one click. Without a Qloo key the same four
                properties run on a labeled sample. Nothing here is a cached live response.
              </p>
            </section>
          ) : null}
        </div>
      </div>

      <p className="privacy">
        Results describe audience groups, not individuals. SponsorFit sends public cultural names only. It does not
        send personal names, emails, or device ids, and it does not infer health, politics, religion, or finances.
        A Fit Score is this product reading of returned Qloo signals. It is not itself a Qloo metric, and an affinity
        is not a claim about any one person.
      </p>
    </main>
  );
}

function download(result: ScoutResult, kind: "md" | "html") {
  const contents = kind === "md" ? briefMarkdown(result) : briefHtml(result);
  const blob = new Blob([contents], { type: kind === "md" ? "text/markdown" : "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const slug = result.property.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  link.download = `sponsorfit-${slug}.${kind === "md" ? "md" : "html"}`;
  link.click();
  URL.revokeObjectURL(url);
}

async function readEvents(response: Response, onEvent: (event: ScoutEvent) => void) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty scout response.");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk
        .split("\n")
        .map((item) => item.trim())
        .find((item) => item.startsWith("data:"));
      if (!line) continue;
      onEvent(JSON.parse(line.slice(5)) as ScoutEvent);
    }
  }
}
