
// src/app/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import PlayerComponent from '@/components/game/Player';
import MonsterComponent from '@/components/game/Monster';
import ProjectileComponent from '@/components/game/Projectile'; // Monster projectiles
import PlayerProjectileComponent from '@/components/game/PlayerProjectile'; // Player projectiles
import ScoreDisplay from '@/components/game/ScoreDisplay';
import QuestionModal from '@/components/game/QuestionModal';
import GameOverScreen from '@/components/game/GameOverScreen';
import UsernamePromptModal from '@/components/game/UsernamePromptModal';
import {
  PLAYER_SIZE, PLAYER_SPEED, MONSTER_SIZE, MONSTER_SPEED, MONSTER_SHOOT_INTERVAL_BASE, MONSTER_SHOOT_INTERVAL_RANDOM, MONSTER_CHARGE_DURATION,
  MONSTER_SPAWN_CYCLE_INTERVAL, INITIAL_MONSTER_SPAWN_BATCH_SIZE, MONSTER_SPAWN_BATCH_INCREMENT,
  PROJECTILE_SIZE, PROJECTILE_SPEED, MONSTER_PROJECTILE_SPREAD_ANGLE,
  PLAYER_PROJECTILE_SIZE, PLAYER_PROJECTILE_SPEED,
  WORLD_WIDTH, WORLD_HEIGHT, VIEWPORT_WIDTH, VIEWPORT_HEIGHT,
  SCORE_INCREMENT_INTERVAL, SCORE_INCREMENT_AMOUNT, INITIAL_PLAYER_X, INITIAL_PLAYER_Y,
  MonsterType, KEY_BINDINGS
} from '@/config/game';
import type {
  PlayerState, MonsterInstance, ProjectileInstance, PlayerProjectileInstance, CurrentQuestionContext, GameOverData, BaseQuestionOutput, LeaderboardEntry
} from '@/types/game';
import { generateEconomicsQuestion } from '@/ai/flows/generate-economics-question';
import { generateCauseEffectQuestion } from '@/ai/flows/generate-cause-effect-question';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation'; // For App Router

type GameStatus = 'start_screen' | 'playing' | 'question' | 'game_over' | 'prompting_username' | 'viewing_leaderboard';

const MAX_QUESTION_QUEUE_SIZE = 2;
const MIN_QUESTION_QUEUE_SIZE = 1;

const AP_MACRO_TOPICS = [
  "Basic Economic Concepts (Scarcity, Opportunity Cost, PPC)",
  "Supply and Demand",
  "Market Equilibrium",
  "Elasticity (Price, Income, Cross-Price)",
  "Market Failures (Externalities, Public Goods)",
  "Government Intervention (Price Ceilings, Price Floors, Taxes, Subsidies)",
  "Measuring Economic Performance (GDP, Nominal vs. Real GDP, GDP Deflator)",
  "Unemployment (Types, Natural Rate)",
  "Inflation (CPI, Causes, Effects)",
  "Aggregate Demand (AD)",
  "Aggregate Supply (AS - Short-run and Long-run)",
  "Macroeconomic Equilibrium (Short-run and Long-run)",
  "Fiscal Policy (Expansionary, Contractionary, Multipliers)",
  "Monetary Policy (Tools of the Fed, Money Market, Loanable Funds Market)",
  "The Phillips Curve (Short-run and Long-run)",
  "Money, Banking, and Financial Markets (Definition of Money, Banks, Federal Reserve)",
  "Economic Growth (Determinants, Productivity)",
  "International Trade and Finance (Comparative Advantage, Trade Barriers)",
  "Exchange Rates (Appreciation, Depreciation)",
  "Balance of Payments (Current Account, Capital and Financial Account)",
  "Business Cycles",
  "Circular Flow Model",
  "National Income Accounting",
  "Consumer Price Index (CPI) and Inflation Calculation",
  "GDP Deflator vs. CPI",
  "Costs of Inflation (Shoe-leather, Menu Costs, etc.)",
  "Types of Unemployment (Frictional, Structural, Cyclical)",
  "Okun's Law",
  "Classical vs. Keynesian Economics",
  "Marginal Propensity to Consume (MPC) and Save (MPS)",
  "Expenditure Multiplier and Tax Multiplier",
  "Automatic Stabilizers",
  "Government Debt and Deficits",
  "Crowding Out Effect",
  "Functions of Money",
  "Measures of Money Supply (M1, M2)",
  "Bank Balance Sheets and Money Creation",
  "Reserve Requirement and Money Multiplier",
  "Discount Rate and Federal Funds Rate",
  "Open Market Operations",
  "Equation of Exchange (MV=PQ)",
  "Quantity Theory of Money",
  "Nominal vs. Real Interest Rates",
  "Loanable Funds Market (Supply and Demand for Loanable Funds)",
  "Expectations and Macroeconomic Policy",
  "Supply Shocks",
  "Trade Balance (Exports vs. Imports)",
  "Foreign Exchange Market (Supply and Demand for Currencies)",
  "Factors Affecting Exchange Rates",
  "Effects of Exchange Rate Changes on Trade"
];

const ECONOMIC_CONDITIONS = [
    "recessionary gap",
    "inflationary gap",
    "stagflation",
    "full employment with rising inflation",
    "cyclical unemployment",
    "demand-pull inflation",
    "cost-push inflation",
    "economic boom with low unemployment",
    "deflationary pressures",
    "liquidity trap",
    "rapid economic growth leading to resource scarcity",
    "unexpected decrease in consumer confidence",
    "significant increase in oil prices affecting production costs",
    "a decrease in net exports",
    "an increase in autonomous consumption",
    "a decrease in investment demand",
    "a government budget surplus"
];

// Helper function to shuffle choices and update the correct index
function shuffleChoicesAndUpdateIndex(
  choices: string[],
  correctIndex: number
): { newChoices: string[]; newCorrectIndex: number } {
  const correctAnswerText = choices[correctIndex];

  // Fisher-Yates shuffle algorithm for newChoices
  const newChoices = [...choices];
  for (let i = newChoices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newChoices[i], newChoices[j]] = [newChoices[j], newChoices[i]];
  }

  const newCorrectIndex = newChoices.indexOf(correctAnswerText);
  if (newCorrectIndex === -1) {
    console.error(
      "[Shuffle] Error: Correct answer text not found after shuffling. Defaulting to original index."
    );
    return { newChoices: choices, newCorrectIndex: correctIndex };
  }
  console.log("[Shuffle] Original correct idx:", correctIndex, "Text:", correctAnswerText, "New correct idx:", newCorrectIndex, "New choices:", newChoices)
  return { newChoices, newCorrectIndex };
}

export default function EcoRoamPage() {
  const [playerState, setPlayerState] = useState<PlayerState>({ x: INITIAL_PLAYER_X, y: INITIAL_PLAYER_Y });
  const [monsters, setMonsters] = useState<MonsterInstance[]>([]);
  const [projectiles, setProjectiles] = useState<ProjectileInstance[]>([]);
  const [playerProjectiles, setPlayerProjectiles] = useState<PlayerProjectileInstance[]>([]);
  const [score, setScore] = useState(0);
  const [timeSurvived, setTimeSurvived] = useState(0); // in 100ms intervals
  const [monstersKilled, setMonstersKilled] = useState(0);
  const [gameStatus, setGameStatus] = useState<GameStatus>('start_screen');
  const [currentQuestionContext, setCurrentQuestionContext] = useState<CurrentQuestionContext | null>(null);
  const [gameOverData, setGameOverData] = useState<GameOverData | null>(null);
  const [isPlayerHit, setIsPlayerHit] = useState(false);

  const [triviaQuestionQueue, setTriviaQuestionQueue] = useState<BaseQuestionOutput[]>([]);
  const [causeEffectQuestionQueue, setCauseEffectQuestionQueue] = useState<BaseQuestionOutput[]>([]);
  const [isFetchingTrivia, setIsFetchingTrivia] = useState(false);
  const [isFetchingCauseEffect, setIsFetchingCauseEffect] = useState(false);
  const [currentMonsterSpawnBatchSize, setCurrentMonsterSpawnBatchSize] = useState(INITIAL_MONSTER_SPAWN_BATCH_SIZE);


  const pressedKeys = useRef<Set<string>>(new Set());
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const lastMonsterSpawnTime = useRef<number>(0);
  const isProcessingHit = useRef<boolean>(false);
  const router = useRouter();
  const gameStatusRef = useRef(gameStatus);

  useEffect(() => {
    console.log("--- CURRENT GAME CONFIG VALUES ---");
    console.log("PLAYER_SPEED:", PLAYER_SPEED);
    console.log("MONSTER_SPEED:", MONSTER_SPEED);
    console.log("MONSTER_SHOOT_INTERVAL_BASE:", MONSTER_SHOOT_INTERVAL_BASE);
    console.log("MONSTER_SHOOT_INTERVAL_RANDOM:", MONSTER_SHOOT_INTERVAL_RANDOM);
    console.log("MONSTER_CHARGE_DURATION:", MONSTER_CHARGE_DURATION);
    console.log("MONSTER_PROJECTILE_SPREAD_ANGLE:", MONSTER_PROJECTILE_SPREAD_ANGLE);
    console.log("MONSTER_SPAWN_CYCLE_INTERVAL:", MONSTER_SPAWN_CYCLE_INTERVAL);
    console.log("INITIAL_MONSTER_SPAWN_BATCH_SIZE:", INITIAL_MONSTER_SPAWN_BATCH_SIZE);
    console.log("MONSTER_SPAWN_BATCH_INCREMENT:", MONSTER_SPAWN_BATCH_INCREMENT);
    console.log("PROJECTILE_SPEED (Monster):", PROJECTILE_SPEED);
    console.log("PLAYER_PROJECTILE_SPEED:", PLAYER_PROJECTILE_SPEED);
    console.log("SCORE_INCREMENT_AMOUNT:", SCORE_INCREMENT_AMOUNT);
    console.log("SCORE_INCREMENT_INTERVAL:", SCORE_INCREMENT_INTERVAL);
    console.log("--- END GAME CONFIG VALUES ---");
  }, []);

  useEffect(() => {
    gameStatusRef.current = gameStatus;
  }, [gameStatus]);


  const fetchTriviaQuestions = useCallback(async (count: number) => {
    if (isFetchingTrivia || count <= 0 || triviaQuestionQueue.length >= MAX_QUESTION_QUEUE_SIZE) return;
    setIsFetchingTrivia(true);
    console.log(`[FetchTrivia] Attempting to fetch ${count} trivia questions. Current queue size: ${triviaQuestionQueue.length}`);
    try {
      const promises = [];
      for (let i = 0; i < count; i++) {
        const randomTopic = AP_MACRO_TOPICS[Math.floor(Math.random() * AP_MACRO_TOPICS.length)];
        console.log(`[FetchTrivia] Requesting question for topic: ${randomTopic}`);
        promises.push(generateEconomicsQuestion({ topic: randomTopic }));
      }
      const results = await Promise.allSettled(promises);
      const newQuestions = results
        .filter(r => {
          if (r.status === 'rejected') console.error("[FetchTrivia] Promise rejected:", r.reason);
          return r.status === 'fulfilled';
        })
        .map(r => (r as PromiseFulfilledResult<BaseQuestionOutput>).value);

      setTriviaQuestionQueue(prev => {
        const combined = [...prev, ...newQuestions];
        const finalQueue = combined.slice(-MAX_QUESTION_QUEUE_SIZE);
        console.log(`[FetchTrivia] Fetched ${newQuestions.length} new questions. New queue size: ${finalQueue.length}`);
        return finalQueue;
      });
    } catch (error) {
      console.error("[FetchTrivia] Error fetching trivia questions:", error);
    } finally {
      setIsFetchingTrivia(false);
    }
  }, [isFetchingTrivia, triviaQuestionQueue.length]);

  const fetchCauseEffectQuestions = useCallback(async (count: number) => {
    if (isFetchingCauseEffect || count <= 0 || causeEffectQuestionQueue.length >= MAX_QUESTION_QUEUE_SIZE) return;
    setIsFetchingCauseEffect(true);
    console.log(`[FetchCauseEffect] Attempting to fetch ${count} cause-effect questions. Current queue size: ${causeEffectQuestionQueue.length}`);
    try {
      const promises = [];
      for (let i = 0; i < count; i++) {
        const randomCondition = ECONOMIC_CONDITIONS[Math.floor(Math.random() * ECONOMIC_CONDITIONS.length)];
        console.log(`[FetchCauseEffect] Requesting question for condition: ${randomCondition}`);
        promises.push(generateCauseEffectQuestion({ economicCondition: randomCondition }));
      }
      const results = await Promise.allSettled(promises);
      const newQuestions = results
        .filter(r => {
          if (r.status === 'rejected') console.error("[FetchCauseEffect] Promise rejected:", r.reason);
          return r.status === 'fulfilled';
        })
        .map(r => (r as PromiseFulfilledResult<BaseQuestionOutput>).value);

      setCauseEffectQuestionQueue(prev => {
        const combined = [...prev, ...newQuestions];
        const finalQueue = combined.slice(-MAX_QUESTION_QUEUE_SIZE);
        console.log(`[FetchCauseEffect] Fetched ${newQuestions.length} new questions. New queue size: ${finalQueue.length}`);
        return finalQueue;
      });
    } catch (error) {
      console.error("[FetchCauseEffect] Error fetching cause-effect questions:", error);
    } finally {
      setIsFetchingCauseEffect(false);
    }
  }, [isFetchingCauseEffect, causeEffectQuestionQueue.length]);

  const spawnMonster = useCallback((count = 1) => {
    setMonsters(prevMonsters => {
      const newMonstersList: MonsterInstance[] = [];
      for (let i = 0; i < count; i++) {
        const type = Math.random() < 0.5 ? MonsterType.TRIVIA : MonsterType.CAUSE_EFFECT;
        const spawnPadding = MONSTER_SIZE / 2; // Allows spawning closer to edges
        let x, y;
        // Determine spawn edge (0: top, 1: bottom, 2: left, 3: right)
        const edge = Math.floor(Math.random() * 4);
        switch (edge) {
          case 0: // Top edge
            x = Math.random() * (WORLD_WIDTH - MONSTER_SIZE - spawnPadding * 2) + spawnPadding;
            y = spawnPadding;
            break;
          case 1: // Bottom edge
            x = Math.random() * (WORLD_WIDTH - MONSTER_SIZE - spawnPadding * 2) + spawnPadding;
            y = WORLD_HEIGHT - MONSTER_SIZE - spawnPadding;
            break;
          case 2: // Left edge
            x = spawnPadding;
            y = Math.random() * (WORLD_HEIGHT - MONSTER_SIZE - spawnPadding * 2) + spawnPadding;
            break;
          case 3: // Right edge
            x = WORLD_WIDTH - MONSTER_SIZE - spawnPadding;
            y = Math.random() * (WORLD_HEIGHT - MONSTER_SIZE - spawnPadding * 2) + spawnPadding;
            break;
          default: // Fallback to random, though should not be reached
            x = Math.random() * (WORLD_WIDTH - MONSTER_SIZE - spawnPadding * 2) + spawnPadding;
            y = Math.random() * (WORLD_HEIGHT - MONSTER_SIZE - spawnPadding * 2) + spawnPadding;
            break;
        }

        newMonstersList.push({
          id: `m-${Date.now()}-${Math.random()}`,
          type, x, y,
          nextShotDecisionTime: Date.now() + (Math.random() * MONSTER_SHOOT_INTERVAL_RANDOM + MONSTER_SHOOT_INTERVAL_BASE),
          isPreparingToShoot: false,
        });
      }
      if (newMonstersList.length > 0) {
        console.log(`[SpawnMonster] Spawned ${newMonstersList.length} monster(s). Total: ${prevMonsters.length + newMonstersList.length}`);
      }
      return [...prevMonsters, ...newMonstersList];
    });
  }, []);

  const resetGameState = useCallback(() => {
    console.log("[ResetGameState] Resetting game state...");
    setPlayerState({ x: INITIAL_PLAYER_X, y: INITIAL_PLAYER_Y });
    setMonsters([]);
    setProjectiles([]);
    setPlayerProjectiles([]);
    setScore(0);
    setTimeSurvived(0);
    setMonstersKilled(0);
    setCurrentQuestionContext(null);
    setGameOverData(null);
    setIsPlayerHit(false);
    pressedKeys.current.clear();
    
    setCurrentMonsterSpawnBatchSize(INITIAL_MONSTER_SPAWN_BATCH_SIZE);
    lastMonsterSpawnTime.current = Date.now(); 
    isProcessingHit.current = false;

    setTriviaQuestionQueue([]);
    setCauseEffectQuestionQueue([]);
    setIsFetchingTrivia(false);
    setIsFetchingCauseEffect(false);
    
    if (gameStatusRef.current === 'playing' || gameStatus === 'playing') { 
        console.log("[ResetGameState] Game is playing, fetching initial questions.");
        fetchTriviaQuestions(MAX_QUESTION_QUEUE_SIZE);
        fetchCauseEffectQuestions(MAX_QUESTION_QUEUE_SIZE);
    }

    // Spawn initial batch of monsters
    spawnMonster(INITIAL_MONSTER_SPAWN_BATCH_SIZE);

  }, [spawnMonster, fetchTriviaQuestions, fetchCauseEffectQuestions, gameStatus]);

  const handleEndGameFlow = async (finalScore: number, finalTimeSurvived: number, finalMonstersKilled: number, failedQ?: GameOverData['failedQuestion']) => {
    console.log(`[HandleEndGameFlow] Score: ${finalScore}, Time: ${finalTimeSurvived}, Killed: ${finalMonstersKilled}`);
    const currentGameOverData: GameOverData = {
        score: finalScore,
        timeSurvived: Math.floor(finalTimeSurvived * SCORE_INCREMENT_INTERVAL / 1000),
        monstersKilled: finalMonstersKilled,
        failedQuestion: failedQ,
    };
    setGameOverData(currentGameOverData);

    if (finalScore > 0) {
      console.log("[HandleEndGameFlow] Score > 0, prompting for username.");
      setGameStatus('prompting_username');
    } else {
      console.log("[HandleEndGameFlow] Score is 0, going to game over screen.");
      setGameStatus('game_over');
    }
  };

  const submitScoreToLeaderboard = async (name: string, currentScore: number, currentGameOverData: GameOverData) => {
    console.log(`[SubmitScore] Submitting score for ${name} with score ${currentScore}`);
    try {
      const response = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, score: currentScore }),
      });
      
      const responseText = await response.text(); 
      console.log('[SubmitScore] API Response Status:', response.status);
      console.log('[SubmitScore] API Response Text:', responseText);

      if (response.ok) {
        const updatedLeaderboard: LeaderboardEntry[] = JSON.parse(responseText);
        console.log('[SubmitScore] Successfully submitted. Updated leaderboard (first 3):', updatedLeaderboard.slice(0,3));
        const rank = updatedLeaderboard.findIndex(entry => entry.name === name && entry.score === currentScore) + 1;
        console.log(`[SubmitScore] Calculated rank: ${rank}`);
        setGameOverData({ ...currentGameOverData, rank: rank > 0 ? rank : undefined });
      } else {
        console.error(`[SubmitScore] Failed to submit score. Server responded with status ${response.status} and text: ${responseText}`);
        setGameOverData({ ...currentGameOverData, rank: undefined }); 
      }
    } catch (error) {
      console.error('[SubmitScore] Error submitting score to leaderboard:', error);
      setGameOverData({ ...currentGameOverData, rank: undefined });
    }
  };

  const handleUsernameSubmit = async (name: string) => {
    console.log(`[HandleUsernameSubmit] Username submitted: ${name}`);
    if (gameOverData) {
      await submitScoreToLeaderboard(name, gameOverData.score, gameOverData);
    }
    setGameStatus('game_over');
  };

  const handleSkipUsernamePrompt = () => {
    console.log("[HandleSkipUsernamePrompt] User skipped username prompt.");
    setGameStatus('game_over');
  };


  const handleProjectileHit = useCallback(async (projectile: ProjectileInstance) => {
    if (isProcessingHit.current || gameStatusRef.current === 'question' || gameStatusRef.current === 'game_over' || gameStatusRef.current === 'prompting_username') {
      return;
    }
    console.log(`[HandleProjectileHit] Player hit by projectile ${projectile.id} from monster ${projectile.monsterId} (type: ${projectile.monsterType})`);
    isProcessingHit.current = true;
    setIsPlayerHit(true); 
    setGameStatus('question'); // Freeze game immediately

    setTimeout(async () => {
      setIsPlayerHit(false); // Turn off red flash right before showing modal

      let questionData: BaseQuestionOutput | undefined;
      const monsterType = projectile.monsterType;
      console.log(`[HandleProjectileHit] Delay ended. Fetching question for type: ${monsterType}`);

      if (monsterType === MonsterType.TRIVIA) {
        questionData = triviaQuestionQueue[0];
        if (questionData) {
          setTriviaQuestionQueue(prev => prev.slice(1));
          console.log("[HandleProjectileHit] Used question from trivia queue. New queue size:", triviaQuestionQueue.length -1);
        }
      } else {
        questionData = causeEffectQuestionQueue[0];
        if (questionData) {
          setCauseEffectQuestionQueue(prev => prev.slice(1));
          console.log("[HandleProjectileHit] Used question from cause-effect queue. New queue size:", causeEffectQuestionQueue.length -1);
        }
      }

      if (monsterType === MonsterType.TRIVIA && triviaQuestionQueue.length -1 < MIN_QUESTION_QUEUE_SIZE && !isFetchingTrivia) {
          console.log("[HandleProjectileHit] Trivia queue low, fetching more.");
          fetchTriviaQuestions(1);
      } else if (monsterType === MonsterType.CAUSE_EFFECT && causeEffectQuestionQueue.length -1 < MIN_QUESTION_QUEUE_SIZE && !isFetchingCauseEffect) {
          console.log("[HandleProjectileHit] Cause-effect queue low, fetching more.");
          fetchCauseEffectQuestions(1);
      }

      if (!questionData) {
        console.warn(`[HandleProjectileHit] Queue empty for ${monsterType}, fetching on demand.`);
        try {
          if (monsterType === MonsterType.TRIVIA) {
            const randomTopic = AP_MACRO_TOPICS[Math.floor(Math.random() * AP_MACRO_TOPICS.length)];
            questionData = await generateEconomicsQuestion({ topic: randomTopic });
          } else {
            const randomCondition = ECONOMIC_CONDITIONS[Math.floor(Math.random() * ECONOMIC_CONDITIONS.length)];
            questionData = await generateCauseEffectQuestion({ economicCondition: randomCondition });
          }
          console.log("[HandleProjectileHit] Fetched question on demand:", questionData?.question);
        } catch (error) {
          console.error("[HandleProjectileHit] Error generating question on demand:", error);
          handleEndGameFlow(score, timeSurvived, monstersKilled, { questionText: "AI Error generating question.", correctAnswerText: "N/A"});
          isProcessingHit.current = false; 
          return;
        }
      }

      if (questionData) {
        const { newChoices, newCorrectIndex } = shuffleChoicesAndUpdateIndex(
          questionData.choices,
          questionData.correctAnswerIndex
        );
        const finalQuestionData: BaseQuestionOutput = {
          ...questionData,
          choices: newChoices,
          correctAnswerIndex: newCorrectIndex,
        };
        setCurrentQuestionContext({
          monsterId: projectile.monsterId,
          projectileId: projectile.id,
          questionData: finalQuestionData,
          monsterType: projectile.monsterType,
        });
        console.log("[HandleProjectileHit] Question context set for modal:", finalQuestionData.question);
      } else {
        console.error("[HandleProjectileHit] Failed to obtain a question for the player.");
        handleEndGameFlow(score, timeSurvived, monstersKilled, { questionText: "System Error: No question available.", correctAnswerText: "N/A"});
      }
    }, 1000); 

  }, [triviaQuestionQueue, causeEffectQuestionQueue, score, timeSurvived, monstersKilled, fetchTriviaQuestions, fetchCauseEffectQuestions, isFetchingTrivia, isFetchingCauseEffect]);

  useEffect(() => {
    if (gameStatus !== 'question') {
        isProcessingHit.current = false;
    }
}, [gameStatus]);


  const startGame = () => {
    console.log("[StartGame] Starting game...");
    resetGameState(); 
    setGameStatus('playing'); 
  };

  useEffect(() => {
    if (gameStatus === 'playing' && triviaQuestionQueue.length < MIN_QUESTION_QUEUE_SIZE && !isFetchingTrivia) {
        const numToFetch = MAX_QUESTION_QUEUE_SIZE - triviaQuestionQueue.length;
        if (numToFetch > 0) {
          console.log(`[EffectTriviaQueue] Trivia queue below min (${triviaQuestionQueue.length}/${MIN_QUESTION_QUEUE_SIZE}), fetching ${numToFetch}.`);
          fetchTriviaQuestions(numToFetch);
        }
    }
  }, [triviaQuestionQueue.length, isFetchingTrivia, gameStatus, fetchTriviaQuestions]);

  useEffect(() => {
    if (gameStatus === 'playing' && causeEffectQuestionQueue.length < MIN_QUESTION_QUEUE_SIZE && !isFetchingCauseEffect) {
         const numToFetch = MAX_QUESTION_QUEUE_SIZE - causeEffectQuestionQueue.length;
         if (numToFetch > 0) {
           console.log(`[EffectCauseEffectQueue] Cause-effect queue below min (${causeEffectQuestionQueue.length}/${MIN_QUESTION_QUEUE_SIZE}), fetching ${numToFetch}.`);
           fetchCauseEffectQuestions(numToFetch);
         }
    }
  }, [causeEffectQuestionQueue.length, isFetchingCauseEffect, gameStatus, fetchCauseEffectQuestions]);


  useEffect(() => {
    if (gameStatusRef.current !== 'playing') return;

    const gameLoop = requestAnimationFrame(() => {
      const now = Date.now();

      setPlayerState(prev => {
        let newX = prev.x;
        let newY = prev.y;
        if (pressedKeys.current.has(KEY_BINDINGS.LEFT) || pressedKeys.current.has(KEY_BINDINGS.A)) newX -= PLAYER_SPEED;
        if (pressedKeys.current.has(KEY_BINDINGS.RIGHT) || pressedKeys.current.has(KEY_BINDINGS.D)) newX += PLAYER_SPEED;
        if (pressedKeys.current.has(KEY_BINDINGS.UP) || pressedKeys.current.has(KEY_BINDINGS.W)) newY -= PLAYER_SPEED;
        if (pressedKeys.current.has(KEY_BINDINGS.DOWN) || pressedKeys.current.has(KEY_BINDINGS.S)) newY += PLAYER_SPEED;

        newX = Math.max(0, Math.min(WORLD_WIDTH - PLAYER_SIZE, newX));
        newY = Math.max(0, Math.min(WORLD_HEIGHT - PLAYER_SIZE, newY));
        return { x: newX, y: newY };
      });

      setMonsters(prevMonsters => prevMonsters.map(monster => {
        const angleToPlayer = Math.atan2(playerState.y - monster.y, playerState.x - monster.x);
        const randomAngleOffset = (Math.random() - 0.5) * (Math.PI / 3); 
        const moveAngle = angleToPlayer + randomAngleOffset;

        let newMonsterX = monster.x + Math.cos(moveAngle) * MONSTER_SPEED;
        let newMonsterY = monster.y + Math.sin(moveAngle) * MONSTER_SPEED;

        newMonsterX = Math.max(0, Math.min(WORLD_WIDTH - MONSTER_SIZE, newMonsterX));
        newMonsterY = Math.max(0, Math.min(WORLD_HEIGHT - MONSTER_SIZE, newMonsterY));

        let updatedMonster = { ...monster, x: newMonsterX, y: newMonsterY };

        if (!updatedMonster.isPreparingToShoot && now >= updatedMonster.nextShotDecisionTime - MONSTER_CHARGE_DURATION) {
            updatedMonster.isPreparingToShoot = true;
        }

        if (updatedMonster.isPreparingToShoot && now >= updatedMonster.nextShotDecisionTime) {
          const baseAngleToPlayer = Math.atan2(playerState.y - updatedMonster.y, playerState.x - updatedMonster.x);
          
          // Create two projectiles with different spreads
          const spread1 = (Math.random() - 0.5) * MONSTER_PROJECTILE_SPREAD_ANGLE;
          const spread2 = (Math.random() - 0.5) * MONSTER_PROJECTILE_SPREAD_ANGLE; // Can be the same, or make it distinct
                                                                                     // e.g., ensure spread2 has a different sign or magnitude

          const projectileAngle1 = baseAngleToPlayer + spread1;
          const projectileAngle2 = baseAngleToPlayer + spread2;

          const newProjectiles: ProjectileInstance[] = [
            {
              id: `p1-${Date.now()}-${Math.random()}`,
              monsterId: updatedMonster.id,
              monsterType: updatedMonster.type,
              x: updatedMonster.x + MONSTER_SIZE / 2,
              y: updatedMonster.y + MONSTER_SIZE / 2,
              angle: projectileAngle1
            },
            {
              id: `p2-${Date.now()}-${Math.random()}`,
              monsterId: updatedMonster.id,
              monsterType: updatedMonster.type,
              x: updatedMonster.x + MONSTER_SIZE / 2,
              y: updatedMonster.y + MONSTER_SIZE / 2,
              angle: projectileAngle2
            }
          ];

          setProjectiles(prevProj => [...prevProj, ...newProjectiles]);
          updatedMonster.isPreparingToShoot = false;
          updatedMonster.nextShotDecisionTime = now + (Math.random() * MONSTER_SHOOT_INTERVAL_RANDOM) + MONSTER_SHOOT_INTERVAL_BASE;
        }
        return updatedMonster;
      }));

      setProjectiles(prevProj => prevProj.filter(p => {
        if (!p) return false;
        p.x += PROJECTILE_SPEED * Math.cos(p.angle);
        p.y += PROJECTILE_SPEED * Math.sin(p.angle);

        if (p.x < 0 || p.x > WORLD_WIDTH || p.y < 0 || p.y > WORLD_HEIGHT) return false;

        const dx = p.x - (playerState.x + PLAYER_SIZE / 2);
        const dy = p.y - (playerState.y + PLAYER_SIZE / 2);
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < PROJECTILE_SIZE / 2 + PLAYER_SIZE / 2) {
          if (!isProcessingHit.current) {
            handleProjectileHit(p);
          }
          return false;
        }
        return true;
      }));

      setPlayerProjectiles(prevPlayerProj => {
        const updatedProjectiles = prevPlayerProj.map(p => ({
          ...p,
          x: p.x + PLAYER_PROJECTILE_SPEED * Math.cos(p.angle),
          y: p.y + PLAYER_PROJECTILE_SPEED * Math.sin(p.angle),
        }));

        const remainingProjectiles: PlayerProjectileInstance[] = [];
        const hitMonsterIds = new Set<string>();

        for (const p of updatedProjectiles) {
          if (p.x < 0 || p.x > WORLD_WIDTH || p.y < 0 || p.y > WORLD_HEIGHT) {
            continue;
          }

          let hit = false;
          for (const monster of monsters) {
            if (hitMonsterIds.has(monster.id)) continue;

            const dx = p.x - (monster.x + MONSTER_SIZE / 2);
            const dy = p.y - (monster.y + MONSTER_SIZE / 2);
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < PLAYER_PROJECTILE_SIZE / 2 + MONSTER_SIZE / 2) {
              hit = true;
              hitMonsterIds.add(monster.id);
              setScore(prev => prev + 25);
              break;
            }
          }
          if (!hit) {
            remainingProjectiles.push(p);
          }
        }

        if (hitMonsterIds.size > 0) {
          setMonsters(prev => {
            const newMonstersList = prev.filter(m => !hitMonsterIds.has(m.id));
            const killedCount = prev.length - newMonstersList.length;
            if (killedCount > 0) {
              setMonstersKilled(prevKilled => prevKilled + killedCount);
            }
            return newMonstersList;
          });
        }
        return remainingProjectiles;
      });


      if (now - lastMonsterSpawnTime.current > MONSTER_SPAWN_CYCLE_INTERVAL) {
        spawnMonster(currentMonsterSpawnBatchSize);
        lastMonsterSpawnTime.current = now;
        setCurrentMonsterSpawnBatchSize(prev => prev + MONSTER_SPAWN_BATCH_INCREMENT);
        console.log(`[GameLoop] Spawned wave of ${currentMonsterSpawnBatchSize}. Next wave size: ${currentMonsterSpawnBatchSize + MONSTER_SPAWN_BATCH_INCREMENT}`);
      }
    });

    return () => cancelAnimationFrame(gameLoop);
  }, [gameStatus, playerState.x, playerState.y, monsters, projectiles, playerProjectiles, spawnMonster, handleProjectileHit, currentMonsterSpawnBatchSize]);


  const handleAnswer = (isCorrect: boolean) => {
    if (!currentQuestionContext) return;
    console.log(`[HandleAnswer] Answer submitted. Correct: ${isCorrect}`);
    setIsPlayerHit(false); // Turn off red flash as modal closes

    if (isCorrect) {
      setMonsters(prev => {
        const monsterExists = prev.some(m => m.id === currentQuestionContext.monsterId);
        if (monsterExists) {
            setMonstersKilled(killed => killed + 1);
        }
        return prev
          .filter(m => m.id !== currentQuestionContext.monsterId)
          .map(monster => ({ 
            ...monster,
            nextShotDecisionTime: Date.now() + (Math.random() * MONSTER_SHOOT_INTERVAL_RANDOM) + MONSTER_SHOOT_INTERVAL_BASE,
            isPreparingToShoot: false,
          }));
      });
      setScore(prev => prev + 50);
      setProjectiles([]); 
      setCurrentQuestionContext(null);
      setGameStatus('playing');
      console.log("[HandleAnswer] Correct. Resuming game. Monster projectiles cleared. Monsters' shot timers reset.");
    } else {
      const qData = currentQuestionContext.questionData;
      const correctAnswerText = qData.choices[qData.correctAnswerIndex];
      setCurrentQuestionContext(null);
      console.log("[HandleAnswer] Incorrect. Ending game flow.");
      handleEndGameFlow(score, timeSurvived, monstersKilled, { questionText: qData.question, correctAnswerText, explanationText: qData.explanation });
    }
  };

  const handleGameAreaClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (gameStatusRef.current !== 'playing' || !gameAreaRef.current) return;

    const rect = gameAreaRef.current.getBoundingClientRect();
    const clickXInViewport = event.clientX - rect.left;
    const clickYInViewport = event.clientY - rect.top;

    const playerScreenX = VIEWPORT_WIDTH / 2;
    const playerScreenY = VIEWPORT_HEIGHT / 2;

    const angle = Math.atan2(clickYInViewport - playerScreenY, clickXInViewport - playerScreenX);

    setPlayerProjectiles(prev => [...prev, {
      id: `pp-${Date.now()}-${Math.random()}`,
      x: playerState.x + PLAYER_SIZE / 2,
      y: playerState.y + PLAYER_SIZE / 2,
      angle,
    }]);
  };

  useEffect(() => {
    if (gameStatusRef.current !== 'playing') return;
    const interval = setInterval(() => {
      setScore(prev => prev + SCORE_INCREMENT_AMOUNT);
      setTimeSurvived(prev => prev + 1);
    }, SCORE_INCREMENT_INTERVAL);
    return () => clearInterval(interval);
  }, [gameStatus]); 

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStatusRef.current !== 'playing') return; 

      if (typeof e.key !== 'string') return;

      let canonicalKeyPressed: string | undefined = undefined;
      const keyLower = e.key.toLowerCase();

      for (const bindingKey in KEY_BINDINGS) {
        const bindingValue = KEY_BINDINGS[bindingKey as keyof typeof KEY_BINDINGS];
        if (bindingValue.length === 1 && bindingValue.toLowerCase() === keyLower) { 
          canonicalKeyPressed = bindingValue;
          break;
        }
        if (bindingValue.length > 1 && bindingValue === e.key) { 
          canonicalKeyPressed = bindingValue;
          break;
        }
      }

      if (canonicalKeyPressed) {
        e.preventDefault();
        pressedKeys.current.add(canonicalKeyPressed);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (gameStatusRef.current !== 'playing') return; 

      if (typeof e.key !== 'string') return;

      let canonicalReleasedKey: string | undefined = undefined;
      const keyLower = e.key.toLowerCase();

      for (const bindingKey in KEY_BINDINGS) {
        const bindingValue = KEY_BINDINGS[bindingKey as keyof typeof KEY_BINDINGS];
        if (bindingValue.length === 1 && bindingValue.toLowerCase() === keyLower) {
            canonicalReleasedKey = bindingValue;
            break;
        }
        if (bindingValue.length > 1 && bindingValue === e.key) {
            canonicalReleasedKey = bindingValue;
            break;
        }
      }

      if (canonicalReleasedKey) {
        e.preventDefault();
        pressedKeys.current.delete(canonicalReleasedKey);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []); 


  const worldOffsetX = VIEWPORT_WIDTH / 2 - playerState.x;
  const worldOffsetY = VIEWPORT_HEIGHT / 2 - playerState.y;

  const gameAreaDynamicStyle = {
    backgroundPositionX: `${worldOffsetX % 32}px`,
    backgroundPositionY: `${worldOffsetY % 32}px`,
  };

  const boundaryThickness = 4;


  if (gameStatus === 'start_screen') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-8">
        <h1 className="text-6xl font-bold text-primary mb-4" style={{fontFamily: "'Press Start 2P', cursive"}}>EcoRoam</h1>
        <p className="text-xl mb-8 text-center max-w-md">Navigate the treacherous lands of economics! Answer questions to defeat monsters and survive. Click to shoot.</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button onClick={startGame} size="lg" className="px-12 py-6 text-2xl bg-primary hover:bg-primary/90 text-primary-foreground">
            Start Game
          </Button>
          <Button
            onClick={() => router.push('/leaderboard')}
            size="lg"
            variant="outline"
            className="px-12 py-6 text-2xl"
          >
            View Leaderboard
          </Button>
        </div>
         <p className="mt-8 text-sm text-muted-foreground">Controls: Arrow Keys or WASD to move. Mouse Click to shoot.</p>
         <p className="mt-4 text-xs text-muted-foreground">Made by Jayden Lim & Aidan Chan P2</p>
      </div>
    );
  }

  const displayedTimeSurvived = Math.floor(timeSurvived * SCORE_INCREMENT_INTERVAL / 1000);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4 select-none">
      <div
        ref={gameAreaRef}
        className="relative pixelated-ground shadow-2xl overflow-hidden border-4 border-border"
        style={{
          width: VIEWPORT_WIDTH,
          height: VIEWPORT_HEIGHT,
          imageRendering: 'pixelated',
          ...gameAreaDynamicStyle
        }}
        onClick={handleGameAreaClick}
      >
        {isPlayerHit && (
          <div
            className="absolute inset-0 bg-destructive/40 pointer-events-none"
            style={{ zIndex: 500 }}
          ></div>
        )}
        <div
          className="absolute"
          style={{
            left: `${worldOffsetX}px`,
            top: `${worldOffsetY}px`,
            width: `${WORLD_WIDTH}px`,
            height: `${WORLD_HEIGHT}px`,
          }}
        >
          {/* World Boundaries */}
          <div
            className="absolute bg-black"
            style={{ left: 0, top: 0, width: WORLD_WIDTH, height: boundaryThickness }}
            aria-label="Top Boundary"
          />
          <div
            className="absolute bg-black"
            style={{ left: 0, top: WORLD_HEIGHT - boundaryThickness, width: WORLD_WIDTH, height: boundaryThickness }}
            aria-label="Bottom Boundary"
          />
          <div
            className="absolute bg-black"
            style={{ left: 0, top: 0, width: boundaryThickness, height: WORLD_HEIGHT }}
            aria-label="Left Boundary"
          />
          <div
            className="absolute bg-black"
            style={{ left: WORLD_WIDTH - boundaryThickness, top: 0, width: boundaryThickness, height: WORLD_HEIGHT }}
            aria-label="Right Boundary"
          />

          {monsters.map(monster => (
            <MonsterComponent key={monster.id} monster={monster} />
          ))}
          {projectiles.map(projectile => (
            <ProjectileComponent key={projectile.id} projectile={projectile} />
          ))}
          {playerProjectiles.map(pProjectile => (
            <PlayerProjectileComponent key={pProjectile.id} projectile={pProjectile} />
          ))}
        </div>

        <PlayerComponent />

        <ScoreDisplay score={score} timeSurvived={displayedTimeSurvived} monstersKilled={monstersKilled} />
      </div>

      {gameStatus === 'question' && currentQuestionContext && (
        <QuestionModal questionContext={currentQuestionContext} onAnswer={handleAnswer} />
      )}
      {gameStatus === 'prompting_username' && gameOverData && (
        <UsernamePromptModal 
            onSubmit={handleUsernameSubmit} 
            onSkip={handleSkipUsernamePrompt} 
            currentScore={gameOverData.score} 
        />
      )}
      {gameStatus === 'game_over' && gameOverData && (
        <GameOverScreen gameOverData={gameOverData} onRestart={startGame} onViewLeaderboard={() => router.push('/leaderboard')} />
      )}
      {gameStatus === 'playing' && (
        <p className="mt-4 text-xs text-muted-foreground">Controls: Arrow Keys or WASD to move. Mouse Click to shoot.</p>
      )}
    </main>
  );
}

