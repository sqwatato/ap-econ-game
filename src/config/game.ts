// src/config/game.ts
export const PLAYER_SIZE = 30;
export const PLAYER_SPEED = 4; // pixels per frame update

export const MONSTER_SIZE = 30;
export const MONSTER_SPEED = 1.5; // pixels per frame update for monsters
export const MONSTER_SHOOT_INTERVAL_BASE = 3000; // ms (min delay: 3 seconds)
export const MONSTER_SHOOT_INTERVAL_RANDOM = 5000; // ms (max additional delay: 5 seconds, total 3-8 seconds)
export const MONSTER_CHARGE_DURATION = 1000; // ms, how long monster charges before shooting
export const MONSTER_PROJECTILE_SPREAD_ANGLE = (Math.PI / 12) * 1.25; // Approx 18.75 degrees

export const MONSTER_SPAWN_CYCLE_INTERVAL = 10000; // ms (10 seconds) - how often a new wave spawns
export const INITIAL_MONSTER_SPAWN_BATCH_SIZE = 10; // Initial number of monsters in a wave
export const MONSTER_SPAWN_BATCH_INCREMENT = 2; // How many more monsters to add to each subsequent wave

export const PROJECTILE_SIZE = 8; // Monster projectile size
export const PROJECTILE_SPEED = 12; // Monster projectile speed (was 8, increased by 50%)

export const PLAYER_PROJECTILE_SIZE = 6;
export const PLAYER_PROJECTILE_SPEED = 10.08; // Player projectile speed

// Define viewport dimensions (the visible part of the game)
export const VIEWPORT_WIDTH = 800;
export const VIEWPORT_HEIGHT = 600;

// Define world dimensions (the total scrollable game area)
export const WORLD_WIDTH = VIEWPORT_WIDTH * 2; // Example: world is twice the viewport width
export const WORLD_HEIGHT = VIEWPORT_HEIGHT * 2; // Example: world is twice the viewport height

export const SCORE_INCREMENT_INTERVAL = 100; // ms - 1 point per 100ms
export const SCORE_INCREMENT_AMOUNT = 1; // Amount to increment score by for time survived

// Initial player position in world coordinates
export const INITIAL_PLAYER_X = WORLD_WIDTH / 2 - PLAYER_SIZE / 2;
export const INITIAL_PLAYER_Y = WORLD_HEIGHT * 0.8 - PLAYER_SIZE / 2; // Start near bottom-center of the world

export enum MonsterType {
  TRIVIA = 'trivia',
  CAUSE_EFFECT = 'cause-effect',
}

export const KEY_BINDINGS = {
  UP: 'ArrowUp',
  DOWN: 'ArrowDown',
  LEFT: 'ArrowLeft',
  RIGHT: 'ArrowRight',
  W: 'w',
  S: 's',
  A: 'a',
  D: 'd',
};
