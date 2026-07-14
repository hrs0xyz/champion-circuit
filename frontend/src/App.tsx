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
import { TournamentsBrowsePage } from './pages/TournamentsBrowsePage';
import { TournamentDetailPage } from './pages/TournamentDetailPage';
import { LegacyTournamentRedirect } from './pages/LegacyTournamentRedirect';
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
import { ActivityLogPage } from './pages/admin/ActivityLogPage';

// Staff portals — hidden, full-screen, no public navbar
import { StaffLoginPage } from './pages/staff/StaffLoginPage';
import { SuperAdminPage } from './pages/staff/SuperAdminPage';
import { TurfOwnerPage } from './pages/staff/TurfOwnerPage';
import { MatchAdminPage } from './pages/staff/MatchAdminPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CityProvider>
          <PlatformProvider>
            <Routes>

              {/* ── Staff portals (no public layout, full screen) ── */}
              <Route path="staff-login" element={<StaffLoginPage />} />
              <Route path="partner-login" element={<StaffLoginPage />} />
              <Route path="staff/admin" element={<SuperAdminPage />} />
              <Route path="staff/venue" element={<TurfOwnerPage />} />
              <Route path="staff/match" element={<MatchAdminPage />} />

              {/* ── Public pages with navbar ── */}
              <Route element={<PublicLayout />}>
                <Route index element={<LandingPage />} />
                <Route path="about" element={<AboutPage />} />
                <Route path="login" element={<LoginPage />} />
                <Route path="signup" element={<SignupPage />} />
                <Route path="register" element={<Navigate to="/signup" replace />} />
                <Route path="forgot-password" element={<ForgotPasswordPage />} />

                <Route path="turf" element={<TurfBrowsePage />} />
                <Route path="venue/:id" element={<VenueDetailPage />} />

                <Route path="esports" element={<EsportsBrowsePage />} />
                <Route path="tournaments" element={<TournamentsBrowsePage />} />
                <Route path="tournaments/:slug" element={<TournamentDetailPage />} />
                {/* Old links stay alive — resolves the id → canonical slug page */}
                <Route path="esports/tournament/:id" element={<LegacyTournamentRedirect />} />

                <Route
                  path="leaderboard"
                  element={
                    <RequireAuth>
                      <LeaderboardPage />
                    </RequireAuth>
                  }
                />

                <Route path="vouchers" element={<VouchersPage />} />
                <Route path="my-voucher" element={<MyVoucherPage />} />

                <Route path="news" element={<NewsPage />} />
                <Route path="news/:id" element={<NewsArticlePage />} />
              </Route>

              {/* ── Authenticated user pages ── */}
              <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
                <Route path="profile" element={<ProfilePage />} />
                <Route path="bookings" element={<BookingsPage />} />
                <Route path="my-matches" element={<MyMatchesPage />} />
                <Route path="my-vouchers" element={<MyVoucherPage />} />
              </Route>

              {/* ── Old admin panel (legacy) ── */}
              <Route path="admin/login" element={<AdminLoginPage />} />
              <Route element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
                <Route path="admin" element={<AdminDashboardPage />} />
                <Route path="admin/turfs" element={<AdminTurfsPage />} />
                <Route path="admin/tournaments" element={<AdminTournamentsPage />} />
                <Route path="admin/leaderboard" element={<AdminLeaderboardPage />} />
                <Route path="admin/users" element={<AdminUsersPage />} />
                <Route path="admin/content" element={<AdminContentPage />} />
                <Route path="admin/activity" element={<ActivityLogPage />} />
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
