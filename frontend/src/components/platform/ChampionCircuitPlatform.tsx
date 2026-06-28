import { Navigate } from 'react-router-dom';

/** @deprecated Use routed pages under `/turf`, `/esports`, `/profile`, and `/admin`. */
export function ChampionCircuitPlatform() {
  return <Navigate to="/turf" replace />;
}
