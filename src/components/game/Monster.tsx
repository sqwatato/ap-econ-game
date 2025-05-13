// src/components/game/Monster.tsx
import type React from 'react';
import { MONSTER_SIZE, MonsterType } from '@/config/game';
import type { MonsterInstance } from '@/types/game';

interface MonsterProps {
  monster: MonsterInstance;
}

const Monster: React.FC<MonsterProps> = ({ monster }) => {
  const monsterColor =
    monster.type === MonsterType.TRIVIA ? 'bg-chart-1' : 'bg-chart-2';

  return (
    <div
      className={`absolute ${monsterColor} rounded-sm shadow-md`}
      style={{
        left: `${monster.x}px`,
        top: `${monster.y}px`,
        width: `${MONSTER_SIZE}px`,
        height: `${MONSTER_SIZE}px`,
      }}
      aria-label={`Monster ${monster.type}`}
    />
  );
};

export default Monster;
