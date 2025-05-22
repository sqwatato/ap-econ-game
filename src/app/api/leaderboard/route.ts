
// src/app/api/leaderboard/route.ts
import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { LeaderboardEntry } from '@/types/game';

// Path to the JSON file
const LEADERBOARD_FILE_PATH = path.join(process.cwd(), 'data', 'leaderboard.json');
const MAX_LEADERBOARD_ENTRIES = 100;

async function readLeaderboard(): Promise<LeaderboardEntry[]> {
  console.log('[API/Leaderboard] Attempting to read leaderboard from file:', LEADERBOARD_FILE_PATH);
  try {
    await fs.mkdir(path.dirname(LEADERBOARD_FILE_PATH), { recursive: true }); // Ensure data directory exists
    const fileContent = await fs.readFile(LEADERBOARD_FILE_PATH, 'utf-8');
    const leaderboard = JSON.parse(fileContent) as LeaderboardEntry[];
    if (!Array.isArray(leaderboard)) {
      console.warn('[API/Leaderboard] Leaderboard data in file is not an array, returning empty.');
      return [];
    }
    // Ensure data is sorted and trimmed when read
    const sortedLeaderboard = leaderboard.sort((a, b) => b.score - a.score).slice(0, MAX_LEADERBOARD_ENTRIES);
    console.log(`[API/Leaderboard] Successfully read and sorted ${sortedLeaderboard.length} entries from file.`);
    return sortedLeaderboard;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log('[API/Leaderboard] leaderboard.json not found, returning empty array.');
      return []; // File doesn't exist, so leaderboard is empty
    }
    console.error('[API/Leaderboard] Error reading leaderboard from file:', error);
    return []; // In case of other errors, return an empty array
  }
}

async function writeLeaderboard(data: LeaderboardEntry[]): Promise<void> {
  const sortedAndTrimmedData = data
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_LEADERBOARD_ENTRIES);
  console.log(`[API/Leaderboard] Attempting to write ${sortedAndTrimmedData.length} entries to file...`, sortedAndTrimmedData.slice(0,3)); 
  try {
    await fs.mkdir(path.dirname(LEADERBOARD_FILE_PATH), { recursive: true }); // Ensure data directory exists
    await fs.writeFile(LEADERBOARD_FILE_PATH, JSON.stringify(sortedAndTrimmedData, null, 2));
    console.log('[API/Leaderboard] Successfully wrote leaderboard to file.');
  } catch (error) {
    console.error('[API/Leaderboard] Error writing leaderboard to file:', error);
    // Consider if you need to throw here or handle differently
  }
}

export async function GET() {
  console.log('[API/Leaderboard] GET request received.');
  try {
    const leaderboard = await readLeaderboard();
    console.log('[API/Leaderboard] GET: Returning leaderboard data:', leaderboard.slice(0,3));
    return NextResponse.json(leaderboard);
  } catch (error) {
    console.error('[API/Leaderboard] GET: Failed to get leaderboard:', error);
    return NextResponse.json({ message: 'Failed to retrieve leaderboard data from file.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  console.log('[API/Leaderboard] POST request received.');
  try {
    const body = await request.json();
    console.log('[API/Leaderboard] POST: Request body:', body);
    const { name, score } = body as { name: string; score: number };

    if (!name || typeof score !== 'number') {
      console.warn('[API/Leaderboard] POST: Invalid name or score received.');
      return NextResponse.json({ message: 'Invalid name or score' }, { status: 400 });
    }
    if (name.length > 20) {
      console.warn('[API/Leaderboard] POST: Name too long.');
      return NextResponse.json({ message: 'Name too long (max 20 chars)' }, { status: 400 });
    }

    const newEntry: LeaderboardEntry = {
      id: Date.now().toString() + Math.random().toString(36).substring(2,7), // Simple unique ID
      name,
      score,
      date: new Date().toISOString(),
    };
    console.log('[API/Leaderboard] POST: Created new entry:', newEntry);

    const currentLeaderboard = await readLeaderboard();
    console.log('[API/Leaderboard] POST: Current leaderboard size before add:', currentLeaderboard.length);
    
    currentLeaderboard.push(newEntry);
    console.log('[API/Leaderboard] POST: Leaderboard size after add (before write):', currentLeaderboard.length);

    await writeLeaderboard(currentLeaderboard);
    
    // Return the updated (and sorted/trimmed by readLeaderboard again to be sure) leaderboard
    const updatedLeaderboard = await readLeaderboard(); 
    console.log('[API/Leaderboard] POST: Returning updated leaderboard data after write. Size:', updatedLeaderboard.length, updatedLeaderboard.slice(0,3));
    return NextResponse.json(updatedLeaderboard, { status: 201 });

  } catch (error) {
    console.error('[API/Leaderboard] POST: Failed to update leaderboard:', error);
    return NextResponse.json({ message: 'Failed to update leaderboard in file.' }, { status: 500 });
  }
}
