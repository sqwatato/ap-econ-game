// src/components/game/UsernamePromptModal.tsx
"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { X as XIcon } from 'lucide-react'; // Renamed to avoid conflict with React.JSX.Element 'X'

interface UsernamePromptModalProps {
  onSubmit: (name: string) => void;
  onSkip: () => void; // New prop for skipping
  currentScore: number;
}

const UsernamePromptModal: React.FC<UsernamePromptModalProps> = ({ onSubmit, onSkip, currentScore }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name cannot be empty.');
      return;
    }
    if (name.length > 20) {
      setError('Name cannot be longer than 20 characters.');
      return;
    }
    setError('');
    onSubmit(name.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
      <Card className="w-full max-w-md shadow-2xl bg-card text-card-foreground relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={onSkip}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
          aria-label="Skip submission"
        >
          <XIcon className="h-5 w-5" />
        </Button>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="text-2xl text-primary">New High Score!</CardTitle>
            <CardDescription>Your score of {currentScore} made the leaderboard! Enter your name (or skip):</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Name (max 20 chars)</Label>
              <Input
                id="username"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                maxLength={20}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              Submit to Leaderboard
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default UsernamePromptModal;
