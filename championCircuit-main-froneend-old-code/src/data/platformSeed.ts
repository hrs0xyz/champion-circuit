import { SiteContent, Tournament, TurfVenue, UserProfile } from '../types/platform';

export const DEFAULT_SITE_CONTENT: SiteContent = {
  homeDescription: 'Live, upcoming, completed, and exclusive tournaments: one competitive home for Indian esports.',
  homeBackground: '',
  esportsIntro: 'Compete in structured brackets, earn leaderboard points, and join brand-exclusive events.',
};

export const TURF_SEED: TurfVenue[] = [
  {
    id: 'kolkata-central',
    city: 'Kolkata',
    name: 'Kolkata Central Turf',
    description: 'Premium 7-a-side turf with changing rooms and evening lighting.',
    slots: [
      { id: 'kol-1', label: '6:00 PM - 7:00 PM', isBooked: false },
      { id: 'kol-2', label: '7:00 PM - 8:00 PM', isBooked: true, bookedByEmail: 'player1@circuit.gg' },
      { id: 'kol-3', label: '8:00 PM - 9:00 PM', isBooked: false },
    ],
  },
  {
    id: 'mumbai-west',
    city: 'Mumbai',
    name: 'Mumbai West Arena',
    description: 'FIFA-certified synthetic turf with spectator zone.',
    slots: [
      { id: 'mum-1', label: '6:00 PM - 7:00 PM', isBooked: false },
      { id: 'mum-2', label: '7:00 PM - 8:00 PM', isBooked: false },
      { id: 'mum-3', label: '8:00 PM - 9:00 PM', isBooked: true, bookedByEmail: 'captain@circuit.gg' },
    ],
  },
];

export const TOURNAMENT_SEED: Tournament[] = [
  {
    id: 'valor-clash',
    name: 'Valor Clash Open',
    date: '2026-05-12',
    game: 'Valorant',
    mode: 'team',
    format: 'double-elimination',
    status: 'live',
    isExclusive: false,
    isPaid: true,
    entryFee: 149,
    description: 'Open bracket for registered teams.',
    rules: 'Best of 1 in early rounds, best of 3 finals.',
    seoContent: 'Valorant live tournament India',
    registrationOpen: true,
    participantsLimit: 16,
    participants: ['captain@circuit.gg'],
  },
  {
    id: 'bgmi-rising',
    name: 'BGMI Rising Weekender',
    date: '2026-06-02',
    game: 'BGMI',
    mode: 'solo',
    format: 'group-stage',
    status: 'upcoming',
    isExclusive: true,
    isPaid: false,
    description: 'Points-based qualifier for rising players.',
    rules: 'Top players from groups qualify for final table.',
    seoContent: 'BGMI upcoming tournament leaderboard',
    registrationOpen: false,
    participantsLimit: 64,
    participants: [],
  },
  {
    id: 'fifa-cup',
    name: 'FIFA City Cup',
    date: '2026-03-22',
    game: 'EA FC',
    mode: 'solo',
    format: 'knockout',
    status: 'completed',
    isExclusive: false,
    isPaid: false,
    description: 'Single elimination city championship.',
    rules: 'Home and away final.',
    seoContent: 'FIFA tournament completed standings',
    registrationOpen: false,
    participantsLimit: 32,
    participants: ['finalist@circuit.gg', 'runner@circuit.gg'],
    winner: 'finalist@circuit.gg',
    secondPlace: 'runner@circuit.gg',
  },
];

export const EMPTY_PROFILE: UserProfile = {
  name: '',
  email: '',
  contactNumber: '',
  city: '',
  age: 18,
  ign: '',
  profilePicture: '',
};

