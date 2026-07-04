import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from '../components/ui/Navbar';
import { Footer } from '../components/ui/Footer';
import { InteractiveBackground } from '../components/ui/InteractiveBackground';
import { useAuth } from '../context/AuthContext';

export function PublicLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isLanding = pathname === '/';
  const navVariant = user ? 'app' : 'public';

  return (
    <div className="app">
      <div className="app-aurora" aria-hidden="true">
        <div className="aurora aurora--gold" />
        <div className="aurora aurora--blue" />
        <div className="aurora aurora--silver" />
      </div>
      <InteractiveBackground />
      <div className="noise" aria-hidden="true" />
      <Navbar variant={navVariant} />
      <main className={isLanding ? 'main-landing' : 'main-public'}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
