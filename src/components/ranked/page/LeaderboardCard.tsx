import React from "react";

// Define the type for top racers
interface TopRacer {
  name: string;
  rank: string;
  wpm: number;
  elo?: number;
}

// Component props definition
interface LeaderboardCardProps {
  topRacers: TopRacer[];
  isLoading: boolean;
}

/**
 * Displays the top typists leaderboard with their ranks, WPM, and ELO scores
 */
const LeaderboardCard: React.FC<LeaderboardCardProps> = ({
  topRacers,
  isLoading,
}) => {
  return (
    <div className="bg-[#2c2e31] rounded-lg p-6">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl font-bold text-[#d1d0c5]">Top Typrs</h2>
      </div>

      {/* Racer List */}
      <div className="space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="animate-pulse text-[#646669]">
              Loading leaderboard...
            </div>
          </div>
        ) : topRacers.length > 0 ? (
          topRacers.map((racer, index) => (
            <div
              key={index}
              className="flex items-center gap-4"
            >
              <div className="w-8 h-8 bg-[#323437] rounded-full flex items-center justify-center text-[#d1d0c5]">
                {index + 1}
              </div>
              <div className="flex-grow">
                <div className="flex items-center">
                  <img
                    src={`https://ui-avatars.com/api/?name=${racer.name}&background=random&color=fff&size=32`}
                    alt={racer.name}
                    className="w-8 h-8 rounded-full mr-3"
                  />
                  <div>
                    <p className="font-bold text-[#d1d0c5]">{racer.name}</p>
                    <p className="text-sm">
                      <span
                        className={`${
                          racer.rank === "Cherry MX"
                            ? "text-red-500"
                            : racer.rank === "Diamond"
                            ? "text-blue-400"
                            : racer.rank === "Platinum"
                            ? "text-cyan-400"
                            : racer.rank === "Gold"
                            ? "text-[#e2b714]"
                            : racer.rank === "Silver"
                            ? "text-gray-400"
                            : "text-blue-500" // Default for Plastic
                        } font-bold`}
                      >
                        {racer.rank}
                      </span>
                      {racer.elo && (
                        <span className="text-[#646669] ml-2">
                          {racer.elo} ELO
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-[#d1d0c5]">{racer.wpm} WPM</p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-4 text-[#646669]">
            No leaderboard data available
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaderboardCard;
