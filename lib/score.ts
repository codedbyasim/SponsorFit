import type { FitFactor } from "./types";

/** Published weights. Rows renormalize when a factor was not returned. */
export const FIT_WEIGHTS = {
  affinity: 0.6,
  popularity: 0.25,
  demographic: 0.15,
} as const;

export type FitInput = {
  affinity: number | null;
  popularity: number | null;
  demographic: number | null;
};

export type FitResult = {
  fit: number | null;
  formula: string;
  factors: FitFactor[];
};

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Qloo Insights affinities and popularity are documented on a 0–1 scale.
 * If a value is above 1 and at most 100, treat it as a 0–100 score.
 */
export function toUnitInterval(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  if (value >= 0 && value <= 1) return value;
  if (value > 1 && value <= 100) return value / 100;
  if (value < 0) return 0;
  return 1;
}

/**
 * Fit Score is SponsorFit's reading of returned signals, not a Qloo metric.
 * Affinity is required. Missing popularity or demographic alignment drops
 * that term and renormalizes the remaining weights.
 */
export function fitScore(input: FitInput): FitResult {
  const affinity = input.affinity == null ? null : toUnitInterval(input.affinity);
  if (affinity == null) {
    return {
      fit: null,
      formula: "Fit Score withheld: Qloo did not return an affinity for this brand.",
      factors: [],
    };
  }

  const parts: Array<{
    key: FitFactor["key"];
    label: string;
    weight: number;
    value: number;
  }> = [
    {
      key: "affinity",
      label: "Qloo affinity",
      weight: FIT_WEIGHTS.affinity,
      value: affinity * 100,
    },
  ];

  const popularity = input.popularity == null ? null : toUnitInterval(input.popularity);
  if (popularity != null) {
    parts.push({
      key: "popularity",
      label: "Qloo popularity",
      weight: FIT_WEIGHTS.popularity,
      value: popularity * 100,
    });
  }

  if (input.demographic != null && Number.isFinite(input.demographic)) {
    parts.push({
      key: "demographic",
      label: "Demographic alignment",
      weight: FIT_WEIGHTS.demographic,
      value: Math.min(100, Math.max(0, input.demographic)),
    });
  }

  const weightSum = parts.reduce((sum, part) => sum + part.weight, 0);
  const factors: FitFactor[] = parts.map((part) => {
    const weight = round3(part.weight / weightSum);
    const value = round1(part.value);
    return {
      key: part.key,
      label: part.label,
      weight,
      value,
      contribution: round1(weight * value),
    };
  });

  const fit = round1(factors.reduce((sum, factor) => sum + factor.contribution, 0));
  const formula = factors
    .map((factor) => `${Math.round(factor.weight * 100)}% × ${factor.label}`)
    .join(" + ");

  return { fit, formula, factors };
}

/**
 * Cosine similarity of two signed demographic index vectors, mapped from
 * [-1, 1] onto 0–100. Returns null when fewer than two shared bands exist
 * or either vector has no magnitude. Does not invent missing bands.
 */
export function demographicAlignment(
  left: Record<string, number>,
  right: Record<string, number>,
): number | null {
  const keys = Object.keys(left).filter(
    (key) => typeof right[key] === "number" && Number.isFinite(left[key]) && Number.isFinite(right[key]),
  );
  if (keys.length < 2) return null;

  let dot = 0;
  let leftMag = 0;
  let rightMag = 0;
  for (const key of keys) {
    dot += left[key] * right[key];
    leftMag += left[key] * left[key];
    rightMag += right[key] * right[key];
  }
  if (leftMag === 0 || rightMag === 0) return null;

  const cosine = dot / Math.sqrt(leftMag * rightMag);
  const clamped = Math.min(1, Math.max(-1, cosine));
  return round1(((clamped + 1) / 2) * 100);
}

export const AGE_LABELS: Record<string, string> = {
  "24_and_younger": "24 and younger",
  "25_to_29": "25 to 29",
  "30_to_34": "30 to 34",
  "35_to_44": "35 to 44",
  "45_to_54": "45 to 54",
  "55_and_older": "55 and older",
};

export function ageLabel(key: string): string {
  return AGE_LABELS[key] ?? key.replaceAll("_", " ");
}
