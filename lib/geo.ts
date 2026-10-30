import type { HeatCell } from "./types";

type Point = { lat: number; lng: number };

const EARTH_KM = 6371;

export function distanceKm(a: Point, b: Point): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function median(values: number[]): number {
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Qloo resolves a free-text locality loosely ("Lahore", "Paris", "New York" can match a whole
 * region), so a few cells can land in other towns far from the city. Keep the dense cluster around
 * the median centre and drop distant strays. Works for any city, nothing is hard-coded.
 */
export function focusCluster(cells: HeatCell[], maxKm = 50): HeatCell[] {
  if (cells.length < 4) return cells;
  const centre = { lat: median(cells.map((cell) => cell.lat)), lng: median(cells.map((cell) => cell.lng)) };
  const kept = cells.filter((cell) => distanceKm(centre, cell) <= maxKm);
  return kept.length >= 3 ? kept : cells;
}

export function formatCoord(lat: number, lng: number, digits = 3): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(digits)}°${ns}, ${Math.abs(lng).toFixed(digits)}°${ew}`;
}

/** Geohash length decides how big a cell is: 5 chars is roughly 5 km, 6 chars roughly 1 km. */
export function cellSizeLabel(geohash?: string): string {
  const length = geohash?.length ?? 0;
  if (length >= 7) return "~150 m area";
  if (length === 6) return "~1 km area";
  if (length === 5) return "~5 km area";
  return "city-scale area";
}

export function mapsAreaUrl(lat: number, lng: number, geohash?: string): string {
  const zoom = (geohash?.length ?? 5) >= 6 ? 15 : 13;
  return `https://www.google.com/maps/@${lat},${lng},${zoom}z`;
}
