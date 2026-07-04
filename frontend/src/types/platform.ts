export type TournamentStatus = 'live' | 'upcoming' | 'completed';
export type TournamentMode = 'team' | 'solo';
export type TournamentFormat = 'knockout' | 'double-elimination' | 'group-stage' | 'group-knockout';

export type UserProfile = {
  name: string;
  email: string;
  contactNumber: string;
  city: string;
  age: number;
  ign?: string;
  profilePicture?: string;
};

export type TurfSlot = {
  id: string;
  label: string;
  isBooked: boolean;
  bookedByEmail?: string;
};

export type TurfVenue = {
  id: string;
  city: string;
  name: string;
  description: string;
  slots: TurfSlot[];
};

export type Tournament = {
  id: string;
  name: string;
  date: string;
  game: string;
  mode: TournamentMode;
  format: TournamentFormat;
  status: TournamentStatus;
  isExclusive: boolean;
  isPaid: boolean;
  entryFee?: number;
  description: string;
  rules: string;
  seoContent: string;
  registrationOpen: boolean;
  participantsLimit: number;
  participants: string[];
  winner?: string;
  secondPlace?: string;
};

export type TeamInvite = {
  email: string;
  status: 'pending' | 'accepted';
};

export type Team = {
  id: string;
  name: string;
  leaderEmail: string;
  members: string[];
  invites: TeamInvite[];
};

export type LeaderboardEntry = {
  player: string;
  points: number;
  history: string[];
};

export type TurfBooking = {
  id: string;
  turfId: string;
  turfName: string;
  slotId: string;
  slotLabel: string;
  date: string;
  email: string;
  createdAt: string;
};

export type SiteContent = {
  homeDescription: string;
  homeBackground: string;
  esportsIntro: string;
};
