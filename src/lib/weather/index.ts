import type { WeatherEvidence } from "@/lib/domain/types";
import { diffDays, todayLocal } from "@/lib/domain/dates";

/**
 * Site-weather corroboration via Open-Meteo (free, keyless). We store the measured values inside the
 * sealed log entry, so the evidence stays fixed even if the upstream service later revises its data.
 */

const DAILY = "precipitation_sum,wind_gusts_10m_max,temperature_2m_max,temperature_2m_min";

interface DailyResponse {
  daily?: {
    time: string[];
    precipitation_sum: (number | null)[];
    wind_gusts_10m_max: (number | null)[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
  };
}

async function fetchDaily(lat: number, lon: number, start: string, end: string): Promise<DailyResponse | null> {
  const recent = diffDays(start, todayLocal()) <= 85;
  const base = recent ? "https://api.open-meteo.com/v1/forecast" : "https://archive-api.open-meteo.com/v1/archive";
  const url = `${base}?latitude=${lat}&longitude=${lon}&start_date=${start}&end_date=${end}&daily=${DAILY}&wind_speed_unit=kmh&timezone=auto`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as DailyResponse;
  } catch {
    return null;
  }
}

export async function fetchSiteWeather(lat: number | null, lon: number | null, date: string): Promise<WeatherEvidence | null> {
  if (lat === null || lon === null) return null;
  if (diffDays(todayLocal(), date) > 0) return null; // can't measure the future
  const data = await fetchDaily(lat, lon, date, date);
  const d = data?.daily;
  if (!d || !d.time?.length) return null;
  return {
    source: "open-meteo",
    fetchedAt: new Date().toISOString(),
    date,
    lat,
    lon,
    precipitationMm: d.precipitation_sum?.[0] ?? null,
    windMaxKmh: d.wind_gusts_10m_max?.[0] ?? null,
    tempMaxC: d.temperature_2m_max?.[0] ?? null,
    tempMinC: d.temperature_2m_min?.[0] ?? null,
  };
}

/** One request for a date range; used by the demo seeder to place events on real wet/windy days. */
export async function fetchSiteWeatherRange(
  lat: number,
  lon: number,
  start: string,
  end: string,
): Promise<Map<string, WeatherEvidence>> {
  const out = new Map<string, WeatherEvidence>();
  const data = await fetchDaily(lat, lon, start, end);
  const d = data?.daily;
  if (!d) return out;
  d.time.forEach((date, i) =>
    out.set(date, {
      source: "open-meteo",
      fetchedAt: new Date().toISOString(),
      date,
      lat,
      lon,
      precipitationMm: d.precipitation_sum?.[i] ?? null,
      windMaxKmh: d.wind_gusts_10m_max?.[i] ?? null,
      tempMaxC: d.temperature_2m_max?.[i] ?? null,
      tempMinC: d.temperature_2m_min?.[i] ?? null,
    }),
  );
  return out;
}
