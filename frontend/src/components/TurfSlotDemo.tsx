import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Slot = { id: string; label: string; booked: boolean };

const SLOTS: Slot[] = [
  { id: '1', label: '6:00-7:00 PM', booked: false },
  { id: '2', label: '7:00-8:00 PM', booked: true },
  { id: '3', label: '8:00-9:00 PM', booked: false },
  { id: '4', label: '9:00-10:00 PM', booked: true },
];

export function TurfSlotDemo() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="slot-demo">
      <div className="slot-demo-head">
        <h4>Hourly slots</h4>
        <p className="muted small">
          Open windows shine gold; booked slots stay blurred. Tap an open window to continue.
        </p>
      </div>
      <div className="slot-grid" role="list">
        {SLOTS.map((slot) => {
          const isBooked = slot.booked;
          const isSelected = selected === slot.id;
          return (
            <motion.button
              key={slot.id}
              type="button"
              role="listitem"
              className={`slot-cell${isBooked ? ' is-booked' : ''}${isSelected ? ' is-selected' : ''}`}
              disabled={isBooked}
              onClick={() => !isBooked && setSelected(slot.id)}
              whileHover={!isBooked ? { scale: 1.02, y: -2 } : undefined}
              whileTap={!isBooked ? { scale: 0.98 } : undefined}
              layout
            >
              <span className="slot-time">{slot.label}</span>
              <span className="slot-state">{isBooked ? 'Booked' : 'Open'}</span>
            </motion.button>
          );
        })}
      </div>
      <AnimatePresence mode="wait">
        {selected ? (
          <motion.div
            key={selected}
            className="slot-toast"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
          >
            <span className="slot-toast-gold">Continue to checkout</span>
            <span className="muted small">Your slot is held. Next step is payment.</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
