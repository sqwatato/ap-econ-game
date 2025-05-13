// src/components/game/Player.tsx
import type React from 'react';
import { PLAYER_SIZE, VIEWPORT_WIDTH, VIEWPORT_HEIGHT } from '@/config/game';

const PlayerComponent: React.FC = () => {
  return (
    <div
      className="absolute bg-primary rounded-sm shadow-md z-10" // Ensure player is on top of world elements
      style={{
        left: `${VIEWPORT_WIDTH / 2 - PLAYER_SIZE / 2}px`,
        top: `${VIEWPORT_HEIGHT / 2 - PLAYER_SIZE / 2}px`,
        width: `${PLAYER_SIZE}px`,
        height: `${PLAYER_SIZE}px`,
      }}
      aria-label="Player Character"
    />
  );
};

export default PlayerComponent;
