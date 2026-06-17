import { useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { voucherApi, type VoucherListing, type IssuedVoucher, type CheckoutResponse, type FreeCheckoutResponse } from '../../lib/voucherApi';
import { ApiError } from '../../lib/api';

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

interface Props {
  listing: VoucherListing;
  partnerRef: string;
  isGuest: boolean;
  onClose: () => void;
  onSuccess: (vouchers: IssuedVoucher[]) => void;
}

export function CheckoutModal({ listing, partnerRef, isGuest, onClose, onSuccess }: Props) {
  const { user } = useAuth();

  const [email, setEmail] = useState(user?.email ?? '');
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [qty, setQty] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const total = listing.price_inr * qty;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const payload = {
      listing_id: listing.id,
      quantity: qty,
      buyer_email: email.trim(),
      buyer_name: name.trim(),
      buyer_phone: phone.trim(),
      partner_ref: partnerRef,
    };

    try {
      const checkoutFn = isGuest ? voucherApi.guestCheckout : voucherApi.checkout;
      const res = await checkoutFn(payload);

      // Free voucher — issued immediately
      if ('vouchers' in res) {
        onSuccess((res as FreeCheckoutResponse).vouchers);
        return;
      }

      // Paid — open Razorpay
      const rzRes = res as CheckoutResponse;

      // Dev mode (fake order id)
      if (rzRes.razorpay_order_id.startsWith('order_DEV_')) {
        const verify = await voucherApi.verifyPayment({
          order_id: rzRes.order_id,
          razorpay_payment_id: 'pay_DEV_test',
          razorpay_order_id: rzRes.razorpay_order_id,
          razorpay_signature: 'dev_sig',
        });
        onSuccess(verify.vouchers);
        return;
      }

      const loaded = await loadRazorpayScript();
      if (!loaded) { setError('Could not load payment gateway. Try again.'); return; }

      const rz = new window.Razorpay({
        key: rzRes.razorpay_key_id,
        amount: rzRes.amount_paise,
        currency: 'INR',
        order_id: rzRes.razorpay_order_id,
        name: 'Champion Circuit',
        description: rzRes.listing_title,
        prefill: { name: rzRes.buyer_name, email: rzRes.buyer_email, contact: phone },
        theme: { color: '#ffffff' },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          try {
            const verify = await voucherApi.verifyPayment({
              order_id: rzRes.order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });
            onSuccess(verify.vouchers);
          } catch {
            setError('Payment received but verification failed. Contact support with your payment ID.');
          }
        },
        modal: { ondismiss: () => setLoading(false) },
      });
      rz.open();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="modal-header">
          <p className="modal-eyebrow">{listing.partner.name} · {listing.partner.city}</p>
          <h2 className="modal-title">{listing.title}</h2>
          <p className="modal-value-label">
            {listing.value_label || (listing.value_type === 'discount_inr' ? `₹${listing.value_amount} off` : listing.value_type)}
          </p>
        </div>

        <form className="auth-form" onSubmit={(e) => void handleSubmit(e)}>
          <div className="auth-field">
            <label className="auth-label">Email</label>
            <input className="auth-input" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" />
          </div>
          <div className="auth-field">
            <label className="auth-label">Name</label>
            <input className="auth-input" type="text" value={name}
              onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={120} />
          </div>
          <div className="auth-field">
            <label className="auth-label">Phone</label>
            <input className="auth-input" type="tel" value={phone}
              onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" maxLength={20} />
          </div>

          {listing.stock !== -1 && listing.stock - listing.sold_count > 1 ? (
            <div className="auth-field">
              <label className="auth-label">Quantity</label>
              <select className="auth-input" value={qty}
                onChange={(e) => setQty(Number(e.target.value))}>
                {Array.from({ length: Math.min(10, listing.stock - listing.sold_count) }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          ) : null}

          {listing.terms ? (
            <p className="modal-terms">{listing.terms}</p>
          ) : null}

          {error ? <p className="auth-error">{error}</p> : null}

          <div className="modal-footer">
            <div className="modal-total">
              {listing.price_inr === 0 ? (
                <span className="modal-total__free">Free</span>
              ) : (
                <span className="modal-total__amount">₹{total}</span>
              )}
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
              {loading ? 'Processing…' : listing.price_inr === 0 ? 'Get voucher' : `Pay ₹${total}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
