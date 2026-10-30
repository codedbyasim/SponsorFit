import assert from "node:assert/strict";
import test from "node:test";
import { normalizeName, runScout } from "./agent";
import { assertPublicQuery, PrivacyError } from "./privacy";
import { pitchIsGrounded, type PitchContext } from "./pitch";

test("personal contact data never becomes a Qloo query", async () => {
  await assert.rejects(
    () => runScout({ query: "scout@example.com" }, () => undefined, { allowLlm: false }),
    PrivacyError,
  );
  await assert.rejects(
    () => runScout({ query: "123-456-7890" }, () => undefined, { allowLlm: false }),
    /Personal contact/,
  );
});

test("assertPublicQuery enforces length and valid characters", () => {
  assert.equal(assertPublicQuery("  Chelsea   FC  "), "Chelsea FC");
  assert.throws(() => assertPublicQuery("A"), /must be between 2 and 80/);
  assert.throws(() => assertPublicQuery("<script>alert(1)</script>"), /unsupported characters/);
});

test("normalizeName standardizes strings, symbols, and whitespace", () => {
  assert.equal(normalizeName("Chelsea F.C. & Co."), "chelsea f c and co");
  assert.equal(normalizeName("   LA   Dodgers  "), "la dodgers");
});

test("pitchIsGrounded validates numbers against evidence and rejects hallucinations", () => {
  const ctx: PitchContext = {
    propertyName: "Chelsea FC",
    brandId: "brand-1",
    brandName: "Nike",
    rank: 1,
    fit: 85.5,
    formula: "60% × affinity + 25% × popularity",
    factors: [],
    affinity: 0.9,
    popularity: 0.8,
    demoAlignment: null,
    why: [],
    audience: { ages: [], genders: [], tags: [] },
    taste: [],
    destinationName: "London",
    destinationAffinity: 0.75,
    heatmapCity: "London",
    heatmapSource: "destination",
    topCellAffinity: 0.88,
  };

  const validPitch = {
    brandId: "brand-1",
    brandName: "Nike",
    rank: 1,
    why: "Nike ranks 1 with a Fit Score of 85.5.",
    evidence: ["Qloo affinity 0.90", "Qloo popularity 0.80"],
    activation: "Activation in London.",
    city: "London",
    writer: "template" as const,
  };

  assert.equal(pitchIsGrounded(validPitch, ctx), true);

  const hallucinatedPitch = {
    ...validPitch,
    why: "Nike ranks 1 with 999999 fans.", // 999999 is ungrounded
  };
  assert.equal(pitchIsGrounded(hallucinatedPitch, ctx), false);
});
