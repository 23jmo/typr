import React from "react";
import { useUser } from "../contexts/UserContext";
import { getRankByElo, getNextRank, RankKey } from "../types/ranks";
import RankIcon from "./RankIcon";

/**
 * Displays the user's current rank with medal icon, ELO score, 
 * and progress bar to the next rank
 */
const UserRankDisplay: React.FC = () => {
  // Get user data from context
  const { userData } = useUser();

  // Get the user's ELO from userData
  const elo = userData?.stats?.overall?.elo || 0;

  // Get current rank and next rank information
  const currentRank = getRankByElo(elo);
  const nextRank = getNextRank(elo);

  // Calculate progress percentage to the next rank
  const calculateProgressPercentage = () => {
    if (!nextRank) return 100; // Max rank achieved
    
    const currentRankMin = currentRank.minElo;
    const currentRankMax = currentRank.maxElo;
    const totalRankRange = currentRankMax - currentRankMin;
    const userProgress = elo - currentRankMin;
    
    return Math.min(Math.round((userProgress / totalRankRange) * 100), 100);
  };

  const progressPercentage = calculateProgressPercentage();
  
  // Get text color based on rank
  const getRankColor = (rankKey: RankKey): string => {
    switch (rankKey) {
      case "plastic":
        return "text-blue-500";
      case "silver":
        return "text-gray-400";
      case "gold":
        return "text-yellow-400";
      case "platinum":
        return "text-cyan-400";
      case "diamond":
        return "text-emerald-400";
      case "cherryMX":
        return "text-red-500";
      default:
        return "text-[#e2b714]";
    }
  };

  // Get progress bar color based on rank
  const getProgressBarColor = (rankKey: RankKey): string => {
    switch (rankKey) {
      case "plastic":
        return "bg-blue-500";
      case "silver":
        return "bg-gray-400";
      case "gold":
        return "bg-yellow-400";
      case "platinum":
        return "bg-cyan-400";
      case "diamond":
        return "bg-emerald-400";
      case "cherryMX":
        return "bg-red-500";
      default:
        return "bg-[#e2b714]";
    }
  };

  return (
    <div className="bg-[#2c2e31] rounded-lg p-6">
      <h2 className="text-xl font-bold text-[#d1d0c5] mb-2">Your Rank</h2>
      <p className="text-[#646669] text-sm mb-6">Current standing and progress</p>

      <div className="flex items-center gap-4 mb-4">
        <RankIcon rankKey={currentRank.rankKey} size={60} />
        <div>
          <div className={`text-2xl font-bold ${getRankColor(currentRank.rankKey)}`}>
            {currentRank.name}
          </div>
          <div className="text-[#d1d0c5]">{elo.toLocaleString()} ELO</div>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="w-full bg-[#323437] h-3 rounded-full overflow-hidden mb-2">
        <div
          className={`${getProgressBarColor(currentRank.rankKey)} h-full rounded-full transition-all duration-300`}
          style={{ width: `${progressPercentage}%` }}
        ></div>
      </div>
      
      {/* Progress information */}
      <div className="flex justify-between items-center text-sm">
        <span className="text-[#646669]">
          {nextRank 
            ? `${progressPercentage}% to ${nextRank.name}` 
            : "Max Rank Achieved!"}
        </span>
        <span className="text-[#646669]">
          {nextRank 
            ? `+${nextRank.minElo - elo} ELO needed` 
            : ""}
        </span>
      </div>
    </div>
  );
};

export default UserRankDisplay; 