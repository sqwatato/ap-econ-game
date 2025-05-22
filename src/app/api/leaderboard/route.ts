
// src/app/api/leaderboard/route.ts
import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import type { LeaderboardEntry } from '@/types/game';

const LEADERBOARD_KEY = 'leaderboard';
const MAX_LEADERBOARD_ENTRIES = 100;

async function readLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const leaderboard = await kv.get<LeaderboardEntry[]>(LEADERBOARD_KEY);
    // Ensure data is sorted and trimmed when read, as KV stores it as a blob
    return leaderboard ? leaderboard.sort((a, b) => b.score - a.score).slice(0, MAX_LEADERBOARD_ENTRIES) : [];
  } catch (error) {
    console.error('Error reading leaderboard from KV:', error);
    return [];
  }
}

async function writeLeaderboard(data: LeaderboardEntry[]): Promise<void> {
  const sortedAndTrimmedData = data
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_LEADERBOARD_ENTRIES);
  try {
    await kv.set(LEADERBOARD_KEY, sortedAndTrimmedData);
  } catch (error) {
    console.error('Error writing leaderboard to KV:', error);
    // Depending on the desired behavior, you might want to throw the error
    // or handle it in a way that informs the user the save might have failed.
  }
}

export async function GET() {
  try {
    const leaderboard = await readLeaderboard();
    return NextResponse.json(leaderboard);
  } catch (error) {
    console.error('Failed to get leaderboard:', error);
    return NextResponse.json({ message: 'Failed to retrieve leaderboard' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, score } = (await request.json()) as { name: string; score: number };

    if (!name || typeof score !== 'number') {
      return NextResponse.json({ message: 'Invalid name or score' }, { status: 400 });
    }
    if (name.length > 20) {
        return NextResponse.json({ message: 'Name too long (max 20 chars)' }, { status: 400 });
    }

    const newEntry: LeaderboardEntry = {
      id: Date.now().toString() + Math.random().toString(36).substring(2,7), // Simple unique ID
      name,
      score,
      date: new Date().toISOString(),
    };

    const leaderboard = await readLeaderboard();
    leaderboard.push(newEntry);
    await writeLeaderboard(leaderboard);
    
    // Return the updated (and sorted/trimmed by readLeaderboard) leaderboard
    const updatedLeaderboard = await readLeaderboard(); 
    return NextResponse.json(updatedLeaderboard, { status: 201 });

  } catch (error) {
    console.error('Failed to update leaderboard:', error);
    return NextResponse.json({ message: 'Failed to update leaderboard' }, { status: 500 });
  }
}
