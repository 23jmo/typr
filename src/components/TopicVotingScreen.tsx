import React, { useState, useEffect } from "react";
import { GameData } from "../types";
import { useUser } from "../contexts/UserContext";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
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

  // Check if all players have voted
  useEffect(() => {
    if (!gameData.players) return;

    const connectedPlayers = Object.values(gameData.players).filter(
      (player) => player.connected
    );
    const votedPlayers = connectedPlayers.filter((player) => player.vote);

    if (
      connectedPlayers.length > 0 &&
      votedPlayers.length === connectedPlayers.length
    ) {
      setAllVoted(true);
    } else {
      setAllVoted(false);
    }
  }, [gameData.players]);

  // Handle topic selection
  const handleTopicSelect = async (topic: string) => {
    if (!userId || !roomId) return;

    setSelectedTopic(topic);

    try {
      const db = getFirestore();
      await updateDoc(doc(db, "gameRooms", roomId), {
        [`players.${userId}.vote`]: topic,
      });
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

          <div className="mb-6">
            <div className="flex items-center justify-center mb-2">
              <FaClock className="text-yellow-400 mr-2 text-xl" />
              <span className="text-3xl font-mono font-bold">
                {timeLeft > 0 ? `${timeLeft}s` : "Voting ended"}
              </span>
              {allVoted && (
                <span className="ml-4 text-green-400 flex items-center">
                  <FaCheck className="mr-1" /> All players voted!
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
                className="h-full bg-yellow-500 transition-all duration-1000"
                style={{
                  width: `${(timeLeft / 15) * 100}%`,
                }}
              />
            </div>
            <div className="text-center text-sm text-gray-400 mt-1">
              {timeLeft > 0
                ? `Voting ends in ${timeLeft} seconds`
                : "Voting has ended"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {gameData.topicOptions?.map((topic) => (
            <div
              key={topic}
              className={`p-4 rounded-lg cursor-pointer transition-all ${
                selectedTopic === topic
                  ? "bg-yellow-500 text-black"
                  : "bg-[#333333] hover:bg-[#444444]"
              }`}
              onClick={() => handleTopicSelect(topic)}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg capitalize">{topic}</h3>
                  <p className="text-sm opacity-80">
                    {TOPIC_DESCRIPTIONS[topic]}
                  </p>
                </div>
                <div className="text-2xl font-bold">{votes[topic] || 0}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center text-gray-400">
          {selectedTopic ? (
            <p>
              You voted for{" "}
              <span className="text-yellow-400 capitalize">
                {selectedTopic}
              </span>
            </p>
          ) : (
            <p>Select a topic to vote</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopicVotingScreen;
