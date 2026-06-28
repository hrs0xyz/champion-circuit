import { ApiError } from './api';

const BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('cc_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const b = await res.json(); detail = b.detail ?? detail; } catch { /* */ }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export interface Partner {
  id: number; name: string; slug: string;
  logo_url: string; city: string; description: string; is_active: boolean;
}

export interface VoucherListing {
  id: number; partner_id: number; partner: Partner;
  title: string; description: string; terms: string;
  value_type: string; value_amount: number; value_label: string;
  price_inr: number; stock: number; sold_count: number;
  valid_days: number; image_url: string;
  is_active: boolean; is_featured: boolean;
}

export interface IssuedVoucher {
  id: number; code: string; status: string; expires_at: string;
  listing_title: string; listing_value_label: string;
  partner_name: string; partner_city: string; qr_svg: string;
}

export interface CheckoutResponse {
  order_id: number; razorpay_order_id: string; razorpay_key_id: string;
  amount_paise: number; currency: string;
  listing_title: string; buyer_name: string; buyer_email: string;
}

export interface FreeCheckoutResponse {
  order_id: number; vouchers: IssuedVoucher[]; message: string;
}

export interface PaymentVerifyResponse {
  success: boolean; vouchers: IssuedVoucher[]; message: string;
}

export const voucherApi = {
  browse: (partnerRef = '') =>
    req<VoucherListing[]>(`/api/vouchers${partnerRef ? `?partner_ref=${encodeURIComponent(partnerRef)}` : ''}`),

  getListing: (id: number) => req<VoucherListing>(`/api/vouchers/${id}`),

  checkout: (payload: {
    listing_id: number; quantity: number;
    buyer_email: string; buyer_name: string; buyer_phone: string; partner_ref: string;
  }) => req<CheckoutResponse | FreeCheckoutResponse>('/api/vouchers/checkout', {
    method: 'POST', body: JSON.stringify(payload),
  }),

  guestCheckout: (payload: {
    listing_id: number; quantity: number;
    buyer_email: string; buyer_name: string; buyer_phone: string; partner_ref: string;
  }) => req<CheckoutResponse | FreeCheckoutResponse>('/api/vouchers/checkout/guest', {
    method: 'POST', body: JSON.stringify(payload),
  }),

  verifyPayment: (payload: {
    order_id: number; razorpay_payment_id: string;
    razorpay_order_id: string; razorpay_signature: string;
  }) => req<PaymentVerifyResponse>('/api/vouchers/payment/verify', {
    method: 'POST', body: JSON.stringify(payload),
  }),

  myVouchers: () => req<IssuedVoucher[]>('/api/vouchers/my/list'),

  lookup: (code: string) => req<IssuedVoucher>('/api/vouchers/lookup', {
    method: 'POST', body: JSON.stringify({ code }),
  }),

  redeem: (code: string) => req<{ success: boolean; message: string; voucher: IssuedVoucher }>(
    '/api/vouchers/redeem', { method: 'POST', body: JSON.stringify({ code }) }
  ),
};
