import { useEffect, useRef, useState } from 'react';
import { CC_CITIES, useCity } from '../../context/CityContext';
import { useActivity } from '../../hooks/useActivity';

export function CityDropdown() {
  const { cities, toggleCity, clearCities } = useCity();
  const { track } = useActivity();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Label shown on the trigger button
  const label = cities.length === 0 ? 'All Cities' : cities[0];

  // Filter cities based on search query
  const filteredCities = search.trim()
    ? CC_CITIES.filter((c) => c.toLowerCase().includes(search.toLowerCase()))
    : CC_CITIES;

  // Close on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) {
      // Small timeout to let the dropdown render first
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  function selectCity(city: string | null) {
    if (!city) {
      clearCities();
      sessionStorage.setItem('cc_city_auto_set', '1');
    } else {
      clearCities();
      toggleCity(city);
      sessionStorage.setItem('cc_city_auto_set', '1');
      track({ event: 'city_filter', city });
    }
    setOpen(false);
    setSearch('');
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen((o) => !o);
    }
    if (e.key === 'Escape') {
      setOpen(false);
      setSearch('');
    }
  }

  function isActive(city: string): boolean {
    return cities.includes(city);
  }

  return (
    <div className="city-dropdown" ref={containerRef}>
      <button
        type="button"
        className="city-dropdown__trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          setOpen((o) => !o);
          if (open) setSearch('');
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        {label} ▾
      </button>

      {open && (
        <div className="city-dropdown__panel" role="dialog" aria-label="Select city">
          {/* Search box - shown for usability when list is long */}
          <div className="city-dropdown__search-wrap">
            <input
              ref={searchRef}
              type="text"
              className="city-dropdown__search"
              placeholder="Search city…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setOpen(false);
                  setSearch('');
                }
                // Enter selects the first filtered result
                if (e.key === 'Enter' && filteredCities.length > 0) {
                  selectCity(filteredCities[0]);
                }
              }}
              aria-label="Search cities"
              autoComplete="off"
            />
            {search && (
              <button
                type="button"
                className="city-dropdown__search-clear"
                onClick={() => {
                  setSearch('');
                  searchRef.current?.focus();
                }}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <ul role="listbox" className="city-dropdown__list">
            {/* All Cities option - only show when not filtering */}
            {!search && (
              <li
                role="option"
                aria-selected={cities.length === 0}
                tabIndex={0}
                className={`city-dropdown__option${cities.length === 0 ? ' city-dropdown__option--active' : ''}`}
                onClick={() => selectCity(null)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && selectCity(null)}
              >
                All Cities
              </li>
            )}

            {filteredCities.length === 0 ? (
              <li className="city-dropdown__no-results">No cities found</li>
            ) : (
              filteredCities.map((city) => (
                <li
                  key={city}
                  role="option"
                  aria-selected={isActive(city)}
                  tabIndex={0}
                  className={`city-dropdown__option${isActive(city) ? ' city-dropdown__option--active' : ''}`}
                  onClick={() => selectCity(city)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && selectCity(city)}
                >
                  {city}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
