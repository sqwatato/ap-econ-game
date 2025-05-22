// src/app/api/leaderboard/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { LeaderboardEntry } from '@/types/game';

const leaderboardFilePath = path.join(process.cwd(), 'data', 'leaderboard.json');
const dataDir = path.join(process.cwd(), 'data');

const MAX_LEADERBOARD_ENTRIES = 100; // Keep a reasonable limit

async function ensureDataDirAndFile() {
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
  try {
    await fs.access(leaderboardFilePath);
  } catch {
    await fs.writeFile(leaderboardFilePath, JSON.stringify([]), 'utf-8');
  }
}

async function readLeaderboard(): Promise<LeaderboardEntry[]> {
  await ensureDataDirAndFile();
  try {
    const fileContent = await fs.readFile(leaderboardFilePath, 'utf-8');
    return JSON.parse(fileContent) as LeaderboardEntry[];
  } catch (error) {
    console.error('Error reading leaderboard file:', error);
    // If file is corrupted or truly missing after check, return empty
    return [];
  }
}

async function writeLeaderboard(data: LeaderboardEntry[]): Promise<void> {
  await ensureDataDirAndFile();
  const sortedAndTrimmedData = data
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_LEADERBOARD_ENTRIES);
  await fs.writeFile(leaderboardFilePath, JSON.stringify(sortedAndTrimmedData, null, 2), 'utf-8');
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
    
    // Return the updated leaderboard so client can find rank
    const updatedLeaderboard = await readLeaderboard(); 
    return NextResponse.json(updatedLeaderboard, { status: 201 });

  } catch (error) {
    console.error('Failed to update leaderboard:', error);
    return NextResponse.json({ message: 'Failed to update leaderboard' }, { status: 500 });
  }
}
