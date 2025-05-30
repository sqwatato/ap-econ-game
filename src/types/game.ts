// src/types/game.ts
import type { MonsterType } from '@/config/game';

// Base output structure from AI flows (simplified for unification)
export interface BaseQuestionOutput {
  question: string;
  choices: string[];
  correctAnswerIndex: number;
  explanation?: string; // Explanation is optional, mainly for trivia
}

export interface Position {
  x: number;
  y: number;
}

export interface PlayerState extends Position {}

export interface MonsterInstance extends Position {
  id: string;
  type: MonsterType;
  nextShotDecisionTime: number; // Timestamp when the monster will shoot
  isPreparingToShoot: boolean; // True if in the "charging up" phase
}

export interface ProjectileInstance extends Position { // Monster Projectile
  id: string;
  monsterId: string; // To know which monster to remove if question answered correctly
  angle: number; // Radians, for movement
  monsterType: MonsterType; // To fetch correct question type
}

export interface PlayerProjectileInstance extends Position {
  id: string;
  angle: number; // Radians, for movement
}

export interface CurrentQuestionContext {
  monsterId: string; // To identify which monster asked the question
  projectileId: string; // To identify the projectile that hit
  questionData: BaseQuestionOutput;
  monsterType: MonsterType;
}

export interface GameOverData {
  score: number;
  timeSurvived: number; // in seconds (this is now actual seconds for display)
  monstersKilled: number;
  failedQuestion?: {
    questionText: string;
    correctAnswerText: string;
    explanationText?: string;
  };
  rank?: number; // Optional: Player's rank on the leaderboard
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  date: string; // ISO string format
}
