// src/app/api/leaderboard/route.ts
import { NextResponse } from 'next/server';
import { createClient, type RedisClientType } from 'redis';
import type { LeaderboardEntry } from '@/types/game';

const MAX_LEADERBOARD_ENTRIES = 100;
const LEADERBOARD_KEY = 'leaderboard_scores'; // Sorted set for scores
const LEADERBOARD_ENTRY_HASH_PREFIX = 'leaderboard_entry:'; // Prefix for hashes storing entry details

let redis: RedisClientType | undefined;
let redisConnectingPromise: Promise<RedisClientType> | undefined;

async function getRedisClient(): Promise<RedisClientType> {
  if (redis && redis.isOpen) {
    return redis;
  }

  if (redisConnectingPromise) {
    return redisConnectingPromise;
  }

  if (!process.env.REDIS_URL) {
    console.error('[API/Leaderboard] (Redis) REDIS_URL environment variable is not set.');
    throw new Error('Redis configuration missing');
  }

  console.log('[API/Leaderboard] (Redis) Attempting to connect to Redis...');
  const client = createClient({
    url: process.env.REDIS_URL,
  });

  client.on('error', (err: unknown) => console.error('[API/Leaderboard] (Redis) Client Error', err));

  redisConnectingPromise = client.connect()
    .then((connectedClient: unknown) => {
      console.log('[API/Leaderboard] (Redis) Successfully connected.');
      redis = connectedClient as RedisClientType;
      redisConnectingPromise = undefined; 
      return redis;
    })
    .catch((err: unknown) => {
      console.error('[API/Leaderboard] (Redis) Connection failed:', err);
      redisConnectingPromise = undefined; 
      redis = undefined; // Ensure client is undefined if connection fails
      throw err; 
    });

  return redisConnectingPromise;
}

export async function GET() {
  console.log('[API/Leaderboard] (Redis) GET request received.');
  try {
    const client = await getRedisClient();
    console.log('[API/Leaderboard] (Redis) Fetching top leaderboard entries...');

    // Get top N entry IDs from the sorted set (highest scores first)
    const entryIds = await client.zRangeWithScores(LEADERBOARD_KEY, 0, MAX_LEADERBOARD_ENTRIES - 1, { REV: true });
    console.log(`[API/Leaderboard] (Redis) Fetched ${entryIds.length} entry IDs/scores from sorted set.`);

    if (entryIds.length === 0) {
      return NextResponse.json([]);
    }

    const multi = client.multi();
    entryIds.forEach(entry => {
      multi.hGetAll(`${LEADERBOARD_ENTRY_HASH_PREFIX}${entry.value}`); // entry.value is the ID
    });

    const results = await multi.exec() as Record<string, string>[];
    console.log(`[API/Leaderboard] (Redis) Fetched details for ${results.length} entries from hashes.`);

    const leaderboard: LeaderboardEntry[] = results.map((entryData, index) => {
      if (!entryData || Object.keys(entryData).length === 0) {
        // This case might happen if a hash is missing for an ID in the sorted set
        console.warn(`[API/Leaderboard] (Redis) Missing hash data for ID: ${entryIds[index]?.value}`);
        return null;
      }
      return {
        id: entryData.id,
        name: entryData.name,
        score: parseInt(entryData.score, 10),
        date: entryData.date,
      };
    }).filter(entry => entry !== null) as LeaderboardEntry[];
    
    // The zRangeWithScores with REV:true should already return them in descending order by score.
    // If secondary sort by date for ties is needed, it can be done here.
    // For now, Redis's sorted set order is primary.
    console.log('[API/Leaderboard] (Redis) GET: Returning leaderboard data (first 3):', leaderboard.slice(0,3));
    return NextResponse.json(leaderboard);

  } catch (error: any) {
    console.error('[API/Leaderboard] (Redis) GET: Failed to get leaderboard:', error.message, error.stack);
    return NextResponse.json({ message: 'Failed to retrieve leaderboard data from Redis.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  console.log('[API/Leaderboard] (Redis) POST request received.');
  try {
    const body = await request.json();
    console.log('[API/Leaderboard] (Redis) POST: Request body:', body);
    const { name, score } = body as { name: string; score: number };

    if (!name || typeof score !== 'number') {
      console.warn('[API/Leaderboard] (Redis) POST: Invalid name or score received.');
      return NextResponse.json({ message: 'Invalid name or score' }, { status: 400 });
    }
    if (name.length > 20) {
      console.warn('[API/Leaderboard] (Redis) POST: Name too long.');
      return NextResponse.json({ message: 'Name too long (max 20 chars)' }, { status: 400 });
    }

    const newEntry: LeaderboardEntry = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9), // More unique ID
      name,
      score,
      date: new Date().toISOString(),
    };
    console.log('[API/Leaderboard] (Redis) POST: Created new entry:', newEntry);

    const client = await getRedisClient();
    const multi = client.multi();

    // Store the full entry in a hash
    multi.hSet(`${LEADERBOARD_ENTRY_HASH_PREFIX}${newEntry.id}`, {
      id: newEntry.id,
      name: newEntry.name,
      score: newEntry.score.toString(), // Store score as string in hash
      date: newEntry.date,
    });

    // Add to sorted set (score, member_id)
    multi.zAdd(LEADERBOARD_KEY, { score: newEntry.score, value: newEntry.id });

    // Trim the sorted set to keep only the top MAX_LEADERBOARD_ENTRIES
    // Removes elements from rank 0 (lowest score) up to -(MAX_LEADERBOARD_ENTRIES + 1)
    // This keeps the MAX_LEADERBOARD_ENTRIES highest scores.
    multi.zRemRangeByRank(LEADERBOARD_KEY, 0, -MAX_LEADERBOARD_ENTRIES -1);
    
    // Additionally, if an entry was removed from the sorted set, its hash should ideally be deleted.
    // This is more complex to do atomically without Lua scripts.
    // For simplicity now, hashes might persist for entries no longer in top N.

    await multi.exec();
    console.log('[API/Leaderboard] (Redis) POST: Successfully executed Redis transaction for new entry.');
    
    // Fetch and return the updated leaderboard
    const updatedEntryIds = await client.zRangeWithScores(LEADERBOARD_KEY, 0, MAX_LEADERBOARD_ENTRIES - 1, { REV: true });
    if (updatedEntryIds.length === 0) {
      return NextResponse.json([], { status: 201 });
    }
    const fetchMulti = client.multi();
    updatedEntryIds.forEach(entry => {
      fetchMulti.hGetAll(`${LEADERBOARD_ENTRY_HASH_PREFIX}${entry.value}`);
    });
    const updatedResults = await fetchMulti.exec() as Record<string, string>[];
    const updatedLeaderboard: LeaderboardEntry[] = updatedResults.map((entryData, index) => {
       if (!entryData || Object.keys(entryData).length === 0) return null;
      return {
        id: entryData.id,
        name: entryData.name,
        score: parseInt(entryData.score, 10),
        date: entryData.date,
      };
    }).filter(entry => entry !== null) as LeaderboardEntry[];

    console.log('[API/Leaderboard] (Redis) POST: Returning updated leaderboard data. Size:', updatedLeaderboard.length, updatedLeaderboard.slice(0,3));
    return NextResponse.json(updatedLeaderboard, { status: 201 });

  } catch (error: any) {
    console.error('[API/Leaderboard] (Redis) POST: Failed to update leaderboard:', error.message, error.stack);
    return NextResponse.json({ message: 'Failed to update leaderboard in Redis.' }, { status: 500 });
  }
}
