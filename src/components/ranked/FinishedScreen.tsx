import React, { useState, useEffect } from "react";
import StatsOverview from "../StatsOverview";
import { GameData } from "../../types";
import { useUser } from "../../contexts/UserContext";
import { useNavigate } from "react-router-dom";
import {
  FaTrophy,
  FaHome,
  FaChartLine,
  FaArrowUp,
  FaArrowDown,
} from "react-icons/fa";
import { rankedIcons } from "../../types/ranks";
import "./FinishedScreen.css";

interface RankedGameData extends GameData {
  ranked: true;
  initialElo: { [key: string]: number };
}

interface FinishedScreenProps {
  gameData: GameData;
  wpm: number;
  accuracy: number;
  startTime: number;
  wpmHistory: { wpm: number; time: number }[];
  charStats: {
    correct: number;
    incorrect: number;
    extra: number;
    missed: number;
  };
}

const FinishedScreen = ({
  gameData,
  wpm,
  accuracy,
  startTime,
  wpmHistory,
  charStats,
}: FinishedScreenProps) => {
  const { userData } = useUser();
  const userId = userData?.uid;
  const navigate = useNavigate();
  const isWinner = gameData.winner === userId;

  // Calculate real ELO change based on the game data
  const [eloChange, setEloChange] = useState<number>(0);
  const [currentElo, setCurrentElo] = useState<number>(
    userData?.stats?.overall?.elo || 1000
  );
  const [newElo, setNewElo] = useState<number>(currentElo);

  useEffect(() => {
    // Check if this is a ranked game
    const isRanked =
      "ranked" in gameData && (gameData as RankedGameData).ranked === true;

    if (isRanked && userId && gameData.winner) {
      const rankedGameData = gameData as RankedGameData;

      // Get the initial ELO values
      if (rankedGameData.initialElo && userId in rankedGameData.initialElo) {
        const initialElo = rankedGameData.initialElo[userId];
        setCurrentElo(initialElo);

        // Calculate ELO change based on the winner
        if (gameData.winner) {
          const winner = gameData.winner;
          const players = Object.keys(gameData.players);
          const loser = players.find((id) => id !== winner);

          if (
            loser &&
            winner &&
            rankedGameData.initialElo[winner] &&
            rankedGameData.initialElo[loser]
          ) {
            const winnerInitialElo = rankedGameData.initialElo[winner];
            const loserInitialElo = rankedGameData.initialElo[loser];

            // Use the same ELO formula as the backend
            const expectedScore =
              1 /
              (1 + Math.pow(10, (loserInitialElo - winnerInitialElo) / 400));
            const calculatedEloChange = Math.round(32 * (1 - expectedScore));

            // Apply the change based on whether the user won or lost
            const userEloChange = isWinner
              ? calculatedEloChange
              : -calculatedEloChange;
            setEloChange(userEloChange);
            setNewElo(initialElo + userEloChange);
          }
        }
      } else {
        // Fallback to current ELO from user data if initial ELO is not available
        const userElo = userData?.stats?.overall?.elo || 1000;
        setCurrentElo(userElo);

        // Use a simplified calculation as fallback
        const fallbackChange = isWinner ? 25 : -15;
        setEloChange(fallbackChange);
        setNewElo(userElo + fallbackChange);
      }
    } else {
      // Not a ranked game, use simplified calculation
      const userElo = userData?.stats?.overall?.elo || 1000;
      setCurrentElo(userElo);

      const fallbackChange = isWinner ? 25 : -15;
      setEloChange(fallbackChange);
      setNewElo(userElo + fallbackChange);
    }
  }, [gameData, userId, isWinner, userData]);

  // Animation for progress bar
  const [progressWidth, setProgressWidth] = useState(0);

  // Find current and next rank
  const getCurrentRank = (elo: number) => {
    const ranks = Object.entries(rankedIcons);
    for (const [key, rank] of ranks) {
      if (elo >= rank.minElo && elo <= rank.maxElo) {
        return { rankKey: key, ...rank };
      }
    }
    return { rankKey: "plastic", ...ranks[0][1] }; // Default to first rank
  };

  const currentRank = getCurrentRank(currentElo);
  const nextRank = getCurrentRank(newElo);
  const isNextRankDifferent = currentRank.rankKey !== nextRank.rankKey;

  // Calculate progress percentage within current rank
  const calculateProgress = (elo: number, rank: any) => {
    if (rank.maxElo === Infinity) return 100;
    const totalRange = rank.maxElo - rank.minElo;
    const progress = ((elo - rank.minElo) / totalRange) * 100;
    return Math.min(Math.max(progress, 0), 100);
  };

  const oldProgress = calculateProgress(currentElo, currentRank);
  const newProgress = isNextRankDifferent
    ? 100
    : calculateProgress(newElo, currentRank);

  useEffect(() => {
    // Animate progress bar after component mounts
    setTimeout(() => {
      setProgressWidth(newProgress);
    }, 500);
  }, [newProgress]);

  return (
    <div className="fixed inset-0 bg-[#1e1e1e] flex flex-col items-center justify-center p-6 overflow-y-auto">
      <div className="bg-[#2a2a2a] rounded-xl shadow-xl p-8 max-w-3xl w-full mx-auto border border-[#3a3a3a]">
        <div className="text-center mb-8">
          <h2 className="text-5xl font-bold mb-6 flex items-center justify-center gap-3 text-yellow-400">
            {isWinner ? (
              <>
                <FaTrophy className="text-yellow-400" />
                You won!
              </>
            ) : (
              <>
                <FaTrophy className="text-yellow-400" />
                {gameData.players[gameData.winner!]?.name} won!
              </>
            )}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            {Object.entries(gameData.players).map(([playerId, player]) => (
              <div
                key={playerId}
                className={`p-6 rounded-lg bg-[#333333] border-2 ${
                  playerId === gameData.winner
                    ? "border-yellow-500"
                    : "border-[#444444]"
                }`}
              >
                <div className="font-medium text-xl mb-3 flex items-center">
                  <span className="text-white">{player.name}</span>
                  {playerId === userId && (
                    <span className="ml-2 text-sm bg-yellow-500 text-black font-bold px-2 py-0.5 rounded-full">
                      You
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <span className="text-gray-400 text-sm mb-1">WPM</span>
                    <span className="text-yellow-400 font-mono text-2xl font-bold">
                      {player.wpm}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-400 text-sm mb-1">Accuracy</span>
                    <span className="text-white font-mono text-2xl">
                      {player.accuracy}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ELO Change and Rank Progress Section */}
        {userId && (
          <div className="bg-[#333333] p-6 rounded-lg mb-8 border border-[#444444]">
            <h3 className="text-xl font-semibold mb-6 flex items-center gap-2 text-white border-b border-[#444444] pb-3">
              <span className="text-yellow-400">{currentRank.icon}</span> Rank
              Progress
            </h3>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <span className="text-white font-mono text-xl mr-3">
                  {currentElo}
                </span>
                <span
                  className={`flex items-center ${
                    eloChange >= 0 ? "text-green-400" : "text-red-400"
                  } font-mono`}
                >
                  {eloChange >= 0 ? (
                    <FaArrowUp className="mr-1" />
                  ) : (
                    <FaArrowDown className="mr-1" />
                  )}
                  {Math.abs(eloChange)}
                </span>
              </div>
              <span className="text-white font-mono text-xl">{newElo}</span>
            </div>

            <div className="mb-2 flex justify-between text-sm">
              <span className="text-gray-400">{currentRank.name}</span>
              {isNextRankDifferent ? (
                <span className="text-yellow-400 animate-pulse font-bold">
                  Ranked up to {nextRank.name}! {nextRank.icon}
                </span>
              ) : (
                <span className="text-gray-400">
                  Next:{" "}
                  {Object.values(rankedIcons).find(
                    (r) => r.minElo > currentRank.maxElo
                  )?.name || "Max Rank"}
                </span>
              )}
            </div>

            <div className="relative h-4 bg-[#222222] rounded-full overflow-hidden mb-1">
              {/* Current rank marker */}
              <div
                className="absolute top-0 h-full w-0.5 bg-gray-400 z-10"
                style={{ left: "0%" }}
                title={`${currentRank.name} starts at ${currentRank.minElo} ELO`}
              />

              {/* Next rank marker */}
              {currentRank.maxElo !== Infinity && (
                <div
                  className="absolute top-0 h-full w-0.5 bg-yellow-400 z-10"
                  style={{ left: "100%" }}
                  title={`${
                    Object.values(rankedIcons).find(
                      (r) => r.minElo > currentRank.maxElo
                    )?.name
                  } starts at ${currentRank.maxElo + 1} ELO`}
                />
              )}

              {/* Original ELO progress */}
              <div
                className="absolute h-full bg-gradient-to-r from-yellow-600 to-yellow-400"
                style={{ width: `${oldProgress}%`, left: 0 }}
              ></div>

              {/* Gained ELO progress (animated) */}
              {eloChange > 0 && (
                <div
                  className="absolute h-full transition-all duration-1000 ease-out overflow-hidden"
                  style={{
                    width: `${progressWidth - oldProgress}%`,
                    left: `${oldProgress}%`,
                    transitionProperty: "width",
                    background: `repeating-linear-gradient(45deg, rgba(255, 204, 0, 0.9), rgba(255, 204, 0, 0.9) 8px, rgba(255, 180, 0, 0.7) 8px, rgba(255, 180, 0, 0.7) 16px)`,
                    animation: "moveStripes 2s linear infinite",
                  }}
                ></div>
              )}
            </div>

            {/* ELO markers */}
            <div className="flex justify-between text-xs text-gray-500">
              <span>{currentRank.minElo}</span>
              <span>
                {currentRank.maxElo === Infinity
                  ? `${currentRank.minElo}+`
                  : currentRank.maxElo}
              </span>
            </div>
          </div>
        )}

        <div className="bg-[#333333] p-6 rounded-lg mb-8 border border-[#444444]">
          <h3 className="text-xl font-semibold mb-6 flex items-center gap-2 text-white border-b border-[#444444] pb-3">
            <FaChartLine className="text-yellow-400" /> Your Performance
          </h3>
          <StatsOverview
            wpm={wpm}
            accuracy={accuracy}
            startTime={startTime}
            wpmHistory={wpmHistory}
            charStats={charStats}
          />
        </div>

        <div className="flex justify-center mt-8">
          <button
            className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-8 py-3 rounded-lg transition-all hover:shadow-lg"
            onClick={() => navigate("/")}
          >
            <FaHome /> Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinishedScreen;
