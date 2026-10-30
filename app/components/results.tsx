"use client";

import { useState } from "react";
import { cellSizeLabel, formatCoord, mapsAreaUrl } from "@/lib/geo";
import type { Activation, AudienceProfile, BrandRow, CompareResult, HeatCell, Pitch, TasteItem, TraceStep } from "@/lib/types";

export function unit(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

export function points(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(1);
}

export function subtypeLabel(urn: string): string {
  const last = (urn.split(":").pop() ?? urn).replaceAll("_", " ");
  return last.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function TraceList({ steps }: { steps: TraceStep[] }) {
  return (
    <aside className="trace" aria-label="Agent trace">
      <h2>Agent trace</h2>
      {steps.length === 0 ? (
        <div className="cue">
          <b>00</b>
          <div>
            <div className="title">Waiting for a property</div>
            <p>The desk stays quiet until you send a team, creator, artist, or event.</p>
          </div>
        </div>
      ) : (
        steps.map((step) => (
          <div key={step.id} className={`cue ${step.status}`}>
            <b>{step.cue}</b>
            <div>
              <div className="title">{step.title}</div>
              <div className="status">{step.status}</div>
              <p>{step.detail}</p>
              {step.endpoint ? <span className="endpoint">{step.endpoint}</span> : null}
            </div>
          </div>
        ))
      )}
    </aside>
  );
}

export function BrandBoard({
  brands,
  selectedId,
  onSelect,
}: {
  brands: BrandRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const selected = brands.find((brand) => brand.id === selectedId) ?? brands[0];
  return (
    <section className="panel" aria-labelledby="board-title">
      <div className="panel-head">
        <h2 id="board-title">Sponsor board</h2>
        <p className="kicker">Fit Score is SponsorFit math on returned signals.</p>
      </div>
      <div className="table-wrap">
        <table>
          <caption className="sr">Brands ranked by Fit Score</caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Brand</th>
              <th scope="col">Fit</th>
              <th scope="col">Affinity</th>
              <th scope="col">Popularity</th>
              <th scope="col">Age align</th>
              <th scope="col">Why</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((brand) => (
              <tr key={brand.id} className={brand.id === selected?.id ? "is-selected" : undefined}>
                <td className="rank">{brand.rank}</td>
                <td>
                  <button
                    type="button"
                    className="name-btn"
                    aria-pressed={brand.id === selected?.id}
                    onClick={() => onSelect(brand.id)}
                  >
                    {brand.name}
                    {brand.catalogTags[0] ? <span className="sub">{brand.catalogTags.slice(0, 2).join(" · ")}</span> : null}
                  </button>
                </td>
                <td>
                  <div className="num">{points(brand.fit)}</div>
                  <div className="bar" aria-hidden="true">
                    <span style={{ width: `${Math.max(0, Math.min(100, brand.fit ?? 0))}%` }} />
                  </div>
                </td>
                <td className="num">{unit(brand.affinity)}</td>
                <td className="num">{unit(brand.popularity)}</td>
                <td className="num">{points(brand.demoAlignment)}</td>
                <td>
                  <div className="chips-inline">
                    {brand.why.length ? (
                      brand.why.map((chip) => (
                        <span key={`${chip.label}-${chip.score}`} className="why">
                          {chip.label}
                          {chip.score == null ? "" : ` ${unit(chip.score)}`}
                        </span>
                      ))
                    ) : (
                      <span className="why">No explainability returned</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected ? (
        <>
          <p className="formula">
            {selected.name}: {selected.formula}
          </p>
          <div className="factors">
            {selected.factors.map((factor) => (
              <div key={factor.key} className="factor">
                <span>
                  {Math.round(factor.weight * 100)}% {factor.label}
                </span>
                <b>{points(factor.contribution)}</b>
                <span>from {points(factor.value)}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

function IndexRows({ rows, signed }: { rows: AudienceProfile["ages"]; signed?: boolean }) {
  const peak = Math.max(1, ...rows.map((row) => Math.abs(row.value)));
  return (
    <div>
      {rows.map((row) => {
        const width = Math.min(50, (Math.abs(row.value) / peak) * 50);
        const negative = signed && row.value < 0;
        return (
          <div key={row.key} className="index">
            <span>{row.label}</span>
            <div className="track" aria-hidden="true">
              <i />
              <span
                className={negative ? "neg" : undefined}
                style={negative ? { right: "50%", width: `${width}%` } : { left: "50%", width: `${width}%` }}
              />
            </div>
            <span className="num">{unit(row.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function AudiencePanel({ audience, taste }: { audience: AudienceProfile; taste: TasteItem[] }) {
  const domains: Array<{ key: TasteItem["domain"]; label: string }> = [
    { key: "artist", label: "Artists" },
    { key: "movie", label: "Movies" },
    { key: "destination", label: "Destinations" },
  ];
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Audience profile</h2>
        <p className="kicker">Group indexes. Not a person.</p>
      </div>
      <div style={{ padding: "8px 14px 14px" }}>
        <h3 className="kicker">Age index</h3>
        {audience.ages.length ? <IndexRows rows={audience.ages} signed /> : <p className="note">No age indexes returned.</p>}
        <h3 className="kicker">Gender index</h3>
        {audience.genders.length ? <IndexRows rows={audience.genders} signed /> : <p className="note">No gender indexes returned.</p>}
        <h3 className="kicker">Taste tags</h3>
        <div className="tags">
          {audience.tags.length ? (
            audience.tags.map((tag) => (
              <span key={tag.id} className="tag">
                <b>{tag.name}</b> {tag.affinity == null ? "" : unit(tag.affinity)}
              </span>
            ))
          ) : (
            <p className="note">No taste tags returned.</p>
          )}
        </div>
        <div className="taste">
          {domains.map((domain) => {
            const items = taste.filter((item) => item.domain === domain.key);
            return (
              <div key={domain.key}>
                <h3>{domain.label}</h3>
                <ul>
                  {items.length ? (
                    items.map((item) => (
                      <li key={item.id}>
                        {item.name} <span className="num">{unit(item.affinity)}</span>
                      </li>
                    ))
                  ) : (
                    <li>None returned</li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function ActivationPanel({ activation }: { activation: Activation | null }) {
  return (
    <section className="panel activation-panel">
      <div className="panel-head">
        <h2>Activation map</h2>
        <div className="activation-head-right">
          <p className="kicker">{activation ? `${activation.brandName} · ${activation.city}` : "No map"}</p>
          {activation ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activation.brandName + " " + activation.city)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="city-map-btn"
              title={`Search ${activation.brandName} in ${activation.city} on Google Maps`}
            >
              🗺️ Open {activation.city} Map ↗
            </a>
          ) : null}
        </div>
      </div>
      <div style={{ padding: "8px 14px 14px" }}>
        {activation && activation.cells.length ? (
          <>
            <p className="note">
              {activation.citySource === "operator"
                ? `${activation.city} was entered as your target activation city.`
                : `${activation.city} is the top travel destination returned by Qloo for this audience.`}
              {activation.localityName && activation.localityName !== activation.city
                ? ` (Qloo matched locality: ${activation.localityName}).`
                : ""}{" "}
              Each dot is a grid square, not a street address: the centre of an area where {activation.brandName} fans concentrate. A square can include parks, water, or open land, so open it on the map and look around the area before choosing a venue.
            </p>

            <div className="heat-legend">
              <span><i className="legend-dot high" /> Top Density Hotspots (&gt;95% match)</span>
              <span><i className="legend-dot med" /> High Footfall Zones (80% - 95%)</span>
            </div>

            <Heatmap cells={activation.cells} city={activation.city} brandName={activation.brandName} />

            <h3 className="kicker" style={{ marginTop: 14 }}>Top Campaign Hotspots in {activation.city}</h3>
            <div className="hotspot-cards">
              {activation.cells.slice(0, 4).map((cell, idx) => {
                const pct = ((cell.affinity ?? 0) * 100).toFixed(0);
                const mapsUrl = mapsAreaUrl(cell.lat, cell.lng, cell.geohash);
                return (
                  <div key={cell.geohash ?? `${cell.lat},${cell.lng}`} className="hotspot-card">
                    <div className="hotspot-left">
                      <span className="hotspot-badge">#{idx + 1} Zone</span>
                      <div>
                        <strong className="hotspot-coords">
                          {formatCoord(cell.lat, cell.lng)}
                          {cell.geohash ? <span className="geohash-tag">Geohash: {cell.geohash}</span> : null}
                        </strong>
                        <span className="hotspot-sub">Centre of a {cellSizeLabel(cell.geohash)} with concentrated {activation.brandName} fans</span>
                      </div>
                    </div>
                    <div className="hotspot-actions">
                      <span className="hotspot-affinity-val">{pct}% Affinity</span>
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="map-link-btn"
                        title="Open exact coordinates on Google Maps"
                      >
                        📍 View area ↗
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="note">No heatmap cells for this run. Enter a city such as London, New York, or Lahore, or rely on a returned destination.</p>
        )}
      </div>
    </section>
  );
}

function Heatmap({ cells, city, brandName }: { cells: HeatCell[]; city: string; brandName: string }) {
  const [selectedCell, setSelectedCell] = useState<HeatCell | null>(cells[0] ?? null);
  const lats = cells.map((cell) => cell.lat);
  const lngs = cells.map((cell) => cell.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = maxLat - minLat || 0.01;
  const lngSpan = maxLng - minLng || 0.01;

  return (
    <div className="heat-container">
      <div className="heat" role="img" aria-label="Returned heatmap cells plotted by latitude and longitude">
        <div className="compass-n">N</div>
        <div className="compass-s">S</div>
        <div className="compass-w">W</div>
        <div className="compass-e">E</div>
        <div className="city-watermark">{city}</div>

        {cells.map((cell, idx) => {
          const x = ((cell.lng - minLng) / lngSpan) * 76 + 12;
          const y = (1 - (cell.lat - minLat) / latSpan) * 76 + 12;
          const affinity = cell.affinity ?? 0.4;
          const size = 14 + Math.max(0, Math.min(1, affinity)) * 18;
          const isSelected = selectedCell?.geohash === cell.geohash || (selectedCell?.lat === cell.lat && selectedCell?.lng === cell.lng);

          return (
            <button
              type="button"
              key={cell.geohash ?? `${cell.lat}-${cell.lng}`}
              className={`dot ${isSelected ? "is-active" : ""}`}
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: size,
                height: size,
                opacity: 0.55 + affinity * 0.45,
              }}
              onClick={() => setSelectedCell(cell)}
              onMouseEnter={() => setSelectedCell(cell)}
              title={`Zone #${idx + 1}: ${cell.geohash ?? `${cell.lat.toFixed(3)}, ${cell.lng.toFixed(3)}`} (${((cell.affinity ?? 0) * 100).toFixed(0)}% affinity)`}
              aria-label={`Hotspot ${idx + 1}`}
            />
          );
        })}
      </div>

      {selectedCell ? (
        <div className="active-cell-callout">
          <div className="callout-header">
            <span className="callout-pin">📍</span>
            <div>
              <strong>
                Hotspot {selectedCell.geohash ? `"${selectedCell.geohash}"` : ""} ({formatCoord(selectedCell.lat, selectedCell.lng, 4)})
              </strong>
              <small>Centre of a {cellSizeLabel(selectedCell.geohash)} with concentrated {brandName} fans in {city}</small>
            </div>
          </div>
          <div className="callout-right">
            <span className="callout-affinity">
              {((selectedCell.affinity ?? 0) * 100).toFixed(0)}% match
            </span>
            <a
              href={mapsAreaUrl(selectedCell.lat, selectedCell.lng, selectedCell.geohash)}
              target="_blank"
              rel="noopener noreferrer"
              className="map-link-btn"
            >
              View area on Google Maps ↗
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ComparePanel({ compare }: { compare: CompareResult }) {
  const groups: Array<{ bucket: CompareResult["qlooTags"][number]["bucket"]; label: string }> = [
    { bucket: "shared", label: "Shared" },
    { bucket: "a", label: compare.a.name },
    { bucket: "b", label: compare.b.name },
    { bucket: "returned", label: "Returned" },
  ];
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Compare</h2>
        <p className="kicker">
          {compare.a.name} vs {compare.b.name}
        </p>
      </div>
      <p className="formula">{compare.note}</p>
      <div className="compare-grid">
        <div>
          <h3>On both brand lists</h3>
          {compare.sharedBrands.length ? (
            <table>
              <thead>
                <tr>
                  <th scope="col">Brand</th>
                  <th scope="col">{compare.a.name}</th>
                  <th scope="col">{compare.b.name}</th>
                </tr>
              </thead>
              <tbody>
                {compare.sharedBrands.map((brand) => (
                  <tr key={brand.name}>
                    <td>{brand.name}</td>
                    <td className="num">{points(brand.fitA)}</td>
                    <td className="num">{points(brand.fitB)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="note">No shared brand names in the two lists.</p>
          )}
        </div>
        <div>
          <h3>Only {compare.a.name}</h3>
          <ul>
            {compare.onlyA.slice(0, 8).map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Only {compare.b.name}</h3>
          <ul>
            {compare.onlyB.slice(0, 8).map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      </div>
      <div style={{ padding: "0 14px 14px" }}>
        <h3 className="kicker">Qloo compare tags</h3>
        {compare.qlooTags.length ? (
          groups.map((group) => {
            const tags = compare.qlooTags.filter((tag) => tag.bucket === group.bucket);
            if (!tags.length) return null;
            return (
              <div key={group.bucket} className="tag-row" style={{ marginTop: 8 }}>
                <span className="why">{group.label}</span>
                {tags.map((tag) => (
                  <span key={`${group.bucket}-${tag.name}`} className="tag">
                    {tag.name}
                  </span>
                ))}
              </div>
            );
          })
        ) : (
          <p className="note">No compare tags for this pair.</p>
        )}
      </div>
    </section>
  );
}

export function PitchDeck({ pitches }: { pitches: Pitch[] }) {
  return (
    <section className="paper-wrap" id="pitches">
      <h2>Pitch cards</h2>
      <div className="pitch-grid">
        {pitches.map((pitch) => (
          <article key={pitch.brandId} className="pitch">
            <header>
              <h3>
                {pitch.rank}. {pitch.brandName}
              </h3>
              <span className="writer">{pitch.writer === "llm" ? "AIML draft, number-checked" : "Template from the evidence"}</span>
            </header>
            <p>{pitch.why}</p>
            <ul>
              {pitch.evidence.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p>{pitch.activation}</p>
            <p className="city-line">Target city: {pitch.city ?? "Not returned"}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
