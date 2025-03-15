import React, { useState, useEffect } from "react";
import { GameData } from "../types";
import { rankedIcons } from "../types/ranks";
import { getFirestore, doc, getDoc } from "firebase/firestore";

interface RaceLobbyProps {
  gameData: GameData;
  roomId: string;
  userId: string;
  username: string;
  onToggleReady: () => void;
}

// Utility function to determine rank from ELO
const getRankFromElo = (elo: number) => {
  const rank = Object.entries(rankedIcons).find(
    ([_, rankData]) => elo >= rankData.minElo && elo <= rankData.maxElo
  );
  
  return rank ? { key: rank[0], ...rank[1] } : { key: "plastic", ...rankedIcons.plastic };
};

const RaceLobby: React.FC<RaceLobbyProps> = ({
  gameData,
  roomId,
  userId,
  username,
  onToggleReady,
}) => {
  // Calculate player count
  const playerCount = Object.keys(gameData.players).length;
  const maxPlayers = gameData.maxPlayers || 8; // Use maxPlayers from gameData if available, otherwise default to 8
  
  // Count connected players
  const connectedPlayers = Object.values(gameData.players).filter(
    (player) => player.connected
  ).length;
  
  // Check if current player is ready
  const isReady = gameData.players[userId]?.ready || false;
  
  // Check if we have enough players to start
  const hasEnoughPlayers = connectedPlayers >= 2;
  
  // State for copy button text
  const [copyButtonText, setCopyButtonText] = useState("Invite Friends");
  const [showCopyIcon, setShowCopyIcon] = useState(true);
  
  // State to store enhanced player data with stats
  const [enhancedPlayers, setEnhancedPlayers] = useState<{
    [key: string]: {
      id: string;
      name: string;
      ready: boolean;
      wpm: number;
      wins: number;
      elo: number;
      rank: { name: string; icon: string; key: string };
      isCurrentUser: boolean;
    }
  }>({});
  
  // Fetch player data from Firestore
  useEffect(() => {
    const fetchPlayerData = async () => {
      const db = getFirestore();
      const enhancedData: any = {};
      
      // Process all players in the game
      for (const [playerId, player] of Object.entries(gameData.players)) {
        // Default values
        let playerData = {
          id: playerId,
          name: player.name || "Anonymous",
          ready: player.ready || false,
          wpm: 0,
          wins: 0,
          elo: 1000,
          rank: getRankFromElo(1000),
          isCurrentUser: playerId === userId
        };
        
        try {
          // Try to fetch user data from Firestore
          const userDoc = await getDoc(doc(db, "users", playerId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const stats = userData.stats?.overall || {};
            
            // Update with actual data if available
            playerData.wpm = stats.averageWPM || 0;
            playerData.wins = stats.totalWins || 0;
            playerData.elo = stats.elo || 1000;
            playerData.rank = getRankFromElo(stats.elo || 1000);
          }
        } catch (error) {
          console.error(`Error fetching data for player ${playerId}:`, error);
        }
        
        enhancedData[playerId] = playerData;
      }
      
      setEnhancedPlayers(enhancedData);
    };
    
    fetchPlayerData();
  }, [gameData.players, userId]);
  
  // Function to handle copying invite link
  const handleCopyInviteLink = () => {
    const inviteLink = `${window.location.origin}/custom/${roomId}`;
    navigator.clipboard.writeText(inviteLink)
      .then(() => {
        setCopyButtonText("Link Copied!");
        setShowCopyIcon(false);
        
        // Reset button text after 2 seconds
        setTimeout(() => {
          setCopyButtonText("Invite Friends");
          setShowCopyIcon(true);
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy link: ', err);
      });
  };
  
  // Sort players by joinedAt timestamp to ensure consistent order
  const sortedPlayers = Object.entries(gameData.players).sort((a, b) => {
    // Extract timestamps, handling different possible formats
    const getTimestamp = (player: any) => {
      if (!player.joinedAt) return 0;
      
      // Handle Firestore Timestamp objects
      if (typeof player.joinedAt.toMillis === 'function') {
        return player.joinedAt.toMillis();
      }
      
      // Handle JavaScript Date objects
      if (player.joinedAt instanceof Date) {
        return player.joinedAt.getTime();
      }
      
      // Handle numeric timestamps
      if (typeof player.joinedAt === 'number') {
        return player.joinedAt;
      }
      
      // Default fallback
      return 0;
    };
    
    return getTimestamp(a[1]) - getTimestamp(b[1]);
  });
  
  // Calculate race details
  const calculateRaceDetails = () => {
    // Calculate word count from the text
    const wordCount = gameData.text ? gameData.text.trim().split(/\s+/).length : 0;
    
    // Determine race type (custom or ranked)
    const raceType = "ranked" in gameData && gameData.ranked ? "Ranked" : "Custom";
    
    // Get selected topic if available
    const topic = gameData.selectedTopic || "Random";
    
    return { wordCount, raceType, topic };
  };
  
  const raceDetails = calculateRaceDetails();
  
  return (
    <div className="w-full max-w-6xl mx-auto p-4 mt-24">
      {/* Header */}
      <div className="mb-8">
        {/* Top row with title and action buttons */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-4">
          <h1 className="text-5xl font-bold text-white mb-4 md:mb-0">Race Lobby</h1>
        </div>
        
        {/* Bottom row with player count and lobby code */}
        <div className="flex flex-wrap gap-4 mt-2">
          <div className="bg-[#2c2e31] rounded-full px-6 py-2 flex items-center">
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor" />
            </svg>
            <span>{playerCount}/{maxPlayers} Players</span>
          </div>
          <div className="bg-[#2c2e31] rounded-full px-6 py-2">
            <span className="text-gray-400 mr-2">Lobby Code:</span>
            <span className="font-mono">{roomId}</span>
          </div>
        </div>
      </div>
      
      {/* Player Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {sortedPlayers.map(([playerId, player]) => {
          const enhancedPlayer = enhancedPlayers[playerId];
          
          return (
            <div 
              key={playerId}
              className="bg-[#2c2e31] rounded-lg p-6"
            >
              <div className="flex items-center">
                {/* Avatar */}
                <div className="w-16 h-16 bg-[#1e1f21] rounded-full flex items-center justify-center text-2xl mr-4">
                  {player.name?.charAt(0).toUpperCase() || "?"}
                </div>
                
                {/* Player Info */}
                <div className="flex-grow">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold flex items-center">
                      {player.name || "Anonymous"}
                      {/* Show "YOU" tag for the current user */}
                      {playerId === userId && (
                        <span className="ml-2 text-sm bg-yellow-500 text-black font-bold px-2 py-0.5 rounded-full">
                          You
                        </span>
                      )}
                    </h3>
                    <div className={`px-3 py-1 rounded ${
                      player.ready 
                        ? "bg-gray-700 bg-opacity-80 text-white" 
                        : "bg-gray-500 bg-opacity-40 text-gray-300"
                    }`}>
                      {player.ready ? "Ready" : "Not Ready"}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Stats and Rank - Below player info */}
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-700">
                {/* Rank on the left */}
                {enhancedPlayer && (
                  <div className="flex items-center">
                    <span className="text-sm mr-2">{enhancedPlayer.rank.icon}</span>
                    <span className="text-sm mr-1">{enhancedPlayer.rank.name}</span>
                    <span className="text-sm text-gray-400">({enhancedPlayer.elo})</span>
                  </div>
                )}
                
                {/* Stats on the right */}
                <div className="flex items-center">
                  <div className="flex items-center mr-6">
                    <span className="text-gray-400 text-sm mr-1">WPM:</span>
                    <span className="text-sm">
                      {enhancedPlayer ? Math.round(enhancedPlayer.wpm) : 0}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-gray-400 text-sm mr-1">Wins:</span>
                    <span className="text-sm">
                      {enhancedPlayer ? enhancedPlayer.wins : 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Race Details */}
      <div className="bg-[#2c2e31] rounded-lg p-6 mb-8">
        <h3 className="text-xl mb-4 flex items-center">
          <span className="mr-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" fill="currentColor"/>
              <path d="M12.5 7H11V13L16.2 16.2L17 14.9L12.5 12.2V7Z" fill="currentColor"/>
            </svg>
          </span>
          Race Details
        </h3>
        <div className="flex justify-between items-start">
          <div className="flex flex-col items-start text-left">
            <div className="text-gray-400 text-sm mb-1">Race Type</div>
            <div className="text-xl">{raceDetails.raceType}</div>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="text-gray-400 text-sm mb-1">Topic</div>
            <div className="text-xl capitalize">{raceDetails.topic}</div>
          </div>
          <div className="flex flex-col items-end text-right">
            <div className="text-gray-400 text-sm mb-1">Length</div>
            <div className="text-xl">
              {raceDetails.wordCount > 0 
                ? `${raceDetails.wordCount} words` 
                : "Text not loaded yet"}
            </div>
          </div>
        </div>
      </div>
      
      {/* Warning message when not enough players */}
      {!hasEnoughPlayers && (
        <div className="text-center mb-4 text-yellow-500">
          <p>Waiting for more players to join. At least 2 players are needed to start the race.</p>
        </div>
      )}
      
      {/* Ready Button and Invite Friends */}
      <div className="flex justify-center gap-4">
        <button
          onClick={onToggleReady}
          disabled={!hasEnoughPlayers}
          className={`px-8 py-3 rounded-lg text-xl transition-colors ${
            isReady 
              ? "bg-yellow-500 text-black" 
              : hasEnoughPlayers 
                ? "bg-yellow-500 text-black hover:bg-yellow-400" 
                : "bg-gray-500 text-gray-300 cursor-not-allowed"
          }`}
        >
          {isReady ? "Ready!" : hasEnoughPlayers ? "Ready Up" : "Waiting for players..."}
        </button>
        
        <button 
          onClick={handleCopyInviteLink}
          className="bg-[#2c2e31] hover:bg-[#3c3e41] px-8 py-2 rounded-lg transition-colors flex items-center text-xl"
        >
          {!showCopyIcon && (
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 10-5.656-5.656l-1.102 1.101" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {copyButtonText}
        </button>
      </div>
    </div>
  );
};

export default RaceLobby; 