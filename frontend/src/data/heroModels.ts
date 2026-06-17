/**
 * GLB files in /public/models/ (no Sketchfab). Cricket first for the hero gate.
 * Add or remove entries as you change files on disk.
 */
export const HERO_GLTF_MODELS = [
  '/models/virat_kohli_cricket_batting_animation_-_low_poly.glb',
  '/models/dualshock_ps1.glb',
  '/models/table_tennis_with_ping_pong_ball.glb',
  '/models/brain.glb',
] as const;

export type HeroGltfPath = (typeof HERO_GLTF_MODELS)[number];

export const HERO_CRICKET_MODEL_URL = HERO_GLTF_MODELS[0];
