import { useState, useEffect } from "react";
import { rankedIcons } from "../types/ranks";
import { useUser } from "../contexts/UserContext";
import MatchmakingScreen from "../components/ranked/MatchmakingScreen";
import PerformanceGraph from "../components/ranked/PerformanceGraph";
import { MatchData } from "../types";
import { FaClock, FaUsers, FaBolt, FaChevronRight } from "react-icons/fa";
import { leaderboardService } from "../services/firebase";
import { useNavigate } from "react-router-dom";
import { socket } from "../services/socket.ts";

// Define rank key type for type safety
type RankKey = 'plastic' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'cherryMX';

// Define the type for top racers
interface TopRacer {
  name: string;
  rank: string;
  wpm: number;
  elo?: number;
}

const Ranked = () => {
  const { userData } = useUser();
  const [topRacers, setTopRacers] = useState<TopRacer[]>([
    { name: "TypeMaster99", rank: "CherryMX", wpm: 145 },
    { name: "SpeedDemon", rank: "Diamond", wpm: 135 },
    { name: "KeyboardWarrior", rank: "Diamond", wpm: 130 },
    { name: "SwiftKeys", rank: "Platinum", wpm: 120 },
    { name: "FastFingers", rank: "Platinum", wpm: 115 }
  ]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardLastUpdated, setLeaderboardLastUpdated] = useState<string | null>(null);
  const [updatingLeaderboard, setUpdatingLeaderboard] = useState(false);
  const navigate = useNavigate();

  // --- NEW Matchmaking State ---
  const [isSearching, setIsSearching] = useState(false);
  const [searchStartTime, setSearchStartTime] = useState<number | null>(null);
  const [elapsedSearchTime, setElapsedSearchTime] = useState(0);
  const [matchmakingError, setMatchmakingError] = useState<string | null>(null);

  // Fetch leaderboard data
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLeaderboardLoading(true);
        const leaderboardData = await leaderboardService.getGlobalLeaderboard();
        
        if (leaderboardData && leaderboardData.topUsers && leaderboardData.topUsers.length > 0) {
          // Transform data to match the UI format
          const formattedData = leaderboardData.topUsers.map((user: any) => ({
            name: user.username || "Anonymous",
            rank: user.rank,
            wpm: user.averageWPM || 0,
            elo: user.elo
          }));
          
          setTopRacers(formattedData);
          
          // Format the last updated date
          if (leaderboardData.updatedAt) {
            const updatedDate = new Date(leaderboardData.updatedAt);
            setLeaderboardLastUpdated(updatedDate.toLocaleDateString());
          }
        }
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      } finally {
        setLeaderboardLoading(false);
      }
    };
    
    fetchLeaderboard();
  }, []);

  // Function to manually update the leaderboard
  const handleUpdateLeaderboard = async () => {
    try {
      setUpdatingLeaderboard(true);
      const result = await leaderboardService.updateLeaderboardNow();
      
      if (result.success) {
        console.log("Leaderboard update successful, new data:", result);
        
        // Transform data to match the UI format
        if (result.topUsers && result.topUsers.length > 0) {
          const formattedData = result.topUsers.map((user: any) => ({
            name: user.username || "Anonymous",
            rank: user.rank,
            wpm: user.averageWPM || 0,
            elo: user.elo
          }));
          
          console.log("Formatted data for UI:", formattedData);
          setTopRacers(formattedData);
          
          // Format the last updated date
          if (result.updatedAt) {
            const updatedDate = new Date(result.updatedAt);
            setLeaderboardLastUpdated(updatedDate.toLocaleDateString());
          }
        } else {
          console.warn("No top users found in the result:", result);
        }
        
        alert("Leaderboard updated successfully!");
      } else {
        console.error("Failed to update leaderboard:", result.error);
        alert(`Failed to update leaderboard: ${result.error}`);
      }
    } catch (error) {
      console.error("Error updating leaderboard:", error);
      alert("An error occurred while updating the leaderboard");
    } finally {
      setUpdatingLeaderboard(false);
    }
  };

  // Function to determine user's rank and progress to next rank
  const getUserRankAndProgress = () => {
    // Find the base rank based on ELO
    const elo = userData?.stats?.overall?.elo || 0;
    
    const baseRank = Object.values(rankedIcons).find(
      (rank) =>
        elo >= rank.minElo &&
        elo <= rank.maxElo
    ) || rankedIcons.plastic;
    
    // Find the rank key by comparing the found rank object with the rankedIcons objects
    const rankKey = Object.entries(rankedIcons).find(
      ([_, rank]) => rank === baseRank
    )?.[0] as RankKey || 'plastic';
    
    // Find the next rank (if any)
    const sortedRanks = Object.values(rankedIcons).sort((a, b) => a.minElo - b.minElo);
    const currentRankIndex = sortedRanks.findIndex(rank => rank === baseRank);
    const nextRank = currentRankIndex < sortedRanks.length - 1 ? sortedRanks[currentRankIndex + 1] : null;
    
    // Calculate progress to next rank
    let progressPercent = 0;
    if (nextRank) {
      const rangeInCurrentRank = baseRank.maxElo - baseRank.minElo;
      const progressInCurrentRank = elo - baseRank.minElo;
      progressPercent = Math.min(Math.round((progressInCurrentRank / rangeInCurrentRank) * 100), 100);
    } else {
      // If at max rank, show 100%
      progressPercent = 100;
    }
    
    return {
      rankName: baseRank.name,
      rankIcon: baseRank.icon,
      elo: elo,
      rankKey: rankKey,
      nextRankName: nextRank?.name || null,
      progressPercent: progressPercent,
      eloToNextRank: nextRank ? nextRank.minElo - elo : 0
    };
  };

  // Get user's rank information
  const userRank = getUserRankAndProgress();

  // Get text color based on rank
  const getRankColor = (rankKey: RankKey): string => {
    switch(rankKey) {
      case 'plastic':
        return 'text-blue-500';
      case 'silver':
        return 'text-gray-400';
      case 'gold':
        return 'text-[#e2b714]';
      case 'platinum':
        return 'text-cyan-400';
      case 'diamond':
        return 'text-blue-400';
      case 'cherryMX':
        return 'text-red-500';
      default:
        return 'text-[#e2b714]';
    }
  };

  // Get progress bar color based on rank
  const getProgressBarColor = (rankKey: RankKey): string => {
    switch(rankKey) {
      case 'plastic':
        return 'bg-blue-500';
      case 'silver':
        return 'bg-gray-400';
      case 'gold':
        return 'bg-[#e2b714]';
      case 'platinum':
        return 'bg-cyan-400';
      case 'diamond':
        return 'bg-blue-400';
      case 'cherryMX':
        return 'bg-red-500';
      default:
        return 'bg-[#e2b714]';
    }
  };

  // Format timestamp to "X time ago" format
  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes} min ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  // Use actual data from user document or fallback to empty array
  const recentMatches: MatchData[] = userData?.recentMatches ? 
    userData.recentMatches.map(match => ({
      opponent: match.opponentName || "Unknown",
      timeAgo: formatTimeAgo(match.timestamp || Date.now()),
      userWpm: match.userWpm || 0,
      opponentWpm: match.opponentWpm || 0,
      isWin: match.isWin || false,
      eloChange: match.eloChange || 0,
      accuracy: match.accuracy || 0
    })) : [];

  // Debug log to check if recentMatches is being populated correctly
  console.log("userData:", userData);
  console.log("userData.recentMatches:", userData?.recentMatches);
  console.log("recentMatches:", recentMatches);

  // Calculate win rate safely
  const calculateWinRate = () => {
    const wins = userData?.stats?.overall?.totalWins || 0;
    const losses = userData?.stats?.overall?.totalLosses || 0;
    const total = wins + losses;
    
    if (total === 0) return 0;
    return Math.round((wins / total) * 100);
  };

  // --- UPDATED: Start Matchmaking ---
  const handleFindMatch = () => {
     if (!userData) {
         setMatchmakingError("Please log in to play ranked matches.");
         return;
     }
     if (!socket || !socket.connected) {
          setMatchmakingError("Not connected to server. Please refresh.");
          return;
     }
     console.log("Initiating findMatch...");
     setMatchmakingError(null);
     setIsSearching(true); // Set searching state immediately for responsiveness
     setSearchStartTime(Date.now());
     socket.emit("findMatch", {
         userId: userData.uid,
         username: userData.username,
         elo: userData.stats?.overall?.elo || 0, // Send current ELO
     });
  };

  // --- NEW: Cancel Matchmaking ---
  const handleCancelMatchmaking = () => {
      if (!socket) return;
      console.log("Cancelling matchmaking...");
      socket.emit("cancelMatchmaking");
      // State updates (isSearching=false, etc.) will be handled by the 'matchmakingCancelled' event listener
  };

  // --- Socket Listeners Effect ---
  useEffect(() => {
    if (!socket) return;

    const handleMatchFound = (data: { roomId: string }) => {
        console.log(`[Socket] Match found! Room ID: ${data.roomId}`);
        setIsSearching(false);
        setSearchStartTime(null);
        setElapsedSearchTime(0);
        // Navigate to the RaceRoom page
        navigate(`/race/${data.roomId}`);
    };

    const handleSearching = () => {
        console.log("[Socket] Now searching for match...");
        setIsSearching(true);
        setSearchStartTime(Date.now());
        setMatchmakingError(null); // Clear previous errors
    };

    const handleAlreadyInQueue = () => {
         console.log("[Socket] Already in queue.");
         setIsSearching(true); // Ensure state reflects searching
         if (!searchStartTime) setSearchStartTime(Date.now()); // Set start time if not already set
         setMatchmakingError(null);
    };

    const handleError = (data: { message: string }) => {
        console.error("[Socket] Matchmaking Error:", data.message);
        setIsSearching(false);
        setSearchStartTime(null);
        setElapsedSearchTime(0);
        setMatchmakingError(data.message || "An unknown matchmaking error occurred.");
    };

    const handleCancelled = () => {
         console.log("[Socket] Matchmaking cancelled by server/user.");
         setIsSearching(false);
         setSearchStartTime(null);
         setElapsedSearchTime(0);
         setMatchmakingError(null);
    };

    socket.on("matchFound", handleMatchFound);
    socket.on("searchingForMatch", handleSearching);
    socket.on("alreadyInQueue", handleAlreadyInQueue);
    socket.on("matchmakingError", handleError);
    socket.on("matchmakingCancelled", handleCancelled);

    // Cleanup listeners on component unmount
    return () => {
      socket.off("matchFound", handleMatchFound);
      socket.off("searchingForMatch", handleSearching);
      socket.off("alreadyInQueue", handleAlreadyInQueue);
      socket.off("matchmakingError", handleError);
      socket.off("matchmakingCancelled", handleCancelled);
    };
  }, [navigate, searchStartTime]); // Add searchStartTime dependency

  // --- Timer Effect for Search Time ---
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (isSearching && searchStartTime) {
      intervalId = setInterval(() => {
        setElapsedSearchTime(Math.floor((Date.now() - searchStartTime) / 1000));
      }, 1000);
    } else {
      setElapsedSearchTime(0);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isSearching, searchStartTime]);

  return (
    <div className="min-h-screen overflow-y-auto">
      {/* --- Conditionally render MatchmakingScreen or Ranked Home Page --- */}
      {isSearching ? (
        <MatchmakingScreen
           searchTime={elapsedSearchTime}
           onCancel={handleCancelMatchmaking}
           error={matchmakingError} // Pass error message
         />
      ) : (
        <div className="max-w-7xl mx-auto p-4 pt-20 pb-8">
          {/* Header Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#d1d0c5]">Ranked Mode</h1>
            <p className="text-[#646669]">Compete against others and climb the leaderboard</p>
          </div>

           {/* Display Matchmaking Error if any */}
           {matchmakingError && !isSearching && (
             <div className="bg-red-500/20 border border-red-600 text-red-300 p-4 rounded-lg mb-6 flex justify-between items-center">
               <span>Error: {matchmakingError}</span>
               <button onClick={() => setMatchmakingError(null)} className="text-red-200 hover:text-white">&times;</button>
             </div>
           )}

          <div className="flex flex-col lg:flex-row gap-6">
            <div className="w-full lg:w-3/4">
              {/* Quick Match Section */}
              <div className="bg-[#2c2e31] rounded-lg p-6 mb-6">
                <h2 className="text-2xl font-bold mb-2 text-[#d1d0c5]">Quick Match</h2>
                <p className="text-[#646669] mb-6">Find a ranked match and start typing</p>
                
                {/* Match details */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {/* Time */}
                  <div className="text-center">
                    <div className="flex justify-center mb-2">
                      <div className="w-12 h-12 bg-[#323437] rounded-full flex items-center justify-center">
                        <FaClock className="text-[#d1d0c5] text-xl" />
                      </div>
                    </div>
                    <div className="font-bold text-[#d1d0c5]">1 minute</div>
                    <div className="text-sm text-[#646669]">Time</div>
                  </div>
                  
                  {/* Format */}
                  <div className="text-center">
                    <div className="flex justify-center mb-2">
                      <div className="w-12 h-12 bg-[#323437] rounded-full flex items-center justify-center">
                        <FaUsers className="text-[#d1d0c5] text-xl" />
                      </div>
                    </div>
                    <div className="font-bold text-[#d1d0c5]">1v1</div>
                    <div className="text-sm text-[#646669]">Format</div>
                  </div>
                  
                  {/* ELO */}
                  <div className="text-center">
                    <div className="flex justify-center mb-2">
                      <div className="w-12 h-12 bg-[#323437] rounded-full flex items-center justify-center">
                        <FaBolt className="text-[#d1d0c5] text-xl" />
                      </div>
                    </div>
                    <div className="font-bold text-[#d1d0c5]">±10-15</div>
                    <div className="text-sm text-[#646669]">ELO</div>
                  </div>
                </div>
                
                <p className="text-[#646669] mb-6">Race against an opponent of similar skill for 1 minute. The player with the highest WPM wins.</p>
                
                {/* UPDATED Start Typing Button */}
                <button
                  onClick={handleFindMatch} // Use the new handler
                  disabled={isSearching} // Disable if already searching
                  className="w-full bg-[#323437] hover:bg-[#e2b714] text-[#d1d0c5] hover:text-[#323437] font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="mr-2">Start Typing</span>
                  <FaChevronRight />
                </button>
              </div>
              
              {/* Your Stats Section */}
              <div className="bg-[#2c2e31] rounded-lg p-6 mb-6">
                <h2 className="text-2xl font-bold mb-2 text-[#d1d0c5]">Your Stats</h2>
                <p className="text-[#646669] mb-6">Overall performance metrics</p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {/* Matches Played */}
                  <div>
                    <p className="text-[#646669] text-sm">Matches Played</p>
                    <p className="text-2xl font-bold text-[#d1d0c5]">
                      {(userData?.stats?.overall?.totalWins || 0) + (userData?.stats?.overall?.totalLosses || 0)}
                    </p>
                  </div>
                  
                  {/* Win Rate */}
                  <div>
                    <p className="text-[#646669] text-sm">Win Rate</p>
                    <p className="text-2xl font-bold text-[#e2b714]">
                      {calculateWinRate()}%
                    </p>
                  </div>
                  
                  {/* Avg. WPM */}
                  <div>
                    <p className="text-[#646669] text-sm">Avg. WPM</p>
                    <p className="text-2xl font-bold text-[#d1d0c5]">
                      {userData?.stats?.overall?.averageWPM || 0}
                    </p>
                  </div>
                  
                  {/* Avg. Accuracy */}
                  <div>
                    <p className="text-[#646669] text-sm">Avg. Accuracy</p>
                    <p className="text-2xl font-bold text-[#d1d0c5]">
                      {userData?.stats?.overall?.averageAccuracy?.toFixed(1) || 0}%
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Match History & Performance Section */}
              
            </div>
            
            <div className="w-full lg:w-1/4">
              {/* User Rank Display */}
              <div className="bg-[#2c2e31] rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center mb-3">
                  <div className={`${getRankColor(userRank.rankKey as RankKey)} font-bold text-xl`}>
                    {userRank.rankName}
                  </div>
                  <div>
                    <p className="text-xl font-bold text-[#d1d0c5]">{userRank.elo.toLocaleString()} ELO</p>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-[#323437] h-2 rounded-full overflow-hidden">
                  <div 
                    className={`${getProgressBarColor(userRank.rankKey as RankKey)} h-full rounded-full`} 
                    style={{ width: `${userRank.progressPercent}%` }}
                  ></div>
                </div>
                
                {/* Next Rank Info */}
                <div className="flex justify-between items-center mt-2 text-sm">
                  <span className="text-[#646669]">
                    {userRank.nextRankName ? `${userRank.progressPercent}% to ${userRank.nextRankName}` : 'Max Rank Achieved'}
                  </span>
                  <span className="text-[#646669]">
                    {userRank.eloToNextRank > 0 ? `+${userRank.eloToNextRank} ELO needed` : ''}
                  </span>
                </div>
              </div>
              
              {/* Top Racers Section */}
              <div className="bg-[#2c2e31] rounded-lg p-6">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-2xl font-bold text-[#d1d0c5]">Top Typrs</h2>
                  <button 
                    onClick={handleUpdateLeaderboard}
                    disabled={updatingLeaderboard}
                    className="text-sm bg-[#323437] hover:bg-[#e2b714] text-[#d1d0c5] hover:text-[#323437] px-2 py-1 rounded transition-colors"
                  >
                    {updatingLeaderboard ? "Updating..." : "Update Now"}
                  </button>
                </div>
                {leaderboardLastUpdated && (
                  <p className="text-sm text-[#646669] mb-4">Last updated: {leaderboardLastUpdated}</p>
                )}
                
                {/* Racer List */}
                <div className="space-y-6">
                  {leaderboardLoading ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-pulse text-[#646669]">Loading leaderboard...</div>
                    </div>
                  ) : topRacers.length > 0 ? (
                    topRacers.map((racer, index) => (
                      <div key={index} className="flex items-center gap-4">
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
                                <span className={`${
                                  racer.rank === "Cherry MX" ? "text-red-500" :
                                  racer.rank === "Diamond" ? "text-blue-400" :
                                  racer.rank === "Platinum" ? "text-cyan-400" :
                                  racer.rank === "Gold" ? "text-[#e2b714]" :
                                  racer.rank === "Silver" ? "text-gray-400" :
                                  "text-blue-500" // Default for Plastic
                                } font-bold`}>
                                  {racer.rank}
                                </span>
                                {racer.elo && <span className="text-[#646669] ml-2">{racer.elo} ELO</span>}
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
            </div>
          </div>
          <div className="mt-3">
                
                {/* Flex container for matches and graph */}
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Recent Matches List without scrolling */}
                  <div className={`w-full ${recentMatches.length > 0 ? 'md:w-[38%]' : ''}`}>
                    <h3 className="text-xl font-bold mb-2 text-[#d1d0c5]">Recent Matches</h3>
                    <div className="space-y-3">
                      {recentMatches && recentMatches.length > 0 ? (
                        recentMatches.map((match, index) => (
                          <div key={index} className="bg-[#2c2e31] rounded-lg p-4 flex items-center justify-between">
                            <div className="flex items-center">
                              <div className={`${match.isWin ? 'bg-[#323437]' : 'bg-[#3a3a3c]'} text-[#d1d0c5] px-3 py-1 rounded-md mr-4`}>
                                {match.isWin ? 'Win' : 'Loss'}
                              </div>
                              <div>
                                <p className="font-bold text-[#d1d0c5]">vs. {match.opponent}</p>
                                <p className="text-sm text-[#646669]">{match.timeAgo}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-[#d1d0c5]">
                                {match.userWpm} WPM <span className="text-sm text-[#646669]">({match.opponentWpm})</span>
                              </p>
                              <p className={`text-sm ${match.isWin ? 'text-green-400' : 'text-red-400'}`}>
                                {match.isWin ? '+' : ''}{match.eloChange}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="bg-[#2c2e31] rounded-lg p-6 flex items-center justify-center">
                          <p className="text-[#646669]">No match history yet. Play some ranked games!</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Performance Graph with fixed height and overflow control - only show if there are matches */}
                  {recentMatches && recentMatches.length > 0 && (
                    <div className="w-full md:w-[62%] bg-[#2c2e31] rounded-lg p-6 h-[500px] flex flex-col relative">
                      <h3 className="text-xl font-bold mb-2 text-[#d1d0c5]">Performance Graph</h3>
                      <p className="text-[#646669] mb-4">Your typing performance over time</p>
                      
                      <div className="flex-grow overflow-hidden">
                        <PerformanceGraph matches={recentMatches} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
        </div>
      )}
    </div>
  );
};

export default Ranked;