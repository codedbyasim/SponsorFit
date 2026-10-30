import type { CompareTag, HeatCell, IndexBucket, TasteItem, TasteTag, WhyChip } from "../types";
import { ageLabel } from "../score";

export type ParsedEntity = {
  id: string;
  name: string;
  subtype: string;
  disambiguation?: string;
  popularity: number | null;
  description?: string;
  affinity: number | null;
  why: WhyChip[];
  catalogTags: string[];
  isLocality?: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function readPopularity(record: Record<string, unknown>): number | null {
  const properties = asRecord(record.properties);
  return num(record.popularity) ?? (properties ? num(properties.popularity) : null);
}

function readDescription(record: Record<string, unknown>): string | undefined {
  const properties = asRecord(record.properties);
  const direct = str(record.description);
  if (direct) return direct;
  if (!properties) return undefined;
  return str(properties.description) ?? str(properties.short_description);
}

function readCatalogTags(record: Record<string, unknown>): string[] {
  const properties = asRecord(record.properties);
  const raw = asArray(record.tags).concat(properties ? asArray(properties.tags) : []);
  const names: string[] = [];
  for (const tag of raw) {
    const row = asRecord(tag);
    const name = row ? str(row.name) : undefined;
    if (name && !names.includes(name)) names.push(name);
  }
  return names.slice(0, 6);
}

export function extractExplainers(query: unknown): WhyChip[] {
  const root = asRecord(query);
  const explain = root?.explainability;
  if (!explain || (asRecord(explain)?.warning && Object.keys(asRecord(explain) ?? {}).length === 1)) {
    return [];
  }
  const chips: WhyChip[] = [];
  const seen = new Set<string>();

  const visit = (node: unknown, depth: number) => {
    if (depth > 6 || node == null) return;
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item, depth + 1));
      return;
    }
    const record = asRecord(node);
    if (!record) return;
    const label = str(record.name) ?? str(record.entity_id) ?? str(record.id);
    const score = num(record.score) ?? num(record.affinity) ?? num(record.weight);
    if (label && score != null) {
      const key = `${label}:${score}`;
      if (!seen.has(key)) {
        seen.add(key);
        chips.push({ label, score, source: "query.explainability" });
      }
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === "object") visit(value, depth + 1);
    }
  };

  visit(explain, 0);
  return chips.slice(0, 4);
}

function entityList(payload: unknown): Record<string, unknown>[] {
  const root = asRecord(payload);
  if (!root) return [];
  if (Array.isArray(root.results)) {
    return root.results.map(asRecord).filter((row): row is Record<string, unknown> => Boolean(row));
  }
  const results = asRecord(root.results);
  const list = asArray(results?.entities ?? root.entities);
  return list.map(asRecord).filter((row): row is Record<string, unknown> => Boolean(row));
}

export function parseEntities(payload: unknown): ParsedEntity[] {
  return entityList(payload).flatMap((record) => {
    const id = str(record.entity_id) ?? str(record.id);
    const name = str(record.name);
    if (!id || !name) return [];
    const query = asRecord(record.query);
    const subtype = str(record.subtype) ?? str(record.type) ?? "urn:entity";
    const properties = asRecord(record.properties);
    const rawTags = asArray(record.tags).concat(properties ? asArray(properties.tags) : []);
    const isLocality = Boolean(
      properties?.place ||
      rawTags.some((tag) => {
        const row = asRecord(tag);
        const tagType = str(row?.type) ?? str(row?.tag_id) ?? "";
        return tagType.includes("locality");
      })
    );
    return [
      {
        id,
        name,
        subtype,
        disambiguation: str(record.disambiguation),
        popularity: readPopularity(record),
        description: readDescription(record),
        affinity: query ? num(query.affinity) : null,
        why: extractExplainers(query),
        catalogTags: readCatalogTags(record),
        isLocality,
      },
    ];
  });
}

export function parseSearch(payload: unknown): ParsedEntity[] {
  return parseEntities(payload);
}

function indexMap(value: unknown): IndexBucket[] {
  const record = asRecord(value);
  if (!record) return [];
  return Object.entries(record).flatMap(([key, raw]) => {
    const valueNumber = num(raw);
    if (valueNumber == null) return [];
    return [{ key, label: key === "male" || key === "female" ? key : ageLabel(key), value: valueNumber }];
  });
}

export function parseDemographics(payload: unknown, entityId?: string): {
  ages: IndexBucket[];
  genders: IndexBucket[];
} {
  const root = asRecord(payload);
  const results = asRecord(root?.results);
  const rows = asArray(results?.demographics).map(asRecord).filter((row): row is Record<string, unknown> => Boolean(row));
  const match =
    rows.find((row) => entityId && str(row.entity_id)?.toLowerCase() === entityId.toLowerCase()) ?? rows[0];
  const query = asRecord(match?.query);
  return {
    ages: indexMap(query?.age),
    genders: indexMap(query?.gender),
  };
}

export function ageRecord(ages: IndexBucket[]): Record<string, number> {
  return Object.fromEntries(ages.map((bucket) => [bucket.key, bucket.value]));
}

export function parseTags(payload: unknown): TasteTag[] {
  const root = asRecord(payload);
  const results = asRecord(root?.results);
  return asArray(results?.tags).flatMap((item) => {
    const row = asRecord(item);
    if (!row) return [];
    const name = str(row.name);
    const id = str(row.tag_id) ?? str(row.id) ?? name;
    if (!name || !id) return [];
    const query = asRecord(row.query);
    return [{ id, name, affinity: query ? num(query.affinity) : null }];
  });
}

export function parseTaste(payload: unknown, domain: TasteItem["domain"]): TasteItem[] {
  return parseEntities(payload).map((entity) => ({
    id: entity.id,
    name: entity.name,
    domain,
    affinity: entity.affinity,
    popularity: entity.popularity,
  }));
}

export function parseHeatmap(payload: unknown): { cells: HeatCell[]; localityName?: string } {
  const root = asRecord(payload);
  const results = asRecord(root?.results);
  const cells = asArray(results?.heatmap).flatMap((item) => {
    const row = asRecord(item);
    const location = asRecord(row?.location);
    if (!row || !location) return [];
    const lat = num(location.latitude);
    const lng = num(location.longitude);
    if (lat == null || lng == null) return [];
    const query = asRecord(row.query);
    return [
      {
        lat,
        lng,
        geohash: str(location.geohash),
        affinity: query ? num(query.affinity) : null,
        popularity: query ? num(query.popularity) : null,
      },
    ];
  });
  cells.sort((a, b) => (b.affinity ?? -1) - (a.affinity ?? -1));
  const query = asRecord(root?.query);
  const localities = asRecord(query?.localities);
  const filter = asRecord(localities?.filter);
  return { cells: cells.slice(0, 40), localityName: filter ? str(filter.name) : undefined };
}

const SHARED_KEYS = ["shared", "overlap", "common", "intersection", "both"];
const A_KEYS = ["a", "left", "only_a", "unique_a", "a_only", "group_a"];
const B_KEYS = ["b", "right", "only_b", "unique_b", "b_only", "group_b"];

function tagName(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  const record = asRecord(value);
  return record ? str(record.name) ?? str(record.tag_id) ?? str(record.id) : undefined;
}

function collectNames(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((item) => collectNames(item));
  const named = tagName(value);
  const record = asRecord(value);
  if (named && record && (record.name || record.tag_id)) return [named];
  if (!record) return named ? [named] : [];
  return Object.values(record).flatMap((item) => collectNames(item));
}

export function parseCompare(payload: unknown): CompareTag[] {
  const root = asRecord(payload);
  const results = asRecord(root?.results) ?? root;
  if (!results) return [];
  const tags: CompareTag[] = [];
  const seen = new Set<string>();
  const push = (bucket: CompareTag["bucket"], names: string[]) => {
    for (const name of names) {
      const key = `${bucket}:${name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      tags.push({ name, bucket });
    }
  };

  let matched = false;
  for (const [key, value] of Object.entries(results)) {
    const folded = key.toLowerCase();
    const names = collectNames(value).slice(0, 12);
    const bucket = SHARED_KEYS.includes(folded)
      ? "shared"
      : A_KEYS.includes(folded)
        ? "a"
        : B_KEYS.includes(folded)
          ? "b"
          : null;
    if (!bucket) continue;
    push(bucket, names);
    matched = true;
  }
  if (!matched) push("returned", collectNames(results).slice(0, 16));
  return tags.slice(0, 24);
}
