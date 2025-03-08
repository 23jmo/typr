import React, { useState, useEffect } from "react";
import { GameData } from "../types";
import { useUser } from "../contexts/UserContext";
import { getFirestore, doc, updateDoc, getDoc } from "firebase/firestore";
import { FaVoteYea, FaClock, FaCheck, FaHourglassHalf } from "react-icons/fa";
import { TOPIC_DESCRIPTIONS } from "../constants/topicDescriptions";

interface TopicVotingScreenProps {
  gameData: GameData;
  roomId: string;
}

const TopicVotingScreen: React.FC<TopicVotingScreenProps> = ({
  gameData,
  roomId,
}) => {
  const { userData } = useUser();
  const userId = userData?.uid;
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [allVoted, setAllVoted] = useState<boolean>(false);
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);

  // Check if there are at least 2 connected players
  const connectedPlayers = Object.values(gameData.players).filter(
    (player) => player.connected
  );
  const hasMultiplePlayers = connectedPlayers.length >= 2;

  // Check if all connected players have voted
  const allPlayersVoted = connectedPlayers.every((player) => player.vote);

  // Update allVoted state when all players have voted
  useEffect(() => {
    if (allPlayersVoted && connectedPlayers.length >= 2) {
      setAllVoted(true);
    } else {
      setAllVoted(false);
    }
  }, [allPlayersVoted, connectedPlayers.length]);

  // Effect to handle insufficient players
  useEffect(() => {
    if (!hasMultiplePlayers && !isRedirecting) {
      console.log(
        "Not enough players for voting, will redirect to waiting room"
      );
      setIsRedirecting(true);

      // Show the message for a few seconds before the server updates the status
      const timer = setTimeout(() => {
        // The server should handle the actual status change
        console.log("Waiting for server to update status to waiting...");
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [hasMultiplePlayers, isRedirecting, roomId]);

  // Calculate time left for voting
  useEffect(() => {
    // Use clientVotingEndTime for client-side calculations if available
    if (gameData.clientVotingEndTime) {
      const calculateTimeLeft = () => {
        const now = Date.now();
        const timeRemaining = Math.max(
          0,
          Math.floor((gameData.clientVotingEndTime! - now) / 1000)
        );
        setTimeLeft(timeRemaining);
      };

      calculateTimeLeft();
      const timer = setInterval(calculateTimeLeft, 1000);

      return () => clearInterval(timer);
    } else if (gameData.votingEndTime) {
      // Fallback to votingEndTime if clientVotingEndTime is not available
      const calculateTimeLeft = () => {
        const now = Date.now();

        // Handle different types of votingEndTime values
        let endTime: number;
        try {
          if (typeof gameData.votingEndTime === "number") {
            // It's already a JavaScript timestamp in milliseconds
            endTime = gameData.votingEndTime;
          } else {
            // Try to use toMillis() if it's a Firestore Timestamp
            // @ts-ignore - Ignore type checking for this line
            const toMillis = gameData.votingEndTime.toMillis;
            if (typeof toMillis === "function") {
              // @ts-ignore - Ignore type checking for this line
              endTime = gameData.votingEndTime.toMillis();
            } else {
              // Fallback - convert to a Date and get the time
              endTime = new Date(gameData.votingEndTime as any).getTime();
            }
          }
        } catch (error) {
          console.error("Error parsing votingEndTime:", error);
          // Fallback to 15 seconds from now if parsing fails
          endTime = now + 15000;
        }

        const timeRemaining = Math.max(0, Math.floor((endTime - now) / 1000));
        setTimeLeft(timeRemaining);
      };

      calculateTimeLeft();
      const timer = setInterval(calculateTimeLeft, 1000);

      return () => clearInterval(timer);
    }
  }, [gameData.votingEndTime, gameData.clientVotingEndTime]);

  // Check if the current user has already voted
  useEffect(() => {
    if (!userId || !gameData.players[userId]) return;

    if (gameData.players[userId].vote) {
      setSelectedTopic(gameData.players[userId].vote);
    }
  }, [gameData.players, userId]);

  // Handle topic selection
  const handleTopicSelect = async (topic: string) => {
    if (!userId || !roomId) return;

    setSelectedTopic(topic);

    try {
      const db = getFirestore();
      await updateDoc(doc(db, "gameRooms", roomId), {
        [`players.${userId}.vote`]: topic,
      });

      // Get the latest game data to check if all players have voted
      const roomRef = doc(db, "gameRooms", roomId);
      const roomSnapshot = await getDoc(roomRef);

      if (roomSnapshot.exists()) {
        const latestGameData = roomSnapshot.data() as GameData;
        const connectedPlayers = Object.values(latestGameData.players).filter(
          (player) => player.connected
        );
        const allPlayersVoted = connectedPlayers.every((player) => player.vote);

        if (allPlayersVoted && connectedPlayers.length >= 2) {
          console.log(
            "All players have voted after this vote, ending voting early"
          );
          // The game state effect in RaceRoom will handle ending the voting
        }
      }
    } catch (error) {
      console.error("Error voting for topic:", error);
    }
  };

  // Count votes for each topic
  const countVotes = () => {
    const votes: { [key: string]: number } = {};

    Object.values(gameData.players).forEach((player) => {
      if (player.vote && player.connected) {
        votes[player.vote] = (votes[player.vote] || 0) + 1;
      }
    });

    return votes;
  };

  const votes = countVotes();

  return (
    <div className="fixed inset-0 bg-[#1e1e1e] flex flex-col items-center justify-center p-6 overflow-y-auto">
      <div className="bg-[#2a2a2a] rounded-xl shadow-xl p-8 max-w-3xl w-full mx-auto border border-[#3a3a3a]">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3 text-yellow-400">
            <FaVoteYea className="text-yellow-400" />
            Vote for Next Topic
          </h2>

          {!hasMultiplePlayers ? (
            <div className="text-red-400 mb-6 p-6 bg-red-900/20 rounded-lg border border-red-900 animate-pulse">
              <p className="font-bold text-xl mb-3">Not enough players!</p>
              <p className="mb-2">
                At least 2 players must be connected to start a new race.
              </p>
              <p className="font-medium">Returning to waiting room...</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="flex items-center justify-center mb-2">
                  <FaClock className="text-yellow-400 mr-2 text-xl" />
                  <span className="text-3xl font-mono font-bold">
                    {timeLeft > 0 ? `${timeLeft}s` : "Voting ended"}
                  </span>
                  {allVoted && (
                    <span className="ml-4 text-green-400 flex items-center animate-pulse">
                      <FaCheck className="mr-1" /> All players voted! Starting
                      race...
                    </span>
                  )}
                  {!allVoted && timeLeft > 0 && (
                    <span className="ml-4 text-yellow-300 flex items-center">
                      <FaHourglassHalf className="mr-1" /> Waiting for votes...
                    </span>
                  )}
                </div>

                <div className="w-full h-2 bg-[#444444] rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      allVoted ? "bg-green-500" : "bg-yellow-500"
                    }`}
                    style={{
                      width: allVoted ? "100%" : `${(timeLeft / 15) * 100}%`,
                    }}
                  />
                </div>
                <div className="text-center text-sm text-gray-400 mt-1">
                  {allVoted
                    ? "All players have voted! Starting new race..."
                    : timeLeft > 0
                    ? `Voting ends in ${timeLeft} seconds or when all players vote`
                    : "Voting has ended"}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {gameData.topicOptions?.map((topic) => (
                  <div
                    key={topic}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedTopic === topic
                        ? "border-yellow-500 bg-yellow-500/20"
                        : "border-[#444444] bg-[#333333] hover:bg-[#3a3a3a]"
                    }`}
                    onClick={() => handleTopicSelect(topic)}
                  >
                    <h3 className="text-lg font-semibold mb-2 text-white">
                      {topic.charAt(0).toUpperCase() + topic.slice(1)}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {TOPIC_DESCRIPTIONS[topic]}
                    </p>
                    <div className="mt-3 flex justify-between items-center">
                      <span className="text-xs text-gray-500">
                        {votes[topic] || 0} vote
                        {(votes[topic] || 0) !== 1 ? "s" : ""}
                      </span>
                      {selectedTopic === topic && (
                        <span className="text-yellow-400 text-sm font-medium">
                          Your vote
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopicVotingScreen;
