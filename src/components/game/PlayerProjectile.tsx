// src/components/game/PlayerProjectile.tsx
import type React from 'react';
import { PLAYER_PROJECTILE_SIZE } from '@/config/game';
import type { PlayerProjectileInstance } from '@/types/game';

interface PlayerProjectileProps {
  projectile: PlayerProjectileInstance;
}

const PlayerProjectileComponent: React.FC<PlayerProjectileProps> = ({ projectile }) => {
  return (
    <div
      className="absolute bg-accent rounded-full shadow-sm" // Player projectiles are accent colored
      style={{
        left: `${projectile.x - PLAYER_PROJECTILE_SIZE / 2}px`, // Center projectile
        top: `${projectile.y - PLAYER_PROJECTILE_SIZE / 2}px`, // Center projectile
        width: `${PLAYER_PROJECTILE_SIZE}px`,
        height: `${PLAYER_PROJECTILE_SIZE}px`,
      }}
      aria-label="Player Projectile"
    />
  );
};

export default PlayerProjectileComponent;
