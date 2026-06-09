import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/ui/Navbar';
import { Footer } from '../components/ui/Footer';

export function AppLayout() {
  return (
    <div className="app">
      <div className="app-aurora app-aurora--subtle" aria-hidden="true">
        <div className="aurora aurora--blue" />
      </div>
      <div className="noise" aria-hidden="true" />
      <Navbar variant="app" />
      <main className="main-app">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
