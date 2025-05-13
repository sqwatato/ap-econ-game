// src/components/game/Monster.tsx
import type React from 'react';
import { MONSTER_SIZE, MonsterType } from '@/config/game';
import type { MonsterInstance } from '@/types/game';
import { cn } from '@/lib/utils';

interface MonsterProps {
  monster: MonsterInstance;
}

const Monster: React.FC<MonsterProps> = ({ monster }) => {
  const monsterBaseColor =
    monster.type === MonsterType.TRIVIA ? 'bg-chart-1' : 'bg-chart-2';

  // Conditional classes for charging up
  const chargingClasses = monster.isPreparingToShoot 
    ? 'bg-red-600/70 animate-shake ring-1 ring-red-400' // Red tint, shake, and ring
    : monsterBaseColor;

  return (
    <div
      className={cn(
        'absolute rounded-sm shadow-md',
        chargingClasses
      )}
      style={{
        left: `${monster.x}px`,
        top: `${monster.y}px`,
        width: `${MONSTER_SIZE}px`,
        height: `${MONSTER_SIZE}px`,
      }}
      aria-label={`Monster ${monster.type}${monster.isPreparingToShoot ? ' (charging)' : ''}`}
    />
  );
};

export default Monster;

