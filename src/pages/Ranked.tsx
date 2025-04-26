import { useState, useEffect } from "react";
import { rankedIcons } from "../types/ranks";
import { useUser } from "../contexts/UserContext";
import { useNavigate } from "react-router-dom";
import { socket } from "../services/socket.ts";
import { FaMedal, FaChartLine, FaPercentage, FaTrophy, FaSpinner } from "react-icons/fa"; // Added FaSpinner
import { motion } from "framer-motion"; // For subtle animations
import MatchmakingScreen from "../components/ranked/MatchmakingScreen"; // Import MatchmakingScreen
import { leaderboardService } from "../services/firebase"; // Import leaderboard service
import MedalIcon from "../assets/MedalIcon"; // Import our custom MedalIcon component

// Define rank key type for type safety (copied from previous context if needed)
type RankKey = keyof typeof rankedIcons;

// Define leaderboard types
interface LeaderboardUser {
  uid: string;
  username: string;
  elo: number;
  rank: string;
  averageWPM: number;
}

interface LeaderboardData {
  updatedAt: string | { seconds: number; nanoseconds: number };
  topUsers: LeaderboardUser[];
}

const Ranked = () => {
  const { userData } = useUser();
  const navigate = useNavigate();

  // Matchmaking State
  const [isSearching, setIsSearching] = useState(false);
  const [matchmakingError, setMatchmakingError] = useState<string | null>(null);
  const [searchTime, setSearchTime] = useState(0);
  // Leaderboard State
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);

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

  // Fetch leaderboard data
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLeaderboardLoading(true);
        const data = await leaderboardService.getGlobalLeaderboard();
        setLeaderboard(data as LeaderboardData);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      } finally {
        setLeaderboardLoading(false);
      }
    };
    
    fetchLeaderboard();
  }, []);

  // Format the updated date
  const formatLastUpdated = (dateString: string | { seconds: number; nanoseconds: number }) => {
    if (!dateString) return "";
    
    try {
      // Handle Firestore timestamp objects
      let date: Date;
      if (typeof dateString === 'object' && 'seconds' in dateString) {
        date = new Date(dateString.seconds * 1000);
      } else {
        date = new Date(dateString);
      }

      // Check if date is valid
      if (isNaN(date.getTime())) {
        return "Recently";
      }
      
      return date.toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      console.error("Error formatting date:", e);
      return "Recently";
    }
  };

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
    
    console.log("Initiating findMatch...");
    setMatchmakingError(null);
    setIsSearching(true); // Show MatchmakingScreen
    setSearchTime(0); // Reset search time

    // Start tracking search time
    const timeInterval = setInterval(() => {
      setSearchTime(prev => prev + 1);
    }, 1000);

    // Emit socket event to find match
    socket.emit("findMatch", {
      userId: userData.uid,
      username: userData.username,
      elo: userData.stats?.overall?.elo || 0,
    });

    // Clean up interval when component unmounts or search ends
    return () => clearInterval(timeInterval);
  };

  // --- Cancel matchmaking ---
  const handleCancelSearch = () => {
    console.log("Cancelling search...");
    if (socket && socket.connected) {
      socket.emit("cancelMatchmaking", { userId: userData?.uid });
    }
    setIsSearching(false);
    setSearchTime(0);
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
      setSearchTime(0); // Reset search time
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
      setSearchTime(0); // Reset search time
      setMatchmakingError(
        data.message || "An unknown matchmaking error occurred."
      );
    };

    // Listen for cancellation confirmation (if initiated elsewhere or by server)
    const handleCancelled = () => {
      console.log("[Socket] Matchmaking cancelled.");
      setIsSearching(false);
      setSearchTime(0); // Reset search time
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

  // If searching is true, show the MatchmakingScreen instead of the regular UI
  if (isSearching) {
    return (
      <div className="min-h-screen bg-[#323437] text-white">
        <MatchmakingScreen 
          searchTime={searchTime} 
          onCancel={handleCancelSearch} 
          error={matchmakingError} 
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-[#323437] text-white p-4 pt-16">
      {/* Header section with logo/icon - similar to Overwatch */}
      <div className="mb-12 w-full max-w-4xl mx-auto flex items-center px-4 md:px-8 mt-12">
        <div className="text-yellow-500 mr-3">
          <FaMedal size={36} />
        </div>
        <h1 className="text-5xl font-bold tracking-wider uppercase text-slate-200 italic">
          RANKED MODE
        </h1>
      </div>

      <div className="w-full max-w-4xl mx-auto px-4 md:px-8">
        {/* Match Stats Section */}
        <div className="mb-16 flex justify-between items-center">
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

        {/* Leaderboard Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-[#d1d0c5] flex items-center">
              <FaTrophy className="text-yellow-400 mr-2" /> Leaderboard
            </h2>
            <span className="text-sm text-[#646669]">
              {leaderboard?.updatedAt ? `Updated: ${formatLastUpdated(leaderboard.updatedAt)}` : ''}
            </span>
          </div>
          
          {leaderboardLoading ? (
            <div className="bg-[#272829] rounded-lg p-12 text-center flex justify-center items-center">
              <FaSpinner className="text-[#d1d0c5] text-2xl animate-spin mr-3" />
              <p className="text-[#d1d0c5]">Loading leaderboard...</p>
            </div>
          ) : (
            <div className="bg-[#272829] rounded-lg overflow-hidden">
              <table className="w-full table-auto">
                <thead>
                  <tr className="bg-[#1e1f20]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#d1d0c5] uppercase tracking-wider">Rank</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[#d1d0c5] uppercase tracking-wider">Player</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#d1d0c5] uppercase tracking-wider">ELO</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[#d1d0c5] uppercase tracking-wider">Avg WPM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#323437]">
                  {leaderboard?.topUsers && leaderboard.topUsers.length > 0 ? (
                    leaderboard.topUsers.map((user, index) => (
                      <tr key={user.uid} className={`${user.uid === userData?.uid ? 'bg-[#2c2e31]' : ''}`}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <MedalIcon position={index + 1} size={20} />
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className={`font-medium ${user.uid === userData?.uid ? 'text-yellow-400' : 'text-white'}`}>
                              {user.username || "Anonymous"}
                              {user.uid === userData?.uid && (
                                <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
                                  You
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                          <span className="text-[#e2b714]">{user.elo}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                          {user.averageWPM || 0}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-[#646669]">
                        No leaderboard data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Action Button - centered at bottom like Overwatch */}
        <div className="flex justify-center w-full max-w-2xl mx-auto">
          <motion.button
            onClick={handleFindMatch}
            className="w-full max-w-sm py-4 text-2xl font-bold uppercase tracking-wider rounded-lg shadow-lg transition-all duration-300 ease-in-out focus:outline-none bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-400 hover:to-yellow-300 text-slate-900"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Start
          </motion.button>
        </div>

        {/* Error Message */}
        {matchmakingError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 text-red-300 bg-red-900/30 px-4 py-3 rounded-md text-center flex justify-between items-center max-w-2xl mx-auto"
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
