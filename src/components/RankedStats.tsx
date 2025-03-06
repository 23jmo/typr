import { useUser } from "../contexts/UserContext";
import { rankedIcons } from "../types/ranks";

const RankedStats = () => {
  const { userData } = useUser();

  const getUserRank = () => {
    const avgWpm = userData?.stats?.overall?.averageWPM || 0;
    return (
      Object.values(rankedIcons).find(
        (rank) => avgWpm >= rank.minWPM && avgWpm <= rank.maxWPM
      ) || rankedIcons.plastic
    );
  };

  const currentRank = getUserRank();
  const nextRank = Object.values(rankedIcons).find(
    (rank) => rank.minWPM > (userData?.stats?.overall?.averageWPM || 0)
  );

  return (
    <div className="max-w-5xl mx-auto p-8">
      {/* Rank Display */}
      <div className="bg-[#2c2e31] rounded-lg p-8 mb-8">
        <div className="flex items-center gap-8">
          <div className="text-6xl">{currentRank.icon}</div>
          <div>
            <h2 className="text-4xl font-bold text-[#e2b714] mb-2">
              {currentRank.name}
            </h2>
            <p className="text-[#646669]">
              {nextRank
                ? `${
                    nextRank.minWPM -
                    (userData?.stats?.overall?.averageWPM || 0)
                  } WPM until ${nextRank.name}`
                : "Maximum rank achieved!"}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-[#2c2e31] rounded-lg p-6">
          <h3 className="text-[#646669] text-sm mb-4">Competitive Stats</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-[#646669] text-sm">Rating</p>
              <p className="text-3xl text-[#e2b714]">
                {userData?.stats?.overall?.elo || 1000}
              </p>
            </div>
            <div>
              <p className="text-[#646669] text-sm">Peak Rating</p>
              <p className="text-3xl text-[#e2b714]">
                {userData?.stats?.overall?.peakElo || 1000}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-[#2c2e31] rounded-lg p-6">
          <h3 className="text-[#646669] text-sm mb-4">Win/Loss Record</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[#646669] text-sm">Wins</p>
              <p className="text-3xl text-green-500">
                {userData?.stats?.overall?.totalWins || 0}
              </p>
            </div>
            <div>
              <p className="text-[#646669] text-sm">Losses</p>
              <p className="text-3xl text-red-500">
                {userData?.stats?.overall?.totalLosses || 0}
              </p>
            </div>
            <div>
              <p className="text-[#646669] text-sm">Win Rate</p>
              <p className="text-3xl text-[#e2b714]">
                {userData?.stats?.overall?.winRate || 0}%
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="col-span-2 bg-[#2c2e31] rounded-lg p-6">
          <h3 className="text-[#646669] text-sm mb-4">Rank Progress</h3>
          <div className="relative h-4 bg-[#323437] rounded-full overflow-hidden">
            <div
              className="absolute h-full bg-[#e2b714] rounded-full transition-all duration-300"
              style={{
                width: `${
                  (((userData?.stats?.overall?.averageWPM || 0) -
                    currentRank.minWPM) /
                    (nextRank ? nextRank.minWPM - currentRank.minWPM : 1)) *
                  100
                }%`,
              }}
            />
          </div>
          <div className="flex justify-between mt-2 text-sm text-[#646669]">
            <span>{currentRank.minWPM} WPM</span>
            <span>{nextRank ? `${nextRank.minWPM} WPM` : "Max"}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RankedStats;
