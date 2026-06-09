import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useLocalState } from '../hooks/useLocalState';
import { EMPTY_PROFILE, TOURNAMENT_SEED, TURF_SEED, DEFAULT_SITE_CONTENT } from '../data/platformSeed';
import type { SiteContent, Team, Tournament, TournamentStatus, TurfBooking, TurfVenue, UserProfile } from '../types/platform';
import { computeLeaderboard, todayIso } from '../lib/platformUtils';
import { useAuth } from './AuthContext';

type PlatformContextValue = {
  profile: UserProfile;
  setProfile: (p: UserProfile | ((prev: UserProfile) => UserProfile)) => void;
  registered: boolean;
  setRegistered: (v: boolean) => void;
  turfs: TurfVenue[];
  setTurfs: (v: TurfVenue[] | ((prev: TurfVenue[]) => TurfVenue[])) => void;
  tournaments: Tournament[];
  setTournaments: (v: Tournament[] | ((prev: Tournament[]) => Tournament[])) => void;
  teams: Team[];
  bookings: TurfBooking[];
  siteContent: SiteContent;
  setSiteContent: (c: SiteContent | ((prev: SiteContent) => SiteContent)) => void;
  bookingDate: string;
  setBookingDate: (d: string) => void;
  cloudStatus: string;
  leaderboard: ReturnType<typeof computeLeaderboard>;
  cityTurfs: TurfVenue[];
  completeRegistration: (e: FormEvent) => string | null;
  bookSlot: (turfId: string, slotId: string) => { ok: true; booking: TurfBooking } | { ok: false; message: string };
  registerTournament: (id: string) => string | null;
  createTeam: (name: string, inviteCsv: string) => void;
  deleteTeam: (teamId: string) => void;
  updateTournamentStatus: (id: string, status: TournamentStatus) => void;
  setTournamentWinner: (id: string, winner: string, secondPlace?: string) => void;
  adjustLeaderboardPoints: (email: string, delta: number, reason: string) => void;
  manualPointOverrides: Record<string, number>;
};

const PlatformContext = createContext<PlatformContextValue | null>(null);

function migrateCatalogKeys() {
  try {
    if (!localStorage.getItem('cc_catalog_turfs') && localStorage.getItem('cc_turfs')) {
      localStorage.setItem('cc_catalog_turfs', localStorage.getItem('cc_turfs')!);
    }
    if (!localStorage.getItem('cc_catalog_tournaments') && localStorage.getItem('cc_tournaments')) {
      localStorage.setItem('cc_catalog_tournaments', localStorage.getItem('cc_tournaments')!);
    }
  } catch {
    /* ignore */
  }
}

export function PlatformProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    migrateCatalogKeys();
  }, []);
  const [profile, setProfile] = useLocalState<UserProfile>('cc_profile', EMPTY_PROFILE);
  const [registered, setRegistered] = useLocalState<boolean>('cc_registered', false);
  const [turfs, setTurfs] = useLocalState<TurfVenue[]>('cc_catalog_turfs', TURF_SEED);
  const [tournaments, setTournaments] = useLocalState<Tournament[]>('cc_catalog_tournaments', TOURNAMENT_SEED);
  const [teams, setTeams] = useLocalState<Team[]>('cc_teams', []);
  const [bookings, setBookings] = useLocalState<TurfBooking[]>('cc_bookings', []);
  const [siteContent, setSiteContent] = useLocalState<SiteContent>('cc_site_content', DEFAULT_SITE_CONTENT);
  const [manualPointOverrides, setManualPointOverrides] = useLocalState<Record<string, number>>('cc_point_overrides', {});
  const [bookingDate, setBookingDate] = useState(todayIso);
  const [cloudStatus] = useState('');

  // Sync profile name/email from backend user when logged in
  // Always use backend user's email as the source of truth
  useEffect(() => {
    if (!user) return;
    const nextName = user.name || profile.name || '';
    const nextEmail = user.email;
    const changed = nextName !== profile.name || nextEmail !== profile.email;
    if (changed) setProfile((p) => ({ ...p, name: nextName, email: nextEmail }));
    // Any logged-in user is considered "registered" for local platform features
    if (!registered) setRegistered(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const leaderboard = useMemo(() => {
    const base = computeLeaderboard(tournaments);
    if (Object.keys(manualPointOverrides).length === 0) return base;
    const merged = new Map(base.map((r) => [r.player, { ...r }]));
    Object.entries(manualPointOverrides).forEach(([player, extra]) => {
      const row = merged.get(player) ?? { player, points: 0, history: [] as string[] };
      row.points += extra;
      row.history.push('Admin adjustment');
      merged.set(player, row);
    });
    return [...merged.values()].sort((a, b) => b.points - a.points);
  }, [tournaments, manualPointOverrides]);

  const cityTurfs = useMemo(() => {
    if (!profile.city) return turfs;
    return turfs.filter((t) => t.city.toLowerCase() === profile.city.toLowerCase());
  }, [profile.city, turfs]);

  const completeRegistration = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!profile.name || !profile.email || !profile.contactNumber || !profile.city || !profile.age) {
        return 'Please complete all required fields before continuing.';
      }
      setRegistered(true);
      return null;
    },
    [profile, setRegistered],
  );

  const bookSlot = useCallback(
    (turfId: string, slotId: string): { ok: true; booking: TurfBooking } | { ok: false; message: string } => {
      if (!registered || !profile.email) {
        return { ok: false, message: 'Complete registration to book slots.' };
      }
      const turf = turfs.find((t) => t.id === turfId);
      const slot = turf?.slots.find((s) => s.id === slotId);
      if (!turf || !slot) return { ok: false, message: 'Slot not found.' };
      if (slot.isBooked) return { ok: false, message: 'This slot is already booked.' };
      if (!bookingDate) return { ok: false, message: 'Select a booking date.' };

      setTurfs((prev) =>
        prev.map((t) =>
          t.id !== turfId
            ? t
            : {
                ...t,
                slots: t.slots.map((s) =>
                  s.id !== slotId || s.isBooked ? s : { ...s, isBooked: true, bookedByEmail: profile.email },
                ),
              },
        ),
      );

      const booking: TurfBooking = {
        id: crypto.randomUUID(),
        turfId,
        turfName: turf.name,
        slotId,
        slotLabel: slot.label,
        date: bookingDate,
        email: profile.email,
        createdAt: new Date().toISOString(),
      };
      setBookings((prev) => [booking, ...prev]);
      return { ok: true, booking };
    },
    [registered, profile.email, turfs, bookingDate, setTurfs, setBookings],
  );

  const registerTournament = useCallback(
    (id: string) => {
      if (!registered || !profile.email) return 'Register your account first.';
      const t = tournaments.find((x) => x.id === id);
      if (!t) return 'Tournament not found.';
      if (!t.registrationOpen) return 'Registration is closed for this tournament.';
      if (t.participants.includes(profile.email)) return 'You are already registered.';
      if (t.participants.length >= t.participantsLimit) return 'This tournament is full.';
      setTournaments((prev) =>
        prev.map((x) =>
          x.id !== id || !x.registrationOpen || x.participants.includes(profile.email) ? x : { ...x, participants: [...x.participants, profile.email] },
        ),
      );
      return null;
    },
    [registered, profile.email, tournaments, setTournaments],
  );

  const createTeam = useCallback(
    (name: string, inviteCsv: string) => {
      if (!registered || !profile.email || !name.trim()) return;
      const invites = inviteCsv
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 7)
        .map((email) => ({ email, status: 'pending' as const }));
      setTeams((prev) => [
        ...prev,
        { id: crypto.randomUUID(), name: name.trim(), leaderEmail: profile.email, members: [profile.email], invites },
      ]);
    },
    [registered, profile.email, setTeams],
  );

  const deleteTeam = useCallback(
    (teamId: string) => {
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
    },
    [setTeams],
  );

  const updateTournamentStatus = useCallback(
    (id: string, status: TournamentStatus) => {
      setTournaments((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    },
    [setTournaments],
  );

  const setTournamentWinner = useCallback(
    (id: string, winner: string, secondPlace?: string) => {
      setTournaments((prev) =>
        prev.map((t) => (t.id === id ? { ...t, winner, secondPlace, status: 'completed' as const } : t)),
      );
    },
    [setTournaments],
  );

  const adjustLeaderboardPoints = useCallback(
    (email: string, delta: number, _reason: string) => {
      setManualPointOverrides((prev) => ({ ...prev, [email]: (prev[email] ?? 0) + delta }));
    },
    [setManualPointOverrides],
  );

  const value = useMemo(
    () => ({
      profile,
      setProfile,
      registered,
      setRegistered,
      turfs,
      setTurfs,
      tournaments,
      setTournaments,
      teams,
      bookings,
      siteContent,
      setSiteContent,
      bookingDate,
      setBookingDate,
      cloudStatus,
      leaderboard,
      cityTurfs,
      completeRegistration,
      bookSlot,
      registerTournament,
      createTeam,
      deleteTeam,
      updateTournamentStatus,
      setTournamentWinner,
      adjustLeaderboardPoints,
      manualPointOverrides,
    }),
    [
      profile,
      registered,
      turfs,
      tournaments,
      teams,
      bookings,
      siteContent,
      bookingDate,
      cloudStatus,
      leaderboard,
      cityTurfs,
      completeRegistration,
      bookSlot,
      registerTournament,
      createTeam,
      deleteTeam,
      updateTournamentStatus,
      setTournamentWinner,
      adjustLeaderboardPoints,
      manualPointOverrides,
    ],
  );

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatform() {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform must be used within PlatformProvider');
  return ctx;
}
