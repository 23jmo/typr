import React from 'react';
import { MedalIcon } from '../assets';

// Define rank keys type first
export type RankKey = 'plastic' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'cherryMX';

// Define medal colors for each rank
export const rankColors: Record<RankKey, { primary: string; secondary: string; ribbon: string }> = {
  plastic: {
    primary: '#3B82F6', // Blue
    secondary: '#1E40AF',
    ribbon: '#93C5FD',
  },
  silver: {
    primary: '#E5E7EB', // Silver
    secondary: '#9CA3AF',
    ribbon: '#F3F4F6',
  },
  gold: {
    primary: '#FBBF24', // Gold
    secondary: '#D97706',
    ribbon: '#FDE68A',
  },
  platinum: {
    primary: '#A5F3FC', // Light blue
    secondary: '#0E7490',
    ribbon: '#CFFAFE',
  },
  diamond: {
    primary: '#A7F3D0', // Light teal
    secondary: '#047857',
    ribbon: '#D1FAE5',
  },
  cherryMX: {
    primary: '#F43F5E', // Red
    secondary: '#BE123C',
    ribbon: '#FECDD3',
  },
};

// Medal renderer function for each rank
export const getMedalIcon = (rankKey: RankKey, size: number = 40) => {
  const colors = rankColors[rankKey];
  return React.createElement(MedalIcon, {
    primaryColor: colors.primary,
    secondaryColor: colors.secondary,
    ribbonColor: colors.ribbon,
    size: size,
  });
};

// Rank definitions with more detailed info
export const rankedIcons: Record<RankKey, { name: string; minElo: number; maxElo: number }> = {
  plastic: {
    name: "Plastic",
    minElo: 0,
    maxElo: 799,
  },
  silver: {
    name: "Silver",
    minElo: 800,
    maxElo: 1199,
  },
  gold: {
    name: "Gold",
    minElo: 1200,
    maxElo: 1499,
  },
  platinum: {
    name: "Platinum",
    minElo: 1500,
    maxElo: 1799,
  },
  diamond: {
    name: "Diamond",
    minElo: 1800,
    maxElo: 2199,
  },
  cherryMX: {
    name: "Cherry MX",
    minElo: 2000,
    maxElo: Infinity,
  },
};

/**
 * Find a rank by ELO score
 * @param elo - The ELO score to find the rank for
 * @returns The rank object and key
 */
export const getRankByElo = (elo: number) => {
  const rankEntry = Object.entries(rankedIcons).find(
    ([_, rank]) => elo >= rank.minElo && elo <= rank.maxElo
  );
  
  if (rankEntry) {
    const [rankKey, rank] = rankEntry;
    return { rankKey: rankKey as RankKey, ...rank };
  }
  
  // Default to plastic if no rank found
  return { rankKey: 'plastic' as RankKey, ...rankedIcons.plastic };
};

/**
 * Get the next rank above the current ELO
 * @param elo - The current ELO score
 * @returns The next rank or undefined if at max rank
 */
export const getNextRank = (elo: number) => {
  const currentRank = getRankByElo(elo);
  const ranksArray = Object.entries(rankedIcons)
    .map(([rankKey, rank]) => ({ rankKey: rankKey as RankKey, ...rank }))
    .sort((a, b) => a.minElo - b.minElo);
  
  const currentIndex = ranksArray.findIndex(rank => rank.rankKey === currentRank.rankKey);
  if (currentIndex < ranksArray.length - 1) {
    return ranksArray[currentIndex + 1];
  }
  
  return undefined; // No next rank (at max)
};
