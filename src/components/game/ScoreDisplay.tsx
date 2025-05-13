// src/components/game/ScoreDisplay.tsx
import type React from 'react';

interface ScoreDisplayProps {
  score: number;
  timeSurvived: number; // in seconds
  monstersKilled: number;
}

const ScoreDisplay: React.FC<ScoreDisplayProps> = ({ score, timeSurvived, monstersKilled }) => {
  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute top-4 left-4 bg-card/70 backdrop-blur-sm p-3 rounded-md shadow-lg text-card-foreground z-10">
      <h2 className="text-lg font-bold">Score: {score}</h2>
      <p className="text-sm">Time: {formatTime(timeSurvived)}</p>
      <p className="text-sm">Defeated: {monstersKilled}</p>
    </div>
  );
};

export default ScoreDisplay;

