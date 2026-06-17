import { useEffect, useState } from 'react';

const MOBILE_MENU_ID = 'site-mobile-navigation';

type HeaderProps = {
  onAuthClick: () => void;
  authLabel: 'Sign in' | 'Sign out';
  bookHref: string;
  contactHref: string;
  overviewHref?: string;
};

export function Header({ onAuthClick, authLabel, bookHref, contactHref, overviewHref = '#top' }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <header className="site-header">
        <div className="site-header-glass">
          <a className="brand brand-wide" href="#top" onClick={close} title="Champion Circuit">
            <img src="/branding/cc-full.png" alt="Champion Circuit" width={220} height={56} className="brand-mark-wide" decoding="async" />
            <span className="brand-sr">Champion Circuit, home</span>
          </a>
          <nav className="nav-glass" aria-label="Site">
            <a href={overviewHref} onClick={close}>
              Overview
            </a>
            <a href={bookHref} onClick={close}>
              Book
            </a>
            <a href={contactHref} onClick={close}>
              Contact
            </a>
          </nav>
          <button
            type="button"
            className="nav-glass-cta"
            onClick={() => {
              close();
              onAuthClick();
            }}
          >
            {authLabel}
          </button>
          <button
            type="button"
            className={`nav-toggle${open ? ' nav-toggle--open' : ''}`}
            aria-expanded={open}
            aria-controls={MOBILE_MENU_ID}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="nav-toggle-line nav-toggle-line--top" aria-hidden />
            <span className="nav-toggle-line nav-toggle-line--mid" aria-hidden />
            <span className="nav-toggle-line nav-toggle-line--bot" aria-hidden />
          </button>
        </div>
      </header>

      <div
        className={`mobile-nav-backdrop${open ? ' mobile-nav-backdrop--open' : ''}`}
        aria-hidden={!open}
        onClick={close}
      />

      <div
        id={MOBILE_MENU_ID}
        className={`mobile-nav${open ? ' mobile-nav--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        aria-hidden={!open}
      >
        <nav className="mobile-nav-links" aria-label="Mobile site menu">
          <a href={overviewHref} onClick={close}>
            Overview
          </a>
          <a href={bookHref} onClick={close}>
            Book
          </a>
          <a href={contactHref} onClick={close}>
            Contact
          </a>
        </nav>
        <button
          type="button"
          className="mobile-nav-cta btn btn-primary"
          onClick={() => {
            close();
            onAuthClick();
          }}
        >
          {authLabel}
        </button>
      </div>
    </>
  );
}
