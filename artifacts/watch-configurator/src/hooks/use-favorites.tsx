import { useState, useCallback } from 'react';

const FAV_KEY = 'watch_favorites';
const RECENT_KEY = 'watch_recently_viewed';
const MAX_RECENT = 8;

function readSet(key: string): Set<number> {
  try {
    const s = localStorage.getItem(key);
    return s ? new Set(JSON.parse(s)) : new Set();
  } catch { return new Set(); }
}

function readArray(key: string): number[] {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<number>>(() => readSet(FAV_KEY));

  const toggle = useCallback((id: number) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(FAV_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  const isFavorite = useCallback((id: number) => favorites.has(id), [favorites]);

  return { favorites, toggle, isFavorite, count: favorites.size };
}

export function useRecentlyViewed() {
  const [recent, setRecent] = useState<number[]>(() => readArray(RECENT_KEY));

  const addViewed = useCallback((id: number) => {
    setRecent(prev => {
      const next = [id, ...prev.filter(x => x !== id)].slice(0, MAX_RECENT);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return { recent, addViewed };
}
