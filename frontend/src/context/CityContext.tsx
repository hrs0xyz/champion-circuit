/**
 * CityContext — selected cities (multi-select).
 * Empty array = All cities.
 * Persisted in localStorage.
 */
import {
  createContext, useCallback, useContext,
  useMemo, useState, type ReactNode,
} from 'react';

export const CC_CITIES = [
  'Kolkata', 'Mumbai', 'Delhi', 'Bengaluru',
  'Hyderabad', 'Chennai', 'Pune', 'Ahmedabad',
];

const STORAGE_KEY = 'cc_selected_cities';

function load(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function save(cities: string[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cities)); } catch { /* */ }
}

type CityContextValue = {
  cities: string[];                    // selected cities, [] = All
  toggleCity: (c: string) => void;     // toggle one city on/off
  clearCities: () => void;             // reset to All
  isSelected: (c: string) => boolean;
  matchesCity: (c: string) => boolean; // true if city passes current filter
};

const CityContext = createContext<CityContextValue | null>(null);

export function CityProvider({ children }: { children: ReactNode }) {
  const [cities, setCities] = useState<string[]>(load);

  const toggleCity = useCallback((c: string) => {
    setCities((prev) => {
      const next = prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c];
      save(next);
      return next;
    });
  }, []);

  const clearCities = useCallback(() => {
    setCities([]);
    save([]);
  }, []);

  const isSelected = useCallback((c: string) => cities.includes(c), [cities]);

  const matchesCity = useCallback(
    (c: string) => cities.length === 0 || cities.some((s) => s.toLowerCase() === c.toLowerCase()),
    [cities],
  );

  const value = useMemo(
    () => ({ cities, toggleCity, clearCities, isSelected, matchesCity }),
    [cities, toggleCity, clearCities, isSelected, matchesCity],
  );

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}

export function useCity() {
  const ctx = useContext(CityContext);
  if (!ctx) throw new Error('useCity must be used within CityProvider');
  return ctx;
}
