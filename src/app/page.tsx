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
  PLAYER_SIZE, PLAYER_SPEED, MONSTER_SIZE, MONSTER_SPEED, MONSTER_SHOOT_INTERVAL_BASE, MONSTER_SHOOT_INTERVAL_RANDOM, MONSTER_CHARGE_DURATION,
  MAX_MONSTERS, MONSTER_SPAWN_INTERVAL, PROJECTILE_SIZE, PROJECTILE_SPEED,
  PLAYER_PROJECTILE_SIZE, PLAYER_PROJECTILE_SPEED,
  WORLD_WIDTH, WORLD_HEIGHT, VIEWPORT_WIDTH, VIEWPORT_HEIGHT,
  SCORE_INCREMENT_INTERVAL, SCORE_INCREMENT_AMOUNT, INITIAL_PLAYER_X, INITIAL_PLAYER_Y,
  MonsterType, KEY_BINDINGS
} from '@/config/game';
import type {
  PlayerState, MonsterInstance, ProjectileInstance, PlayerProjectileInstance, CurrentQuestionContext, GameOverData, BaseQuestionOutput
} from '@/types/game';
import { generateEconomicsQuestion } from '@/ai/flows/generate-economics-question';
import { generateCauseEffectQuestion } from '@/ai/flows/generate-cause-effect-question';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type GameStatus = 'start_screen' | 'playing' | 'question' | 'game_over';

const MAX_QUESTION_QUEUE_SIZE = 2;
const MIN_QUESTION_QUEUE_SIZE = 1; 

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


  const fetchTriviaQuestions = useCallback(async (count: number) => {
    if (isFetchingTrivia || count <= 0 || triviaQuestionQueue.length >= MAX_QUESTION_QUEUE_SIZE) return;
    setIsFetchingTrivia(true);
    try {
      const promises = [];
      const topics = ["Fiscal Policy", "Monetary Policy", "Supply and Demand", "GDP", "Inflation", "Market Structures", "International Trade"];
      for (let i = 0; i < count; i++) {
        const randomTopic = topics[Math.floor(Math.random() * topics.length)];
        promises.push(generateEconomicsQuestion({ topic: randomTopic }));
      }
      const results = await Promise.allSettled(promises);
      const newQuestions = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<BaseQuestionOutput>).value);
      
      setTriviaQuestionQueue(prev => {
        const combined = [...prev, ...newQuestions];
        return combined.slice(-MAX_QUESTION_QUEUE_SIZE); // Ensure queue doesn't exceed max size
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
      const conditions = ["recessionary gap", "inflationary gap", "stagflation", "full employment with rising inflation"];
      for (let i = 0; i < count; i++) {
        const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
        promises.push(generateCauseEffectQuestion({ economicCondition: randomCondition }));
      }
      const results = await Promise.allSettled(promises);
      const newQuestions = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<BaseQuestionOutput>).value);
      
      setCauseEffectQuestionQueue(prev => {
        const combined = [...prev, ...newQuestions];
        return combined.slice(-MAX_QUESTION_QUEUE_SIZE); // Ensure queue doesn't exceed max size
      });
    } catch (error) {
      console.error("Error fetching cause-effect questions:", error);
    } finally {
      setIsFetchingCauseEffect(false);
    }
  }, [isFetchingCauseEffect, causeEffectQuestionQueue.length]);

  const spawnMonster = useCallback((count = 1) => {
    setMonsters(prevMonsters => {
      const newMonsters: MonsterInstance[] = [];
      for (let i = 0; i < count; i++) {
        if (prevMonsters.length + newMonsters.length >= MAX_MONSTERS) break;
        const type = Math.random() < 0.5 ? MonsterType.TRIVIA : MonsterType.CAUSE_EFFECT;
        const spawnPadding = MONSTER_SIZE * 2;
        // Ensure monsters spawn within world boundaries, avoiding edges.
        const x = Math.random() * (WORLD_WIDTH - MONSTER_SIZE - spawnPadding * 2) + spawnPadding;
        const y = Math.random() * (WORLD_HEIGHT - MONSTER_SIZE - spawnPadding * 2) + spawnPadding; 
        newMonsters.push({ 
          id: `m-${Date.now()}-${Math.random()}`, 
          type, x, y, 
          nextShotDecisionTime: Date.now() + (Math.random() * MONSTER_SHOOT_INTERVAL_RANDOM + MONSTER_SHOOT_INTERVAL_BASE),
          isPreparingToShoot: false,
        });
      }
      return [...prevMonsters, ...newMonsters];
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

    // Initial fill of question queues
    fetchTriviaQuestions(MAX_QUESTION_QUEUE_SIZE);
    fetchCauseEffectQuestions(MAX_QUESTION_QUEUE_SIZE);
    
    setTimeout(() => spawnMonster(Math.floor(MAX_MONSTERS / 2) || 1), 100);
  }, [spawnMonster, fetchTriviaQuestions, fetchCauseEffectQuestions]);


  const handleProjectileHit = useCallback(async (projectile: ProjectileInstance) => {
    if (isProcessingHit.current || gameStatus === 'question' || gameStatus === 'game_over') {
      return; 
    }
    isProcessingHit.current = true;

    setIsPlayerHit(true);
    setTimeout(() => setIsPlayerHit(false), 300); 

    setGameStatus('question'); 

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
    
    // Fetch replacement questions immediately after one is used.
    if (monsterType === MonsterType.TRIVIA && triviaQuestionQueue.length -1 < MIN_QUESTION_QUEUE_SIZE && !isFetchingTrivia) {
        fetchTriviaQuestions(1);
    } else if (monsterType === MonsterType.CAUSE_EFFECT && causeEffectQuestionQueue.length -1 < MIN_QUESTION_QUEUE_SIZE && !isFetchingCauseEffect) {
        fetchCauseEffectQuestions(1);
    }


    if (!questionData) {
      console.warn(`Queue empty for ${monsterType}, fetching on demand.`);
      try {
        if (monsterType === MonsterType.TRIVIA) {
          const topics = ["Fiscal Policy", "Monetary Policy", "Supply and Demand", "GDP", "Inflation", "Market Structures", "International Trade"];
          const randomTopic = topics[Math.floor(Math.random() * topics.length)];
          questionData = await generateEconomicsQuestion({ topic: randomTopic });
        } else { 
          const conditions = ["recessionary gap", "inflationary gap", "stagflation", "full employment with rising inflation"];
          const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
          questionData = await generateCauseEffectQuestion({ economicCondition: randomCondition });
        }
      } catch (error) {
        console.error("Error generating question on demand:", error);
        const currentTimeSurvivedInSeconds = Math.floor(timeSurvived * SCORE_INCREMENT_INTERVAL / 1000);
        setGameOverData({ score, timeSurvived: currentTimeSurvivedInSeconds, monstersKilled, failedQuestion: { questionText: "AI Error generating question.", correctAnswerText: "N/A"} });
        setGameStatus('game_over'); 
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
      const currentTimeSurvivedInSeconds = Math.floor(timeSurvived * SCORE_INCREMENT_INTERVAL / 1000);
      setGameOverData({ score, timeSurvived: currentTimeSurvivedInSeconds, monstersKilled, failedQuestion: { questionText: "System Error: No question available.", correctAnswerText: "N/A"} });
      setGameStatus('game_over');
    }
  }, [gameStatus, triviaQuestionQueue, causeEffectQuestionQueue, score, timeSurvived, monstersKilled, fetchTriviaQuestions, fetchCauseEffectQuestions, isFetchingTrivia, isFetchingCauseEffect]);

  useEffect(() => {
    if (gameStatus !== 'question') {
      isProcessingHit.current = false;
    }
  }, [gameStatus]);

  const startGame = () => {
    resetGameState(); 
    setGameStatus('playing');
  };

  // Effect for maintaining trivia question queue
  useEffect(() => {
    if ((gameStatus === 'playing' || gameStatus === 'start_screen') && triviaQuestionQueue.length < MIN_QUESTION_QUEUE_SIZE && !isFetchingTrivia) {
        const numToFetch = MAX_QUESTION_QUEUE_SIZE - triviaQuestionQueue.length;
        if (numToFetch > 0) fetchTriviaQuestions(numToFetch);
    }
  }, [triviaQuestionQueue.length, isFetchingTrivia, gameStatus, fetchTriviaQuestions]);

  // Effect for maintaining cause-effect question queue
  useEffect(() => {
    if ((gameStatus === 'playing' || gameStatus === 'start_screen') && causeEffectQuestionQueue.length < MIN_QUESTION_QUEUE_SIZE && !isFetchingCauseEffect) {
         const numToFetch = MAX_QUESTION_QUEUE_SIZE - causeEffectQuestionQueue.length;
         if (numToFetch > 0) fetchCauseEffectQuestions(numToFetch);
    }
  }, [causeEffectQuestionQueue.length, isFetchingCauseEffect, gameStatus, fetchCauseEffectQuestions]);


  // Game Loop
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
        const randomAngleOffset = (Math.random() - 0.5) * (Math.PI / 3); // Random up to 30 degrees deviation
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
        p.x += PROJECTILE_SPEED * Math.cos(p.angle);
        p.y += PROJECTILE_SPEED * Math.sin(p.angle);

        if (p.x < 0 || p.x > WORLD_WIDTH || p.y < 0 || p.y > WORLD_HEIGHT) return false;

        const dx = p.x - (playerState.x + PLAYER_SIZE / 2);
        const dy = p.y - (playerState.y + PLAYER_SIZE / 2);
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < PROJECTILE_SIZE / 2 + PLAYER_SIZE / 2) {
          handleProjectileHit(p); 
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
              setScore(prev => prev + 25); // Monster kill score update
              break; 
            }
          }
          if (!hit) {
            remainingProjectiles.push(p);
          }
        }
        
        if (hitMonsterIds.size > 0) {
          setMonsters(prev => {
            const newMonsters = prev.filter(m => !hitMonsterIds.has(m.id));
            const killedCount = prev.length - newMonsters.length;
            if (killedCount > 0) {
              setMonstersKilled(prevKilled => prevKilled + killedCount);
            }
            return newMonsters;
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

    if (isCorrect) {
      setMonsters(prev => {
        const monsterExists = prev.some(m => m.id === currentQuestionContext.monsterId);
        if (monsterExists) {
            setMonstersKilled(killed => killed + 1);
            return prev.filter(m => m.id !== currentQuestionContext.monsterId);
        }
        return prev;
      });
      setScore(prev => prev + 50); 
      setCurrentQuestionContext(null);
      setGameStatus('playing');
    } else {
      const qData = currentQuestionContext.questionData;
      const correctAnswerText = qData.choices[qData.correctAnswerIndex];
      const currentTimeSurvivedInSeconds = Math.floor(timeSurvived * SCORE_INCREMENT_INTERVAL / 1000);
      setGameOverData({
        score, timeSurvived: currentTimeSurvivedInSeconds, monstersKilled,
        failedQuestion: { questionText: qData.question, correctAnswerText, explanationText: qData.explanation }
      });
      setGameStatus('game_over');
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
      setTimeSurvived(prev => prev + 1); // timeSurvived increments by 1 unit (representing 100ms)
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

  const boundaryThickness = 4; // px


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
  
  // Convert timeSurvived (in 100ms units) to seconds for display
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
            style={{ zIndex: 5 }} 
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
            className="absolute bg-border/50"
            style={{ left: 0, top: 0, width: WORLD_WIDTH, height: boundaryThickness }}
            aria-label="Top Boundary"
          />
          <div
            className="absolute bg-border/50"
            style={{ left: 0, top: WORLD_HEIGHT - boundaryThickness, width: WORLD_WIDTH, height: boundaryThickness }}
            aria-label="Bottom Boundary"
          />
          <div
            className="absolute bg-border/50"
            style={{ left: 0, top: 0, width: boundaryThickness, height: WORLD_HEIGHT }}
            aria-label="Left Boundary"
          />
          <div
            className="absolute bg-border/50"
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
      {gameStatus === 'game_over' && gameOverData && (
        <GameOverScreen gameOverData={gameOverData} onRestart={startGame} />
      )}
      {gameStatus === 'playing' && (
        <p className="mt-4 text-xs text-muted-foreground">Controls: Arrow Keys or WASD to move. Mouse Click to shoot.</p>
      )}
    </main>
  );
}

