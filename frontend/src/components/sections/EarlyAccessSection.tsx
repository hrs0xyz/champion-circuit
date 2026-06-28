import { type FormEvent, useState } from 'react';
import { motion } from 'framer-motion';
import { joinWaitlist, type WaitlistResult } from '../../lib/waitlist';

export function EarlyAccessSection() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<WaitlistResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');
    setStatus('loading');
    try {
      const data = await joinWaitlist(email);
      setResult(data);
      setStatus('success');
      setEmail('');
    } catch (err) {
      setStatus('error');
      setErrorMsg(
        err instanceof Error && !/firebase|not configured/i.test(err.message)
          ? err.message
          : "Couldn't connect right now. Try again or email us directly.",
      );
    }
  };

  return (
    <motion.section
      id="early-access"
      className="section section-cta"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="section-inner narrow cta-panel">

        {/* Header */}
        <p className="cta-eyebrow">Early access</p>
        <h2 className="cta-title">Get your voucher</h2>
        <p className="cta-sub">
          Sign up before we launch and get a voucher for your first booking — on us.
        </p>

        {/* Voucher benefit pill */}
        <div className="cta-benefit-pill">
          <span className="cta-benefit-pill__icon">🎟</span>
          <span className="cta-benefit-pill__text">₹200 off your first booking</span>
        </div>

        {/* Form or success state */}
        {status !== 'success' ? (
          <form className="cta-form" onSubmit={(e) => void onSubmit(e)}>
            <label className="sr-only" htmlFor="early-email">Email address</label>
            <input
              id="early-email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status !== 'idle') { setStatus('idle'); setErrorMsg(''); }
              }}
              placeholder="your@email.com"
              autoComplete="email"
              disabled={status === 'loading'}
              aria-invalid={status === 'error'}
            />
            <button type="submit" className="btn btn-primary" disabled={status === 'loading'}>
              {status === 'loading' ? 'Sending…' : 'Claim voucher'}
            </button>
            {errorMsg ? (
              <p className="small cta-form-feedback cta-form-feedback--error" role="alert">
                {errorMsg}
              </p>
            ) : null}
          </form>
        ) : (
          /* Success — show voucher code */
          <div className="cta-voucher-reveal">
            <p className="cta-voucher-reveal__msg">
              {result?.already_registered
                ? "You're already on the list — here's your code again."
                : "You're in! Your voucher code is:"}
            </p>
            <div className="cta-voucher-code">
              <span className="cta-voucher-code__text">{result?.voucher_code}</span>
              <button
                type="button"
                className="cta-voucher-code__copy"
                onClick={() => void navigator.clipboard.writeText(result?.voucher_code ?? '')}
                title="Copy code"
              >
                Copy
              </button>
            </div>
            <p className="cta-voucher-reveal__sub">
              {result?.benefit} · We've also sent it to your email.
            </p>
          </div>
        )}

        {/* Divider */}
        <div className="cta-divider" />

        {/* Contact info — stacked, centered */}
        <div className="cta-contact">
          <p className="cta-contact__label">Get in touch</p>
          <a href="mailto:contact@championcircuit.com" className="cta-contact__email">
            contact@championcircuit.com
          </a>
          <address className="cta-contact__address">
            83, S. P. Mukherjee Road, Devi Market,<br />
            4th floor, Kolkata – 700026, West Bengal
          </address>
        </div>

      </div>
    </motion.section>
  );
}
