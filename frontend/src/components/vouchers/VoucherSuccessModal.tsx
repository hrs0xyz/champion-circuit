import type { IssuedVoucher } from '../../lib/voucherApi';

interface Props {
  vouchers: IssuedVoucher[];
  onClose: () => void;
}

export function VoucherSuccessModal({ vouchers, onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal-panel modal-panel--success" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="modal-header">
          <p className="modal-success-icon">🎉</p>
          <h2 className="modal-title">Your voucher{vouchers.length > 1 ? 's are' : ' is'} ready!</h2>
          <p className="modal-sub">We've also sent {vouchers.length > 1 ? 'them' : 'it'} to your email.</p>
        </div>

        <div className="voucher-issued-list">
          {vouchers.map((v) => (
            <div key={v.id} className="voucher-issued-card">
              <div className="voucher-issued-card__info">
                <p className="voucher-issued-card__title">{v.listing_title}</p>
                <p className="voucher-issued-card__value">{v.listing_value_label}</p>
                <p className="voucher-issued-card__partner">{v.partner_name} · {v.partner_city}</p>
                {v.expires_at ? (
                  <p className="voucher-issued-card__expiry">Expires {v.expires_at}</p>
                ) : null}
              </div>

              <div className="voucher-issued-card__code-wrap">
                <div className="voucher-issued-card__code">{v.code}</div>
                <button
                  type="button"
                  className="voucher-issued-card__copy"
                  onClick={() => void navigator.clipboard.writeText(v.code)}
                >
                  Copy
                </button>
              </div>

              {v.qr_svg ? (
                <div
                  className="voucher-issued-card__qr"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: v.qr_svg }}
                />
              ) : null}

              <p className="voucher-issued-card__hint">
                Show this code or QR at {v.partner_name} to redeem.
              </p>
            </div>
          ))}
        </div>

        <button type="button" className="btn btn-secondary" onClick={onClose} style={{ width: '100%', marginTop: 8 }}>
          Done
        </button>
      </div>
    </div>
  );
}
