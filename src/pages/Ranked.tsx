import React, { useState } from "react";
import { rankedIcons } from "../types/ranks";
import { useUser } from "../contexts/UserContext";
import RankedHomePage from "../components/ranked/RankedHomePage";
import MatchmakingScreen from "../components/ranked/MatchmakingScreen";
import { FaClock, FaUsers, FaBolt, FaChevronRight } from "react-icons/fa";

// Define rank key type for type safety
type RankKey = 'plastic' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'cherryMX';

const Ranked = () => {
  const [matchMaking, setMatchMaking] = useState(false);
  const [matchFound, setMatchFound] = useState(false);
  const [matchFinished, setMatchFinished] = useState(false);
  const { userData } = useUser();

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

  // Mock data for top racers
  const topRacers = [
    { name: "SpeedDemon", rank: "Master", wpm: 145 },
    { name: "TypeMaster99", rank: "Diamond", wpm: 132 },
    { name: "KeyboardWarrior", rank: "Diamond", wpm: 128 },
    { name: "SwiftKeys", rank: "Platinum", wpm: 120 },
    { name: "FastFingers", rank: "Platinum", wpm: 115 }
  ];

  // Calculate win rate safely
  const calculateWinRate = () => {
    const wins = userData?.stats?.overall?.totalWins || 0;
    const losses = userData?.stats?.overall?.totalLosses || 0;
    const total = wins + losses;
    
    if (total === 0) return 0;
    return Math.round((wins / total) * 100);
  };

  const handleFindMatch = () => {
    setMatchMaking(true);
  };

  const handleMatchFound = () => {
    setMatchFound(true);
  };

  const handleMatchFinished = () => {
    setMatchFinished(true);
  };

  return (
    <div className="min-h-screen overflow-y-auto">
      {matchMaking ? (
        <MatchmakingScreen />
      ) : (
        <div className="max-w-7xl mx-auto p-4 pt-20 pb-16">
          {/* Header Section */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-[#d1d0c5]">Ranked Mode</h1>
            <p className="text-[#646669]">Compete against others and climb the leaderboard</p>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            <div className="w-full lg:w-2/3">
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
                
                {/* Start Typing Button */}
                <button 
                  onClick={handleFindMatch}
                  className="w-full bg-[#323437] hover:bg-[#e2b714] text-[#d1d0c5] hover:text-[#323437] font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
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
              
              {/* Recent Matches Section */}
              <div className="mt-6">
                <div className="flex gap-4 mb-4">
                  <button className="bg-[#2c2e31] px-6 py-2 rounded-lg text-[#d1d0c5] font-medium">Recent Matches</button>
                  <button className="text-[#646669] px-6 py-2 hover:text-[#d1d0c5] transition-colors">Detailed Stats</button>
                </div>
                
                {/* Recent Match Item */}
                <div className="bg-[#2c2e31] rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="bg-[#323437] text-[#d1d0c5] px-3 py-1 rounded-md mr-4">Win</div>
                    <div>
                      <p className="font-bold text-[#d1d0c5]">FastFingers</p>
                      <p className="text-sm text-[#646669]">25 min ago</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#d1d0c5]">92 WPM <span className="text-sm text-[#646669]">(88)</span></p>
                    <p className="text-sm text-green-400">+12</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="w-full lg:w-1/3">
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
                <h2 className="text-2xl font-bold mb-6 text-[#d1d0c5]">Top Racers</h2>
                
                {/* Racer List */}
                <div className="space-y-6">
                  {topRacers.map((racer, index) => (
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
                                racer.rank.includes("Master") ? "text-purple-500" : 
                                racer.rank.includes("Diamond") ? "text-blue-400" :
                                racer.rank.includes("Platinum") ? "text-cyan-400" :
                                racer.rank.includes("Gold") ? "text-[#e2b714]" :
                                racer.rank.includes("Silver") ? "text-gray-400" :
                                "text-blue-500"
                              } font-bold`}>
                                {racer.rank}
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-[#d1d0c5]">{racer.wpm} WPM</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Ranked;
