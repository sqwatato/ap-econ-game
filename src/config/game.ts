// src/config/game.ts
export const PLAYER_SIZE = 20;
export const PLAYER_SPEED = 4; // pixels per frame update

export const MONSTER_SIZE = 20;
export const MONSTER_SHOOT_INTERVAL_BASE = 3000; // ms
export const MONSTER_SHOOT_INTERVAL_RANDOM = 2000; // ms (total interval = base + Math.random() * random)
export const MAX_MONSTERS = 5;
export const MONSTER_SPAWN_INTERVAL = 5000; // ms, how often to try spawning a new monster

export const PROJECTILE_SIZE = 8;
export const PROJECTILE_SPEED = 6; // pixels per frame update

export const GAME_AREA_WIDTH = 800;
export const GAME_AREA_HEIGHT = 600;

export const SCORE_INCREMENT_INTERVAL = 1000; // ms
export const SCORE_INCREMENT_AMOUNT = 10;

export const INITIAL_PLAYER_X = GAME_AREA_WIDTH / 2 - PLAYER_SIZE / 2;
export const INITIAL_PLAYER_Y = GAME_AREA_HEIGHT - PLAYER_SIZE - 30; // Start at bottom middle

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
