import { CC_CITIES, useCity } from '../../context/CityContext';

export function CityBar() {
  const { cities, toggleCity, clearCities, isSelected } = useCity();
  const allSelected = cities.length === 0;

  return (
    <div className="city-bar" role="group" aria-label="Filter by city">
      <span className="city-bar__icon">📍</span>

      <button
        type="button"
        className={`city-chip${allSelected ? ' city-chip--active' : ''}`}
        onClick={clearCities}
      >
        All
      </button>

      {CC_CITIES.map((c) => (
        <button
          key={c}
          type="button"
          className={`city-chip${isSelected(c) ? ' city-chip--active' : ''}`}
          onClick={() => toggleCity(c)}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
