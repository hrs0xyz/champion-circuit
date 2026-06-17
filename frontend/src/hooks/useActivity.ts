/**
 * useActivity — fire-and-forget activity tracking hook.
 * Only logs when user is authenticated. Never blocks the UI.
 */
import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

export interface ActivityPayload {
  event:
    | 'venue_view'
    | 'venue_card_click'
    | 'listing_inquiry'
    | 'sport_filter'
    | 'city_filter'
    | 'voucher_view'
    | 'voucher_purchase'
    | 'booking';
  venue_id?: number;
  venue_name?: string;
  sport?: string;
  city?: string;
  listing_id?: number;
  listing_title?: string;
  extra?: string;
}

export function useActivity() {
  const { user } = useAuth();

  const track = useCallback(
    (payload: ActivityPayload) => {
      // Only track logged-in users
      if (!user) return;

      const token = localStorage.getItem('cc_token');
      if (!token) return;

      // Fire and forget — never await, never block UI
      fetch(`${BASE}/api/activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      }).catch(() => {
        // Silently ignore — tracking failures must never break the app
      });
    },
    [user],
  );

  return { track };
}
