// Arabic text normalizer - removes diacritics and normalizes characters
export function normalizeArabic(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[يى]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئء]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Levenshtein distance
export function levenshtein(a: string, b: string): number {
  const m: number[][] = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  m[0] = Array.from({ length: a.length + 1 }, (_, j) => j);
  for (let i = 1; i <= b.length; i++)
    for (let j = 1; j <= a.length; j++)
      m[i][j] = b[i - 1] === a[j - 1]
        ? m[i - 1][j - 1]
        : Math.min(m[i - 1][j - 1], m[i][j - 1], m[i - 1][j]) + 1;
  return m[b.length][a.length];
}

// Word matcher with fuzzy matching
export function arabicWordMatch(spoken: string, expected: string): boolean {
  const s = normalizeArabic(spoken);
  const e = normalizeArabic(expected);
  if (!s || !e) return false;
  if (s === e) return true;
  if (s.includes(e) || e.includes(s)) return true;
  if (s.length >= 3 && e.length >= 3 && s.substring(0, 3) === e.substring(0, 3)) return true;
  if (levenshtein(s, e) <= 1) return true;
  return false;
}

// Groq transcribe via edge function - returns extended data for smart detection
export async function groqTranscribe(audioBlob: Blob): Promise<{
  text: string;
  lowConfidence: boolean;
  language?: string;
  noSpeechProb?: number;
}> {
  try {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/groq-transcribe`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: formData,
      }
    );

    if (!res.ok) {
      console.error('Transcription failed:', res.status);
      return { text: '', lowConfidence: true };
    }

    const data = await res.json();
    return {
      text: data.text?.trim() || '',
      lowConfidence: data.lowConfidence || false,
      language: data.language || '',
      noSpeechProb: data.noSpeechProb ?? 1,
    };
  } catch (err) {
    console.error('Groq transcribe error:', err);
    return { text: '', lowConfidence: true };
  }
}
