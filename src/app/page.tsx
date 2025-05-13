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
import {
  PLAYER_SIZE, PLAYER_SPEED, MONSTER_SIZE, MONSTER_SPEED, MONSTER_SHOOT_INTERVAL_BASE, MONSTER_SHOOT_INTERVAL_RANDOM,
  MAX_MONSTERS, MONSTER_SPAWN_INTERVAL, PROJECTILE_SIZE, PROJECTILE_SPEED,
  PLAYER_PROJECTILE_SIZE, PLAYER_PROJECTILE_SPEED,
  WORLD_WIDTH, WORLD_HEIGHT, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, // Use new dimensions
  SCORE_INCREMENT_INTERVAL, SCORE_INCREMENT_AMOUNT, INITIAL_PLAYER_X, INITIAL_PLAYER_Y,
  MonsterType, KEY_BINDINGS
} from '@/config/game';
import type {
  PlayerState, MonsterInstance, ProjectileInstance, PlayerProjectileInstance, CurrentQuestionContext, GameOverData, BaseQuestionOutput
} from '@/types/game';
import { generateEconomicsQuestion } from '@/ai/flows/generate-economics-question';
import { generateCauseEffectQuestion } from '@/ai/flows/generate-cause-effect-question';
import { Button } from '@/components/ui/button';

type GameStatus = 'start_screen' | 'playing' | 'question' | 'game_over';

export default function EcoRoamPage() {
  const [playerState, setPlayerState] = useState<PlayerState>({ x: INITIAL_PLAYER_X, y: INITIAL_PLAYER_Y });
  const [monsters, setMonsters] = useState<MonsterInstance[]>([]);
  const [projectiles, setProjectiles] = useState<ProjectileInstance[]>([]); // Monster projectiles
  const [playerProjectiles, setPlayerProjectiles] = useState<PlayerProjectileInstance[]>([]);
  const [score, setScore] = useState(0);
  const [timeSurvived, setTimeSurvived] = useState(0);
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
    setPlayerProjectiles([]);
    setScore(0);
    setTimeSurvived(0);
    setMonstersKilled(0);
    setCurrentQuestionContext(null);
    setGameOverData(null);
    pressedKeys.current.clear();
    lastMonsterSpawnTime.current = Date.now();
    setTimeout(() => spawnMonster(MAX_MONSTERS / 2 > 1 ? MAX_MONSTERS / 2 : 2), 100); 
  }, []);

  const startGame = () => {
    resetGameState();
    setGameStatus('playing');
  };

  const spawnMonster = useCallback((count = 1) => {
    setMonsters(prevMonsters => {
      const newMonsters: MonsterInstance[] = [];
      for (let i = 0; i < count; i++) {
        if (prevMonsters.length + newMonsters.length >= MAX_MONSTERS) break;
        const type = Math.random() < 0.5 ? MonsterType.TRIVIA : MonsterType.CAUSE_EFFECT;
        // Spawn monsters within world boundaries, avoid edges if desired
        const spawnPadding = MONSTER_SIZE * 2;
        const x = Math.random() * (WORLD_WIDTH - MONSTER_SIZE * 2 - spawnPadding * 2) + spawnPadding;
        const y = Math.random() * (WORLD_HEIGHT * 0.7 - MONSTER_SIZE - spawnPadding * 2) + spawnPadding; // Spawn in upper 70% of world
        newMonsters.push({ id: `m-${Date.now()}-${Math.random()}`, type, x, y, lastShotTime: Date.now() });
      }
      return [...prevMonsters, ...newMonsters];
    });
  }, []);

  // Game Loop
  useEffect(() => {
    if (gameStatus !== 'playing') return;

    const gameLoop = requestAnimationFrame(() => {
      const now = Date.now();

      // Player Movement (updates world coordinates)
      setPlayerState(prev => {
        let newX = prev.x;
        let newY = prev.y;
        if (pressedKeys.current.has(KEY_BINDINGS.LEFT) || pressedKeys.current.has(KEY_BINDINGS.A)) newX -= PLAYER_SPEED;
        if (pressedKeys.current.has(KEY_BINDINGS.RIGHT) || pressedKeys.current.has(KEY_BINDINGS.D)) newX += PLAYER_SPEED;
        if (pressedKeys.current.has(KEY_BINDINGS.UP) || pressedKeys.current.has(KEY_BINDINGS.W)) newY -= PLAYER_SPEED;
        if (pressedKeys.current.has(KEY_BINDINGS.DOWN) || pressedKeys.current.has(KEY_BINDINGS.S)) newY += PLAYER_SPEED;

        // Boundary checks against world dimensions
        newX = Math.max(0, Math.min(WORLD_WIDTH - PLAYER_SIZE, newX));
        newY = Math.max(0, Math.min(WORLD_HEIGHT - PLAYER_SIZE, newY));
        return { x: newX, y: newY };
      });

      // Monster Movement & Actions
      setMonsters(prevMonsters => prevMonsters.map(monster => {
        // Movement: randomly towards player
        const angleToPlayer = Math.atan2(playerState.y - monster.y, playerState.x - monster.x);
        const randomAngleOffset = (Math.random() - 0.5) * (Math.PI / 3); // +/- 30 degrees randomness
        const moveAngle = angleToPlayer + randomAngleOffset;
        
        let newMonsterX = monster.x + Math.cos(moveAngle) * MONSTER_SPEED;
        let newMonsterY = monster.y + Math.sin(moveAngle) * MONSTER_SPEED;

        // World boundary check for monsters
        newMonsterX = Math.max(0, Math.min(WORLD_WIDTH - MONSTER_SIZE, newMonsterX));
        newMonsterY = Math.max(0, Math.min(WORLD_HEIGHT - MONSTER_SIZE, newMonsterY));
        
        let updatedMonster = { ...monster, x: newMonsterX, y: newMonsterY };

        // Shooting
        if (now - monster.lastShotTime > MONSTER_SHOOT_INTERVAL_BASE + Math.random() * MONSTER_SHOOT_INTERVAL_RANDOM) {
          const projectileAngle = Math.atan2(playerState.y - monster.y, playerState.x - monster.x); // Target player's world coords
          setProjectiles(prevProj => [...prevProj, {
            id: `p-${Date.now()}-${Math.random()}`,
            monsterId: monster.id,
            monsterType: monster.type,
            x: monster.x + MONSTER_SIZE / 2, // Start from monster's center (world coords)
            y: monster.y + MONSTER_SIZE / 2,
            angle: projectileAngle
          }]);
          updatedMonster.lastShotTime = now;
        }
        return updatedMonster;
      }));

      // Monster Projectile Movement & Collision
      setProjectiles(prevProj => prevProj.filter(p => {
        p.x += PROJECTILE_SPEED * Math.cos(p.angle);
        p.y += PROJECTILE_SPEED * Math.sin(p.angle);

        // Projectile out of world bounds
        if (p.x < 0 || p.x > WORLD_WIDTH || p.y < 0 || p.y > WORLD_HEIGHT) return false;

        // Projectile-Player Collision (Player is at playerState.x, playerState.y in world)
        const dx = p.x - (playerState.x + PLAYER_SIZE / 2);
        const dy = p.y - (playerState.y + PLAYER_SIZE / 2);
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < PROJECTILE_SIZE / 2 + PLAYER_SIZE / 2) {
          handleProjectileHit(p);
          return false; // Remove projectile
        }
        return true;
      }));

      // Player Projectile Movement & Collision
      setPlayerProjectiles(prevPlayerProj => {
        const updatedProjectiles = prevPlayerProj.map(p => ({
          ...p,
          x: p.x + PLAYER_PROJECTILE_SPEED * Math.cos(p.angle),
          y: p.y + PLAYER_PROJECTILE_SPEED * Math.sin(p.angle),
        }));

        const remainingProjectiles: PlayerProjectileInstance[] = [];
        const hitMonsterIds = new Set<string>();

        for (const p of updatedProjectiles) {
          // Out of world bounds
          if (p.x < 0 || p.x > WORLD_WIDTH || p.y < 0 || p.y > WORLD_HEIGHT) {
            continue; 
          }

          let hit = false;
          for (const monster of monsters) {
            if (hitMonsterIds.has(monster.id)) continue; // Monster already hit by another projectile this frame

            const dx = p.x - (monster.x + MONSTER_SIZE / 2);
            const dy = p.y - (monster.y + MONSTER_SIZE / 2);
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < PLAYER_PROJECTILE_SIZE / 2 + MONSTER_SIZE / 2) {
              hit = true;
              hitMonsterIds.add(monster.id);
              setScore(prev => prev + 20); // Score for hitting monster
              setMonstersKilled(prev => prev + 1);
              break; 
            }
          }
          if (!hit) {
            remainingProjectiles.push(p);
          }
        }
        // Remove hit monsters
        if (hitMonsterIds.size > 0) {
          setMonsters(prev => prev.filter(m => !hitMonsterIds.has(m.id)));
        }
        return remainingProjectiles;
      });


      // Spawn new monsters periodically
      if (now - lastMonsterSpawnTime.current > MONSTER_SPAWN_INTERVAL && monsters.length < MAX_MONSTERS) {
        spawnMonster(1);
        lastMonsterSpawnTime.current = now;
      }
    });

    return () => cancelAnimationFrame(gameLoop);
  }, [gameStatus, playerState.x, playerState.y, monsters, projectiles, playerProjectiles, spawnMonster]);


  const handleProjectileHit = (projectile: ProjectileInstance) => {
    setTimeout(async () => {
      setGameStatus('question'); 
      try {
        let questionData: BaseQuestionOutput;
        if (projectile.monsterType === MonsterType.TRIVIA) {
          const topics = ["Fiscal Policy", "Monetary Policy", "Supply and Demand", "GDP", "Inflation", "Market Structures", "International Trade"];
          const randomTopic = topics[Math.floor(Math.random() * topics.length)];
          questionData = await generateEconomicsQuestion({ topic: randomTopic });
        } else {
          const conditions = ["recessionary gap", "inflationary gap", "stagflation", "full employment with rising inflation"];
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
        setGameOverData({ score, timeSurvived, monstersKilled, failedQuestion: { questionText: "AI Error generating question.", correctAnswerText: "N/A"} });
      }
    }, 0);
  };

  const handleAnswer = (isCorrect: boolean) => {
    if (!currentQuestionContext) return;

    if (isCorrect) {
      setMonsters(prev => prev.filter(m => m.id !== currentQuestionContext.monsterId));
      setMonstersKilled(prev => prev + 1); // Already counted if killed by projectile, but ok for question kill
      setScore(prev => prev + 50); 
      setCurrentQuestionContext(null);
      setGameStatus('playing');
    } else {
      const qData = currentQuestionContext.questionData;
      const correctAnswerText = qData.choices[qData.correctAnswerIndex];
      setGameOverData({
        score, timeSurvived, monstersKilled,
        failedQuestion: { questionText: qData.question, correctAnswerText, explanationText: qData.explanation }
      });
      setGameStatus('game_over');
    }
  };

  const handleGameAreaClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (gameStatus !== 'playing' || !gameAreaRef.current) return;

    const rect = gameAreaRef.current.getBoundingClientRect();
    // Click coordinates relative to the viewport
    const clickXInViewport = event.clientX - rect.left;
    const clickYInViewport = event.clientY - rect.top;

    // Player is always at viewport center for aiming purposes
    const playerScreenX = VIEWPORT_WIDTH / 2;
    const playerScreenY = VIEWPORT_HEIGHT / 2;

    const angle = Math.atan2(clickYInViewport - playerScreenY, clickXInViewport - playerScreenX);

    setPlayerProjectiles(prev => [...prev, {
      id: `pp-${Date.now()}-${Math.random()}`,
      x: playerState.x + PLAYER_SIZE / 2, // Start from player's world center
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
      if (Object.values(KEY_BINDINGS).includes(e.key.toLowerCase()) || Object.values(KEY_BINDINGS).includes(e.key.toUpperCase())) {
        e.preventDefault();
        pressedKeys.current.add(e.key.toLowerCase());
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
       if (Object.values(KEY_BINDINGS).includes(e.key.toLowerCase()) || Object.values(KEY_BINDINGS).includes(e.key.toUpperCase())) {
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
  
  useEffect(() => {
    if (gameStatus === 'playing' && monsters.length === 0) {
       setTimeout(() => spawnMonster(MAX_MONSTERS / 2 > 1 ? MAX_MONSTERS / 2 : 2), 100);
       lastMonsterSpawnTime.current = Date.now();
    }
  }, [gameStatus, monsters.length, spawnMonster]);

  // Calculate the world container's offset based on player's world position
  const worldOffsetX = VIEWPORT_WIDTH / 2 - playerState.x;
  const worldOffsetY = VIEWPORT_HEIGHT / 2 - playerState.y;

  // Dynamic background position for scrolling effect
  const gameAreaDynamicStyle = {
    backgroundPositionX: `${worldOffsetX % 32}px`, // 32px is the background-size from globals.css
    backgroundPositionY: `${worldOffsetY % 32}px`,
  };


  if (gameStatus === 'start_screen') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-8">
        <h1 className="text-6xl font-bold text-primary mb-4" style={{fontFamily: "'Press Start 2P', cursive"}}>EcoRoam</h1>
        <p className="text-xl mb-8 text-center max-w-md">Navigate the treacherous lands of economics! Answer questions to defeat monsters and survive. Click to shoot.</p>
        <Button onClick={startGame} size="lg" className="px-12 py-6 text-2xl bg-primary hover:bg-primary/90 text-primary-foreground">
          Start Game
        </Button>
         <p className="mt-8 text-sm text-muted-foreground">Controls: Arrow Keys or WASD to move. Mouse Click to shoot.</p>
      </div>
    );
  }

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
        onClick={handleGameAreaClick} // Player shoots on click
      >
        {/* World Container: monsters and projectiles are positioned within this using their world coordinates */}
        <div
          className="absolute"
          style={{
            left: `${worldOffsetX}px`,
            top: `${worldOffsetY}px`,
            width: `${WORLD_WIDTH}px`,
            height: `${WORLD_HEIGHT}px`,
          }}
        >
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

        {/* Player is rendered on top, visually fixed in viewport center */}
        <PlayerComponent />
        
        <ScoreDisplay score={score} timeSurvived={timeSurvived} />
      </div>

      {gameStatus === 'question' && currentQuestionContext && (
        <QuestionModal questionContext={currentQuestionContext} onAnswer={handleAnswer} />
      )}
      {gameStatus === 'game_over' && gameOverData && (
        <GameOverScreen gameOverData={gameOverData} onRestart={startGame} />
      )}
      {gameStatus === 'playing' && (
        <p className="mt-4 text-xs text-muted-foreground">Controls: Arrow Keys or WASD to move. Mouse Click to shoot.</p>
      )}
    </main>
  );
}
