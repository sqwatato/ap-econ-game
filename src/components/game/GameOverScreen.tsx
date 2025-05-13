// src/components/game/GameOverScreen.tsx
import type React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { GameOverData } from '@/types/game';

interface GameOverScreenProps {
  gameOverData: GameOverData;
  onRestart: () => void;
}

const GameOverScreen: React.FC<GameOverScreenProps> = ({ gameOverData, onRestart }) => {
  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-destructive/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md shadow-2xl bg-card text-card-foreground">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl text-destructive-foreground bg-destructive p-3 rounded-t-md -m-6 mb-3 break-words">Game Over!</CardTitle>
          <CardDescription className="text-lg pt-3 break-words">Your economic journey has ended.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-center">
          <p className="text-xl">Final Score: <span className="font-bold text-primary">{gameOverData.score}</span></p>
          <p>Time Survived: <span className="font-semibold">{formatTime(gameOverData.timeSurvived)}</span></p>
          <p>Monsters Defeated: <span className="font-semibold">{gameOverData.monstersKilled}</span></p>
          {gameOverData.failedQuestion && (
            <div className="mt-4 pt-3 border-t border-border text-left p-3 bg-secondary rounded-md">
              <p className="font-semibold text-secondary-foreground break-words">Regarding the last question:</p>
              <p className="text-sm text-muted-foreground break-words whitespace-pre-wrap">"{gameOverData.failedQuestion.questionText}"</p>
              <p className="text-sm mt-1 break-words">The correct answer was: <strong className="text-primary">{gameOverData.failedQuestion.correctAnswerText}</strong></p>
              {gameOverData.failedQuestion.explanationText && (
                 <p className="text-xs mt-1 text-muted-foreground break-words whitespace-pre-wrap"><em>Explanation: {gameOverData.failedQuestion.explanationText}</em></p>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button 
            onClick={onRestart} 
            className="px-8 py-3 text-lg bg-primary hover:bg-primary/90 text-primary-foreground"
            aria-label="Play Again"
          >
            Play Again
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default GameOverScreen;
