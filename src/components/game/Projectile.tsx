// src/components/game/Projectile.tsx
import type React from 'react';
import { PROJECTILE_SIZE } from '@/config/game';
import type { ProjectileInstance } from '@/types/game';

interface ProjectileProps {
  projectile: ProjectileInstance;
}

const Projectile: React.FC<ProjectileProps> = ({ projectile }) => {
  return (
    <div
      className="absolute bg-destructive rounded-full shadow-sm"
      style={{
        left: `${projectile.x - PROJECTILE_SIZE / 2}px`, // Center projectile
        top: `${projectile.y - PROJECTILE_SIZE / 2}px`, // Center projectile
        width: `${PROJECTILE_SIZE}px`,
        height: `${PROJECTILE_SIZE}px`,
      }}
      aria-label="Monster Projectile"
    />
  );
};

export default Projectile;
