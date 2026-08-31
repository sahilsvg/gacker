import { supabase } from '@/integrations/supabase/client';

export interface Quote {
  id: string;
  body: string;
  author: string | null;
}

const CACHE_KEY = 'gacker.quotes';

/**
 * Quotes are cached locally because notifications are scheduled ahead of time:
 * the schedule has to be rebuildable while offline, and a failed fetch should
 * leave the existing quotes in place rather than silently emptying them.
 */
export const loadCachedQuotes = (): Quote[] => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Quote[]) : [];
  } catch {
    return [];
  }
};

export const refreshQuotes = async (): Promise<Quote[]> => {
  const { data, error } = await supabase
    .from('quotes')
    .select('id, body, author')
    .eq('active', true);

  if (error || !data) {
    console.warn('[quotes] fetch failed, keeping cache:', error?.message);
    return loadCachedQuotes();
  }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Cache is a convenience; scheduling still works from what we just fetched.
  }
  return data as Quote[];
};
