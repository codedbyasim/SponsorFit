# SponsorFit — Devpost draft

Working draft for the Qloo Agent Hackathon submission. Trim to the Devpost character limits before pasting.

## Inspiration

Sponsorship conversations still open with the property’s logo and a guess about the room. Chelsea, the Dodgers, a festival, a podcast: the audience already concentrates on some brands and walks past others. We wanted a desk a partnerships lead could put on a screen in a meeting — not another taste quiz, and not a cultural-DNA poster — that starts from that concentration and will not invent a number to make the slide work.

The judges include people who actually buy and sell these partnerships. The demo had to survive “show me Chelsea” and “now put the Dodgers next to them.”

## What it does

You type a public team, creator, artist, or event, or you hit one example. SponsorFit:

1. Resolves the name to a Qloo entity.
2. Pulls brand affinities for that audience, with explainability when Qloo returns it.
3. Adds demographics, taste tags, and a cross-domain snapshot (artists, movies, destinations).
4. Optionally maps activation pockets for the lead brand inside a returned or typed city.
5. Optionally compares two properties: shared sponsor names from the two insight lists, plus tags from Qloo’s compare endpoint.
6. Scores each brand with a printed Fit Score.
7. Writes a short pitch for the top brands. Every figure has to trace to a returned signal or the draft is discarded.
8. Exports the brief as copy, Markdown, or a one-page printable HTML file.

A badge says **Live Qloo data**: every board is built from Qloo responses at request time. There is no account. Judges click Chelsea FC and get a board.

## How we built it

Next.js (App Router, TypeScript) on Vercel, one project, free tier. Qloo is called only from a server route. The browser receives a stream of agent cues and the finished board.

The Qloo surface is the hackathon host and the documented parameters: `/search`, `/entities`, `/v2/insights` for `urn:entity:brand`, `urn:demographics`, `urn:tag`, `urn:entity:artist`, `urn:entity:movie`, `urn:entity:destination`, and `urn:heatmap`, plus `/v2/analysis/compare`. `feature.explainability=true` is sent on entity insights. `take` never exceeds 50.

Fit Score is local and explicit: 60% affinity, 25% popularity, 15% cosine alignment of the age-index vectors, with missing terms dropped and the rest renormalized. Pitches go through the AIML API (`gpt-4o-mini`) when a key is present, and through a deterministic template otherwise. A number check rejects model text that is not in the evidence packet.

There is no demo mode and no bundled sample: every board comes from the live hackathon API, and no Qloo payload is committed. When a typed name is ambiguous or only loosely matches Qloo’s top hit, the desk asks the user to pick from Qloo’s own search results. A short in-memory cache, a per-visitor rate limit, and a per-instance call budget protect the key.

## Challenges

Qloo ignores unsupported parameters instead of erroring, so a “successful” empty body can mean we asked the wrong question. We checked each `filter.type` against the entity parameter guide and the use-case pages (demographics, heatmaps, taste analysis, compare) and we only show a factor when the parser actually found it.

Explainability’s exact JSON shape is described in prose more than in a single schema, so the parser walks the `query.explainability` tree for named scores and otherwise says explainability was not returned.

Search responses are heavy: each hit carries its full tag tree, so asking for eight hits returned about 2 MB and took over 20 seconds. We cut search to five hits, raised the upstream timeout, and stopped retrying after a timeout so one slow call cannot blow the route’s time limit. We only show explainability, compare tags, and other optional signals when the parser actually finds them.

Keeping an LLM in the loop without letting it invent reach, fees, or cities took a hard gate: if a digit in the draft is not in the evidence set, that pitch is replaced by the template.

## Accomplishments

A judge can run the Chelsea desk, the Dodgers desk, and Chelsea versus the Dodgers against live Qloo data with one click. The trace, the formula, the factor bars, the audience indexes, the map, and the pitch cards are all on one page. Tests cover scoring math, response parsing, the rate limit, query privacy checks, and the number check that rejects ungrounded pitch text.

The product is shaped like a sponsorship desk. The score is a tool for a meeting, with the arithmetic left in the room.

## What we learned

Affinity is a relationship in a graph of audiences, not a probability about a fan. Demographic indexes in the docs are signed deviations, not percents, and they only become an “alignment” after we say so and show the formula. Heatmaps answer “where inside this city is the signal concentrated,” which is a different question from “which city should we activate.” Destinations answer the second one. Mixing those up would have produced fake neighborhood names.

We also learned that a successful live call is not the same as a fast one. Payload size, not request count, was the bottleneck, and a timeout should fail fast rather than retry into the route limit.

## What's next

- Confirm explainability, compare grouping, and heatmap locality matching on the live hackathon key, and record what the responses actually changed.
- Let a buyer pin category exclusions (no beer, no wagering) as `filter.exclude.tags` once those tag ids are resolved from `/v2/tags` rather than guessed.
- Add a one-page leave-behind that a club’s partnerships team can forward, with the Qloo request ids redacted and the formula still visible.
- Price nothing. The next step is a better brief, not a checkout.
