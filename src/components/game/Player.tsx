// src/components/game/Player.tsx
import type React from 'react';
import Image from 'next/image';
import { PLAYER_SIZE, VIEWPORT_WIDTH, VIEWPORT_HEIGHT } from '@/config/game';

const PlayerComponent: React.FC = () => {
  return (
    <Image
      src="/player.png" // Assumed path in public folder
      alt="Player Character"
      width={PLAYER_SIZE}
      height={PLAYER_SIZE}
      className="absolute rounded-sm shadow-md z-10 pixelated" // Added pixelated class
      style={{
        left: `${VIEWPORT_WIDTH / 2 - PLAYER_SIZE / 2}px`,
        top: `${VIEWPORT_HEIGHT / 2 - PLAYER_SIZE / 2}px`,
      }}
      aria-label="Player Character"
      priority // Player image is critical, so prioritize loading
    />
  );
};

export default PlayerComponent;
