import React, { useState, useEffect } from "react";
import { GameData } from "../types";
import { rankedIcons } from "../types/ranks";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { FaCrown, FaCheckCircle, FaClock, FaUserSlash, FaCheck } from "react-icons/fa";

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
  onToggleReady,
}) => {
  // Calculate player count
  const playerCount = Object.keys(gameData.players).length;
  const maxPlayers = gameData.playerLimit || 4;
  
  
  // Check if current player is ready
  const isReady = gameData.players[userId]?.ready || false;
  
  // State for copy button text
  const [copyLinkText, setCopyLinkText] = useState("Copy Invite Link");
  const [lobbyCode] = useState(roomId?.toUpperCase() || "");
  const [isCodeCopied, setIsCodeCopied] = useState(false); // State for copy animation
  
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
  
  // Function to handle copying lobby code
  const handleCopyLobbyCode = () => {
    // Try the modern Clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(lobbyCode)
        .then(() => {
          setIsCodeCopied(true); // Trigger checkmark animation
          // Reset icon after 1.5 seconds
          setTimeout(() => {
            setIsCodeCopied(false);
          }, 1500);
        })
        .catch(err => {
          console.error('Failed to copy code using Clipboard API: ', err);
          // If Clipboard API fails, try the fallback
          copyUsingExecCommand();
        });
    } else {
      // If Clipboard API is not available, use the fallback directly
      copyUsingExecCommand();
    }
  };

  // Fallback function using document.execCommand('copy')
  const copyUsingExecCommand = () => {
    const textArea = document.createElement("textarea");
    textArea.value = lobbyCode;

    // Prevent scrolling to bottom of page in MS Edge.
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        setIsCodeCopied(true); // Trigger checkmark animation
        setTimeout(() => {
          setIsCodeCopied(false);
        }, 1500); // Reset icon after 1.5 seconds
      } else {
         console.error('Fallback: Failed to copy code using execCommand.');
         // Optionally, display an error message to the user here
      }
    } catch (err) {
      console.error('Fallback: Error copying code using execCommand:', err);
      // Optionally, display an error message to the user here
    }

    document.body.removeChild(textArea);
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
  
  // Game settings from the screenshot - using defaults from the UI
  /*
  const textDifficulty = "Medium";
  const raceLength = "Standard";
  const privacy = "Private";
  */
  
  // Extract game settings from gameData
  // Determine race type (custom or ranked)
  const raceType = "ranked" in gameData && (gameData as any).ranked ? "Ranked" : "Custom";
  
  // Get topic or text source
  const topic = gameData.textSource === 'topic'
    ? (gameData.topic || 'N/A') // Use the topic name if source is topic
    : (gameData.textSource || 'Random'); // Display 'random' or 'custom'
  
  // Get race length - word count from text
  const wordCount = gameData.text ? gameData.text.trim().split(/\s+/).length : 0;
  const raceLengthText = wordCount > 0 ? `${wordCount} words` : "Loading...";
  
  return (
    <div className="w-full max-w-7xl mx-auto p-4 mt-20 flex flex-col lg:flex-row gap-6 text-[#d1d0c5]">
      {/* Left column - Players */}
      <div className="flex-1 bg-[#2c2e31] rounded-lg p-6 shadow-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center text-[#d1d0c5]">
            <svg className="w-6 h-6 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor" />
            </svg>
            Players
          </h2>
          <div className="bg-[#323437] rounded-full px-4 py-1 text-[#d1d0c5]">
            {playerCount}/{maxPlayers} Players
          </div>
        </div>
        
        <p className="text-[#a1a1a1] mb-6">All players must ready up before the race can begin</p>
        
        {/* Player list */}
        <div className="space-y-4">
          {sortedPlayers.map(([playerId, player]) => {
            const enhancedPlayer = enhancedPlayers[playerId];
            const isCurrentUser = playerId === userId;
            const playerReady = player.ready || false;
            
            return (
              <div key={playerId} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-[#323437] rounded-full flex items-center justify-center text-xl mr-4 text-[#d1d0c5]">
                    {player.name?.charAt(0).toUpperCase() || "?"}
                  </div>
                  
                  <div>
                    <div className="font-medium text-[#d1d0c5] flex items-center">
                      {player.name || "Anonymous"}
                      {isCurrentUser && (
                        <span className="ml-2 px-2 py-0.5 bg-[#323437] rounded-full text-xs text-[#d1d0c5]">
                          You
                        </span>
                      )}
                      {playerId === gameData.hostId && (
                        <span className="ml-2 text-[#e2b714] flex items-center">
                          <FaCrown size={14} />
                        </span>
                      )}
                    </div>
                    {enhancedPlayer && (
                      <div className="text-sm text-[#a1a1a1] flex items-center mt-1">
                        <span className="flex items-center">
                          {enhancedPlayer.rank.icon && (
                            <img 
                              src={enhancedPlayer.rank.icon} 
                              alt={enhancedPlayer.rank.name} 
                              className="w-4 h-4 mr-1" 
                            />
                          )}
                          <span className="capitalize">{enhancedPlayer.rank.name}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Status Icon - Remove fixed width w-16 */}
                <div className="flex items-center justify-center"> 
                  {playerReady ? (
                    <FaCheckCircle 
                      className="text-[#e2b714] text-xl"
                      title="Ready" 
                    />
                  ) : (
                    <FaClock 
                      className="text-[#646669] text-xl" 
                      title="Not Ready" 
                    />
                  )}
                </div>
              </div>
            );
          })}
          
          {/* Fill in empty slots if needed */}
          {Array.from({ length: Math.max(0, maxPlayers - sortedPlayers.length) }).map((_, index) => (
            <div key={`empty-${index}`} className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-[#323437] rounded-full flex items-center justify-center text-xl mr-4 text-[#646669]">
                  ?
                </div>
                
                <div>
                  {/* Use responsive spans for different text on mobile/desktop */}
                  <div className="font-medium text-[#646669]">
                    <span className="block sm:hidden">Waiting...</span>
                    <span className="hidden sm:block">Waiting for player...</span>
                  </div>
                </div>
              </div>
              
              {/* Empty Slot Icon - Remove fixed width w-16 */}
              <div className="flex items-center justify-center"> 
                 <FaUserSlash 
                   className="text-[#646669] text-xl" 
                   title="Empty Slot" 
                 />
              </div>
            </div>
          ))}
        </div>
        
        {/* Bottom button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={onToggleReady}
            className={`px-10 py-3 rounded-lg font-medium transition-colors ${
              isReady 
                ? "bg-[#e2b714] text-black hover:bg-[#f3c724]"
                : "bg-[#323437] text-[#d1d0c5] hover:bg-[#3c3e41]"
            }`}
          >
            {isReady ? "Ready" : "Ready Up"}
          </button>
        </div>
      </div>
      
      {/* Right column - Invite & Settings */}
      <div className="w-full lg:w-96 space-y-6">
        {/* Invite Friends section */}
        <div className="bg-[#2c2e31] rounded-lg p-6 shadow-md">
          <h2 className="text-2xl font-bold mb-4 text-[#d1d0c5]">Invite Friends</h2>
          <p className="text-[#a1a1a1] mb-4">Share the code or link with your friends</p>
          
          <div className="mb-4">
            <p className="text-[#a1a1a1] mb-2">Lobby Code</p>
            <div className="flex">
              <div className="flex-1 bg-[#323437] rounded-l-lg p-3 font-mono text-center text-xl text-[#d1d0c5]">
                {lobbyCode}
              </div>
              <button 
                onClick={handleCopyLobbyCode}
                className="relative bg-[#323437] rounded-r-lg p-3 flex items-center justify-center border-l border-[#3c3e41] text-[#d1d0c5] hover:text-[#e2b714] transition-colors w-12"
                title={isCodeCopied ? "Copied!" : "Copy Lobby Code"}
              >
                <div 
                  className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ease-in-out ${isCodeCopied ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                >
                  <FaCheck className="w-6 h-6 text-[#e2b714]" />
                </div>
                
                <div 
                  className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ease-in-out ${!isCodeCopied ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 5H6C4.89543 5 4 5.89543 4 7V19C4 20.1046 4.89543 21 6 21H16C17.1046 21 18 20.1046 18 19V17M8 5C8 6.10457 8.89543 7 10 7H12C13.1046 7 14 6.10457 14 5M8 5C8 3.89543 8.89543 3 10 3H12C13.1046 3 14 3.89543 14 5M14 5H16C17.1046 5 18 5.89543 18 7V10M20 14H10M10 14L13 11M10 14L13 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </button>
            </div>
          </div>
          
        </div>
        
        {/* Game Settings section */}
        <div className="bg-[#2c2e31] rounded-lg p-6 shadow-md">
          <h2 className="text-2xl font-bold mb-6 text-[#d1d0c5]">Game Settings</h2>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-[#d1d0c5]">Race Type</p>
              <p className="text-[#d1d0c5] font-medium">
                {raceType}
              </p>
            </div>
            
            <div className="flex justify-between items-center">
              <p className="text-[#d1d0c5]">Topic</p>
              <p className="text-[#d1d0c5] font-medium capitalize">
                {topic}
              </p>
            </div>
            
            <div className="flex justify-between items-center">
              <p className="text-[#d1d0c5]">Race Length</p>
              <p className="text-[#d1d0c5] font-medium">
                {raceLengthText}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RaceLobby; 