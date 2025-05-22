// src/components/game/Monster.tsx
import type React from 'react';
import Image from 'next/image';
import { MONSTER_SIZE, MonsterType } from '@/config/game';
import type { MonsterInstance } from '@/types/game';
import { cn } from '@/lib/utils';

interface MonsterProps {
  monster: MonsterInstance;
}

const Monster: React.FC<MonsterProps> = ({ monster }) => {
  const imageSrc =
    monster.type === MonsterType.TRIVIA
      ? '/monster-trivia.png'
      : '/monster-cause-effect.png';

  return (
    <div
      className={cn(
        'absolute pixelated', // Ensure the container also respects pixelation for children
        monster.isPreparingToShoot ? 'animate-shake ring-2 ring-red-500 rounded-sm' : ''
      )}
      style={{
        left: `${monster.x}px`,
        top: `${monster.y}px`,
        width: `${MONSTER_SIZE}px`,
        height: `${MONSTER_SIZE}px`,
      }}
      aria-label={`Monster ${monster.type}${monster.isPreparingToShoot ? ' (charging)' : ''}`}
    >
      {monster.isPreparingToShoot && (
        <div className="absolute inset-0 bg-red-600/50 rounded-sm z-10 pointer-events-none" /> // Red tint overlay
      )}
      <Image
        src={imageSrc}
        alt={`Monster ${monster.type}`}
        width={MONSTER_SIZE}
        height={MONSTER_SIZE}
        className="rounded-sm shadow-md" // Image styling
      />
    </div>
  );
};

export default Monster;
