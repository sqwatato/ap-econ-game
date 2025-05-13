// src/components/game/QuestionModal.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { CurrentQuestionContext } from '@/types/game';
import { cn } from '@/lib/utils';

interface QuestionModalProps {
  questionContext: CurrentQuestionContext;
  onAnswer: (isCorrect: boolean) => void;
}

const QuestionModal: React.FC<QuestionModalProps> = ({ questionContext, onAnswer }) => {
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState<boolean>(false);
  const [isCorrectUserAnswer, setIsCorrectUserAnswer] = useState<boolean | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Reset state when questionContext changes (new question)
  useEffect(() => {
    setSelectedAnswerIndex(null);
    setIsAnswerSubmitted(false);
    setIsCorrectUserAnswer(null);
    setCountdown(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  }, [questionContext]);


  const handleAnswerClick = (selectedIndex: number) => {
    if (isAnswerSubmitted) return;

    setIsAnswerSubmitted(true);
    setSelectedAnswerIndex(selectedIndex);
    const correct = selectedIndex === questionContext.questionData.correctAnswerIndex;
    setIsCorrectUserAnswer(correct);
    setCountdown(3);

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => (prev !== null && prev > 1 ? prev - 1 : 0));
    }, 1000);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      onAnswer(correct);
      // Modal will typically unmount, resetting state naturally.
      // If it could stay mounted, explicit reset would be needed here.
    }, 3000);
  };

  useEffect(() => {
    // Cleanup function for when the component unmounts
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  if (!questionContext) return null;

  const { questionData } = questionContext;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl shadow-2xl bg-card text-card-foreground">
        <CardHeader>
          <CardTitle className="text-2xl text-primary break-words">Economic Challenge!</CardTitle>
          <CardDescription className="text-base break-words whitespace-pre-wrap">{questionData.question}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {questionData.choices.map((choice, index) => {
            const isSelected = index === selectedAnswerIndex;
            const isCorrectChoice = index === questionData.correctAnswerIndex;

            let highlightClass = "";
            if (isAnswerSubmitted) {
              if (isSelected) {
                highlightClass = isCorrectUserAnswer ? "bg-green-500/30 border-green-600 hover:bg-green-500/40" : "bg-red-500/30 border-red-600 hover:bg-red-500/40";
              } else if (isCorrectChoice && !isCorrectUserAnswer) {
                // If user answered wrong, also highlight the correct answer
                highlightClass = "bg-green-500/30 border-green-600 hover:bg-green-500/40";
              }
            }

            return (
              <Button
                key={index}
                variant="outline"
                className={cn(
                  "w-full text-left justify-start p-4 h-auto text-base whitespace-normal break-words",
                  isAnswerSubmitted ? "hover:cursor-not-allowed" : "hover:bg-accent/20 active:bg-accent/30",
                  highlightClass
                )}
                onClick={() => handleAnswerClick(index)}
                disabled={isAnswerSubmitted}
                aria-label={`Answer choice ${index + 1}: ${choice}`}
              >
                {`${String.fromCharCode(65 + index)}. ${choice}`}
              </Button>
            );
          })}
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground flex flex-col items-center min-h-[40px]"> {/* Ensure footer has some min height */}
          {isAnswerSubmitted && countdown !== null ? (
            <p className="text-lg font-semibold text-primary mt-2">
              {countdown > 0 ? `Continuing in ${countdown}...` : (isCorrectUserAnswer ? "Correct!" : "Incorrect.") + " Continuing..."}
            </p>
          ) : (
            questionData.explanation && (
              <p className="break-words whitespace-pre-wrap"><strong>Hint:</strong> {questionData.explanation}</p>
            )
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default QuestionModal;

