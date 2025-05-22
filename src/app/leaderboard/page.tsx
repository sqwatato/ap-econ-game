// src/app/leaderboard/page.tsx
"use client"; // This page uses client-side fetching and navigation

import LeaderboardDisplay from '@/components/game/LeaderboardDisplay';
import React from 'react';

export default function LeaderboardPage() {
  return (
    // The LeaderboardDisplay component is a modal, so it handles its own layout
    <LeaderboardDisplay />
  );
}
