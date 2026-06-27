import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCity } from '../context/CityContext';
import { CityDropdown } from '../components/ui/CityDropdown';
import { voucherApi, type VoucherListing, type IssuedVoucher } from '../lib/voucherApi';
import { VoucherCard } from '../components/vouchers/VoucherCard';
import { CheckoutModal } from '../components/vouchers/CheckoutModal';
import { VoucherSuccessModal } from '../components/vouchers/VoucherSuccessModal';

type MainTab = 'browse' | 'mine';
type MyVoucherFilter = 'all' | 'active' | 'redeemed' | 'expired';

const MY_FILTER_TABS: { key: MyVoucherFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'redeemed', label: 'Redeemed' },
  { key: 'expired', label: 'Expired' },
];

const STATUS_COLOR: Record<string, string> = {
  active: '#4ade80',
  redeemed: '#a3a3a3',
  expired: '#f87171',
};

export function VouchersPage() {
  const { user } = useAuth();
  const { matchesCity, cities } = useCity();
  const [params] = useSearchParams();
  const partnerRef = params.get('ref') ?? '';

  const [mainTab, setMainTab] = useState<MainTab>('browse');
  const [myFilter, setMyFilter] = useState<MyVoucherFilter>('active');

  // Browse state
  const [listings, setListings] = useState<VoucherListing[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [listingsError, setListingsError] = useState('');

  // My vouchers state
  const [myVouchers, setMyVouchers] = useState<IssuedVoucher[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const [mineLoaded, setMineLoaded] = useState(false);

  // Modals
  const [selected, setSelected] = useState<VoucherListing | null>(null);
  const [successVouchers, setSuccessVouchers] = useState<IssuedVoucher[] | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    voucherApi.browse(partnerRef)
      .then(setListings)
      .catch(() => setListingsError('Could not load vouchers. Try again.'))
      .finally(() => setLoadingListings(false));
  }, [partnerRef]);

  // Load my vouchers when tab switches to mine
  useEffect(() => {
    if (mainTab === 'mine' && user && !mineLoaded) {
      setLoadingMine(true);
      voucherApi.myVouchers()
        .then(setMyVouchers)
        .catch(() => {/* silent */})
        .finally(() => { setLoadingMine(false); setMineLoaded(true); });
    }
  }, [mainTab, user, mineLoaded]);

  // Re-load my vouchers after a purchase
  function handlePurchaseSuccess(vouchers: IssuedVoucher[]) {
    setSelected(null);
    setSuccessVouchers(vouchers);
    // Refresh my vouchers list
    setMyVouchers((prev) => [...vouchers, ...prev]);
    setMineLoaded(true);
  }

  function copyCode(code: string) {
    void navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  const filtered = listings.filter((l) => matchesCity(l.partner.city));

  const myFiltered = myVouchers.filter((v) =>
    myFilter === 'all' ? true : v.status === myFilter
  );

  const myCounts = {
    all: myVouchers.length,
    active: myVouchers.filter((v) => v.status === 'active').length,
    redeemed: myVouchers.filter((v) => v.status === 'redeemed').length,
    expired: myVouchers.filter((v) => v.status === 'expired').length,
  };

  return (
    <section className="section section-vouchers">
      <div className="section-inner">

        {/* Main tabs: Browse / My Vouchers */}
        <div className="vouchers-main-tabs">
          <button
            type="button"
            className={`vouchers-main-tab${mainTab === 'browse' ? ' vouchers-main-tab--active' : ''}`}
            onClick={() => setMainTab('browse')}
          >
            Shop
          </button>
          {user && (
            <button
              type="button"
              className={`vouchers-main-tab${mainTab === 'mine' ? ' vouchers-main-tab--active' : ''}`}
              onClick={() => setMainTab('mine')}
            >
              My Vouchers
              {myCounts.active > 0 && (
                <span className="vouchers-main-tab__badge">{myCounts.active}</span>
              )}
            </button>
          )}
          <Link to="/my-voucher" className="vouchers-lookup-btn">
            🔍 Look up by code
          </Link>
        </div>

        {/* ── BROWSE TAB ── */}
        {mainTab === 'browse' && (
          <>
            <div className="vouchers-browse-toolbar">
              <CityDropdown />
              <p className="muted small">
                {cities.length > 0 ? `Deals in ${cities.join(', ')}.` : 'Deals across all cities.'}
                {' '}Buy now, redeem at the venue.
              </p>
            </div>

            {partnerRef && (
              <div className="voucher-partner-banner">
                <span>🎟</span>
                <span>Exclusive partner deals — just for you.</span>
              </div>
            )}

            {loadingListings ? (
              <div className="voucher-grid-loading">
                {[1, 2, 3].map((i) => <div key={i} className="voucher-card-skeleton" />)}
              </div>
            ) : listingsError ? (
              <p className="auth-error">{listingsError}</p>
            ) : filtered.length === 0 ? (
              <div className="voucher-empty">
                <p className="voucher-empty__icon">🎟</p>
                <p>
                  {cities.length > 0
                    ? `No vouchers in ${cities.join(' / ')} yet.`
                    : 'No vouchers available right now.'}
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
          </>
        )}

        {/* ── MY VOUCHERS TAB ── */}
        {mainTab === 'mine' && user && (
          <>
            {/* Status filter */}
            <div className="bookings-tabs" role="tablist" style={{ marginBottom: 24 }}>
              {MY_FILTER_TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={myFilter === t.key}
                  className={`bookings-tab${myFilter === t.key ? ' bookings-tab--active' : ''}`}
                  onClick={() => setMyFilter(t.key)}
                >
                  {t.label}
                  {myCounts[t.key] > 0 && (
                    <span className="bookings-tab__badge">{myCounts[t.key]}</span>
                  )}
                </button>
              ))}
            </div>

            {loadingMine ? (
              <div className="voucher-grid-loading">
                {[1, 2].map((i) => <div key={i} className="voucher-card-skeleton" />)}
              </div>
            ) : myFiltered.length === 0 ? (
              <div className="voucher-empty">
                <p className="voucher-empty__icon">🎟</p>
                <p className="voucher-empty__title">
                  {myFilter === 'active' ? 'No active vouchers' :
                   myFilter === 'redeemed' ? 'No redeemed vouchers' :
                   myFilter === 'expired' ? 'No expired vouchers' :
                   'No vouchers yet'}
                </p>
                <p className="voucher-empty__sub">
                  {myFilter === 'active' || myFilter === 'all'
                    ? 'Browse and buy a voucher to see it here.'
                    : ''}
                </p>
                {(myFilter === 'active' || myFilter === 'all') && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ marginTop: 16 }}
                    onClick={() => setMainTab('browse')}
                  >
                    Browse vouchers →
                  </button>
                )}
              </div>
            ) : (
              <div className="my-vouchers-list">
                {myFiltered.map((v) => (
                  <div key={v.id} className={`my-voucher-card my-voucher-card--${v.status}`}>
                    <div className="my-voucher-card__header">
                      <div>
                        <p className="my-voucher-card__title">{v.listing_title}</p>
                        <p className="my-voucher-card__value">{v.listing_value_label}</p>
                        <p className="my-voucher-card__partner">
                          {v.partner_name} · {v.partner_city}
                        </p>
                      </div>
                      <span
                        className="my-voucher-card__status"
                        style={{ color: STATUS_COLOR[v.status] ?? '#fff' }}
                      >
                        {v.status === 'active' ? '✓ Active' :
                         v.status === 'redeemed' ? 'Redeemed' : 'Expired'}
                      </span>
                    </div>

                    <div className="my-voucher-card__code-row">
                      <span className="my-voucher-card__code">{v.code}</span>
                      <button
                        type="button"
                        className="my-voucher-card__copy"
                        onClick={() => copyCode(v.code)}
                      >
                        {copiedCode === v.code ? '✓ Copied!' : 'Copy'}
                      </button>
                    </div>

                    {v.qr_svg && (
                      <div
                        className="my-voucher-card__qr"
                        dangerouslySetInnerHTML={{ __html: v.qr_svg }}
                      />
                    )}

                    {v.expires_at && (
                      <p className="my-voucher-card__expiry muted small">
                        {v.status === 'active' ? `Expires ${v.expires_at}` : `Expired ${v.expires_at}`}
                      </p>
                    )}

                    {v.status === 'active' && (
                      <Link
                        to={`/my-voucher?code=${encodeURIComponent(v.code)}`}
                        className="btn btn-secondary btn-sm"
                        style={{ marginTop: 12, width: '100%', textAlign: 'center' }}
                      >
                        View / Redeem →
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </div>

      {selected && (
        <CheckoutModal
          listing={selected}
          partnerRef={partnerRef}
          isGuest={!user}
          onClose={() => setSelected(null)}
          onSuccess={handlePurchaseSuccess}
        />
      )}

      {successVouchers && (
        <VoucherSuccessModal
          vouchers={successVouchers}
          onClose={() => setSuccessVouchers(null)}
        />
      )}
    </section>
  );
}
