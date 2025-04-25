import { useState, useEffect } from "react";
import StatsOverview from "../StatsOverview";
import { GameData, Player, CharStats } from "../../types";
import { useUser } from "../../contexts/UserContext";
import { useNavigate } from "react-router-dom";
import {
  FaTrophy,
  FaHome,
  FaChartLine,
  FaArrowUp,
  FaArrowDown,
  FaHistory,

} from "react-icons/fa";
import { rankedIcons, getRankByElo } from "../../types/ranks";
import { RankIcon } from "../../components";
import "./FinishedScreen.css";
import { userStatsService } from "../../services/firebase";

import { Socket } from 'socket.io-client';

interface RankedGameData extends GameData {
  ranked: true;
  initialElo: { [key: string]: number };
}

interface FinishedScreenProps {
  gameData: GameData;
  wpm: number;
  accuracy: number;
  startTime: number;
  wpmHistory: Array<{ wpm: number; time: number }>;
  charStats: CharStats;
  socket: Socket | null;
  roomState: GameData;
  localUserId: string;
}

const FinishedScreen = ({
  gameData,
  wpm,
  accuracy,
  startTime,
  wpmHistory,
  charStats,
  socket,
  roomState,
  localUserId
}: FinishedScreenProps) => {
  const { userData, refreshUserData } = useUser();
  const userId = userData?.uid;
  const navigate = useNavigate();
  const isWinner = gameData.winner === userId;

  // Stats update tracking
  const [statsUpdated, setStatsUpdated] = useState(false);
  
  // Check if this is a ranked game - handle both property naming conventions
  const isRanked = ("ranked" in gameData && (gameData as RankedGameData).ranked === true) || gameData.isRanked === true;
  
  // Log game data properties for debugging
  console.log("[FinishedScreen] Game data properties:", {
    isRanked,
    hasRankedProp: "ranked" in gameData,
    rankedValue: "ranked" in gameData ? (gameData as any).ranked : undefined,
    hasIsRankedProp: "isRanked" in gameData,
    isRankedValue: "isRanked" in gameData ? gameData.isRanked : undefined
  });

  // Calculate real ELO change based on the game data
  const [eloChange, setEloChange] = useState<number>(0);
  const [currentElo, setCurrentElo] = useState<number>(
    userData?.stats?.overall?.elo || 1000
  );
  const [newElo, setNewElo] = useState<number>(currentElo);

  // Animation for progress bar
  const [progressWidth, setProgressWidth] = useState<number>(0);
  const [hasEnoughPlayers, setHasEnoughPlayers] = useState<boolean>(false);

  // Find current and next rank
  const getCurrentRank = (elo: number) => {
    return getRankByElo(elo);
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

  // Update hasEnoughPlayers state whenever gameData changes
  useEffect(() => {
    const connectedPlayers = Object.values(gameData.players).filter(
      (player) => player.connected
    );
    setHasEnoughPlayers(connectedPlayers.length >= 2);

    // Log player count for debugging
    console.log(`Connected players: ${connectedPlayers.length}`);
    if (connectedPlayers.length < 2) {
      console.log("Not enough players to enable Pick Next Topic button");
    }
  }, [gameData]);

  // Update user stats after the game
  useEffect(() => {
    const updateStats = async () => {
      if (!userId || statsUpdated || !gameData) return;

      // Calculate characters and words typed
      const wordsTyped = Math.round(wpm * ((Date.now() - startTime) / 60000));
      const charactersTyped = charStats.correct + charStats.incorrect;
      const totalMistakes =
        charStats.incorrect + charStats.missed + charStats.extra;
      const timePlayed = Math.round((Date.now() - startTime) / 1000);

      // Get the gameId from the URL or gameData
      const gameId = window.location.pathname.split("/").pop() || "";

      // Use the centralized service to update stats
      await userStatsService.updateUserStats(userId, {
        wpm,
        accuracy,
        wordsTyped,
        charactersTyped,
        totalMistakes,
        timePlayed,
        isRanked,
        isWinner,
        gameId,
      });

      setStatsUpdated(true);
      refreshUserData();
    };

    updateStats();
  }, [
    userId,
    gameData,
    wpm,
    accuracy,
    charStats,
    startTime,
    isWinner,
    statsUpdated,
    refreshUserData,
    isRanked,
  ]);

  // Calculate ELO change
  useEffect(() => {
    if (!isRanked) return;
    
    if (userId && gameData.winner) {
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
        const fallbackChange = isWinner ? 20 : -20;
        setEloChange(fallbackChange);
        setNewElo(userElo + fallbackChange);
      }
    } else {
      // Not a ranked game, use simplified calculation
      const userElo = userData?.stats?.overall?.elo || 1000;
      setCurrentElo(userElo);

      const fallbackChange = isWinner ? 20 : -20;
      setEloChange(fallbackChange);
      setNewElo(userElo + fallbackChange);
    }
  }, [gameData, userId, isWinner, userData, isRanked]);

  const handlePlayAgain = () => {
    if (socket) {
      console.log("[FinishedScreen] Emitting requestPlayAgain");
      socket.emit('requestPlayAgain');
    }
  };

  const canPlayAgain = roomState.status === 'finished';
  const localPlayerWantsPlayAgain = (roomState.players[localUserId] as Player | undefined)?.wantsPlayAgain;
  return (
    <div className="fixed inset-0 bg-[#1e1e1e] flex flex-col items-center justify-start p-4 pt-6 overflow-y-auto">
      <div className="bg-[#2a2a2a] rounded-xl shadow-xl p-4 md:p-6 max-w-3xl w-full mx-auto my-2 border border-[#3a3a3a]">
        <div className="text-center mb-4 md:mb-6">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6 flex items-center justify-center gap-3 text-yellow-400">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mt-4 md:mt-6">
            {Object.entries(gameData.players).map(([playerId, player]) => {
              // Determine if this card is for the local user
              const isLocalPlayerCard = playerId === userId;
              // Use the accurate props for the local user, otherwise use player data from gameData
              const displayWpm = isLocalPlayerCard ? wpm : player.wpm;
              const displayAccuracy = isLocalPlayerCard ? accuracy : player.accuracy;

              // Log opponent data for debugging
              if (!isLocalPlayerCard) {
                console.log(`[FinishedScreen] Opponent data for ${player.name} (${playerId}):`, player);
              }

              return (
                <div
                  key={playerId}
                  className={`p-4 md:p-6 rounded-lg bg-[#333333] border-2 ${
                    playerId === gameData.winner
                      ? "border-yellow-500"
                      : "border-[#444444]"
                  }`}
                >
                  <div className="font-medium text-lg md:text-xl mb-3 flex items-center">
                    <span className="text-white">{player.name}</span>
                    {isLocalPlayerCard && (
                      <span className="ml-2 text-sm bg-yellow-500 text-black font-bold px-2 py-0.5 rounded-full">
                        You
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <span className="text-gray-400 text-sm mb-1">WPM</span>
                      <span className="text-yellow-400 font-mono text-xl md:text-2xl font-bold">
                        {displayWpm}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-gray-400 text-sm mb-1">Accuracy</span>
                      <span className="text-white font-mono text-xl md:text-2xl">
                        {displayAccuracy}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ELO Change and Rank Progress Section */}
        {userId && isRanked && (
          <div className="bg-[#333333] p-4 md:p-6 rounded-lg mb-4 md:mb-6 border border-[#444444]">
            <h3 className="text-lg md:text-xl font-semibold mb-4 md:mb-6 flex items-center gap-2 text-white border-b border-[#444444] pb-3">
              <RankIcon rankKey={currentRank.rankKey} size={24} className="text-yellow-400" /> Rank Progress
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
                <span className="text-yellow-400 animate-pulse font-bold flex items-center gap-1">
                  Ranked up to {nextRank.name}! <RankIcon rankKey={nextRank.rankKey} size={20} />
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

            {/* Progress bar container - curved container */}
            <div className="relative h-5 bg-[#1a1a1a] rounded-lg overflow-hidden mb-2">
              {/* Rank boundary guides */}
              <div className="absolute inset-0 flex justify-between px-1 items-center pointer-events-none">
                <div className="h-3 w-0.5 bg-gray-700 opacity-50 rounded" />
                {currentRank.maxElo !== Infinity && (
                  <div className="h-3 w-0.5 bg-gray-700 opacity-50 rounded" />
                )}
              </div>
              
              {/* Determine progress bar appearance based on ELO change */}
              {eloChange >= 0 ? (
                // Gaining ELO (positive change)
                <>
                  {/* Base yellow progress (original ELO) - flat edges */}
                  <div
                    className="absolute h-full bg-yellow-500 transition-all duration-800 ease-out"
                    style={{ width: `${oldProgress}%` }}
                  />
                  
                  {/* Green gain section - flat edges */}
                  {progressWidth > oldProgress && (
                    <div
                      className="absolute h-full bg-green-600 transition-all duration-800 ease-out"
                      style={{ 
                        width: `${progressWidth - oldProgress}%`, 
                        left: `${oldProgress}%`,
                      }}
                    />
                  )}
                </>
              ) : (
                // Losing ELO (negative change)
                <>
                  {/* Red section for lost ELO - flat edges */}
                  {oldProgress > progressWidth && (
                    <div
                      className="absolute h-full bg-red-600 transition-all duration-800 ease-out"
                      style={{ 
                        width: `${oldProgress - progressWidth}%`,
                        left: `${progressWidth}%`,
                      }}
                    />
                  )}
                  
                  {/* Yellow for remaining ELO - flat edges */}
                  <div
                    className="absolute h-full bg-yellow-500 transition-all duration-800 ease-out"
                    style={{ 
                      width: `${progressWidth}%`, 
                    }}
                  />
                </>
              )}
              
              {/* Current position marker */}
              <div 
                className="absolute h-full w-0.5 bg-white z-10 transition-all duration-800 ease-out"
                style={{
                  left: `${progressWidth}%`,
                  boxShadow: '0 0 5px 1px rgba(255, 255, 255, 0.5)',
                }}
              />
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

        <div className="bg-[#333333] p-4 md:p-6 rounded-lg mb-4 md:mb-6 border border-[#444444]">
          <h3 className="text-lg md:text-xl font-semibold mb-4 md:mb-6 flex items-center gap-2 text-white border-b border-[#444444] pb-3">
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

        {/* Action Buttons */}
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 mt-6 md:mt-8 justify-center">
          {/* Ready for Next Game Button (Formerly Play Again/Pick Topic) */}
          {canPlayAgain && (
            <button
              onClick={handlePlayAgain}
              disabled={localPlayerWantsPlayAgain || !hasEnoughPlayers}
              className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors w-full md:w-auto text-lg ${
                localPlayerWantsPlayAgain || !hasEnoughPlayers
                  ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                  : "bg-yellow-500 hover:bg-yellow-600 text-black"
              }`}
            >
              <FaHistory />
              {localPlayerWantsPlayAgain ? "Waiting for others..." : !hasEnoughPlayers ? "Not enough players" : "Pick Next Topic"}
            </button>
          )}

          {/* Return Home Button */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors w-full md:w-auto bg-[#444444] hover:bg-[#555555] text-white text-lg"
          >
            <FaHome />
            Return Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinishedScreen;
