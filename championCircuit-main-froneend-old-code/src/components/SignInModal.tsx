import { Link } from 'react-router-dom';

export function SignInModal({ open, onClose }: { open: boolean; onClose: () => void; onSignedIn?: () => void }) {
  if (!open) return null;

  return (
    <div className="signin-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="signin-modal" role="dialog" aria-modal="true" aria-label="Sign in" onClick={(e) => e.stopPropagation()}>
        <h2>Sign in</h2>
        <p>Log in or create an account to access Champion Circuit.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link to="/login" className="btn btn-primary" onClick={onClose}>
            Log in
          </Link>
          <Link to="/signup" className="btn btn-secondary" onClick={onClose}>
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
