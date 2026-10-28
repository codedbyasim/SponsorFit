export type DemoPoint = {
  id: string;
  name: string;
  affinity: number;
  popularity: number;
};

export type DemoBrand = DemoPoint & {
  ages: Record<string, number>;
  explainScore: number;
  catalogTags: string[];
};

export type DemoProperty = {
  id: string;
  name: string;
  subtype: string;
  disambiguation: string;
  popularity: number;
  description: string;
  aliases: string[];
  ages: Record<string, number>;
  genders: Record<string, number>;
  tags: Array<{ id: string; name: string; affinity: number }>;
  artists: DemoPoint[];
  movies: DemoPoint[];
  destinations: DemoPoint[];
  brands: DemoBrand[];
  heatmapCity: string;
  heatmap: Array<{ lat: number; lng: number; geohash: string; affinity: number; popularity: number }>;
};

const young = {
  "24_and_younger": 0.3,
  "25_to_29": 0.46,
  "30_to_34": 0.24,
  "35_to_44": 0.04,
  "45_to_54": -0.22,
  "55_and_older": -0.3,
};

const matchday = {
  "24_and_younger": 0.18,
  "25_to_29": 0.42,
  "30_to_34": 0.33,
  "35_to_44": 0.12,
  "45_to_54": -0.16,
  "55_and_older": -0.26,
};

const family = {
  "24_and_younger": 0.02,
  "25_to_29": 0.16,
  "30_to_34": 0.34,
  "35_to_44": 0.38,
  "45_to_54": 0.08,
  "55_and_older": -0.12,
};

const older = {
  "24_and_younger": -0.24,
  "25_to_29": -0.04,
  "30_to_34": 0.12,
  "35_to_44": 0.28,
  "45_to_54": 0.34,
  "55_and_older": 0.18,
};

const festival = {
  "24_and_younger": 0.44,
  "25_to_29": 0.4,
  "30_to_34": 0.08,
  "35_to_44": -0.12,
  "45_to_54": -0.28,
  "55_and_older": -0.38,
};

function brand(
  id: string,
  name: string,
  affinity: number,
  popularity: number,
  ages: Record<string, number>,
  explainScore: number,
  catalogTags: string[],
): DemoBrand {
  return { id, name, affinity, popularity, ages, explainScore, catalogTags };
}

export const DEMO_PROPERTIES: DemoProperty[] = [
  {
    id: "demo-entity-chelsea-fc",
    name: "Chelsea FC",
    subtype: "urn:entity:brand",
    disambiguation: "Illustrative football club",
    popularity: 0.94,
    description: "Illustrative sample entity for SponsorFit demo mode. Not a Qloo record.",
    aliases: ["chelsea", "chelsea fc", "chelsea f c"],
    ages: {
      "24_and_younger": 0.22,
      "25_to_29": 0.48,
      "30_to_34": 0.3,
      "35_to_44": 0.08,
      "45_to_54": -0.18,
      "55_and_older": -0.28,
    },
    genders: { male: 0.14, female: -0.14 },
    tags: [
      { id: "demo-tag-matchday", name: "Matchday ritual", affinity: 0.86 },
      { id: "demo-tag-terrace", name: "Terrace fashion", affinity: 0.74 },
      { id: "demo-tag-london-night", name: "London nightlife", affinity: 0.61 },
      { id: "demo-tag-away-day", name: "European away day", affinity: 0.57 },
    ],
    artists: [
      { id: "demo-artist-stormzy", name: "Stormzy", affinity: 0.72, popularity: 0.81 },
      { id: "demo-artist-central-cee", name: "Central Cee", affinity: 0.68, popularity: 0.77 },
      { id: "demo-artist-fred-again", name: "Fred again..", affinity: 0.55, popularity: 0.7 },
    ],
    movies: [
      { id: "demo-movie-bend-it", name: "Bend It Like Beckham", affinity: 0.64, popularity: 0.7 },
      { id: "demo-movie-fever-pitch", name: "Fever Pitch", affinity: 0.51, popularity: 0.46 },
    ],
    destinations: [
      { id: "demo-dest-london", name: "London", affinity: 0.88, popularity: 0.99 },
      { id: "demo-dest-new-york", name: "New York", affinity: 0.41, popularity: 0.98 },
      { id: "demo-dest-abu-dhabi", name: "Abu Dhabi", affinity: 0.36, popularity: 0.62 },
    ],
    brands: [
      brand("demo-brand-nike", "Nike", 0.92, 0.97, young, 0.9, ["Sporting goods", "Footwear"]),
      brand("demo-brand-guinness", "Guinness", 0.81, 0.7, matchday, 0.76, ["Stout", "Pub"]),
      brand("demo-brand-ea", "EA Sports", 0.78, 0.74, young, 0.73, ["Video games"]),
      brand("demo-brand-adidas", "Adidas", 0.73, 0.95, young, 0.69, ["Sporting goods"]),
      brand("demo-brand-amex", "American Express", 0.66, 0.9, older, 0.61, ["Payments"]),
      brand("demo-brand-samsung", "Samsung", 0.6, 0.93, matchday, 0.55, ["Electronics"]),
      brand("demo-brand-uber", "Uber", 0.57, 0.91, matchday, 0.52, ["Mobility"]),
      brand("demo-brand-heineken", "Heineken", 0.54, 0.82, matchday, 0.49, ["Beer"]),
    ],
    heatmapCity: "London",
    heatmap: [
      { lat: 51.51, lng: -0.13, geohash: "demo-london-1", affinity: 0.95, popularity: 0.7 },
      { lat: 51.49, lng: -0.19, geohash: "demo-london-2", affinity: 0.88, popularity: 0.62 },
      { lat: 51.54, lng: -0.06, geohash: "demo-london-3", affinity: 0.81, popularity: 0.55 },
      { lat: 51.46, lng: -0.02, geohash: "demo-london-4", affinity: 0.74, popularity: 0.48 },
      { lat: 51.56, lng: -0.23, geohash: "demo-london-5", affinity: 0.66, popularity: 0.4 },
    ],
  },
  {
    id: "demo-entity-la-dodgers",
    name: "LA Dodgers",
    subtype: "urn:entity:brand",
    disambiguation: "Illustrative baseball club",
    popularity: 0.93,
    description: "Illustrative sample entity for SponsorFit demo mode. Not a Qloo record.",
    aliases: ["la dodgers", "los angeles dodgers", "dodgers", "l a dodgers"],
    ages: {
      "24_and_younger": -0.04,
      "25_to_29": 0.16,
      "30_to_34": 0.36,
      "35_to_44": 0.4,
      "45_to_54": 0.1,
      "55_and_older": -0.14,
    },
    genders: { male: 0.06, female: -0.06 },
    tags: [
      { id: "demo-tag-ballpark", name: "Ballpark evening", affinity: 0.84 },
      { id: "demo-tag-west-coast", name: "West Coast casual", affinity: 0.71 },
      { id: "demo-tag-family-outing", name: "Family outing", affinity: 0.66 },
      { id: "demo-tag-tailgate", name: "Tailgate food", affinity: 0.58 },
    ],
    artists: [
      { id: "demo-artist-kendrick", name: "Kendrick Lamar", affinity: 0.74, popularity: 0.9 },
      { id: "demo-artist-paak", name: "Anderson .Paak", affinity: 0.63, popularity: 0.68 },
      { id: "demo-artist-bad-bunny", name: "Bad Bunny", affinity: 0.59, popularity: 0.95 },
    ],
    movies: [
      { id: "demo-movie-moneyball", name: "Moneyball", affinity: 0.67, popularity: 0.72 },
      { id: "demo-movie-sandlot", name: "The Sandlot", affinity: 0.52, popularity: 0.6 },
    ],
    destinations: [
      { id: "demo-dest-los-angeles", name: "Los Angeles", affinity: 0.93, popularity: 0.98 },
      { id: "demo-dest-tokyo", name: "Tokyo", affinity: 0.48, popularity: 0.9 },
      { id: "demo-dest-new-york", name: "New York", affinity: 0.4, popularity: 0.98 },
    ],
    brands: [
      brand("demo-brand-nike", "Nike", 0.9, 0.97, family, 0.86, ["Sporting goods", "Footwear"]),
      brand("demo-brand-sony", "Sony", 0.84, 0.88, family, 0.8, ["Electronics"]),
      brand("demo-brand-toyota", "Toyota", 0.8, 0.86, family, 0.75, ["Automotive"]),
      brand("demo-brand-modelo", "Modelo", 0.76, 0.73, matchday, 0.71, ["Beer"]),
      brand("demo-brand-apple", "Apple", 0.7, 0.99, family, 0.66, ["Electronics"]),
      brand("demo-brand-amex", "American Express", 0.64, 0.9, older, 0.6, ["Payments"]),
      brand("demo-brand-samsung", "Samsung", 0.58, 0.93, family, 0.53, ["Electronics"]),
      brand("demo-brand-uber", "Uber", 0.55, 0.91, family, 0.5, ["Mobility"]),
    ],
    heatmapCity: "Los Angeles",
    heatmap: [
      { lat: 34.07, lng: -118.25, geohash: "demo-la-1", affinity: 0.93, popularity: 0.8 },
      { lat: 34.04, lng: -118.35, geohash: "demo-la-2", affinity: 0.86, popularity: 0.66 },
      { lat: 34.1, lng: -118.33, geohash: "demo-la-3", affinity: 0.79, popularity: 0.58 },
      { lat: 33.99, lng: -118.22, geohash: "demo-la-4", affinity: 0.71, popularity: 0.5 },
      { lat: 34.14, lng: -118.16, geohash: "demo-la-5", affinity: 0.63, popularity: 0.44 },
    ],
  },
  {
    id: "demo-entity-coachella",
    name: "Coachella",
    subtype: "urn:entity:destination",
    disambiguation: "Illustrative festival",
    popularity: 0.9,
    description: "Illustrative sample entity for SponsorFit demo mode. Not a Qloo record.",
    aliases: ["coachella", "coachella valley music and arts festival"],
    ages: {
      "24_and_younger": 0.4,
      "25_to_29": 0.44,
      "30_to_34": 0.12,
      "35_to_44": -0.08,
      "45_to_54": -0.26,
      "55_and_older": -0.36,
    },
    genders: { male: -0.04, female: 0.04 },
    tags: [
      { id: "demo-tag-desert", name: "Desert weekend", affinity: 0.9 },
      { id: "demo-tag-festival-fit", name: "Festival fit", affinity: 0.82 },
      { id: "demo-tag-golden-hour", name: "Golden hour photo", affinity: 0.7 },
      { id: "demo-tag-set-time", name: "Headliner set", affinity: 0.66 },
    ],
    artists: [
      { id: "demo-artist-beyonce", name: "Beyoncé", affinity: 0.8, popularity: 0.99 },
      { id: "demo-artist-frank", name: "Frank Ocean", affinity: 0.69, popularity: 0.84 },
      { id: "demo-artist-rosalia", name: "Rosalía", affinity: 0.62, popularity: 0.78 },
    ],
    movies: [
      { id: "demo-movie-almost-famous", name: "Almost Famous", affinity: 0.48, popularity: 0.66 },
    ],
    destinations: [
      { id: "demo-dest-indio", name: "Indio", affinity: 0.91, popularity: 0.42 },
      { id: "demo-dest-los-angeles", name: "Los Angeles", affinity: 0.72, popularity: 0.98 },
      { id: "demo-dest-palm-springs", name: "Palm Springs", affinity: 0.64, popularity: 0.55 },
    ],
    brands: [
      brand("demo-brand-heineken", "Heineken", 0.88, 0.82, festival, 0.84, ["Beer"]),
      brand("demo-brand-adidas", "Adidas", 0.83, 0.95, festival, 0.79, ["Sporting goods"]),
      brand("demo-brand-youtube", "YouTube", 0.79, 0.98, festival, 0.75, ["Media"]),
      brand("demo-brand-desert-radio", "Desert Radio FM", 0.75, 0.22, festival, 0.7, ["Illustrative broadcaster"]),
      brand("demo-brand-amex", "American Express", 0.71, 0.9, older, 0.6, ["Payments"]),
      brand("demo-brand-sony", "Sony", 0.67, 0.88, festival, 0.62, ["Electronics"]),
      brand("demo-brand-uber", "Uber", 0.62, 0.91, festival, 0.57, ["Mobility"]),
      brand("demo-brand-nike", "Nike", 0.58, 0.97, young, 0.54, ["Sporting goods"]),
    ],
    heatmapCity: "Indio",
    heatmap: [
      { lat: 33.68, lng: -116.24, geohash: "demo-indio-1", affinity: 0.96, popularity: 0.58 },
      { lat: 33.72, lng: -116.3, geohash: "demo-indio-2", affinity: 0.84, popularity: 0.4 },
      { lat: 33.64, lng: -116.18, geohash: "demo-indio-3", affinity: 0.77, popularity: 0.36 },
      { lat: 33.83, lng: -116.55, geohash: "demo-indio-4", affinity: 0.69, popularity: 0.48 },
    ],
  },
  {
    id: "demo-entity-smartless",
    name: "SmartLess",
    subtype: "urn:entity:podcast",
    disambiguation: "Illustrative podcast",
    popularity: 0.86,
    description: "Illustrative sample entity for a creator-led show. Not a Qloo record.",
    aliases: ["smartless", "smartless podcast"],
    ages: {
      "24_and_younger": -0.1,
      "25_to_29": 0.12,
      "30_to_34": 0.34,
      "35_to_44": 0.42,
      "45_to_54": 0.16,
      "55_and_older": -0.06,
    },
    genders: { male: 0.08, female: -0.08 },
    tags: [
      { id: "demo-tag-commute", name: "Long-form commute", affinity: 0.83 },
      { id: "demo-tag-guest", name: "Celebrity guest", affinity: 0.76 },
      { id: "demo-tag-banter", name: "Studio banter", affinity: 0.69 },
      { id: "demo-tag-live-tap", name: "Live taping", affinity: 0.6 },
    ],
    artists: [
      { id: "demo-artist-john-mayer", name: "John Mayer", affinity: 0.58, popularity: 0.8 },
      { id: "demo-artist-jon-batiste", name: "Jon Batiste", affinity: 0.49, popularity: 0.66 },
    ],
    movies: [
      { id: "demo-movie-air", name: "Air", affinity: 0.55, popularity: 0.61 },
    ],
    destinations: [
      { id: "demo-dest-los-angeles", name: "Los Angeles", affinity: 0.8, popularity: 0.98 },
      { id: "demo-dest-new-york", name: "New York", affinity: 0.63, popularity: 0.98 },
      { id: "demo-dest-boston", name: "Boston", affinity: 0.44, popularity: 0.7 },
    ],
    brands: [
      brand("demo-brand-spotify", "Spotify", 0.89, 0.96, family, 0.85, ["Audio"]),
      brand("demo-brand-apple", "Apple", 0.84, 0.99, family, 0.8, ["Electronics"]),
      brand("demo-brand-amex", "American Express", 0.78, 0.9, older, 0.7, ["Payments"]),
      brand("demo-brand-away", "Away", 0.7, 0.48, family, 0.64, ["Travel goods"]),
      brand("demo-brand-toyota", "Toyota", 0.64, 0.86, family, 0.58, ["Automotive"]),
      brand("demo-brand-nike", "Nike", 0.57, 0.97, young, 0.5, ["Sporting goods"]),
    ],
    heatmapCity: "Los Angeles",
    heatmap: [
      { lat: 34.09, lng: -118.33, geohash: "demo-smartless-1", affinity: 0.9, popularity: 0.72 },
      { lat: 34.05, lng: -118.25, geohash: "demo-smartless-2", affinity: 0.82, popularity: 0.64 },
      { lat: 34.14, lng: -118.4, geohash: "demo-smartless-3", affinity: 0.7, popularity: 0.51 },
      { lat: 34.02, lng: -118.45, geohash: "demo-smartless-4", affinity: 0.61, popularity: 0.42 },
    ],
  },
];

const COMPARE_TAGS: Record<string, Array<{ name: string; bucket: "shared" | "a" | "b" }>> = {
  "demo-entity-chelsea-fc|demo-entity-la-dodgers": [
    { name: "Professional sport", bucket: "shared" },
    { name: "Ticketed events", bucket: "shared" },
    { name: "Premier League", bucket: "a" },
    { name: "Major League Baseball", bucket: "b" },
  ],
  "demo-entity-la-dodgers|demo-entity-chelsea-fc": [
    { name: "Professional sport", bucket: "shared" },
    { name: "Ticketed events", bucket: "shared" },
    { name: "Major League Baseball", bucket: "a" },
    { name: "Premier League", bucket: "b" },
  ],
};

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function findDemoProperty(query: string): DemoProperty | undefined {
  const normalized = normalizeName(query);
  return DEMO_PROPERTIES.find(
    (property) => property.aliases.includes(normalized) || normalizeName(property.name) === normalized,
  );
}

export function demoCompareTags(aId: string, bId: string) {
  return COMPARE_TAGS[`${aId}|${bId}`] ?? [];
}

export const DEMO_EXAMPLES = [
  { label: "Chelsea FC", query: "Chelsea FC" },
  { label: "LA Dodgers", query: "LA Dodgers" },
  { label: "Coachella", query: "Coachella" },
  { label: "SmartLess", query: "SmartLess" },
] as const;
