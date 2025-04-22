import React from "react";
import { useUser } from "../../../contexts/UserContext";

/**
 * Displays a user's overall performance metrics including matches played,
 * win rate, average WPM, and average accuracy
 */
const UserStatsSummaryCard: React.FC = () => {
  // Get user data from context
  const { userData } = useUser();

  // Calculate stats from userData
  const matchesPlayed =
    (userData?.stats?.overall?.totalWins || 0) +
    (userData?.stats?.overall?.totalLosses || 0);

  const winRate = (() => {
    const wins = userData?.stats?.overall?.totalWins || 0;
    const losses = userData?.stats?.overall?.totalLosses || 0;
    const total = wins + losses;

    if (total === 0) return 0;
    return Math.round((wins / total) * 100);
  })();

  const averageWPM = userData?.stats?.overall?.averageWPM || 0;
  const averageAccuracy = userData?.stats?.overall?.averageAccuracy || 0;

  return (
    <div className="bg-[#2c2e31] rounded-lg p-6 mb-6">
      <h2 className="text-2xl font-bold mb-2 text-[#d1d0c5]">Your Stats</h2>
      <p className="text-[#646669] mb-6">Overall performance metrics</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {/* Matches Played */}
        <div>
          <p className="text-[#646669] text-sm">Matches Played</p>
          <p className="text-2xl font-bold text-[#d1d0c5]">{matchesPlayed}</p>
        </div>

        {/* Win Rate */}
        <div>
          <p className="text-[#646669] text-sm">Win Rate</p>
          <p className="text-2xl font-bold text-[#e2b714]">{winRate}%</p>
        </div>

        {/* Avg. WPM */}
        <div>
          <p className="text-[#646669] text-sm">Avg. WPM</p>
          <p className="text-2xl font-bold text-[#d1d0c5]">{averageWPM}</p>
        </div>

        {/* Avg. Accuracy */}
        <div>
          <p className="text-[#646669] text-sm">Avg. Accuracy</p>
          <p className="text-2xl font-bold text-[#d1d0c5]">
            {averageAccuracy.toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
};

export default UserStatsSummaryCard;
