// src/components/game/QuestionModal.tsx
"use client";

import type React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { CurrentQuestionContext } from '@/types/game';

interface QuestionModalProps {
  questionContext: CurrentQuestionContext;
  onAnswer: (isCorrect: boolean) => void;
}

const QuestionModal: React.FC<QuestionModalProps> = ({ questionContext, onAnswer }) => {
  if (!questionContext) return null;

  const { questionData } = questionContext;

  const handleAnswerClick = (selectedIndex: number) => {
    onAnswer(selectedIndex === questionData.correctAnswerIndex);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl shadow-2xl bg-card text-card-foreground">
        <CardHeader>
          <CardTitle className="text-2xl text-primary break-words">Economic Challenge!</CardTitle>
          <CardDescription className="text-base break-words whitespace-pre-wrap">{questionData.question}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {questionData.choices.map((choice, index) => (
            <Button
              key={index}
              variant="outline"
              className="w-full text-left justify-start p-4 h-auto text-base hover:bg-accent/20 active:bg-accent/30 whitespace-normal break-words"
              onClick={() => handleAnswerClick(index)}
              aria-label={`Answer choice ${index + 1}: ${choice}`}
            >
              {`${String.fromCharCode(65 + index)}. ${choice}`}
            </Button>
          ))}
        </CardContent>
        {questionData.explanation && (
           <CardFooter className="text-sm text-muted-foreground">
             <p className="break-words whitespace-pre-wrap"><strong>Hint:</strong> {questionData.explanation}</p>
           </CardFooter>
        )}
      </Card>
    </div>
  );
};

export default QuestionModal;
