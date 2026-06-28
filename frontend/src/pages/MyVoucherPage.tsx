import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { voucherApi, type IssuedVoucher } from '../lib/voucherApi';
import { ApiError } from '../lib/api';
import { VoucherCodeInput } from '../components/vouchers/VoucherCodeInput';

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  redeemed: 'Redeemed',
  expired: 'Expired',
};

const STATUS_COLOR: Record<string, string> = {
  active: '#4ade80',
  redeemed: '#a3a3a3',
  expired: '#f87171',
};

export function MyVoucherPage() {
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('code') ?? '');
  const [voucher, setVoucher] = useState<IssuedVoucher | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLookup(e: FormEvent) {
    e.preventDefault();
    setError('');
    setVoucher(null);
    setLoading(true);
    try {
      const v = await voucherApi.lookup(code.trim().toUpperCase());
      setVoucher(v);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 404
          ? 'No voucher found with that code. Double-check and try again.'
          : 'Something went wrong. Try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  const isComplete = code.replace(/-/g, '').length === 10;

  return (
    <section className="section section-auth">
      <div className="auth-card" style={{ maxWidth: 520 }}>
        <div className="auth-card__logo">
          <img src="/branding/cc-mark.png" alt="Champion Circuit" width={48} height={48} />
        </div>
        <h1 className="auth-card__title">Look up your voucher</h1>
        <p className="auth-card__sub">
          Type your code below — it looks like <strong>CC-XXXX-XXXX</strong>.
        </p>

        <form className="auth-form" onSubmit={(e) => void handleLookup(e)}>
          <div className="auth-field">
            <label htmlFor="voucher-code" className="auth-label">Voucher code</label>
            <VoucherCodeInput value={code} onChange={setCode} autoFocus />
          </div>

          {error ? <p className="auth-error">{error}</p> : null}

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={loading || !isComplete}
          >
            {loading ? 'Looking up…' : 'Find voucher'}
          </button>
        </form>

        {voucher ? (
          <div className="voucher-lookup-result">
            <div className="voucher-lookup-result__header">
              <div>
                <p className="voucher-lookup-result__title">{voucher.listing_title}</p>
                <p className="voucher-lookup-result__value">{voucher.listing_value_label}</p>
                <p className="voucher-lookup-result__partner">
                  {voucher.partner_name} · {voucher.partner_city}
                </p>
              </div>
              <span
                className="voucher-lookup-result__status"
                style={{ color: STATUS_COLOR[voucher.status] ?? '#fff' }}
              >
                {STATUS_LABEL[voucher.status] ?? voucher.status}
              </span>
            </div>

            <div className="voucher-issued-card__code-wrap" style={{ marginTop: 16 }}>
              <div className="voucher-issued-card__code">{voucher.code}</div>
              <button
                type="button"
                className="voucher-issued-card__copy"
                onClick={() => void navigator.clipboard.writeText(voucher.code)}
              >
                Copy
              </button>
            </div>

            {voucher.qr_svg ? (
              <div
                className="voucher-lookup-result__qr"
                dangerouslySetInnerHTML={{ __html: voucher.qr_svg }}
              />
            ) : null}

            {voucher.expires_at ? (
              <p className="voucher-lookup-result__expiry muted small">
                {voucher.status === 'active'
                  ? `Expires ${voucher.expires_at}`
                  : `Expired ${voucher.expires_at}`}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
