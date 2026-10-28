import assert from "node:assert/strict";
import test from "node:test";
import { parseCompare, parseDemographics, parseEntities, parseHeatmap, parseTags } from "./parse";

const entityPayload = {
  success: true,
  results: {
    entities: [
      {
        name: "Sample Brand",
        entity_id: "11111111-1111-1111-1111-111111111111",
        subtype: "urn:entity:brand",
        popularity: 0.42,
        properties: {
          description: "A catalog blurb.",
          tags: [{ name: "Retail" }],
        },
        query: {
          affinity: 0.77,
          explainability: {
            entities: [{ name: "Sample Club", score: 0.81 }],
          },
        },
      },
    ],
  },
};

test("entity parser reads documented affinity, popularity, and explainability", () => {
  const [brand] = parseEntities(entityPayload);
  assert.equal(brand.affinity, 0.77);
  assert.equal(brand.popularity, 0.42);
  assert.equal(brand.why[0]?.label, "Sample Club");
  assert.equal(brand.why[0]?.score, 0.81);
  assert.deepEqual(brand.catalogTags, ["Retail"]);
});

test("demographics parser keeps signed age and gender indexes", () => {
  const parsed = parseDemographics({
    results: {
      demographics: [
        {
          entity_id: "club",
          query: {
            age: { "25_to_29": 0.48, "55_and_older": -0.2 },
            gender: { male: 0.1, female: -0.1 },
          },
        },
      ],
    },
  });
  assert.equal(parsed.ages[0]?.label, "25 to 29");
  assert.equal(parsed.ages[1]?.value, -0.2);
  assert.equal(parsed.genders.length, 2);
});

test("tag, heatmap, and compare parsers follow the documented containers", () => {
  const tags = parseTags({
    results: { tags: [{ tag_id: "urn:tag:demo:terrace", name: "Terrace", query: { affinity: 0.5 } }] },
  });
  assert.equal(tags[0]?.affinity, 0.5);

  const heat = parseHeatmap({
    results: {
      heatmap: [
        { location: { latitude: 51.5, longitude: -0.12, geohash: "gcpvj" }, query: { affinity: 0.9, popularity: 0.4 } },
      ],
    },
    query: { localities: { filter: { name: "London" } } },
  });
  assert.equal(heat.localityName, "London");
  assert.equal(heat.cells[0]?.geohash, "gcpvj");

  const compared = parseCompare({
    results: {
      shared: [{ name: "Ticketed events" }],
      only_a: [{ name: "Terrace" }],
      only_b: ["Diamond"],
    },
  });
  assert.deepEqual(
    compared.map((tag) => tag.bucket),
    ["shared", "a", "b"],
  );
});
