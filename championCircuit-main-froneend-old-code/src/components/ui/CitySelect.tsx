/**
 * CitySelect — dropdown of known CC cities + "Other" option to type a custom city.
 */
import { useState } from 'react';
import { CC_CITIES } from '../../context/CityContext';

interface Props {
  value: string;
  onChange: (city: string) => void;
}

export function CitySelect({ value, onChange }: Props) {
  const isKnown = !value || CC_CITIES.includes(value);
  const [showCustom, setShowCustom] = useState(!isKnown);

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    if (v === '__other__') {
      setShowCustom(true);
      onChange('');
    } else {
      setShowCustom(false);
      onChange(v);
    }
  }

  const selectValue = showCustom ? '__other__' : (value || '');

  return (
    <div className="city-select-wrap">
      <select
        className="auth-input city-select"
        value={selectValue}
        onChange={handleSelect}
      >
        <option value="">Select your city</option>
        {CC_CITIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
        <option value="__other__">Other — type your city</option>
      </select>

      {showCustom ? (
        <input
          className="auth-input"
          type="text"
          placeholder="Type your city name"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={120}
          autoFocus
          style={{ marginTop: 8 }}
        />
      ) : null}
    </div>
  );
}
