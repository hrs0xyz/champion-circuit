import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ccApi, type Notification } from '../../lib/ccApi';

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    ccApi.notifications().then((ns) => {
      setNotifs(ns);
      setUnread(ns.filter((n) => !n.is_read).length);
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!user) return null;

  function handleOpen() {
    setOpen((o) => !o);
    if (!open && unread > 0) {
      ccApi.markNotificationsRead().then(() => {
        setUnread(0);
        setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
      }).catch(() => {});
    }
  }

  return (
    <div className="notif-bell-wrap" ref={ref}>
      <button
        type="button"
        className="notif-bell"
        onClick={handleOpen}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
      >
        🔔
        {unread > 0 && <span className="notif-bell__badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open ? (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-panel__header">
            <span>Notifications</span>
            <button type="button" className="notif-panel__close" onClick={() => setOpen(false)}>✕</button>
          </div>
          {notifs.length === 0 ? (
            <p className="notif-empty">No notifications yet.</p>
          ) : (
            <div className="notif-list">
              {notifs.map((n) => (
                <div
                  key={n.id}
                  className={`notif-item${n.is_read ? '' : ' notif-item--unread'}`}
                  onClick={() => {
                    setOpen(false);
                    if (n.link) navigate(n.link);
                  }}
                  role={n.link ? 'button' : undefined}
                  tabIndex={n.link ? 0 : undefined}
                >
                  <p className="notif-item__title">{n.title}</p>
                  <p className="notif-item__body">{n.body}</p>
                  <p className="notif-item__time muted small">
                    {new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
