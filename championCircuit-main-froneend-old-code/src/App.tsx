import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CityProvider } from './context/CityContext';
import { PlatformProvider } from './context/PlatformContext';
import { PublicLayout } from './layouts/PublicLayout';
import { AppLayout } from './layouts/AppLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { RequireAuth, RequireAdmin, RequireRegistered } from './routes/AuthGuards';
import { LandingPage } from './pages/LandingPage';
import { AboutPage } from './pages/AboutPage';
import { TurfBrowsePage } from './pages/TurfBrowsePage';
import { EsportsBrowsePage } from './pages/EsportsBrowsePage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { TurfDetailPage } from './pages/TurfDetailPage';
import { TurfConfirmPage } from './pages/TurfConfirmPage';
import { EsportsTournamentPage } from './pages/EsportsTournamentPage';
import { ProfilePage } from './pages/ProfilePage';
import { BookingsPage } from './pages/BookingsPage';
import { VouchersPage } from './pages/VouchersPage';
import { MyVoucherPage } from './pages/MyVoucherPage';
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
            <Route element={<PublicLayout />}>
              <Route index element={<LandingPage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="turf" element={<TurfBrowsePage />} />
              <Route path="turf/:id" element={<TurfDetailPage />} />
              <Route path="esports" element={<EsportsBrowsePage />} />
              <Route path="esports/tournament/:id" element={<EsportsTournamentPage />} />
              <Route path="leaderboard" element={<LeaderboardPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="signup" element={<SignupPage />} />
              <Route path="register" element={<Navigate to="/signup" replace />} />
              <Route path="forgot-password" element={<ForgotPasswordPage />} />
              <Route path="vouchers" element={<VouchersPage />} />
              <Route path="my-voucher" element={<MyVoucherPage />} />
            </Route>

            <Route
              element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }
            >
              <Route
                path="turf/:id/confirm"
                element={
                  <RequireRegistered>
                    <TurfConfirmPage />
                  </RequireRegistered>
                }
              />
              <Route path="profile" element={<ProfilePage />} />
              <Route
                path="bookings"
                element={
                  <RequireRegistered>
                    <BookingsPage />
                  </RequireRegistered>
                }
              />
            </Route>

            <Route path="admin/login" element={<AdminLoginPage />} />
            <Route
              element={
                <RequireAdmin>
                  <AdminLayout />
                </RequireAdmin>
              }
            >
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
