import type { VoucherListing } from '../../lib/voucherApi';

// Curated Unsplash images per voucher type (free, no API key)
const FALLBACK_IMAGES: Record<string, string> = {
  discount_inr: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=600&q=80',
  free_slot:    'https://images.unsplash.com/photo-1551958219-acbc595d9e47?w=600&q=80',
  free_entry:   'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80',
  default:      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=80',
};

function valueLabel(l: VoucherListing) {
  if (l.value_label) return l.value_label;
  if (l.value_type === 'discount_inr') return `₹${l.value_amount} off`;
  if (l.value_type === 'free_slot') return 'Free slot';
  if (l.value_type === 'free_entry') return 'Free entry';
  return l.value_type;
}

function stockLabel(l: VoucherListing) {
  if (l.stock === -1) return null;
  const left = l.stock - l.sold_count;
  if (left <= 0) return 'Sold out';
  if (left <= 10) return `${left} left`;
  return null;
}

interface Props {
  listing: VoucherListing;
  onBuy: () => void;
}

export function VoucherCard({ listing: l, onBuy }: Props) {
  const stock = stockLabel(l);
  const soldOut = stock === 'Sold out';

  return (
    <div className={`voucher-card${l.is_featured ? ' voucher-card--featured' : ''}${soldOut ? ' voucher-card--soldout' : ''}`}>
      {l.is_featured ? <span className="voucher-card__badge">Featured</span> : null}
      {stock && stock !== 'Sold out' ? <span className="voucher-card__stock">{stock}</span> : null}

      {l.image_url ? (
        <div className="voucher-card__img-wrap">
          <img src={l.image_url} alt={l.title} className="voucher-card__img" />
        </div>
      ) : (
        <div className="voucher-card__img-wrap">
          <img
            src={FALLBACK_IMAGES[l.value_type] ?? FALLBACK_IMAGES.default}
            alt={l.title}
            className="voucher-card__img"
          />
        </div>
      )}

      <div className="voucher-card__body">
        <div className="voucher-card__partner">
          {l.partner.logo_url ? (
            <img src={l.partner.logo_url} alt={l.partner.name} className="voucher-card__partner-logo" />
          ) : null}
          <span>{l.partner.name}</span>
          {l.partner.city ? <span className="voucher-card__city">· {l.partner.city}</span> : null}
        </div>

        <h3 className="voucher-card__title">{l.title}</h3>

        <div className="voucher-card__value">
          <span className="voucher-card__value-label">{valueLabel(l)}</span>
        </div>

        {l.description ? (
          <p className="voucher-card__desc">{l.description}</p>
        ) : null}

        {l.valid_days > 0 ? (
          <p className="voucher-card__validity">Valid for {l.valid_days} days after purchase</p>
        ) : null}
      </div>

      <div className="voucher-card__footer">
        <div className="voucher-card__price">
          {l.price_inr === 0 ? (
            <span className="voucher-card__price-free">Free</span>
          ) : (
            <>
              <span className="voucher-card__price-amount">₹{l.price_inr}</span>
            </>
          )}
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm voucher-card__buy"
          onClick={onBuy}
          disabled={soldOut}
        >
          {soldOut ? 'Sold out' : l.price_inr === 0 ? 'Get free' : 'Buy now'}
        </button>
      </div>
    </div>
  );
}
