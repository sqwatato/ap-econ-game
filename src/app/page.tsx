
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
  MAX_MONSTERS, MONSTER_SPAWN_INTERVAL, PROJECTILE_SIZE, PROJECTILE_SPEED,
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
const USERNAME_STORAGE_KEY = 'ecoRoamUsername';

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
    "significant increase in oil prices affecting production costs"
];


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

  const pressedKeys = useRef<Set<string>>(new Set());
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const lastMonsterSpawnTime = useRef<number>(0);
  const isProcessingHit = useRef<boolean>(false);
  const router = useRouter();
  const gameStatusRef = useRef(gameStatus);

  useEffect(() => {
    gameStatusRef.current = gameStatus;
  }, [gameStatus]);


  const fetchTriviaQuestions = useCallback(async (count: number) => {
    if (isFetchingTrivia || count <= 0 || triviaQuestionQueue.length >= MAX_QUESTION_QUEUE_SIZE) return;
    setIsFetchingTrivia(true);
    try {
      const promises = [];
      for (let i = 0; i < count; i++) {
        const randomTopic = AP_MACRO_TOPICS[Math.floor(Math.random() * AP_MACRO_TOPICS.length)];
        promises.push(generateEconomicsQuestion({ topic: randomTopic }));
      }
      const results = await Promise.allSettled(promises);
      const newQuestions = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<BaseQuestionOutput>).value);

      setTriviaQuestionQueue(prev => {
        const combined = [...prev, ...newQuestions];
        return combined.slice(-MAX_QUESTION_QUEUE_SIZE);
      });
    } catch (error) {
      console.error("Error fetching trivia questions:", error);
    } finally {
      setIsFetchingTrivia(false);
    }
  }, [isFetchingTrivia, triviaQuestionQueue.length]);

  const fetchCauseEffectQuestions = useCallback(async (count: number) => {
    if (isFetchingCauseEffect || count <= 0 || causeEffectQuestionQueue.length >= MAX_QUESTION_QUEUE_SIZE) return;
    setIsFetchingCauseEffect(true);
    try {
      const promises = [];
      for (let i = 0; i < count; i++) {
        const randomCondition = ECONOMIC_CONDITIONS[Math.floor(Math.random() * ECONOMIC_CONDITIONS.length)];
        promises.push(generateCauseEffectQuestion({ economicCondition: randomCondition }));
      }
      const results = await Promise.allSettled(promises);
      const newQuestions = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<BaseQuestionOutput>).value);

      setCauseEffectQuestionQueue(prev => {
        const combined = [...prev, ...newQuestions];
        return combined.slice(-MAX_QUESTION_QUEUE_SIZE);
      });
    } catch (error) {
      console.error("Error fetching cause-effect questions:", error);
    } finally {
      setIsFetchingCauseEffect(false);
    }
  }, [isFetchingCauseEffect, causeEffectQuestionQueue.length]);

  const spawnMonster = useCallback((count = 1) => {
    setMonsters(prevMonsters => {
      const newMonstersList: MonsterInstance[] = [];
      for (let i = 0; i < count; i++) {
        if (prevMonsters.length + newMonstersList.length >= MAX_MONSTERS) break;
        const type = Math.random() < 0.5 ? MonsterType.TRIVIA : MonsterType.CAUSE_EFFECT;
        const spawnPadding = MONSTER_SIZE * 2;
        const x = Math.random() * (WORLD_WIDTH - MONSTER_SIZE - spawnPadding * 2) + spawnPadding;
        const y = Math.random() * (WORLD_HEIGHT - MONSTER_SIZE - spawnPadding * 2) + spawnPadding;
        newMonstersList.push({
          id: `m-${Date.now()}-${Math.random()}`,
          type, x, y,
          nextShotDecisionTime: Date.now() + (Math.random() * MONSTER_SHOOT_INTERVAL_RANDOM + MONSTER_SHOOT_INTERVAL_BASE),
          isPreparingToShoot: false,
        });
      }
      return [...prevMonsters, ...newMonstersList];
    });
  }, []);

  const resetGameState = useCallback(() => {
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
    lastMonsterSpawnTime.current = Date.now();
    isProcessingHit.current = false;

    setTriviaQuestionQueue([]);
    setCauseEffectQuestionQueue([]);
    setIsFetchingTrivia(false);
    setIsFetchingCauseEffect(false);

    // Fetch initial questions when game state is reset (usually on start game)
    fetchTriviaQuestions(MAX_QUESTION_QUEUE_SIZE);
    fetchCauseEffectQuestions(MAX_QUESTION_QUEUE_SIZE);

    setTimeout(() => spawnMonster(Math.floor(MAX_MONSTERS / 2) || 1), 100);
  }, [spawnMonster, fetchTriviaQuestions, fetchCauseEffectQuestions]);

  const handleEndGameFlow = async (finalScore: number, finalTimeSurvived: number, finalMonstersKilled: number, failedQ?: GameOverData['failedQuestion']) => {
    const storedUsername = localStorage.getItem(USERNAME_STORAGE_KEY);
    const currentGameOverData: GameOverData = {
        score: finalScore,
        timeSurvived: Math.floor(finalTimeSurvived * SCORE_INCREMENT_INTERVAL / 1000),
        monstersKilled: finalMonstersKilled,
        failedQuestion: failedQ,
    };
    setGameOverData(currentGameOverData);

    if (finalScore > 0 && !storedUsername) {
      setGameStatus('prompting_username');
    } else if (finalScore > 0 && storedUsername) {
      await submitScoreToLeaderboard(storedUsername, finalScore, currentGameOverData);
      setGameStatus('game_over');
    } else {
      setGameStatus('game_over');
    }
  };

  const submitScoreToLeaderboard = async (name: string, currentScore: number, currentGameOverData: GameOverData) => {
    try {
      const response = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, score: currentScore }),
      });
      if (response.ok) {
        const updatedLeaderboard: LeaderboardEntry[] = await response.json();
        const rank = updatedLeaderboard.findIndex(entry => entry.name === name && entry.score === currentScore) + 1;
        setGameOverData({ ...currentGameOverData, rank: rank > 0 ? rank : undefined });
      } else {
        console.error('Failed to submit score:', await response.text());
      }
    } catch (error) {
      console.error('Error submitting score:', error);
    }
  };

  const handleUsernameSubmit = async (name: string) => {
    localStorage.setItem(USERNAME_STORAGE_KEY, name);
    if (gameOverData) {
      await submitScoreToLeaderboard(name, gameOverData.score, gameOverData);
    }
    setGameStatus('game_over');
  };


  const handleProjectileHit = useCallback(async (projectile: ProjectileInstance) => {
    if (isProcessingHit.current || gameStatusRef.current === 'question' || gameStatusRef.current === 'game_over' || gameStatusRef.current === 'prompting_username') {
      return;
    }
    isProcessingHit.current = true;
    setIsPlayerHit(true); // Turn on red flash
    setGameStatus('question'); // Freeze game immediately

    setTimeout(async () => {
      setIsPlayerHit(false); // Turn off red flash right before showing question modal

      let questionData: BaseQuestionOutput | undefined;
      const monsterType = projectile.monsterType;

      if (monsterType === MonsterType.TRIVIA) {
        questionData = triviaQuestionQueue[0];
        if (questionData) {
          setTriviaQuestionQueue(prev => prev.slice(1));
        }
      } else {
        questionData = causeEffectQuestionQueue[0];
        if (questionData) {
          setCauseEffectQuestionQueue(prev => prev.slice(1));
        }
      }

      if (monsterType === MonsterType.TRIVIA && triviaQuestionQueue.length -1 < MIN_QUESTION_QUEUE_SIZE && !isFetchingTrivia) {
          fetchTriviaQuestions(1);
      } else if (monsterType === MonsterType.CAUSE_EFFECT && causeEffectQuestionQueue.length -1 < MIN_QUESTION_QUEUE_SIZE && !isFetchingCauseEffect) {
          fetchCauseEffectQuestions(1);
      }

      if (!questionData) {
        console.warn(`Queue empty for ${monsterType}, fetching on demand.`);
        try {
          if (monsterType === MonsterType.TRIVIA) {
            const randomTopic = AP_MACRO_TOPICS[Math.floor(Math.random() * AP_MACRO_TOPICS.length)];
            questionData = await generateEconomicsQuestion({ topic: randomTopic });
          } else {
            const randomCondition = ECONOMIC_CONDITIONS[Math.floor(Math.random() * ECONOMIC_CONDITIONS.length)];
            questionData = await generateCauseEffectQuestion({ economicCondition: randomCondition });
          }
        } catch (error) {
          console.error("Error generating question on demand:", error);
          handleEndGameFlow(score, timeSurvived, monstersKilled, { questionText: "AI Error generating question.", correctAnswerText: "N/A"});
          isProcessingHit.current = false;
          return;
        }
      }

      if (questionData) {
        setCurrentQuestionContext({
          monsterId: projectile.monsterId,
          projectileId: projectile.id,
          questionData,
          monsterType: projectile.monsterType,
        });
      } else {
        console.error("Failed to obtain a question for the player.");
        handleEndGameFlow(score, timeSurvived, monstersKilled, { questionText: "System Error: No question available.", correctAnswerText: "N/A"});
        isProcessingHit.current = false;
      }
      // Note: isProcessingHit.current is reset in handleAnswer or if an error path is taken above.
      // Game status remains 'question' until handleAnswer is called.
    }, 1000);

  }, [triviaQuestionQueue, causeEffectQuestionQueue, score, timeSurvived, monstersKilled, fetchTriviaQuestions, fetchCauseEffectQuestions, isFetchingTrivia, isFetchingCauseEffect]);

  useEffect(() => {
    if (gameStatus !== 'question') {
        isProcessingHit.current = false;
    }
    if (gameStatus === 'start_screen' || gameStatus === 'playing') {
        setIsPlayerHit(false);
    }
}, [gameStatus]);


  const startGame = () => {
    resetGameState();
    setGameStatus('playing');
  };

  useEffect(() => {
    if (gameStatus === 'playing' && triviaQuestionQueue.length < MIN_QUESTION_QUEUE_SIZE && !isFetchingTrivia) {
        const numToFetch = MAX_QUESTION_QUEUE_SIZE - triviaQuestionQueue.length;
        if (numToFetch > 0) fetchTriviaQuestions(numToFetch);
    }
  }, [triviaQuestionQueue.length, isFetchingTrivia, gameStatus, fetchTriviaQuestions]);

  useEffect(() => {
    if (gameStatus === 'playing' && causeEffectQuestionQueue.length < MIN_QUESTION_QUEUE_SIZE && !isFetchingCauseEffect) {
         const numToFetch = MAX_QUESTION_QUEUE_SIZE - causeEffectQuestionQueue.length;
         if (numToFetch > 0) fetchCauseEffectQuestions(numToFetch);
    }
  }, [causeEffectQuestionQueue.length, isFetchingCauseEffect, gameStatus, fetchCauseEffectQuestions]);


  useEffect(() => {
    if (gameStatus !== 'playing') return;

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
          const projectileAngle = Math.atan2(playerState.y - updatedMonster.y, playerState.x - updatedMonster.x);
          setProjectiles(prevProj => [...prevProj, {
            id: `p-${Date.now()}-${Math.random()}`,
            monsterId: updatedMonster.id,
            monsterType: updatedMonster.type,
            x: updatedMonster.x + MONSTER_SIZE / 2,
            y: updatedMonster.y + MONSTER_SIZE / 2,
            angle: projectileAngle
          }]);
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


      if (now - lastMonsterSpawnTime.current > MONSTER_SPAWN_INTERVAL && monsters.length < MAX_MONSTERS) {
        spawnMonster(1);
        lastMonsterSpawnTime.current = now;
      }
    });

    return () => cancelAnimationFrame(gameLoop);
  }, [gameStatus, playerState.x, playerState.y, monsters, projectiles, playerProjectiles, spawnMonster, handleProjectileHit]);


  const handleAnswer = (isCorrect: boolean) => {
    if (!currentQuestionContext) return;

    isProcessingHit.current = false;
    setIsPlayerHit(false);

    if (isCorrect) {
      setMonsters(prev => {
        const monsterExists = prev.some(m => m.id === currentQuestionContext.monsterId);
        if (monsterExists) {
            setMonstersKilled(killed => killed + 1);
        }
        return prev
          .filter(m => m.id !== currentQuestionContext.monsterId)
          .map(monster => ({ // Reset remaining monsters' shooting state
            ...monster,
            nextShotDecisionTime: Date.now() + (Math.random() * MONSTER_SHOOT_INTERVAL_RANDOM) + MONSTER_SHOOT_INTERVAL_BASE,
            isPreparingToShoot: false,
          }));
      });
      setScore(prev => prev + 50);
      setProjectiles([]); // Clear monster projectiles
      setCurrentQuestionContext(null);
      setGameStatus('playing');
    } else {
      const qData = currentQuestionContext.questionData;
      const correctAnswerText = qData.choices[qData.correctAnswerIndex];
      setCurrentQuestionContext(null);
      handleEndGameFlow(score, timeSurvived, monstersKilled, { questionText: qData.question, correctAnswerText, explanationText: qData.explanation });
    }
  };

  const handleGameAreaClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (gameStatus !== 'playing' || !gameAreaRef.current) return;

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
    if (gameStatus !== 'playing') return;
    const interval = setInterval(() => {
      setScore(prev => prev + SCORE_INCREMENT_AMOUNT);
      setTimeSurvived(prev => prev + 1);
    }, SCORE_INCREMENT_INTERVAL);
    return () => clearInterval(interval);
  }, [gameStatus]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStatusRef.current !== 'playing') return; // Only process if game is playing

      if (typeof e.key !== 'string') return;

      let canonicalKeyPressed: string | undefined = undefined;
      const keyLower = e.key.toLowerCase();

      for (const bindingKey in KEY_BINDINGS) {
        const bindingValue = KEY_BINDINGS[bindingKey as keyof typeof KEY_BINDINGS];
        if (bindingValue.length === 1 && bindingValue.toLowerCase() === keyLower) { // For 'w', 'a', 's', 'd'
          canonicalKeyPressed = bindingValue;
          break;
        }
        if (bindingValue.length > 1 && bindingValue === e.key) { // For 'ArrowUp', etc.
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
      if (gameStatusRef.current !== 'playing') return; // Only process if game is playing

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
  }, []); // Empty dependency array is correct here as gameStatusRef.current handles the dynamic check

  useEffect(() => {
    if (gameStatus === 'playing' && monsters.length === 0 && MAX_MONSTERS > 0) {
       setTimeout(() => spawnMonster(Math.min(MAX_MONSTERS, Math.floor(MAX_MONSTERS / 2) || 1 )), 100);
       lastMonsterSpawnTime.current = Date.now();
    }
  }, [gameStatus, monsters.length, spawnMonster]);

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
        <UsernamePromptModal onSubmit={handleUsernameSubmit} currentScore={gameOverData.score} />
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

