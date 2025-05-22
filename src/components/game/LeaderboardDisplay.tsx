// src/components/game/LeaderboardDisplay.tsx
"use client";

import React, { useEffect, useState } from 'react';
import type { LeaderboardEntry } from '@/types/game';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation'; // For App Router
import { Skeleton } from '@/components/ui/skeleton';

const LeaderboardDisplay: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/leaderboard');
        if (!response.ok) {
          throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
        }
        const data = await response.json();
        setLeaderboard(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl shadow-2xl bg-card text-card-foreground">
        <CardHeader className="text-center relative">
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-4 left-4" 
            onClick={() => router.push('/')}
            aria-label="Back to Home"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <CardTitle className="text-3xl text-primary">Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="h-4 w-1/5" />
                  <Skeleton className="h-4 w-1/5" />
                </div>
              ))}
            </div>
          )}
          {error && <p className="text-destructive text-center">{error}</p>}
          {!isLoading && !error && leaderboard.length === 0 && (
            <p className="text-center text-muted-foreground">The leaderboard is empty. Be the first!</p>
          )}
          {!isLoading && !error && leaderboard.length > 0 && (
            <Table>
              <TableCaption>Top scores in EcoRoam!</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px] text-center">Rank</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((entry, index) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium text-center">{index + 1}</TableCell>
                    <TableCell className="truncate max-w-[150px] sm:max-w-none">{entry.name}</TableCell>
                    <TableCell className="text-right">{entry.score}</TableCell>
                    <TableCell className="text-right">{formatDate(entry.date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LeaderboardDisplay;
