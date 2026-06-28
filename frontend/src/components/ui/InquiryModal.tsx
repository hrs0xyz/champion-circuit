import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { Venue } from '../../lib/ccApi';

interface InquiryModalProps {
  venue: Venue;
  onClose: () => void;
}

export function InquiryModal({ venue, onClose }: InquiryModalProps) {
  const { user } = useAuth();
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [infoMsg, setInfoMsg] = useState('');

  // Pre-fill from logged-in user on mount
  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setContact(user.phone || user.email || '');
    }
  }, [user]);

  // Focus the name input on open
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Focus trap: collect focusable elements and cycle Tab within modal
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const modal = modalRef.current;
      if (!modal) return;
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required.';
    if (!contact.trim()) newErrors.contact = 'Contact is required.';
    if (!message.trim()) newErrors.message = 'Message is required.';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const encodedMessage = encodeURIComponent(
      `Hi, I'm ${name.trim()} (${contact.trim()}).\n\n${message.trim()}`,
    );

    if (venue.phone) {
      // Sanitise venue phone: strip non-digits, prepend 91 if exactly 10 digits
      const phoneDigits = venue.phone.replace(/\D/g, '');
      const sanitisedPhone = phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits;
      window.open(`https://wa.me/${sanitisedPhone}?text=${encodedMessage}`, '_blank');
    } else if (venue.email) {
      const subject = encodeURIComponent(`Inquiry from ${name.trim()}`);
      const body = encodeURIComponent(
        `Name: ${name.trim()}\nContact: ${contact.trim()}\n\n${message.trim()}`,
      );
      window.open(`mailto:${venue.email}?subject=${subject}&body=${body}`, '_blank');
    } else {
      setInfoMsg('This venue has not provided contact details. Please call the venue directly.');
      return;
    }

    onClose();
  }

  return (
    <div
      className="inquiry-modal__overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Send inquiry to ${venue.name}`}
    >
      <div
        className="inquiry-modal"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="inquiry-modal__header">
          <h2>Send Inquiry</h2>
          <button
            type="button"
            className="inquiry-modal__close"
            aria-label="Close inquiry modal"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {infoMsg && (
          <p className="inquiry-modal__info" role="status">
            {infoMsg}
          </p>
        )}

        <form className="inquiry-modal__form" onSubmit={handleSubmit} noValidate>
          {/* Name */}
          <div className="inquiry-modal__field">
            <label htmlFor="inquiry-name">Name</label>
            <input
              id="inquiry-name"
              ref={nameRef}
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'inquiry-name-error' : undefined}
            />
            {errors.name && (
              <span id="inquiry-name-error" className="inquiry-modal__error" role="alert">
                {errors.name}
              </span>
            )}
          </div>

          {/* Contact */}
          <div className="inquiry-modal__field">
            <label htmlFor="inquiry-contact">Contact (phone or email)</label>
            <input
              id="inquiry-contact"
              type="text"
              required
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Your phone or email"
              aria-invalid={!!errors.contact}
              aria-describedby={errors.contact ? 'inquiry-contact-error' : undefined}
            />
            {errors.contact && (
              <span id="inquiry-contact-error" className="inquiry-modal__error" role="alert">
                {errors.contact}
              </span>
            )}
          </div>

          {/* Message */}
          <div className="inquiry-modal__field">
            <label htmlFor="inquiry-message">Message</label>
            <textarea
              id="inquiry-message"
              required
              maxLength={500}
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What would you like to ask?"
              aria-invalid={!!errors.message}
              aria-describedby={errors.message ? 'inquiry-message-error' : undefined}
            />
            {errors.message && (
              <span id="inquiry-message-error" className="inquiry-modal__error" role="alert">
                {errors.message}
              </span>
            )}
          </div>

          <button type="submit" className="btn btn-primary">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default InquiryModal;
