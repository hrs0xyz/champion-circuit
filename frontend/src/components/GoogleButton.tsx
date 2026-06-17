import { useEffect, useState } from 'react';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
          prompt: () => void;
        };
      };
    };
  }
}

type GoogleButtonProps = {
  onToken: (token: string) => Promise<void>;
  label?: string;
};

export function GoogleButton({ onToken, label = 'Continue with Google' }: GoogleButtonProps) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return;

    const initialize = () => {
      window.google?.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (!response.credential) {
            setError('Google did not return a sign-in token.');
            return;
          }
          void onToken(response.credential).catch((err) => setError(err instanceof Error ? err.message : 'Google login failed.'));
        },
      });
      setReady(Boolean(window.google));
    };

    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      initialize();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initialize;
    document.head.appendChild(script);
  }, [clientId, onToken]);

  return (
    <>
      <button
        className="secondary-action"
        type="button"
        onClick={() => {
          if (!clientId) {
            setError('Google login needs VITE_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID from Google Cloud.');
            return;
          }
          if (!ready || !window.google) {
            setError('Google login is still loading. Try again in a moment.');
            return;
          }
          window.google.accounts.id.prompt();
        }}
      >
        {label}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </>
  );
}

