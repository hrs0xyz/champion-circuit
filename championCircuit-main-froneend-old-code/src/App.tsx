import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CityProvider } from './context/CityContext';
import { PlatformProvider } from './context/PlatformContext';
import { PublicLayout } from './layouts/PublicLayout';
import { AppLayout } from './layouts/AppLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { RequireAuth, RequireAdmin } from './routes/AuthGuards';

import { LandingPage } from './pages/LandingPage';
import { AboutPage } from './pages/AboutPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';

import { TurfBrowsePage } from './pages/TurfBrowsePage';
import { VenueDetailPage } from './pages/VenueDetailPage';
import { EsportsBrowsePage } from './pages/EsportsBrowsePage';
import { EsportsTournamentPage } from './pages/EsportsTournamentPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { VouchersPage } from './pages/VouchersPage';
import { MyVoucherPage } from './pages/MyVoucherPage';
import { NewsPage, NewsArticlePage } from './pages/NewsPage';

import { ProfilePage } from './pages/ProfilePage';
import { BookingsPage } from './pages/BookingsPage';
import { MyMatchesPage } from './pages/MyMatchesPage';

import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminTurfsPage } from './pages/admin/AdminTurfsPage';
import { AdminTournamentsPage } from './pages/admin/AdminTournamentsPage';
import { AdminLeaderboardPage } from './pages/admin/AdminLeaderboardPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminContentPage } from './pages/admin/AdminContentPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CityProvider>
          <PlatformProvider>
            <Routes>
              {/* Public */}
              <Route element={<PublicLayout />}>
                <Route index element={<LandingPage />} />
                <Route path="about" element={<AboutPage />} />
                <Route path="login" element={<LoginPage />} />
                <Route path="signup" element={<SignupPage />} />
                <Route path="register" element={<Navigate to="/signup" replace />} />
                <Route path="forgot-password" element={<ForgotPasswordPage />} />

                {/* Turf */}
                <Route path="turf" element={<TurfBrowsePage />} />
                <Route path="venue/:id" element={<VenueDetailPage />} />

                {/* Esports */}
                <Route path="esports" element={<EsportsBrowsePage />} />
                <Route path="esports/tournament/:id" element={<EsportsTournamentPage />} />

                {/* Leaderboard */}
                <Route path="leaderboard" element={<LeaderboardPage />} />

                {/* Vouchers */}
                <Route path="vouchers" element={<VouchersPage />} />
                <Route path="my-voucher" element={<MyVoucherPage />} />

                {/* News */}
                <Route path="news" element={<NewsPage />} />
                <Route path="news/:id" element={<NewsArticlePage />} />
              </Route>

              {/* Authenticated */}
              <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
                <Route path="profile" element={<ProfilePage />} />
                <Route path="bookings" element={<BookingsPage />} />
                <Route path="my-matches" element={<MyMatchesPage />} />
                <Route path="my-vouchers" element={<MyVoucherPage />} />
              </Route>

              {/* Admin */}
              <Route path="admin/login" element={<AdminLoginPage />} />
              <Route element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
                <Route path="admin" element={<AdminDashboardPage />} />
                <Route path="admin/turfs" element={<AdminTurfsPage />} />
                <Route path="admin/tournaments" element={<AdminTournamentsPage />} />
                <Route path="admin/leaderboard" element={<AdminLeaderboardPage />} />
                <Route path="admin/users" element={<AdminUsersPage />} />
                <Route path="admin/content" element={<AdminContentPage />} />
              </Route>

              <Route path="platform" element={<Navigate to="/turf" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </PlatformProvider>
        </CityProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
