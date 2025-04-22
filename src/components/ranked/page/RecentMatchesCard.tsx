import React from "react";
import { MatchData } from "../../../types";
import { useUser } from "../../../contexts/UserContext";

/**
 * Displays a list of recent matches with opponent info and match results
 * Fetches its own data using the useUser hook
 */
const RecentMatchesCard: React.FC = () => {
  // Get user data from context
  const { userData } = useUser();

  // Format timestamp to "X time ago" format
  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes} min ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;

    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? "s" : ""} ago`;
  };

  // Use actual data from user document or fallback to empty array
  const recentMatches: MatchData[] = userData?.recentMatches
    ? userData.recentMatches.map((match) => ({
        opponent: match.opponentName || "Unknown",
        timeAgo: formatTimeAgo(match.timestamp || Date.now()),
        userWpm: match.userWpm || 0,
        opponentWpm: match.opponentWpm || 0,
        isWin: match.isWin || false,
        eloChange: match.eloChange || 0,
        accuracy: match.accuracy || 0,
      }))
    : [];

  return (
    <div className="bg-[#2c2e31] rounded-lg p-6 h-[500px] overflow-hidden flex flex-col">
      <h3 className="text-xl font-bold mb-2 text-[#d1d0c5]">Recent Matches</h3>
      <p className="text-[#646669] mb-4">Your last 10 ranked matches</p>

      {/* Matches scrollable area */}
      <div className="flex-grow overflow-y-auto overflow-hidden pr-2 space-y-3">
        {recentMatches.length > 0 ? (
          recentMatches.map((match, index) => (
            <div
              key={index}
              className="bg-[#1e2023] rounded-md p-3 flex flex-col"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-[#d1d0c5] font-medium">
                  vs {match.opponent}
                </span>
                <span className="text-[#646669] text-sm">{match.timeAgo}</span>
              </div>

              {/* WPM Comparison Bar */}
              <div className="flex space-x-2 items-center mb-2">
                <div className="flex-grow bg-[#323437] h-6 rounded-full overflow-hidden relative">
                  {/* User's WPM bar */}
                  <div
                    className={`absolute h-full ${
                      match.isWin ? "bg-[#4caf50]" : "bg-[#e91e63]"
                    } left-0 top-0`}
                    style={{
                      width: `${Math.min(
                        100,
                        (match.userWpm / (match.userWpm + match.opponentWpm)) *
                          100
                      )}%`,
                    }}
                  ></div>
                  {/* Opponent's WPM bar */}
                  <div
                    className={`absolute h-full ${
                      !match.isWin ? "bg-[#4caf50]" : "bg-[#e91e63]"
                    } right-0 top-0`}
                    style={{
                      width: `${Math.min(
                        100,
                        (match.opponentWpm /
                          (match.userWpm + match.opponentWpm)) *
                          100
                      )}%`,
                    }}
                  ></div>
                </div>
              </div>

              {/* Stats Row */}
              <div className="flex justify-between">
                <div className="text-center">
                  <div className="text-[#d1d0c5] font-bold">
                    {match.userWpm}
                  </div>
                  <div className="text-[#646669] text-xs">WPM</div>
                </div>
                <div className="text-center">
                  <div className="text-[#d1d0c5] font-bold">
                    {match.accuracy}%
                  </div>
                  <div className="text-[#646669] text-xs">Accuracy</div>
                </div>
                <div className="text-center">
                  <div
                    className={`font-bold ${
                      match.eloChange >= 0 ? "text-[#4caf50]" : "text-[#e91e63]"
                    }`}
                  >
                    {match.eloChange >= 0
                      ? `+${match.eloChange}`
                      : match.eloChange}
                  </div>
                  <div className="text-[#646669] text-xs">ELO</div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-[#646669]">
              <p className="mb-2">No recent matches</p>
              <p className="text-sm">Play ranked matches to see your history</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentMatchesCard;
