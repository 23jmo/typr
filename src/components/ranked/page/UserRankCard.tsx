import React from "react";
import { useUser } from "../../../contexts/UserContext";
import { rankedIcons } from "../../../types/ranks";

type RankKey =
  | "plastic"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "cherryMX";

/**
 * Displays a user's current rank, ELO score, and progress towards next rank
 * with a visual progress bar
 */
const UserRankCard: React.FC = () => {
  // Get user data from context
  const { userData } = useUser();

  // Calculate user rank and progress
  const getUserRankAndProgress = () => {
    // Find the base rank based on ELO
    const elo = userData?.stats?.overall?.elo || 0;

    const baseRank =
      Object.values(rankedIcons).find(
        (rank) => elo >= rank.minElo && elo <= rank.maxElo
      ) || rankedIcons.plastic;

    // Find the rank key by comparing the found rank object with the rankedIcons objects
    const rankKey =
      (Object.entries(rankedIcons).find(
        ([_, rank]) => rank === baseRank
      )?.[0] as RankKey) || "plastic";

    // Find the next rank (if any)
    const sortedRanks = Object.values(rankedIcons).sort(
      (a, b) => a.minElo - b.minElo
    );
    const currentRankIndex = sortedRanks.findIndex((rank) => rank === baseRank);
    const nextRank =
      currentRankIndex < sortedRanks.length - 1
        ? sortedRanks[currentRankIndex + 1]
        : null;

    // Calculate progress to next rank
    let progressPercent = 0;
    if (nextRank) {
      const rangeInCurrentRank = baseRank.maxElo - baseRank.minElo;
      const progressInCurrentRank = elo - baseRank.minElo;
      progressPercent = Math.min(
        Math.round((progressInCurrentRank / rangeInCurrentRank) * 100),
        100
      );
    } else {
      // If at max rank, show 100%
      progressPercent = 100;
    }

    return {
      rankName: baseRank.name,
      elo: elo,
      rankKey: rankKey,
      nextRankName: nextRank?.name || null,
      progressPercent: progressPercent,
      eloToNextRank: nextRank ? nextRank.minElo - elo : 0,
    };
  };

  // Get user's rank information
  const {
    rankName,
    elo,
    rankKey,
    progressPercent,
    nextRankName,
    eloToNextRank,
  } = getUserRankAndProgress();

  // Get text color based on rank
  const getRankColor = (rankKey: RankKey): string => {
    switch (rankKey) {
      case "plastic":
        return "text-blue-500";
      case "silver":
        return "text-gray-400";
      case "gold":
        return "text-[#e2b714]";
      case "platinum":
        return "text-cyan-400";
      case "diamond":
        return "text-blue-400";
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
        return "bg-[#e2b714]";
      case "platinum":
        return "bg-cyan-400";
      case "diamond":
        return "bg-blue-400";
      case "cherryMX":
        return "bg-red-500";
      default:
        return "bg-[#e2b714]";
    }
  };

  return (
    <div className="bg-[#2c2e31] rounded-lg p-6 mb-6">
      <div className="flex justify-between items-center mb-3">
        <div className={`${getRankColor(rankKey)} font-bold text-xl`}>
          {rankName}
        </div>
        <div>
          <p className="text-xl font-bold text-[#d1d0c5]">
            {elo.toLocaleString()} ELO
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-[#323437] h-2 rounded-full overflow-hidden">
        <div
          className={`${getProgressBarColor(rankKey)} h-full rounded-full`}
          style={{ width: `${progressPercent}%` }}
        ></div>
      </div>

      {/* Next Rank Info */}
      <div className="flex justify-between items-center mt-2 text-sm">
        <span className="text-[#646669]">
          {nextRankName
            ? `${progressPercent}% to ${nextRankName}`
            : "Max Rank Achieved"}
        </span>
        <span className="text-[#646669]">
          {eloToNextRank > 0 ? `+${eloToNextRank} ELO needed` : ""}
        </span>
      </div>
    </div>
  );
};

export default UserRankCard;
