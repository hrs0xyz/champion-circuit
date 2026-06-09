import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCity } from '../context/CityContext';
import { CityBar } from '../components/ui/CityBar';
import { voucherApi, type VoucherListing, type IssuedVoucher } from '../lib/voucherApi';
import { VoucherCard } from '../components/vouchers/VoucherCard';
import { CheckoutModal } from '../components/vouchers/CheckoutModal';
import { VoucherSuccessModal } from '../components/vouchers/VoucherSuccessModal';

export function VouchersPage() {
  const { user } = useAuth();
  const { matchesCity, cities } = useCity();
  const [params] = useSearchParams();
  const partnerRef = params.get('ref') ?? '';

  const [listings, setListings] = useState<VoucherListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<VoucherListing | null>(null);
  const [successVouchers, setSuccessVouchers] = useState<IssuedVoucher[] | null>(null);

  useEffect(() => {
    voucherApi.browse(partnerRef)
      .then(setListings)
      .catch(() => setError('Could not load vouchers. Try again.'))
      .finally(() => setLoading(false));
  }, [partnerRef]);

  const voucherCities = [...new Set(listings.map((l) => l.partner.city).filter(Boolean))];
  const filtered = listings.filter((l) => matchesCity(l.partner.city));

  return (
    <section className="section section-vouchers">
      <div className="section-inner">
        <CityBar />

        <div className="section-head" style={{ marginTop: 24 }}>
          <h1>Vouchers</h1>
          <p>
            {cities.length > 0 ? `Deals in ${cities.join(', ')}.` : 'Deals across all cities.'}
            {' '}Buy now, redeem at the venue with your code or QR.
          </p>
        </div>

        {partnerRef ? (
          <div className="voucher-partner-banner">
            <span>🎟</span>
            <span>Exclusive partner deals — just for you.</span>
          </div>
        ) : null}

        {loading ? (
          <div className="voucher-grid-loading">
            {[1, 2, 3].map((i) => <div key={i} className="voucher-card-skeleton" />)}
          </div>
        ) : error ? (
          <p className="auth-error">{error}</p>
        ) : filtered.length === 0 ? (
          <div className="voucher-empty">
            <p>
              {cities.length > 0 ? `No vouchers in ${cities.join(' / ')} yet.` : 'No vouchers available right now.'}
              {' '}Check back soon.
            </p>
          </div>
        ) : (
          <div className="voucher-grid">
            {filtered.map((l) => (
              <VoucherCard key={l.id} listing={l} onBuy={() => setSelected(l)} />
            ))}
          </div>
        )}

        <div className="voucher-lookup-hint">
          <span>Already have a voucher?</span>
          <a href="/my-voucher" className="voucher-lookup-link">Look it up →</a>
        </div>
      </div>

      {selected ? (
        <CheckoutModal
          listing={selected}
          partnerRef={partnerRef}
          isGuest={!user}
          onClose={() => setSelected(null)}
          onSuccess={(v) => { setSelected(null); setSuccessVouchers(v); }}
        />
      ) : null}

      {successVouchers ? (
        <VoucherSuccessModal
          vouchers={successVouchers}
          onClose={() => setSuccessVouchers(null)}
        />
      ) : null}
    </section>
  );
}
