// src/components/game/Player.tsx
import type React from 'react';
import { PLAYER_SIZE } from '@/config/game';
import type { PlayerState } from '@/types/game';

interface PlayerProps {
  playerState: PlayerState;
}

const Player: React.FC<PlayerProps> = ({ playerState }) => {
  return (
    <div
      className="absolute bg-primary rounded-sm shadow-md"
      style={{
        left: `${playerState.x}px`,
        top: `${playerState.y}px`,
        width: `${PLAYER_SIZE}px`,
        height: `${PLAYER_SIZE}px`,
        transition: 'left 0.05s linear, top 0.05s linear', // Smooth movement slightly
      }}
      aria-label="Player Character"
    />
  );
};

export default Player;
