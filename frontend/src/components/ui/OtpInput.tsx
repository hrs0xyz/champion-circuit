/**
 * OtpInput — 6 individual digit boxes.
 * Auto-advances focus, handles paste, backspace.
 */
import { useRef, type KeyboardEvent, type ClipboardEvent } from 'react';

interface Props {
  value: string;       // 0-6 digit string
  onChange: (v: string) => void;
  autoFocus?: boolean;
}

export function OtpInput({ value, onChange, autoFocus }: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, '').split('').slice(0, 6);

  function focus(i: number) {
    refs.current[i]?.focus();
  }

  function handleChange(i: number, ch: string) {
    const d = ch.replace(/\D/g, '').slice(-1); // only last digit
    const next = digits.map((v, idx) => (idx === i ? d : v)).join('').replace(/ /g, '');
    onChange(next);
    if (d && i < 5) focus(i + 1);
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        const next = digits.map((v, idx) => (idx === i ? '' : v)).join('').replace(/ /g, '');
        onChange(next);
      } else if (i > 0) {
        focus(i - 1);
        const next = digits.map((v, idx) => (idx === i - 1 ? '' : v)).join('').replace(/ /g, '');
        onChange(next);
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      focus(i - 1);
    } else if (e.key === 'ArrowRight' && i < 5) {
      focus(i + 1);
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted);
    focus(Math.min(pasted.length, 5));
  }

  return (
    <div className="otp-boxes">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          className={`otp-box${digits[i] ? ' otp-box--filled' : ''}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] === ' ' ? '' : digits[i]}
          autoFocus={autoFocus && i === 0}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}
