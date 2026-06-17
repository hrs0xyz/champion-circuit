/**
 * VoucherCodeInput — CC-XXXX-XXXX segmented input
 *
 * Rules:
 *  - Positions 1-2 (CC prefix): letters only, auto-uppercased
 *  - Positions 3-6 (segment 2): letters + digits, auto-uppercased
 *  - Positions 7-10 (segment 3): letters + digits, auto-uppercased
 *  - Dashes are auto-inserted, never typed by user
 */
import { useRef, type ChangeEvent, type KeyboardEvent } from 'react';

interface Props {
  value: string;       // formatted: CC-XXXX-XXXX
  onChange: (v: string) => void;
  autoFocus?: boolean;
}

function applyRules(raw: string): string {
  // raw = only alphanumeric chars, max 10
  const out: string[] = [];
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    const ch = raw[i].toUpperCase();
    if (i < 2) {
      // First 2: letters only
      if (/[A-Z]/.test(ch)) out.push(ch);
    } else {
      // Rest: letters + digits
      if (/[A-Z0-9]/.test(ch)) out.push(ch);
    }
  }
  return out.join('');
}

function format(raw: string): string {
  if (raw.length <= 2) return raw;
  if (raw.length <= 6) return `${raw.slice(0, 2)}-${raw.slice(2)}`;
  return `${raw.slice(0, 2)}-${raw.slice(2, 6)}-${raw.slice(6)}`;
}

function strip(formatted: string): string {
  return formatted.replace(/-/g, '');
}

export function VoucherCodeInput({ value, onChange, autoFocus }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const raw = strip(value);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const newRaw = applyRules(strip(e.target.value));
    onChange(format(newRaw));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && value.endsWith('-')) {
      e.preventDefault();
      const newRaw = raw.slice(0, -1);
      onChange(format(newRaw));
    }
  }

  // Build display segments
  const s1 = raw.slice(0, 2);   // CC
  const s2 = raw.slice(2, 6);   // XXXX
  const s3 = raw.slice(6, 10);  // XXXX

  const cursor = raw.length; // which position is active

  return (
    <div className="vcode-wrap" onClick={() => inputRef.current?.focus()}>
      {/* Visual display */}
      <div className="vcode-display" aria-hidden="true">
        {/* Segment 1: CC */}
        <div className="vcode-group">
          {[0, 1].map((i) => (
            <span
              key={i}
              className={`vcode-seg${cursor === i && document.activeElement === inputRef.current ? ' vcode-seg--cursor' : ''}`}
            >
              {s1[i] ?? <span className="vcode-ph">{i === 0 ? 'C' : 'C'}</span>}
            </span>
          ))}
        </div>

        <span className="vcode-dash">–</span>

        {/* Segment 2: XXXX */}
        <div className="vcode-group">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="vcode-seg">
              {s2[i] ?? <span className="vcode-ph">X</span>}
            </span>
          ))}
        </div>

        <span className="vcode-dash">–</span>

        {/* Segment 3: XXXX */}
        <div className="vcode-group">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="vcode-seg">
              {s3[i] ?? <span className="vcode-ph">X</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Invisible real input */}
      <input
        ref={inputRef}
        className="vcode-input"
        type="text"
        inputMode="text"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        maxLength={12}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        autoFocus={autoFocus}
        aria-label="Voucher code, format CC-XXXX-XXXX"
      />
    </div>
  );
}
