import { usePlatform } from '../../context/PlatformContext';

export function AdminTurfsPage() {
  const { turfs, setTurfs } = usePlatform();

  const toggleSlot = (turfId: string, slotId: string) => {
    setTurfs((prev) =>
      prev.map((turf) =>
        turf.id !== turfId
          ? turf
          : {
              ...turf,
              slots: turf.slots.map((s) =>
                s.id !== slotId ? s : { ...s, isBooked: !s.isBooked, bookedByEmail: s.isBooked ? undefined : 'admin@championcircuit.com' },
              ),
            },
      ),
    );
  };

  return (
    <div className="admin-page">
      <h1>Turfs &amp; slots</h1>
      <p className="muted">Toggle slot availability. Shared catalog (local + future Firestore collection).</p>
      {turfs.map((turf) => (
        <div key={turf.id} className="admin-block">
          <h2>
            {turf.name} <span className="muted small">({turf.city})</span>
          </h2>
          <div className="slot-grid">
            {turf.slots.map((slot) => (
              <button
                key={slot.id}
                type="button"
                className={`slot-cell${slot.isBooked ? ' is-booked' : ''}`}
                onClick={() => toggleSlot(turf.id, slot.id)}
              >
                <span className="slot-time">{slot.label}</span>
                <span className="slot-state">{slot.isBooked ? 'Booked' : 'Available'}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
