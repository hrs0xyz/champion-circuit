import type { Tournament, TournamentFormat, TournamentStatus } from '../types/platform';

export type TournamentBrowseTab = TournamentStatus | 'exclusive';

export const POINTS = {
  registration: 1,
  roundQualified: 1,
  winner: 3,
  secondPlace: 2,
} as const;

export const todayIso = () => new Date().toISOString().slice(0, 10);

export function statusLabel(status: TournamentStatus) {
  if (status === 'live') return 'Live';
  if (status === 'upcoming') return 'Upcoming';
  return 'Completed';
}

export function browseTabLabel(tab: TournamentBrowseTab) {
  if (tab === 'exclusive') return 'Exclusive';
  return statusLabel(tab);
}

export function formatLabel(format: TournamentFormat) {
  if (format === 'double-elimination') return 'Double Elimination';
  if (format === 'group-stage') return 'Group Stage';
  if (format === 'group-knockout') return 'Group + Knockout';
  return 'Knockout';
}

export function filterTournamentsByTab(tournaments: Tournament[], tab: TournamentBrowseTab) {
  if (tab === 'exclusive') return tournaments.filter((t) => t.isExclusive);
  return tournaments.filter((t) => t.status === tab);
}

export function computeLeaderboard(tournaments: Tournament[]) {
  const table = new Map<string, { points: number; history: string[] }>();

  const addPoints = (email: string, points: number, reason: string) => {
    const row = table.get(email) ?? { points: 0, history: [] };
    row.points += points;
    row.history.push(reason);
    table.set(email, row);
  };

  tournaments.forEach((t) => {
    t.participants.forEach((email) => addPoints(email, POINTS.registration, `${t.name}: registration`));
    if (t.winner) addPoints(t.winner, POINTS.winner, `${t.name}: winner`);
    if (t.secondPlace) addPoints(t.secondPlace, POINTS.secondPlace, `${t.name}: second place`);
  });

  return [...table.entries()]
    .map(([player, value]) => ({ player, points: value.points, history: value.history }))
    .sort((a, b) => b.points - a.points);
}
