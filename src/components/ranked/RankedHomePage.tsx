import { rankedIcons } from "../../types/ranks";
import { useUser } from "../../contexts/UserContext";

interface RankedHomePageProps {
  onMatchmakingStarted: () => void;
}

const RankedHomePage = ({ onMatchmakingStarted }: RankedHomePageProps) => {
  const { userData } = useUser();
  const currentRank =
    Object.values(rankedIcons).find(
      (rank) =>
        userData?.stats?.overall?.elo &&
        userData?.stats?.overall?.elo >= rank.minElo &&
        userData?.stats?.overall?.elo <= rank.maxElo
    ) || rankedIcons.plastic;

  return (
    <div className="max-w-5xl mx-auto p-8 pt-24">
      <div className="flex items-center justify-center">
        <h1 className="text-6xl font-bold text-[#ffffff] mb-4">
          {userData?.username}
        </h1>
      </div>
      {/* Header Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-[#e2b714] mb-4">Ranked Mode</h1>
        <p className="text-[#646669] text-lg max-w-2xl mx-auto">
          Compete against other players in real-time typing races. Climb the
          ranks and prove your typing speed!
        </p>
      </div>

      {/* Current Stats Card */}
      <div className="bg-[#2c2e31] rounded-lg p-8 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="text-5xl">{currentRank.icon}</div>
            <div>
              <h2 className="text-2xl font-bold text-[#d1d0c5]">
                {currentRank.name}
              </h2>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-bold text-[#e2b714]">
                  {userData?.stats?.overall?.elo || 1000}
                </span>
                <span className="text-[#646669]">Rating</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[#646669] text-sm mb-1">Peak Rating</div>
            <div className="text-2xl text-[#d1d0c5]">
              {userData?.stats?.overall?.peakElo || 1000}
            </div>
          </div>
        </div>
      </div>

      {/* Queue Button */}
      <div className="flex justify-center">
        <button
          onClick={() => onMatchmakingStarted()}
          className="group relative bg-[#e2b714] hover:bg-[#e2b714]/90 text-[#323437] font-bold py-4 px-8 rounded-lg transition-all duration-200 transform hover:scale-105"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">Find Match</span>
            <span className="text-2xl group-hover:animate-pulse">⚔️</span>
          </div>
          <div className="absolute -bottom-6 left-0 right-0 text-center">
            <span className="text-[#646669] text-sm">
              Average Queue Time: ~30s
            </span>
          </div>
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-6 mt-16">
        <div className="bg-[#2c2e31] rounded-lg p-6 text-center">
          <h3 className="text-[#646669] text-sm mb-2">Matches Played</h3>
          <p className="text-2xl text-[#d1d0c5]">
            {(userData?.stats?.overall?.totalWins || 0) +
              (userData?.stats?.overall?.totalLosses || 0)}
          </p>
        </div>
        <div className="bg-[#2c2e31] rounded-lg p-6 text-center">
          <h3 className="text-[#646669] text-sm mb-2">Record</h3>
          <p className="text-2xl text-[#d1d0c5]">
            <span className="text-[#00a81f]">
              {userData?.stats?.overall?.totalWins || 0}W -{" "}
            </span>
            <span className="text-[#e21414]">
              {userData?.stats?.overall?.totalLosses || 0}L -{" "}
            </span>
            <span className="text-[#fffae8]">
              {userData?.stats?.overall?.totalTies || 0}T
            </span>
          </p>
        </div>
        <div className="bg-[#2c2e31] rounded-lg p-6 text-center">
          <h3 className="text-[#646669] text-sm mb-2">Win Rate</h3>
          <p className="text-2xl text-[#e2b714]">
            {((userData?.stats?.overall?.totalWins || 0) /
              ((userData?.stats?.overall?.totalWins || 0) +
                (userData?.stats?.overall?.totalLosses || 0)) +
              (userData?.stats?.overall?.totalTies || 0)) *
              100 || 0}
            %
          </p>
        </div>
      </div>
    </div>
  );
};

export default RankedHomePage;
