import type { AudienceProfile, Pitch, TasteItem, WhyChip } from "./types";
import type { FitFactor } from "./types";

const NUMBER_RE = /-?\d+(?:\.\d+)?/g;

export type PitchContext = {
  propertyName: string;
  brandId: string;
  brandName: string;
  rank: number;
  fit: number;
  formula: string;
  factors: FitFactor[];
  affinity: number;
  popularity: number | null;
  demoAlignment: number | null;
  why: WhyChip[];
  audience: AudienceProfile;
  taste: TasteItem[];
  destinationName: string | null;
  destinationAffinity: number | null;
  heatmapCity: string | null;
  heatmapSource: "destination" | "operator" | null;
  topCellAffinity: number | null;
};

export function numberTokens(text: string): string[] {
  return text.match(NUMBER_RE) ?? [];
}

function addNumber(set: Set<string>, value: number) {
  if (!Number.isFinite(value)) return;
  set.add(String(value));
  set.add(value.toFixed(0));
  set.add(value.toFixed(1));
  set.add(value.toFixed(2));
  set.add(String(Math.round(value)));
  if (Math.abs(value) > 0 && Math.abs(value) <= 1) {
    const scaled = value * 100;
    set.add(scaled.toFixed(0));
    set.add(scaled.toFixed(1));
    set.add(scaled.toFixed(2));
    set.add(String(Math.round(scaled)));
  }
}

export function allowedNumberSet(values: Array<number | string | null | undefined>): Set<string> {
  const set = new Set<string>([
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "12", "20", "25", "40", "50", "60", "100",
    "0.60", "0.25", "0.15",
  ]);
  for (const value of values) {
    if (typeof value === "number") addNumber(set, value);
    if (typeof value === "string") {
      for (const token of numberTokens(value)) set.add(token);
    }
  }
  return set;
}

export function allowedNumbersFor(ctx: PitchContext): Set<string> {
  return allowedNumberSet([
    ctx.rank,
    ctx.fit,
    ctx.formula,
    ctx.affinity,
    ctx.popularity,
    ctx.demoAlignment,
    ctx.destinationName,
    ctx.destinationAffinity,
    ctx.heatmapCity,
    ctx.topCellAffinity,
    ctx.propertyName,
    ctx.brandName,
    ...ctx.factors.flatMap((factor) => [factor.label, factor.weight, factor.value, factor.contribution, factor.weight * 100]),
    ...ctx.why.flatMap((chip) => [chip.label, chip.score, chip.source]),
    ...ctx.audience.ages.flatMap((bucket) => [bucket.key, bucket.label, bucket.value]),
    ...ctx.audience.genders.flatMap((bucket) => [bucket.label, bucket.value]),
    ...ctx.audience.tags.flatMap((tag) => [tag.name, tag.affinity]),
    ...ctx.taste.flatMap((item) => [item.name, item.domain, item.affinity, item.popularity]),
  ]);
}

export function unexpectedNumbers(text: string, allowed: Set<string>): string[] {
  return numberTokens(text).filter((token) => !allowed.has(token));
}

export function fmtUnit(value: number): string {
  return value.toFixed(2);
}

export function fmtSigned(value: number): string {
  return value.toFixed(2);
}

function citySentence(ctx: PitchContext): { city: string | null; line: string } {
  const targetCity = ctx.heatmapCity || ctx.destinationName || null;
  if (targetCity) {
    const isDestination = ctx.destinationName && targetCity.toLowerCase() === ctx.destinationName.toLowerCase();
    const affinity =
      isDestination && ctx.destinationAffinity != null ? ` (destination affinity ${fmtUnit(ctx.destinationAffinity)})` : "";
    const heat =
      ctx.heatmapCity && ctx.topCellAffinity != null
        ? ` A heatmap for ${ctx.heatmapCity} peaked at cell affinity ${fmtUnit(ctx.topCellAffinity)}.`
        : "";
    return {
      city: targetCity,
      line: `Target the activation city ${targetCity}${affinity}.${heat}`,
    };
  }
  return { city: null, line: "No destination entity or activation city was provided, so no target city is named." };
}

export function templatePitch(ctx: PitchContext): Pitch {
  const affinity = `Qloo affinity ${fmtUnit(ctx.affinity)}`;
  const popularity =
    ctx.popularity == null ? "Qloo did not return a popularity for this brand." : `Qloo popularity ${fmtUnit(ctx.popularity)}`;
  const alignment =
    ctx.demoAlignment == null
      ? "Demographic alignment was omitted because a comparable age-index vector was not returned for this brand."
      : `Demographic alignment is ${fmtSigned(ctx.demoAlignment)} on a 0 to 100 scale, from cosine similarity of the returned age indexes.`;
  const explain =
    ctx.why.length > 0
      ? `Explainability cites ${ctx.why
          .map((chip) => `${chip.label}${chip.score == null ? "" : ` at ${fmtUnit(chip.score)}`}`)
          .join(", ")}.`
      : "Explainability was not returned for this brand.";
  const topAge = [...ctx.audience.ages].sort((a, b) => b.value - a.value)[0];
  const ageLine = topAge
    ? `The strongest returned age index for ${ctx.propertyName} is ${topAge.label} at ${fmtSigned(topAge.value)}.`
    : "No age indexes were returned.";
  const topTag = [...ctx.audience.tags].sort((a, b) => (b.affinity ?? -1) - (a.affinity ?? -1))[0];
  const tagLine = topTag
    ? `Returned taste tag "${topTag.name}"${topTag.affinity == null ? "" : ` has affinity ${fmtUnit(topTag.affinity)}`}.`
    : "No taste tags were returned.";
  const artist = ctx.taste.find((item) => item.domain === "artist");
  const { city, line } = citySentence(ctx);
  const activation = topTag
    ? `Give ${ctx.brandName} a presence built around the returned taste tag "${topTag.name}"${
        artist ? ` and the returned artist ${artist.name}` : ""
      }. ${line}`
    : `Give ${ctx.brandName} a presence at ${ctx.propertyName} using only signals that were returned. ${line}`;

  return {
    brandId: ctx.brandId,
    brandName: ctx.brandName,
    rank: ctx.rank,
    why: `${ctx.brandName} ranks ${ctx.rank} for ${ctx.propertyName} with a SponsorFit Fit Score of ${ctx.fit}. That score is ${ctx.formula}.`,
    evidence: [affinity, popularity, alignment, explain, ageLine, tagLine],
    activation,
    city,
    writer: "template",
  };
}

function pitchText(pitch: Pick<Pitch, "why" | "evidence" | "activation" | "city">): string {
  return [pitch.why, ...pitch.evidence, pitch.activation, pitch.city ?? ""].join("\n");
}

export function pitchIsGrounded(pitch: Pitch, ctx: PitchContext): boolean {
  if (pitch.brandName.trim().toLowerCase() !== ctx.brandName.trim().toLowerCase()) return false;
  if (pitch.city) {
    const pitchCity = pitch.city.trim().toLowerCase();
    const allowed = [ctx.heatmapCity, ctx.destinationName].filter(Boolean).map((c) => c!.trim().toLowerCase());
    if (allowed.length > 0 && !allowed.includes(pitchCity)) {
      return false;
    }
  }
  if (pitch.evidence.length === 0 || !pitch.why.trim() || !pitch.activation.trim()) return false;
  return unexpectedNumbers(pitchText(pitch), allowedNumbersFor(ctx)).length === 0;
}

type LlmPitch = {
  brandName?: string;
  why?: string;
  evidence?: string[];
  activation?: string;
  city?: string | null;
};

export async function composePitches(contexts: PitchContext[], allowLlm: boolean): Promise<{ pitches: Pitch[]; detail: string }> {
  const templates = contexts.map(templatePitch);
  const key = process.env.AIML_API_KEY?.trim();
  if (!allowLlm || !key) {
    return {
      pitches: templates,
      detail: "No AIML key in this run. Pitches use the deterministic template and only cite returned signals.",
    };
  }

  try {
    const drafted = await requestLlmPitches(contexts, key);
    let kept = 0;
    const pitches = contexts.map((ctx, index) => {
      const draft = drafted[index];
      if (!draft) return templates[index];
      const pitch: Pitch = {
        brandId: ctx.brandId,
        brandName: ctx.brandName,
        rank: ctx.rank,
        why: draft.why?.trim() ?? "",
        evidence: (draft.evidence ?? []).map((line) => line.trim()).filter(Boolean).slice(0, 6),
        activation: draft.activation?.trim() ?? "",
        city: draft.city?.trim() || null,
        writer: "llm",
      };
      if (!pitchIsGrounded(pitch, ctx)) return templates[index];
      kept += 1;
      return pitch;
    });
    return {
      pitches,
      detail:
        kept === contexts.length
          ? "AIML phrased the pitches from the evidence packet. Each draft passed the number check."
          : "Some AIML drafts cited numbers that were not in the evidence, so those pitches fell back to the template.",
    };
  } catch {
    return {
      pitches: templates,
      detail: "The AIML call failed. Pitches use the deterministic template.",
    };
  }
}

async function requestLlmPitches(contexts: PitchContext[], key: string): Promise<LlmPitch[]> {
  const base = (process.env.AIML_BASE_URL?.trim() || "https://api.aimlapi.com/v1").replace(/\/$/, "");
  const model = process.env.AIML_MODEL?.trim() || "gpt-4o-mini";
  const packet = contexts.map((ctx) => ({
    brandName: ctx.brandName,
    rank: ctx.rank,
    fitScore: ctx.fit,
    formula: ctx.formula,
    qlooAffinity: ctx.affinity,
    qlooPopularity: ctx.popularity,
    demographicAlignment: ctx.demoAlignment,
    explainability: ctx.why,
    strongestAge: [...ctx.audience.ages].sort((a, b) => b.value - a.value)[0] ?? null,
    tasteTags: ctx.audience.tags.slice(0, 4),
    tasteSnapshot: ctx.taste.slice(0, 6),
    targetCity: ctx.heatmapCity || ctx.destinationName || null,
    destination: ctx.destinationName,
    destinationAffinity: ctx.destinationAffinity,
    heatmapCity: ctx.heatmapCity,
    heatmapPeakAffinity: ctx.topCellAffinity,
    allowedNumbers: [...allowedNumbersFor(ctx)],
  }));

  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You write sponsorship pitches for SponsorFit. Use only the provided JSON evidence. Never invent brands, cities, affinities, percentages, dates, or audience counts. Do NOT include years (e.g. 2024, 2025, 2026). Every numeric value you write must strictly appear in that brand's allowedNumbers list. Fit Score is SponsorFit's formula, not a Qloo metric. Return JSON {\"pitches\":[{\"brandName\":\"\",\"why\":\"\",\"evidence\":[\"\"],\"activation\":\"\",\"city\":\"\"}]}. city must be the targetCity string (if provided) or empty. One pitch per brand, same order.",
        },
        { role: "user", content: JSON.stringify({ property: contexts[0]?.propertyName, brands: packet }) },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) throw new Error("aiml_failed");
  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("aiml_empty");
  const parsed = JSON.parse(content) as { pitches?: LlmPitch[] };
  return parsed.pitches ?? [];
}
