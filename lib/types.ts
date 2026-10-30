export type DataSource = "live";

export type StepStatus = "running" | "done" | "skipped" | "error";

export type TraceStep = {
  id: string;
  cue: string;
  title: string;
  status: StepStatus;
  detail: string;
  endpoint?: string;
  params?: Record<string, string>;
  resultCount?: number;
};

export type ResolvedEntity = {
  id: string;
  name: string;
  subtype: string;
  disambiguation?: string;
  popularity: number | null;
  description?: string;
};

export type WhyChip = {
  label: string;
  score: number | null;
  source: string;
};

export type FitFactor = {
  key: "affinity" | "popularity" | "demographic";
  label: string;
  weight: number;
  value: number;
  contribution: number;
};

export type BrandRow = {
  id: string;
  name: string;
  affinity: number | null;
  popularity: number | null;
  demoAlignment: number | null;
  fit: number | null;
  formula: string;
  factors: FitFactor[];
  why: WhyChip[];
  catalogTags: string[];
  rank: number;
};

export type IndexBucket = {
  key: string;
  label: string;
  value: number;
};

export type TasteTag = {
  id: string;
  name: string;
  affinity: number | null;
};

export type AudienceProfile = {
  ages: IndexBucket[];
  genders: IndexBucket[];
  tags: TasteTag[];
};

export type TasteItem = {
  id: string;
  name: string;
  domain: "artist" | "movie" | "destination";
  affinity: number | null;
  popularity: number | null;
};

export type HeatCell = {
  lat: number;
  lng: number;
  geohash?: string;
  affinity: number | null;
  popularity: number | null;
};

export type Activation = {
  city: string;
  citySource: "destination" | "operator";
  brandId: string;
  brandName: string;
  localityName?: string;
  cells: HeatCell[];
};

export type Pitch = {
  brandId: string;
  brandName: string;
  rank: number;
  why: string;
  evidence: string[];
  activation: string;
  city: string | null;
  writer: "llm" | "template";
};

export type SharedBrand = {
  name: string;
  idA?: string;
  idB?: string;
  fitA: number | null;
  fitB: number | null;
  affinityA: number | null;
  affinityB: number | null;
};

export type CompareTag = {
  name: string;
  bucket: "shared" | "a" | "b" | "returned";
};

export type CompareResult = {
  a: ResolvedEntity;
  b: ResolvedEntity;
  sharedBrands: SharedBrand[];
  onlyA: string[];
  onlyB: string[];
  qlooTags: CompareTag[];
  note: string;
};

export type ScoutResult = {
  source: DataSource;
  property: ResolvedEntity;
  alternatives: ResolvedEntity[];
  brands: BrandRow[];
  audience: AudienceProfile;
  taste: TasteItem[];
  activation: Activation | null;
  pitches: Pitch[];
  compare: CompareResult | null;
  trace: TraceStep[];
  warnings: string[];
  needsConfirmation: boolean;
};

export type ScoutInput = {
  query: string;
  entityId?: string;
  compareQuery?: string;
  compareEntityId?: string;
  city?: string;
};

export type ScoutEvent =
  | { type: "step"; step: TraceStep }
  | { type: "result"; result: ScoutResult }
  | { type: "error"; message: string };
