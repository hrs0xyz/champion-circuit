const BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

export interface WaitlistResult {
  message: string;
  voucher_code: string;
  benefit: string;
  already_registered: boolean;
}

export async function joinWaitlist(rawEmail: string): Promise<WaitlistResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) throw new Error('Email is required');

  const res = await fetch(`${BASE}/api/waitlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  return res.json() as Promise<WaitlistResult>;
}
