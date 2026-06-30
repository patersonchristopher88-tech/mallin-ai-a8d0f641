/**
 * Client-side media search: iTunes Search (free, CORS) + lyrics.ovh (free, CORS).
 * No API key required.
 */

export type Track = {
  id: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl100: string;
  artworkUrl600: string;
  previewUrl: string; // 30s mp4
  trackTimeMillis: number;
  releaseDate: string;
  primaryGenreName: string;
  trackViewUrl: string;
};

type ITunesResponse = {
  resultCount: number;
  results: Array<Track & { artworkUrl100?: string; previewUrl?: string }>;
};

export async function searchTracks(query: string, limit = 24): Promise<Track[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `https://itunes.apple.com/search?media=music&entity=song&limit=${limit}&term=${encodeURIComponent(q)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`iTunes ${res.status}`);
  const data = (await res.json()) as ITunesResponse;
  return (data.results ?? [])
    .filter((t) => !!t.previewUrl)
    .map((t) => ({
      ...t,
      artworkUrl600: (t.artworkUrl100 ?? "").replace("100x100", "600x600"),
    }));
}

export async function fetchLyrics(artist: string, title: string): Promise<string | null> {
  try {
    // Strip "(feat. ...)" / "- Remastered" noise to improve hit rate.
    const cleanTitle = title.replace(/\s*\([^)]*\)\s*/g, "").replace(/\s*-\s*Remaster.*$/i, "").trim();
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(cleanTitle)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { lyrics?: string };
    const lyrics = data.lyrics?.trim();
    return lyrics && lyrics.length > 0 ? lyrics : null;
  } catch {
    return null;
  }
}

export async function fetchTrendingSeeds(): Promise<Track[]> {
  // Use a few popular seed searches to populate the empty state.
  const seeds = ["top hits 2025", "billboard", "viral songs"];
  const seed = seeds[Math.floor(Math.random() * seeds.length)];
  return searchTracks(seed, 18);
}
