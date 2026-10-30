import type { ScoutResult } from "./types";

export function briefMarkdown(result: ScoutResult): string {
  const lines: string[] = [
    `# SponsorFit brief: ${result.property.name}`,
    "",
    "Data source: live Qloo Taste AI. Affinities describe groups, not individuals.",
    "",
    "Fit Score = 60% Qloo affinity + 25% Qloo popularity + 15% demographic alignment. Missing factors are dropped and the remaining weights are renormalized. Demographic alignment is the cosine similarity of returned age-index vectors, mapped from -1..1 to 0..100.",
    "",
    "## Ranked brands",
    "",
  ];

  for (const brand of result.brands.slice(0, 8)) {
    lines.push(
      `${brand.rank}. ${brand.name} — Fit ${brand.fit ?? "withheld"} (${brand.formula})`,
    );
  }

  lines.push("", "## Pitches", "");
  for (const pitch of result.pitches) {
    lines.push(`### ${pitch.rank}. ${pitch.brandName}`);
    lines.push("");
    lines.push(pitch.why);
    lines.push("");
    for (const item of pitch.evidence) lines.push(`- ${item}`);
    lines.push("");
    lines.push(pitch.activation);
    lines.push("");
    lines.push(`Target city: ${pitch.city ?? "not returned"}`);
    lines.push(`Writer: ${pitch.writer === "llm" ? "AIML, checked against the evidence" : "deterministic template"}`);
    lines.push("");
  }

  if (result.warnings.length) {
    lines.push("## Notes", "");
    for (const warning of result.warnings) lines.push(`- ${warning}`);
  }

  lines.push(
    "",
    "SponsorFit does not infer health, politics, religion, or finances, and it does not describe private individuals.",
  );
  return lines.join("\n");
}

export function briefHtml(result: ScoutResult): string {
  const markdown = briefMarkdown(result);
  const body = markdown
    .split("\n")
    .map((line) => {
      if (line.startsWith("# ")) return `<h1>${escapeHtml(line.slice(2))}</h1>`;
      if (line.startsWith("## ")) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
      if (line.startsWith("### ")) return `<h3>${escapeHtml(line.slice(4))}</h3>`;
      if (line.startsWith("- ")) return `<li>${escapeHtml(line.slice(2))}</li>`;
      if (!line.trim()) return "";
      return `<p>${escapeHtml(line)}</p>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>SponsorFit brief: ${escapeHtml(result.property.name)}</title>
  <style>
    @page { margin: 0.6in; }
    body { font-family: Georgia, serif; color: #1a1814; max-width: 720px; margin: 0 auto; }
    h1 { font-family: Arial, sans-serif; font-size: 28px; letter-spacing: -0.03em; }
    h2 { font-family: Arial, sans-serif; font-size: 14px; letter-spacing: 0.12em; text-transform: uppercase; }
    li { margin: 0.2rem 0; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
