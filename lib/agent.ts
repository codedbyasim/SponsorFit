import { demoCompareTags, findDemoProperty, normalizeName, type DemoProperty } from "./demo/fixtures";
import { composePitches, pitchIsGrounded, templatePitch, type PitchContext } from "./pitch";
import { assertPublicQuery, PrivacyError } from "./privacy";
import { ageLabel, demographicAlignment, fitScore } from "./score";
import type {
  Activation,
  AudienceProfile,
  BrandRow,
  CompareResult,
  CompareTag,
  ResolvedEntity,
  ScoutEvent,
  ScoutInput,
  ScoutResult,
  TasteItem,
  TraceStep,
} from "./types";
import {
  compareEntities,
  getEntity,
  insights,
  QlooError,
  qlooConfigured,
  searchEntities,
} from "./qloo/client";
import {
  ageRecord as agesOf,
  parseCompare,
  parseDemographics,
  parseEntities,
  parseHeatmap,
  parseTags,
  parseTaste,
  type ParsedEntity,
} from "./qloo/parse";

export type Emit = (event: ScoutEvent) => void;

export type ScoutOptions = {
  forceDemo?: boolean;
  allowLlm?: boolean;
  paceMs?: number;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class Tracer {
  readonly steps: TraceStep[] = [];

  constructor(private readonly emit: Emit) {}

  put(step: TraceStep) {
    const index = this.steps.findIndex((item) => item.id === step.id);
    if (index === -1) this.steps.push(step);
    else this.steps[index] = step;
    this.emit({ type: "step", step });
  }
}

async function pace(ms: number | undefined) {
  if (!ms || ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function emptyAudience(): AudienceProfile {
  return { ages: [], genders: [], tags: [] };
}

function rankRows(rows: BrandRow[]): BrandRow[] {
  const sorted = [...rows].sort((a, b) => {
    const fit = (b.fit ?? -1) - (a.fit ?? -1);
    if (fit !== 0) return fit;
    return (b.affinity ?? -1) - (a.affinity ?? -1);
  });
  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

function toEntity(property: DemoProperty): ResolvedEntity {
  return {
    id: property.id,
    name: property.name,
    subtype: property.subtype,
    disambiguation: property.disambiguation,
    popularity: property.popularity,
    description: property.description,
  };
}

function audienceFromDemo(property: DemoProperty): AudienceProfile {
  return {
    ages: Object.entries(property.ages).map(([key, value]) => ({ key, label: ageLabel(key), value })),
    genders: Object.entries(property.genders).map(([key, value]) => ({ key, label: key, value })),
    tags: property.tags,
  };
}

function tasteFromDemo(property: DemoProperty): TasteItem[] {
  const map = (domain: TasteItem["domain"], items: DemoProperty["artists"]): TasteItem[] =>
    items.map((item) => ({ ...item, domain }));
  return [...map("artist", property.artists), ...map("movie", property.movies), ...map("destination", property.destinations)];
}

function rowsFromDemo(property: DemoProperty): BrandRow[] {
  return rankRows(
    property.brands.map((brand) => {
      const demoAlignment = demographicAlignment(property.ages, brand.ages);
      const scored = fitScore({
        affinity: brand.affinity,
        popularity: brand.popularity,
        demographic: demoAlignment,
      });
      return {
        id: brand.id,
        name: brand.name,
        affinity: brand.affinity,
        popularity: brand.popularity,
        demoAlignment,
        fit: scored.fit,
        formula: scored.formula,
        factors: scored.factors,
        why: [{ label: property.name, score: brand.explainScore, source: "illustrative explainability" }],
        catalogTags: brand.catalogTags,
        rank: 0,
      };
    }),
  );
}

function contextsFor(
  propertyName: string,
  brands: BrandRow[],
  audience: AudienceProfile,
  taste: TasteItem[],
  activation: Activation | null,
): PitchContext[] {
  const destination = taste.find((item) => item.domain === "destination") ?? null;
  const peak = activation?.cells[0]?.affinity ?? null;
  return brands
    .filter((brand) => brand.fit != null && brand.affinity != null)
    .slice(0, 5)
    .map((brand) => ({
      propertyName,
      brandId: brand.id,
      brandName: brand.name,
      rank: brand.rank,
      fit: brand.fit as number,
      formula: brand.formula,
      factors: brand.factors,
      affinity: brand.affinity as number,
      popularity: brand.popularity,
      demoAlignment: brand.demoAlignment,
      why: brand.why,
      audience,
      taste,
      destinationName: destination?.name ?? null,
      destinationAffinity: destination?.affinity ?? null,
      heatmapCity: activation?.city ?? null,
      heatmapSource: activation?.citySource ?? null,
      topCellAffinity: peak,
    }));
}

function overlap(
  a: ResolvedEntity,
  b: ResolvedEntity,
  rowsA: BrandRow[],
  rowsB: BrandRow[],
  qlooTags: CompareTag[],
  note: string,
): CompareResult {
  const byName = new Map(rowsB.map((row) => [normalizeName(row.name), row]));
  const sharedBrands = rowsA.flatMap((row) => {
    const other = byName.get(normalizeName(row.name));
    if (!other) return [];
    return [
      {
        name: row.name,
        idA: row.id,
        idB: other.id,
        fitA: row.fit,
        fitB: other.fit,
        affinityA: row.affinity,
        affinityB: other.affinity,
      },
    ];
  });
  const shared = new Set(sharedBrands.map((brand) => normalizeName(brand.name)));
  return {
    a,
    b,
    sharedBrands,
    onlyA: rowsA.filter((row) => !shared.has(normalizeName(row.name))).map((row) => row.name),
    onlyB: rowsB.filter((row) => !shared.has(normalizeName(row.name))).map((row) => row.name),
    qlooTags,
    note,
  };
}

function candidateScore(query: string, entity: ParsedEntity): number {
  const name = normalizeName(entity.name);
  const wanted = normalizeName(query);
  let score = 0;
  if (name === wanted) score += 100;
  else if (name.startsWith(wanted) || wanted.startsWith(name)) score += 70;
  else if (name.includes(wanted) || wanted.includes(name)) score += 46;
  else {
    const tokens = wanted.split(" ").filter((token) => token.length > 1);
    const hits = tokens.filter((token) => name.includes(token)).length;
    score += tokens.length ? (hits / tokens.length) * 36 : 0;
  }
  if (entity.popularity != null) score += Math.min(1, Math.max(0, entity.popularity)) * 8;
  return score;
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export async function runScout(input: ScoutInput, emit: Emit, options: ScoutOptions = {}): Promise<ScoutResult> {
  const query = assertPublicQuery(input.query);
  const compareQuery = input.compareQuery?.trim() ? assertPublicQuery(input.compareQuery, "Compare") : undefined;
  const city = input.city?.trim() ? assertPublicQuery(input.city, "City") : undefined;
  const clean: ScoutInput = { ...input, query, compareQuery, city };
  const allowLlm = options.allowLlm !== false;

  if (options.forceDemo || !qlooConfigured()) {
    const warning = options.forceDemo
      ? undefined
      : "QLOO_API_KEY is not set. This run uses the illustrative sample, not a live Qloo response.";
    return runDemo(clean, emit, allowLlm, options.paceMs ?? 0, warning);
  }

  try {
    return await runLive(clean, emit, allowLlm);
  } catch (error) {
    if (error instanceof PrivacyError) throw error;
    if (!findDemoProperty(query)) throw error;
    const reason = error instanceof QlooError ? error.code : "upstream";
    return runDemo(
      clean,
      emit,
      allowLlm,
      options.paceMs ?? 0,
      `Live Qloo request failed (${reason}). Showing the illustrative sample for this property.`,
    );
  }
}

async function runDemo(
  input: ScoutInput,
  emit: Emit,
  allowLlm: boolean,
  paceMs: number,
  warning?: string,
): Promise<ScoutResult> {
  const tracer = new Tracer(emit);
  const property = findDemoProperty(input.query);
  if (!property) {
    throw new Error(
      "Demo mode includes Chelsea FC, the LA Dodgers, Coachella, and SmartLess. Connect a Qloo key to scout another public property.",
    );
  }
  const warnings = [
    "Illustrative sample. Affinities, tags, and map cells are invented for the demo and are not Qloo measurements.",
  ];
  if (warning) warnings.unshift(warning);

  tracer.put({
    id: "resolve",
    cue: "01",
    title: "Resolve the property",
    status: "running",
    detail: "Matching the name to a labeled demo property. No /search call.",
    endpoint: "GET /search",
  });
  await pace(paceMs);
  tracer.put({
    id: "resolve",
    cue: "01",
    title: "Resolve the property",
    status: "done",
    detail: `Demo entity ${property.name}. ${property.disambiguation}.`,
    endpoint: "GET /search",
    params: { query: input.query, take: "8" },
    resultCount: 1,
  });

  tracer.put({
    id: "entity",
    cue: "02",
    title: "Hydrate the entity",
    status: "skipped",
    detail: "Demo ids are not Qloo UUIDs, so /entities is not called.",
    endpoint: "GET /entities",
  });

  const brands = rowsFromDemo(property);
  tracer.put({
    id: "brands",
    cue: "03",
    title: "Pull brand affinities",
    status: "done",
    detail: "Illustrative brand list with sample affinity, popularity, and explainability.",
    endpoint: "GET /v2/insights",
    params: {
      "filter.type": "urn:entity:brand",
      "signal.interests.entities": property.id,
      "feature.explainability": "true",
      take: "20",
    },
    resultCount: brands.length,
  });
  await pace(paceMs);

  const audience = audienceFromDemo(property);
  tracer.put({
    id: "audience",
    cue: "04",
    title: "Read the audience profile",
    status: "done",
    detail: "Sample age and gender indexes plus taste tags. Indexes are signed, the way Qloo documents them.",
    endpoint: "GET /v2/insights",
    params: {
      "filter.type": "urn:demographics",
      "signal.interests.entities": property.id,
    },
    resultCount: audience.tags.length,
  });
  await pace(paceMs);

  const taste = tasteFromDemo(property);
  tracer.put({
    id: "taste",
    cue: "05",
    title: "Cross-domain taste snapshot",
    status: "done",
    detail: "Sample artists, screen titles, and destinations for color. Not a live insights response.",
    endpoint: "GET /v2/insights",
    params: { "signal.interests.entities": property.id, take: "6" },
    resultCount: taste.length,
  });

  tracer.put({
    id: "score",
    cue: "06",
    title: "Compute Fit Scores",
    status: "done",
    detail: "60% affinity, 25% popularity, 15% age-index alignment. Local math on the sample rows.",
    resultCount: brands.length,
  });
  await pace(paceMs);

  const operatorCity = input.city?.trim();
  const useMap = !operatorCity || normalizeName(operatorCity) === normalizeName(property.heatmapCity);
  const activation: Activation | null = useMap
    ? {
        city: property.heatmapCity,
        citySource: operatorCity ? "operator" : "destination",
        brandId: brands[0]?.id ?? property.id,
        brandName: brands[0]?.name ?? property.name,
        localityName: property.heatmapCity,
        cells: [...property.heatmap].sort((a, b) => b.affinity - a.affinity),
      }
    : null;
  tracer.put({
    id: "map",
    cue: "07",
    title: "Activation map",
    status: activation ? "done" : "skipped",
    detail: activation
      ? `Illustrative heatmap cells inside ${activation.city} for ${activation.brandName}.`
      : `Demo heatmap exists only for ${property.heatmapCity}.`,
    endpoint: "GET /v2/insights",
    params: {
      "filter.type": "urn:heatmap",
      "filter.location.query": activation?.city ?? operatorCity ?? "",
      "signal.interests.entities": activation?.brandId ?? "",
      take: "40",
    },
    resultCount: activation?.cells.length ?? 0,
  });

  let compare: CompareResult | null = null;
  if (input.compareQuery) {
    const other = findDemoProperty(input.compareQuery);
    if (!other || other.id === property.id) {
      warnings.push("Compare needs a second demo property: Chelsea FC, the LA Dodgers, Coachella, or SmartLess.");
      tracer.put({
        id: "compare",
        cue: "08",
        title: "Compare audiences",
        status: "skipped",
        detail: "The second name is not a separate demo property.",
        endpoint: "GET /v2/analysis/compare",
      });
    } else {
      const otherRows = rowsFromDemo(other);
      const tags = demoCompareTags(property.id, other.id);
      compare = overlap(
        toEntity(property),
        toEntity(other),
        brands,
        otherRows,
        tags,
        tags.length
          ? "Shared and unique brands come from the two sample affinity lists. Catalog tags for this pair are illustrative labels, not a live compare response."
          : "Shared and unique brands come from the two sample affinity lists. This pair has no illustrative catalog-compare tags.",
      );
      tracer.put({
        id: "compare",
        cue: "08",
        title: "Compare audiences",
        status: "done",
        detail: `${compare.sharedBrands.length} brands appear on both sample lists.`,
        endpoint: "GET /v2/analysis/compare",
        params: {
          "a.signal.interests.entities": property.id,
          "b.signal.interests.entities": other.id,
        },
        resultCount: compare.sharedBrands.length,
      });
    }
  } else {
    tracer.put({
      id: "compare",
      cue: "08",
      title: "Compare audiences",
      status: "skipped",
      detail: "Add a second property to compare brand lists.",
      endpoint: "GET /v2/analysis/compare",
    });
  }
  await pace(paceMs);

  tracer.put({
    id: "pitch",
    cue: "09",
    title: "Write the pitches",
    status: "running",
    detail: "Drafting the top of the board from returned signals only.",
  });
  const contexts = contextsFor(property.name, brands, audience, taste, activation);
  const written = await composePitches(contexts, allowLlm);
  for (const [index, pitch] of written.pitches.entries()) {
    if (!pitchIsGrounded(pitch, contexts[index])) {
      written.pitches[index] = templatePitch(contexts[index]);
    }
  }
  tracer.put({
    id: "pitch",
    cue: "09",
    title: "Write the pitches",
    status: "done",
    detail: written.detail,
    resultCount: written.pitches.length,
  });

  const result: ScoutResult = {
    source: "demo",
    property: toEntity(property),
    alternatives: [],
    brands,
    audience,
    taste,
    activation,
    pitches: written.pitches,
    compare,
    trace: tracer.steps,
    warnings,
    needsConfirmation: false,
  };
  emit({ type: "result", result });
  return result;
}

async function runLive(input: ScoutInput, emit: Emit, allowLlm: boolean): Promise<ScoutResult> {
  const tracer = new Tracer(emit);
  const warnings: string[] = [];

  tracer.put({
    id: "resolve",
    cue: "01",
    title: "Resolve the property",
    status: "running",
    detail: "Searching Qloo for a public entity.",
    endpoint: "GET /search",
    params: { query: input.query, take: "8", sort_by: "match" },
  });
  const searched = parseEntities(await searchEntities(input.query));
  const ranked = searched
    .map((entity) => ({ entity, score: candidateScore(input.query, entity) }))
    .sort((a, b) => b.score - a.score);
  const chosen = input.entityId ? ranked.find((item) => item.entity.id === input.entityId) ?? ranked[0] : ranked[0];
  if (!chosen || chosen.score < 20) {
    throw new QlooError("upstream");
  }
  const second = ranked.find((item) => item.entity.id !== chosen.entity.id);
  const exact = normalizeName(chosen.entity.name) === normalizeName(input.query);
  const ambiguous = !input.entityId && !exact && second != null && second.score >= chosen.score - 12 && second.score >= 30;
  tracer.put({
    id: "resolve",
    cue: "01",
    title: "Resolve the property",
    status: "done",
    detail: ambiguous
      ? `Search returned close matches. Confirm which ${input.query} to scout.`
      : `Selected ${chosen.entity.name}.`,
    endpoint: "GET /search",
    params: { query: input.query, take: "8", sort_by: "match" },
    resultCount: ranked.length,
  });

  if (ambiguous) {
    const result: ScoutResult = {
      source: "live",
      property: toResolved(chosen.entity),
      alternatives: ranked.slice(0, 4).map((item) => toResolved(item.entity)),
      brands: [],
      audience: emptyAudience(),
      taste: [],
      activation: null,
      pitches: [],
      compare: null,
      trace: tracer.steps,
      warnings: ["Qloo search returned more than one close match. Pick one to continue."],
      needsConfirmation: true,
    };
    emit({ type: "result", result });
    return result;
  }

  let resolved = toResolved(chosen.entity);
  if (UUID_RE.test(resolved.id)) {
    tracer.put({
      id: "entity",
      cue: "02",
      title: "Hydrate the entity",
      status: "running",
      detail: "Loading the entity record.",
      endpoint: "GET /entities",
      params: { entity_ids: resolved.id },
    });
    try {
      const hydrated = parseEntities(await getEntity(resolved.id))[0];
      if (hydrated) resolved = { ...toResolved(hydrated), description: hydrated.description ?? resolved.description };
      tracer.put({
        id: "entity",
        cue: "02",
        title: "Hydrate the entity",
        status: "done",
        detail: hydrated ? `Entity record loaded for ${resolved.name}.` : "Search hit kept. /entities returned no extra record.",
        endpoint: "GET /entities",
        params: { entity_ids: resolved.id },
        resultCount: hydrated ? 1 : 0,
      });
    } catch {
      warnings.push("Entity lookup failed. The search hit is used instead.");
      tracer.put({
        id: "entity",
        cue: "02",
        title: "Hydrate the entity",
        status: "error",
        detail: "GET /entities failed. Continuing with the search hit.",
        endpoint: "GET /entities",
      });
    }
  } else {
    tracer.put({
      id: "entity",
      cue: "02",
      title: "Hydrate the entity",
      status: "skipped",
      detail: "Search id was not a UUID, so /entities was not called.",
      endpoint: "GET /entities",
    });
  }

  const signal = resolved.id;
  tracer.put({
    id: "brands",
    cue: "03",
    title: "Pull brand affinities",
    status: "running",
    detail: "Asking insights for brands this audience over-indexes on.",
    endpoint: "GET /v2/insights",
    params: {
      "filter.type": "urn:entity:brand",
      "signal.interests.entities": signal,
      "feature.explainability": "true",
      take: "20",
    },
  });
  const brandRaw = await insights({
    "filter.type": "urn:entity:brand",
    "signal.interests.entities": signal,
    "feature.explainability": "true",
    take: "20",
  });
  const parsedBrands = parseEntities(brandRaw).filter((brand) => brand.id !== signal);
  if (!parsedBrands.length) throw new QlooError("upstream");
  tracer.put({
    id: "brands",
    cue: "03",
    title: "Pull brand affinities",
    status: "done",
    detail: `${parsedBrands.length} brands returned. Explainability chips appear only when Qloo sent them.`,
    endpoint: "GET /v2/insights",
    params: {
      "filter.type": "urn:entity:brand",
      "signal.interests.entities": signal,
      "feature.explainability": "true",
      take: "20",
    },
    resultCount: parsedBrands.length,
  });

  tracer.put({
    id: "audience",
    cue: "04",
    title: "Read the audience profile",
    status: "running",
    detail: "Demographics and taste tags, in parallel.",
    endpoint: "GET /v2/insights",
  });
  tracer.put({
    id: "taste",
    cue: "05",
    title: "Cross-domain taste snapshot",
    status: "running",
    detail: "Artists, movies, and destinations in parallel.",
    endpoint: "GET /v2/insights",
  });

  const [demoResult, tagResult, artistResult, movieResult, destinationResult] = await Promise.all([
    insights({ "filter.type": "urn:demographics", "signal.interests.entities": signal }).catch(() => null),
    insights({ "filter.type": "urn:tag", "signal.interests.entities": signal, take: "12" }).catch(() => null),
    insights({
      "filter.type": "urn:entity:artist",
      "signal.interests.entities": signal,
      "feature.explainability": "true",
      take: "6",
    }).catch(() => null),
    insights({
      "filter.type": "urn:entity:movie",
      "signal.interests.entities": signal,
      "feature.explainability": "true",
      take: "6",
    }).catch(() => null),
    insights({
      "filter.type": "urn:entity:destination",
      "signal.interests.entities": signal,
      "feature.explainability": "true",
      take: "6",
    }).catch(() => null),
  ]);

  const demographics = demoResult ? parseDemographics(demoResult, signal) : { ages: [], genders: [] };
  const tags = tagResult ? parseTags(tagResult).slice(0, 12) : [];
  if (!demoResult) warnings.push("Demographic insights were not returned.");
  if (!tagResult) warnings.push("Taste-tag insights were not returned.");
  const audience: AudienceProfile = { ...demographics, tags };
  const taste: TasteItem[] = [
    ...(artistResult ? parseTaste(artistResult, "artist") : []),
    ...(movieResult ? parseTaste(movieResult, "movie") : []),
    ...(destinationResult ? parseTaste(destinationResult, "destination") : []),
  ].filter((item) => item.id !== signal);
  tracer.put({
    id: "audience",
    cue: "04",
    title: "Read the audience profile",
    status: "done",
    detail: `${audience.ages.length} age bands and ${audience.tags.length} taste tags.`,
    endpoint: "GET /v2/insights",
    params: { "filter.type": "urn:demographics + urn:tag", "signal.interests.entities": signal, take: "12" },
    resultCount: audience.tags.length,
  });
  tracer.put({
    id: "taste",
    cue: "05",
    title: "Cross-domain taste snapshot",
    status: taste.length ? "done" : "skipped",
    detail: taste.length ? `${taste.length} cross-domain entities returned.` : "Cross-domain insights returned nothing.",
    endpoint: "GET /v2/insights",
    params: { "filter.type": "urn:entity:artist,movie,destination", take: "6" },
    resultCount: taste.length,
  });

  const propertyAges = agesOf(audience.ages);
  const preliminary = [...parsedBrands].sort((a, b) => (b.affinity ?? -1) - (a.affinity ?? -1)).slice(0, 8);
  const alignments = new Map<string, number | null>();
  if (Object.keys(propertyAges).length >= 2) {
    const fetched = await mapPool(preliminary, 4, async (brand) => {
      try {
        const payload = await insights({ "filter.type": "urn:demographics", "signal.interests.entities": brand.id });
        const ages = agesOf(parseDemographics(payload, brand.id).ages);
        return [brand.id, demographicAlignment(propertyAges, ages)] as const;
      } catch {
        return [brand.id, null] as const;
      }
    });
    for (const [id, alignment] of fetched) alignments.set(id, alignment);
  } else {
    warnings.push("Age indexes were too thin to align brands, so that Fit Score factor is omitted.");
  }

  const brands = rankRows(
    parsedBrands.map((brand) => {
      const demoAlignment = alignments.has(brand.id) ? alignments.get(brand.id) ?? null : null;
      const scored = fitScore({
        affinity: brand.affinity,
        popularity: brand.popularity,
        demographic: demoAlignment,
      });
      return {
        id: brand.id,
        name: brand.name,
        affinity: brand.affinity,
        popularity: brand.popularity,
        demoAlignment,
        fit: scored.fit,
        formula: scored.formula,
        factors: scored.factors,
        why: brand.why,
        catalogTags: brand.catalogTags,
        rank: 0,
      };
    }),
  );
  tracer.put({
    id: "score",
    cue: "06",
    title: "Compute Fit Scores",
    status: "done",
    detail: "Affinity is required. Popularity and age-index alignment are included only when returned.",
    resultCount: brands.filter((brand) => brand.fit != null).length,
  });

  const topDestination = taste.find((item) => item.domain === "destination");
  const mapCity = input.city?.trim() || topDestination?.name;
  const mapSource = input.city?.trim() ? "operator" : "destination";
  const focus = brands.find((brand) => brand.fit != null) ?? brands[0];
  let activation: Activation | null = null;
  if (!mapCity || !focus) {
    tracer.put({
      id: "map",
      cue: "07",
      title: "Activation map",
      status: "skipped",
      detail: "No destination was returned and no city was entered.",
      endpoint: "GET /v2/insights",
    });
  } else {
    const mapParams = {
      "filter.type": "urn:heatmap",
      "filter.location.query": mapCity,
      "signal.interests.entities": focus.id,
      take: "40",
    };
    try {
      const heat = parseHeatmap(await insights(mapParams));
      activation = {
        city: mapCity,
        citySource: mapSource,
        brandId: focus.id,
        brandName: focus.name,
        localityName: heat.localityName,
        cells: heat.cells,
      };
      tracer.put({
        id: "map",
        cue: "07",
        title: "Activation map",
        status: heat.cells.length ? "done" : "skipped",
        detail: heat.cells.length
          ? `${heat.cells.length} heatmap cells for ${focus.name} in ${heat.localityName ?? mapCity}.`
          : "Heatmap returned no cells.",
        endpoint: "GET /v2/insights",
        params: mapParams,
        resultCount: heat.cells.length,
      });
    } catch {
      warnings.push("Heatmap request failed. Brand ranking is unchanged.");
      tracer.put({
        id: "map",
        cue: "07",
        title: "Activation map",
        status: "error",
        detail: "Heatmap request failed.",
        endpoint: "GET /v2/insights",
        params: mapParams,
      });
    }
  }

  let compare: CompareResult | null = null;
  if (input.compareQuery) {
    try {
      const otherSearched = parseEntities(await searchEntities(input.compareQuery));
      const otherRanked = otherSearched
        .map((entity) => ({ entity, score: candidateScore(input.compareQuery ?? "", entity) }))
        .sort((a, b) => b.score - a.score);
      const other =
        (input.compareEntityId ? otherRanked.find((item) => item.entity.id === input.compareEntityId) : undefined) ??
        otherRanked[0];
      if (!other || other.entity.id === signal) throw new Error("compare_unresolved");
      const otherBrandsRaw = parseEntities(
        await insights({
          "filter.type": "urn:entity:brand",
          "signal.interests.entities": other.entity.id,
          "feature.explainability": "true",
          take: "20",
        }),
      );
      const otherRows = rankRows(
        otherBrandsRaw.map((brand) => {
          const scored = fitScore({ affinity: brand.affinity, popularity: brand.popularity, demographic: null });
          return {
            id: brand.id,
            name: brand.name,
            affinity: brand.affinity,
            popularity: brand.popularity,
            demoAlignment: null,
            fit: scored.fit,
            formula: scored.formula,
            factors: scored.factors,
            why: brand.why,
            catalogTags: brand.catalogTags,
            rank: 0,
          };
        }),
      );
      let qlooTags: CompareTag[] = [];
      try {
        qlooTags = parseCompare(await compareEntities(signal, other.entity.id));
      } catch {
        warnings.push("Qloo compare failed. Brand-list overlap is still shown.");
      }
      compare = overlap(
        resolved,
        toResolved(other.entity),
        brands,
        otherRows,
        qlooTags,
        "Shared brands are SponsorFit's overlap of the two brand insights lists. Tags come from /v2/analysis/compare and are grouped only when the response keys say so. The compare side omits demographic alignment to keep the call budget down.",
      );
      tracer.put({
        id: "compare",
        cue: "08",
        title: "Compare audiences",
        status: "done",
        detail: `${compare.sharedBrands.length} shared brands. ${compare.qlooTags.length} compare tags.`,
        endpoint: "GET /v2/analysis/compare",
        params: {
          "a.signal.interests.entities": signal,
          "b.signal.interests.entities": other.entity.id,
        },
        resultCount: compare.sharedBrands.length,
      });
    } catch {
      warnings.push("The second property could not be compared.");
      tracer.put({
        id: "compare",
        cue: "08",
        title: "Compare audiences",
        status: "error",
        detail: "Compare did not resolve a second entity.",
        endpoint: "GET /v2/analysis/compare",
      });
    }
  } else {
    tracer.put({
      id: "compare",
      cue: "08",
      title: "Compare audiences",
      status: "skipped",
      detail: "Add a second property to compare brand lists.",
      endpoint: "GET /v2/analysis/compare",
    });
  }

  tracer.put({
    id: "pitch",
    cue: "09",
    title: "Write the pitches",
    status: "running",
    detail: "Drafting from the evidence packet.",
  });
  const contexts = contextsFor(resolved.name, brands, audience, taste, activation);
  const written = await composePitches(contexts, allowLlm);
  tracer.put({
    id: "pitch",
    cue: "09",
    title: "Write the pitches",
    status: "done",
    detail: written.detail,
    resultCount: written.pitches.length,
  });

  const result: ScoutResult = {
    source: "live",
    property: resolved,
    alternatives: ranked.slice(1, 4).map((item) => toResolved(item.entity)),
    brands,
    audience,
    taste,
    activation,
    pitches: written.pitches,
    compare,
    trace: tracer.steps,
    warnings,
    needsConfirmation: false,
  };
  emit({ type: "result", result });
  return result;
}

function toResolved(entity: ParsedEntity): ResolvedEntity {
  return {
    id: entity.id,
    name: entity.name,
    subtype: entity.subtype,
    disambiguation: entity.disambiguation,
    popularity: entity.popularity,
    description: entity.description,
  };
}
