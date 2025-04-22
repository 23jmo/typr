import React from "react";
import QuickMatchCard from "./QuickMatchCard";
import UserStatsSummaryCard from "./UserStatsSummaryCard";
import UserRankCard from "./UserRankCard";
import LeaderboardCard from "./LeaderboardCard";
import PerformanceSection from "./PerformanceSection";
import { MatchData } from "../../../types";
import { RankKey } from "../../../types/ranks";

// Component props definition
interface RankedHomePageLayoutProps {
  matchmakingError: string | null;
  onClearError: () => void;
  onFindMatch: () => void;
  isSearching: boolean;
  userData: any; // User data object with stats
  userRank: {
    rankName: string;
    elo: number;
    rankKey: RankKey;
    progressPercent: number;
    nextRankName: string | null;
    eloToNextRank: number;
  };
  recentMatches: MatchData[];
  topRacers: {
    name: string;
    rank: string;
    wpm: number;
    elo?: number;
  }[];
  leaderboardLoading: boolean;
}

/**
 * Main layout component for the Ranked page when not searching for a match
 * Organizes all ranked page content into a cohesive layout
 */
const RankedHomePageLayout: React.FC<RankedHomePageLayoutProps> = ({
  matchmakingError,
  onClearError,
  onFindMatch,
  isSearching,
  // userData,
  topRacers,
  leaderboardLoading,
}) => {
  // Calculate match stats
  // const matchesPlayed =
  //   (userData?.stats?.overall?.totalWins || 0) +
  //   (userData?.stats?.overall?.totalLosses || 0);
  // const winRate = (() => {
  //   const wins = userData?.stats?.overall?.totalWins || 0;
  //   const losses = userData?.stats?.overall?.totalLosses || 0;
  //   const total = wins + losses;

  //   if (total === 0) return 0;
  //   return Math.round((wins / total) * 100);
  // })();
  // const averageWPM = userData?.stats?.overall?.averageWPM || 0;
  // const averageAccuracy = userData?.stats?.overall?.averageAccuracy || 0;

  return (
    <div className="max-w-7xl mx-auto p-4 pt-20 pb-8">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#d1d0c5]">Ranked Mode</h1>
        <p className="text-[#646669]">
          Compete against others and climb the leaderboard
        </p>
      </div>

      {/* Display Matchmaking Error if any */}
      {matchmakingError && !isSearching && (
        <div className="bg-red-500/20 border border-red-600 text-red-300 p-4 rounded-lg mb-6 flex justify-between items-center">
          <span>Error: {matchmakingError}</span>
          <button
            onClick={onClearError}
            className="text-red-200 hover:text-white"
          >
            &times;
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-3/4">
          {/* Quick Match Card */}
          <QuickMatchCard
            onFindMatch={onFindMatch}
            isSearching={isSearching}
          />

          {/* User Stats Summary Card */}
          <UserStatsSummaryCard />
        </div>

        <div className="w-full lg:w-1/4">
          {/* User Rank Card */}
          <UserRankCard />

          {/* Leaderboard Card */}
          <LeaderboardCard
            topRacers={topRacers}
            isLoading={leaderboardLoading}
          />
        </div>
      </div>

      {/* Performance Section (Recent Matches + Graph) */}
      <PerformanceSection />
    </div>
  );
};

export default RankedHomePageLayout;
