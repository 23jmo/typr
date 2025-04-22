import { useState, useEffect } from "react";
import { rankedIcons } from "../types/ranks";
import { useUser } from "../contexts/UserContext";
import { useNavigate } from "react-router-dom";
import { socket } from "../services/socket.ts";
import { FaMedal, FaChartLine, FaPercentage } from "react-icons/fa"; // Icons for stats
import { motion } from "framer-motion"; // For subtle animations

// Define rank key type for type safety (copied from previous context if needed)
type RankKey = keyof typeof rankedIcons;

const Ranked = () => {
  const { userData } = useUser();
  const navigate = useNavigate();

  // Matchmaking State
  const [isSearching, setIsSearching] = useState(false);
  const [matchmakingError, setMatchmakingError] = useState<string | null>(null);

  // Function to determine user's rank and progress (simplified, only need rank name and key)
  const getUserRank = () => {
    const elo = userData?.stats?.overall?.elo || 0;

    const baseRank =
      Object.values(rankedIcons).find(
        (rank) => elo >= rank.minElo && elo <= rank.maxElo
      ) || rankedIcons.plastic; // Default to plastic if not found

    const rankKey =
      (Object.entries(rankedIcons).find(
        ([_, rank]) => rank === baseRank
      )?.[0] as RankKey) || "plastic";

    return {
      rankName: baseRank.name,
      rankKey: rankKey,
    };
  };

  // Get user's rank information
  const userRank = getUserRank();
  const userElo = userData?.stats?.overall?.elo || 0;

  // Calculate win rate safely
  const calculateWinRate = () => {
    const wins = userData?.stats?.ranked?.totalWins || 0; // Use ranked wins/losses
    const losses = userData?.stats?.ranked?.totalLosses || 0;
    const total = wins + losses;

    if (total === 0) return 0;
    return Math.round((wins / total) * 100);
  };
  const winRate = calculateWinRate();

  // --- Start Matchmaking ---
  const handleFindMatch = () => {
    if (!userData) {
      setMatchmakingError("Please log in to play ranked.");
      return;
    }
    if (!userData.username) {
      setMatchmakingError("Please set a username in your profile first.");
      // Optional: navigate('/profile') or show a prompt
      return;
    }
    if (!socket || !socket.connected) {
      setMatchmakingError("Connecting to server... try again shortly.");
      // Attempt to reconnect or inform user
      socket.connect(); // Try to connect if disconnected
      return;
    }
    if (isSearching) return; // Prevent multiple clicks

    console.log("Initiating findMatch...");
    setMatchmakingError(null);
    setIsSearching(true); // Show loading state immediately

    socket.emit("findMatch", {
      userId: userData.uid,
      username: userData.username,
      elo: userData.stats?.overall?.elo || 0,
    });
  };

  // --- Clear matchmaking error ---
  const handleClearError = () => {
    setMatchmakingError(null);
  };

  // --- Socket Listeners Effect ---
  useEffect(() => {
    if (!socket) return;

    const handleMatchFound = (data: { roomId: string }) => {
      console.log(`[Socket] Match found! Room ID: ${data.roomId}`);
      setIsSearching(false); // Stop searching state
      navigate(`/race/${data.roomId}`); // Navigate to the game room
    };

    const handleSearching = () => {
      console.log("[Socket] Now searching for match...");
      setIsSearching(true); // Ensure searching state is active
      setMatchmakingError(null); // Clear previous errors
    };

    const handleAlreadyInQueue = () => {
      console.log("[Socket] Already in queue.");
      setIsSearching(true); // Ensure state reflects searching
      setMatchmakingError(null);
    };

    const handleError = (data: { message: string }) => {
      console.error("[Socket] Matchmaking Error:", data.message);
      setIsSearching(false); // Stop searching on error
      setMatchmakingError(
        data.message || "An unknown matchmaking error occurred."
      );
    };

    // Listen for cancellation confirmation (if initiated elsewhere or by server)
    const handleCancelled = () => {
      console.log("[Socket] Matchmaking cancelled.");
      setIsSearching(false);
      setMatchmakingError(null);
    };

    socket.on("matchFound", handleMatchFound);
    socket.on("searchingForMatch", handleSearching);
    socket.on("alreadyInQueue", handleAlreadyInQueue);
    socket.on("matchmakingError", handleError);
    socket.on("matchmakingCancelled", handleCancelled); // Listen for cancellations

    // Check initial connection status
    if (!socket.connected) {
      setMatchmakingError(
        "Disconnected from server. Attempting to reconnect..."
      );
      socket.connect();
    } else {
      setMatchmakingError(null); // Clear disconnect message if connected
    }

    // Cleanup listeners on component unmount
    return () => {
      socket.off("matchFound", handleMatchFound);
      socket.off("searchingForMatch", handleSearching);
      socket.off("alreadyInQueue", handleAlreadyInQueue);
      socket.off("matchmakingError", handleError);
      socket.off("matchmakingCancelled", handleCancelled);
    };
    // Rerun if socket instance changes (though typically it shouldn't)
  }, [navigate, socket]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-[#323437] text-white p-4 pt-16">
      {/* Header section with logo/icon - similar to Overwatch */}
      <div className="mb-12 w-full flex items-center px-4 md:px-8">
        <div className="text-yellow-500 mr-3">
          <FaMedal size={36} />
        </div>
        <h1 className="text-5xl font-bold tracking-wider uppercase text-slate-200 italic">
          RANKED MODE
        </h1>
      </div>

      <div className="w-full px-4 md:px-8">
        {/* Match Stats Section */}
        <div className="mb-32 flex justify-between items-center">
          <div className="flex items-center">
            <span className="text-xl uppercase tracking-wider text-[#d1d0c5] font-bold mr-3">
              ELO
            </span>
            <span className="text-3xl font-bold text-yellow-400">
              {userElo}
            </span>
          </div>
          <div>
            <span className="text-yellow-400 font-bold">{winRate}%</span>
            <span className="text-[#d1d0c5] text-sm ml-2">WIN RATE</span>
          </div>
        </div>

        {/* Role Cards Row - styled like Overwatch hexagon cards */}
        <div className="flex justify-center gap-4 mb-12">
          {/* Rank Card */}
          <motion.div
            className="relative flex-1"
            whileHover={{ scale: 1.05 }}
          >
            <div className="absolute inset-0 bg-[#2c2e31] rounded-lg transform rotate-3 opacity-40"></div>
            <div className="relative bg-[#272829] border-2 border-yellow-500/30 rounded-lg p-6 flex flex-col items-center h-full">
              <div className="bg-[#1e1f20] p-3 rounded-full mb-4">
                <FaMedal className="text-4xl text-yellow-400" />
              </div>
              <span className="text-xl font-bold text-white mb-1">
                {userRank.rankName}
              </span>
              <span className="text-sm uppercase text-[#d1d0c5] opacity-80">
                Current Rank
              </span>
              <div className="mt-4 pt-2 border-t border-[#444444] w-full text-center">
                <span className="text-sm text-[#d1d0c5]">
                  +{userData?.stats?.ranked?.gamesPlayed || 0} Games
                </span>
              </div>
            </div>
          </motion.div>

          {/* WPM Card */}
          <motion.div
            className="relative flex-1"
            whileHover={{ scale: 1.05 }}
          >
            <div className="absolute inset-0 bg-[#2c2e31] rounded-lg transform rotate-3 opacity-40"></div>
            <div className="relative bg-[#272829] border-2 border-yellow-500/30 rounded-lg p-6 flex flex-col items-center h-full">
              <div className="bg-[#1e1f20] p-3 rounded-full mb-4">
                <FaChartLine className="text-4xl text-yellow-400" />
              </div>
              <span className="text-xl font-bold text-white mb-1">
                {userData?.stats?.overall?.averageWPM || 0}
              </span>
              <span className="text-sm uppercase text-[#d1d0c5] opacity-80">
                Average WPM
              </span>
              <div className="mt-4 pt-2 border-t border-[#444444] w-full text-center">
                <span className="text-sm text-[#d1d0c5]">
                  Best: {userData?.stats?.overall?.bestWPM || 0}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Games Played Card */}
          <motion.div
            className="relative flex-1"
            whileHover={{ scale: 1.05 }}
          >
            <div className="absolute inset-0 bg-[#2c2e31] rounded-lg transform rotate-3 opacity-40"></div>
            <div className="relative bg-[#272829] border-2 border-yellow-500/30 rounded-lg p-6 flex flex-col items-center h-full">
              <div className="bg-[#1e1f20] p-3 rounded-full mb-4">
                <FaPercentage className="text-4xl text-yellow-400" />
              </div>
              <span className="text-xl font-bold text-white mb-1">
                {userData?.stats?.ranked?.gamesPlayed || 0}
              </span>
              <span className="text-sm uppercase text-[#d1d0c5] opacity-80">
                Games Played
              </span>
              <div className="mt-4 pt-2 border-t border-[#444444] w-full text-center">
                <span className="text-sm text-[#d1d0c5]">
                  {userData?.stats?.ranked?.totalWins || 0} Wins
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Action Button - centered at bottom like Overwatch */}
        <div className="flex justify-center w-full">
          <motion.button
            onClick={handleFindMatch}
            disabled={isSearching}
            className={`w-full py-4 text-2xl font-bold uppercase tracking-wider rounded-lg shadow-lg transition-all duration-300 ease-in-out focus:outline-none ${
              isSearching
                ? "bg-slate-600 cursor-not-allowed"
                : "bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-400 hover:to-yellow-300 text-slate-900"
            }`}
            whileHover={{ scale: isSearching ? 1 : 1.05 }}
            whileTap={{ scale: isSearching ? 1 : 0.95 }}
          >
            {isSearching ? (
              <div className="flex items-center w-full justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-slate-800"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Searching...
              </div>
            ) : (
              "Start"
            )}
          </motion.button>
        </div>

        {/* Status Message - below button, shows when searching */}
        {isSearching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 text-center text-slate-300 text-sm"
          >
            <div className="mb-1 text-xl">
              Looking for players around {userElo} ELO...
            </div>
            <div className="text-yellow-400 font-bold">
              Average Wait Time: ~1 min
            </div>
          </motion.div>
        )}

        {/* Error Message */}
        {matchmakingError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 text-red-300 bg-red-900/30 px-4 py-3 rounded-md text-center flex justify-between items-center"
          >
            <span>{matchmakingError}</span>
            <button
              onClick={handleClearError}
              className="ml-2 text-red-200 hover:text-white font-bold"
            >
              &times;
            </button>
          </motion.div>
        )}

        {/* Navigation at bottom - like Overwatch */}
        <div className="mt-16 flex justify-between w-full"></div>
      </div>
    </div>
  );
};

export default Ranked;
