import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/ui/Navbar';
import { Footer } from '../components/ui/Footer';
import { FloatingNotifications } from '../components/ui/FloatingNotifications';
import { InteractiveBackground } from '../components/ui/InteractiveBackground';

export function AppLayout() {
  return (
    <div className="app">
      <div className="app-aurora app-aurora--subtle" aria-hidden="true">
        <div className="aurora aurora--blue" />
      </div>
      <InteractiveBackground />
      <div className="noise" aria-hidden="true" />
      <Navbar variant="app" />
      <main className="main-app">
        <Outlet />
      </main>
      <Footer />
      <FloatingNotifications />
    </div>
  );
}
