// src/app/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import PlayerComponent from '@/components/game/Player';
import MonsterComponent from '@/components/game/Monster';
import ProjectileComponent from '@/components/game/Projectile';
import ScoreDisplay from '@/components/game/ScoreDisplay';
import QuestionModal from '@/components/game/QuestionModal';
import GameOverScreen from '@/components/game/GameOverScreen';
import {
  PLAYER_SIZE, PLAYER_SPEED, MONSTER_SIZE, MONSTER_SHOOT_INTERVAL_BASE, MONSTER_SHOOT_INTERVAL_RANDOM,
  MAX_MONSTERS, MONSTER_SPAWN_INTERVAL, PROJECTILE_SIZE, PROJECTILE_SPEED, GAME_AREA_WIDTH,
  GAME_AREA_HEIGHT, SCORE_INCREMENT_INTERVAL, SCORE_INCREMENT_AMOUNT, INITIAL_PLAYER_X, INITIAL_PLAYER_Y,
  MonsterType, KEY_BINDINGS
} from '@/config/game';
import type {
  PlayerState, MonsterInstance, ProjectileInstance, CurrentQuestionContext, GameOverData, BaseQuestionOutput
} from '@/types/game';
import { generateEconomicsQuestion } from '@/ai/flows/generate-economics-question';
import { generateCauseEffectQuestion } from '@/ai/flows/generate-cause-effect-question';
import { Button } from '@/components/ui/button'; // For potential start button

type GameStatus = 'start_screen' | 'playing' | 'question' | 'game_over';

export default function EcoRoamPage() {
  const [playerState, setPlayerState] = useState<PlayerState>({ x: INITIAL_PLAYER_X, y: INITIAL_PLAYER_Y });
  const [monsters, setMonsters] = useState<MonsterInstance[]>([]);
  const [projectiles, setProjectiles] = useState<ProjectileInstance[]>([]);
  const [score, setScore] = useState(0);
  const [timeSurvived, setTimeSurvived] = useState(0); // in seconds
  const [monstersKilled, setMonstersKilled] = useState(0);
  const [gameStatus, setGameStatus] = useState<GameStatus>('start_screen');
  const [currentQuestionContext, setCurrentQuestionContext] = useState<CurrentQuestionContext | null>(null);
  const [gameOverData, setGameOverData] = useState<GameOverData | null>(null);
  
  const pressedKeys = useRef<Set<string>>(new Set());
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const lastMonsterSpawnTime = useRef<number>(0);

  const resetGameState = useCallback(() => {
    setPlayerState({ x: INITIAL_PLAYER_X, y: INITIAL_PLAYER_Y });
    setMonsters([]);
    setProjectiles([]);
    setScore(0);
    setTimeSurvived(0);
    setMonstersKilled(0);
    setCurrentQuestionContext(null);
    setGameOverData(null);
    pressedKeys.current.clear();
    lastMonsterSpawnTime.current = Date.now();
    // Spawn initial monsters after a short delay to allow effect to run
    setTimeout(() => spawnMonster(2), 100); 
  }, []);

  const startGame = () => {
    resetGameState();
    setGameStatus('playing');
  };

  // Monster Spawning Logic
  const spawnMonster = useCallback((count = 1) => {
    setMonsters(prevMonsters => {
      const newMonsters: MonsterInstance[] = [];
      for (let i = 0; i < count; i++) {
        if (prevMonsters.length + newMonsters.length >= MAX_MONSTERS) break;
        const type = Math.random() < 0.5 ? MonsterType.TRIVIA : MonsterType.CAUSE_EFFECT;
        const x = Math.random() * (GAME_AREA_WIDTH - MONSTER_SIZE);
        const y = Math.random() * (GAME_AREA_HEIGHT * 0.6 - MONSTER_SIZE); // Spawn in upper 60%
        newMonsters.push({ id: `m-${Date.now()}-${Math.random()}`, type, x, y, lastShotTime: Date.now() });
      }
      return [...prevMonsters, ...newMonsters];
    });
  }, []);

  // Game Loop
  useEffect(() => {
    if (gameStatus !== 'playing') return;

    const gameLoop = requestAnimationFrame(() => {
      // Player Movement
      setPlayerState(prev => {
        let newX = prev.x;
        let newY = prev.y;
        if (pressedKeys.current.has(KEY_BINDINGS.LEFT) || pressedKeys.current.has(KEY_BINDINGS.A)) newX -= PLAYER_SPEED;
        if (pressedKeys.current.has(KEY_BINDINGS.RIGHT) || pressedKeys.current.has(KEY_BINDINGS.D)) newX += PLAYER_SPEED;
        if (pressedKeys.current.has(KEY_BINDINGS.UP) || pressedKeys.current.has(KEY_BINDINGS.W)) newY -= PLAYER_SPEED;
        if (pressedKeys.current.has(KEY_BINDINGS.DOWN) || pressedKeys.current.has(KEY_BINDINGS.S)) newY += PLAYER_SPEED;

        // Boundary checks
        newX = Math.max(0, Math.min(GAME_AREA_WIDTH - PLAYER_SIZE, newX));
        newY = Math.max(0, Math.min(GAME_AREA_HEIGHT - PLAYER_SIZE, newY));
        return { x: newX, y: newY };
      });

      // Monster Actions (Shooting)
      const now = Date.now();
      setMonsters(prevMonsters => prevMonsters.map(monster => {
        if (now - monster.lastShotTime > MONSTER_SHOOT_INTERVAL_BASE + Math.random() * MONSTER_SHOOT_INTERVAL_RANDOM) {
          const angle = Math.atan2(playerState.y - monster.y, playerState.x - monster.x);
          setProjectiles(prevProj => [...prevProj, {
            id: `p-${Date.now()}-${Math.random()}`,
            monsterId: monster.id,
            monsterType: monster.type,
            x: monster.x + MONSTER_SIZE / 2,
            y: monster.y + MONSTER_SIZE / 2,
            angle
          }]);
          return { ...monster, lastShotTime: now };
        }
        return monster;
      }));

      // Projectile Movement & Collision
      setProjectiles(prevProj => prevProj.filter(p => {
        p.x += PROJECTILE_SPEED * Math.cos(p.angle);
        p.y += PROJECTILE_SPEED * Math.sin(p.angle);

        // Projectile out of bounds
        if (p.x < 0 || p.x > GAME_AREA_WIDTH || p.y < 0 || p.y > GAME_AREA_HEIGHT) return false;

        // Projectile-Player Collision
        if (
          p.x > playerState.x && p.x < playerState.x + PLAYER_SIZE &&
          p.y > playerState.y && p.y < playerState.y + PLAYER_SIZE
        ) {
          handleProjectileHit(p);
          return false; // Remove projectile
        }
        return true;
      }));

      // Spawn new monsters periodically
      if (now - lastMonsterSpawnTime.current > MONSTER_SPAWN_INTERVAL && monsters.length < MAX_MONSTERS) {
        spawnMonster(1);
        lastMonsterSpawnTime.current = now;
      }
    });

    return () => cancelAnimationFrame(gameLoop);
  }, [gameStatus, playerState.x, playerState.y, monsters, spawnMonster]); // Added monsters & spawnMonster to dep array


  const handleProjectileHit = (projectile: ProjectileInstance) => {
    // Defer state updates to prevent "Cannot update a component while rendering another" error.
    // The main logic, including async calls, is now inside the setTimeout callback.
    setTimeout(async () => {
      setGameStatus('question'); 
      try {
        let questionData: BaseQuestionOutput;
        if (projectile.monsterType === MonsterType.TRIVIA) {
          const topics = ["Fiscal Policy", "Monetary Policy", "Supply and Demand", "GDP", "Inflation"];
          const randomTopic = topics[Math.floor(Math.random() * topics.length)];
          questionData = await generateEconomicsQuestion({ topic: randomTopic });
        } else {
          const conditions = ["recessionary gap", "inflationary gap"];
          const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
          questionData = await generateCauseEffectQuestion({ economicCondition: randomCondition });
        }
        setCurrentQuestionContext({
          monsterId: projectile.monsterId,
          projectileId: projectile.id,
          questionData,
          monsterType: projectile.monsterType,
        });
      } catch (error) {
        console.error("Error generating question:", error);
        setGameStatus('game_over'); 
        setGameOverData({ score, timeSurvived, monstersKilled, failedQuestion: { questionText: "AI Error", correctAnswerText: "N/A"} });
      }
    }, 0);
  };

  const handleAnswer = (isCorrect: boolean) => {
    if (!currentQuestionContext) return;

    if (isCorrect) {
      setMonsters(prev => prev.filter(m => m.id !== currentQuestionContext.monsterId));
      setMonstersKilled(prev => prev + 1);
      setScore(prev => prev + 50); // Bonus for correct answer
      setCurrentQuestionContext(null);
      setGameStatus('playing');
    } else {
      const qData = currentQuestionContext.questionData;
      const correctAnswerText = qData.choices[qData.correctAnswerIndex];
      setGameOverData({
        score,
        timeSurvived,
        monstersKilled,
        failedQuestion: {
          questionText: qData.question,
          correctAnswerText: correctAnswerText,
          explanationText: qData.explanation,
        }
      });
      setGameStatus('game_over');
    }
  };


  // Score and Time Update
  useEffect(() => {
    if (gameStatus !== 'playing') return;
    const interval = setInterval(() => {
      setScore(prev => prev + SCORE_INCREMENT_AMOUNT);
      setTimeSurvived(prev => prev + 1);
    }, SCORE_INCREMENT_INTERVAL);
    return () => clearInterval(interval);
  }, [gameStatus]);

  // Keyboard Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (Object.values(KEY_BINDINGS).includes(e.key.toLowerCase()) || Object.values(KEY_BINDINGS).includes(e.key)) {
        e.preventDefault();
        pressedKeys.current.add(e.key.toLowerCase());
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
       if (Object.values(KEY_BINDINGS).includes(e.key.toLowerCase()) || Object.values(KEY_BINDINGS).includes(e.key)) {
        e.preventDefault();
        pressedKeys.current.delete(e.key.toLowerCase());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  
  useEffect(() => { // Ensure monsters are spawned at game start
    if (gameStatus === 'playing' && monsters.length === 0) {
       setTimeout(() => spawnMonster(MAX_MONSTERS / 2), 100); // Spawn initial monsters
       lastMonsterSpawnTime.current = Date.now();
    }
  }, [gameStatus, monsters.length, spawnMonster]);


  if (gameStatus === 'start_screen') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-8">
        <h1 className="text-6xl font-bold text-primary mb-4" style={{fontFamily: "'Press Start 2P', cursive"}}>EcoRoam</h1>
        <p className="text-xl mb-8 text-center max-w-md">Navigate the treacherous lands of economics! Answer questions to defeat monsters and survive.</p>
        <Button onClick={startGame} size="lg" className="px-12 py-6 text-2xl bg-primary hover:bg-primary/90 text-primary-foreground">
          Start Game
        </Button>
         <p className="mt-8 text-sm text-muted-foreground">Controls: Arrow Keys or WASD to move.</p>
      </div>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4 select-none">
      <div
        ref={gameAreaRef}
        className="relative pixelated-ground shadow-2xl overflow-hidden border-4 border-border"
        style={{ width: GAME_AREA_WIDTH, height: GAME_AREA_HEIGHT, imageRendering: 'pixelated' }}
      >
        <PlayerComponent playerState={playerState} />
        {monsters.map(monster => (
          <MonsterComponent key={monster.id} monster={monster} />
        ))}
        {projectiles.map(projectile => (
          <ProjectileComponent key={projectile.id} projectile={projectile} />
        ))}
        <ScoreDisplay score={score} timeSurvived={timeSurvived} />
      </div>

      {gameStatus === 'question' && currentQuestionContext && (
        <QuestionModal questionContext={currentQuestionContext} onAnswer={handleAnswer} />
      )}
      {gameStatus === 'game_over' && gameOverData && (
        <GameOverScreen gameOverData={gameOverData} onRestart={startGame} />
      )}
      {/* Add a small instruction for controls if not on start screen */}
      {gameStatus === 'playing' && (
        <p className="mt-4 text-xs text-muted-foreground">Controls: Arrow Keys or WASD</p>
      )}
    </main>
  );
}