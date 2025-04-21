import React, { useState, useEffect } from "react";
import { GameData, Player } from "../types";
import { Socket } from 'socket.io-client';
import { FaVoteYea, FaClock, FaCheck, FaHourglassHalf } from "react-icons/fa";
import { TOPIC_DESCRIPTIONS } from "../constants/topicDescriptions";

interface TopicVotingScreenProps {
  gameData: GameData;
  roomId: string;
  socket: Socket | null;
  localUserId: string;
}

const TopicVotingScreen: React.FC<TopicVotingScreenProps> = ({
  gameData,
  roomId,
  socket,
  localUserId
}) => {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [allVoted, setAllVoted] = useState<boolean>(false);
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);

  const currentPlayer = gameData.players[localUserId] as Player | undefined;

  const connectedPlayers = Object.values(gameData.players as { [key: string]: Player }).filter(
    (player) => player.connected
  );
  const hasMultiplePlayers = connectedPlayers.length >= 2;

  const allPlayersVoted = connectedPlayers.length > 0 && connectedPlayers.every((player) => !!player.vote);

  useEffect(() => {
    setAllVoted(allPlayersVoted);
  }, [allPlayersVoted]);

  useEffect(() => {
    if (!hasMultiplePlayers && !isRedirecting) {
      console.log("[VoteScreen] Not enough players for voting, showing message.");
      setIsRedirecting(true);
    }
    if(hasMultiplePlayers && isRedirecting) {
        setIsRedirecting(false);
    }
  }, [hasMultiplePlayers, isRedirecting]);

  useEffect(() => {
    if (gameData.votingEndTime) {
       const calculateTimeLeft = () => {
        const now = Date.now();
        const endTime = gameData.votingEndTime as number;
        const timeRemaining = Math.max(0, Math.floor((endTime - now) / 1000));
        setTimeLeft(timeRemaining);
      };

      calculateTimeLeft();
      const timer = setInterval(calculateTimeLeft, 1000);
      return () => clearInterval(timer);
    } else {
        setTimeLeft(0);
    }
  }, [gameData.votingEndTime]);

  useEffect(() => {
    if (currentPlayer?.vote) {
      setSelectedTopic(currentPlayer.vote);
    } else {
      setSelectedTopic(null);
    }
  }, [currentPlayer?.vote]);

  const handleTopicSelect = (topic: string) => {
    if (!localUserId || !roomId || !socket || selectedTopic === topic) return;

    console.log(`[VoteScreen] Emitting submitVote for topic: ${topic}`);
    socket.emit('submitVote', { topic });
    setSelectedTopic(topic);
  };

  const countVotes = () => {
    const votes: { [key: string]: number } = {};
    Object.values(gameData.players as { [key: string]: Player }).forEach((player) => {
      if (player.vote && player.connected) {
        votes[player.vote] = (votes[player.vote] || 0) + 1;
      }
    });
    return votes;
  };

  const votes = countVotes();

  return (
    <div className="fixed inset-0 bg-[#1e1e1e] bg-opacity-95 backdrop-blur-sm flex flex-col items-center justify-center p-6 overflow-y-auto z-30">
      <div className="bg-[#2c2e31] rounded-xl shadow-xl p-8 max-w-3xl w-full mx-auto border border-[#3c3e41]">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3 text-[#e2b714]">
            <FaVoteYea />
            Vote for Next Topic
          </h2>

          {isRedirecting ? (
            <div className="text-red-400 mb-6 p-6 bg-red-900/20 rounded-lg border border-red-800 animate-pulse">
              <p className="font-bold text-xl mb-3">Waiting for Players...</p>
              <p>
                At least 2 players must be connected to vote.
              </p>
              <p className="font-medium mt-2">Returning to waiting room shortly.</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="flex items-center justify-center mb-2">
                  <FaClock className="text-[#e2b714] mr-2 text-xl" />
                  <span className="text-3xl font-mono font-bold text-white">
                    {allVoted ? "0s" : (timeLeft > 0 ? `${timeLeft}s` : "0s")}
                  </span>
                  {allVoted && (
                    <span className="ml-4 text-green-400 flex items-center animate-pulse text-sm">
                      <FaCheck className="mr-1" /> All voted! Starting...
                    </span>
                  )}
                  {!allVoted && timeLeft > 0 && (
                    <span className="ml-4 text-yellow-300 flex items-center text-sm">
                      <FaHourglassHalf className="mr-1" /> Waiting for votes...
                    </span>
                  )}
                </div>

                <div className="w-full h-2 bg-[#444444] rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full transition-all duration-1000 ease-linear ${
                      allVoted ? "bg-green-500" : "bg-[#e2b714]"
                    }`}
                    style={{
                      width: allVoted ? "100%" : `${(timeLeft / (VOTING_DURATION_MS / 1000)) * 100}%`,
                    }}
                  />
                </div>
                <div className="text-center text-sm text-gray-400 mt-2">
                  {allVoted
                    ? "All players have voted! Starting new race..."
                    : timeLeft > 0
                    ? `Voting ends in ${timeLeft} seconds or when all players vote`
                    : "Voting has ended. Determining topic..."}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {gameData.topicOptions?.map((topic) => (
                  <div
                    key={topic}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all h-full flex flex-col justify-between ${
                      selectedTopic === topic
                        ? "border-[#e2b714] bg-[#e2b714]/10 ring-2 ring-[#e2b714]"
                        : "border-[#444444] bg-[#323437] hover:bg-[#3c3e41] hover:border-[#555]"
                    }`}
                    onClick={() => handleTopicSelect(topic)}
                  >
                    <div>
                      <h3 className="text-lg font-semibold mb-1 text-white capitalize">
                        {topic}
                      </h3>
                      <p className="text-sm text-gray-400 mb-3">
                        {TOPIC_DESCRIPTIONS[topic] || "Select this topic for the next race."}
                      </p>
                    </div>
                    <div className="mt-2 flex justify-between items-center text-xs">
                       <span className="text-gray-500">
                        {votes[topic] || 0} vote{(votes[topic] || 0) !== 1 ? "s" : ""}
                      </span>
                      {selectedTopic === topic && (
                        <span className="text-[#e2b714] font-medium flex items-center gap-1">
                           <FaCheck /> Your Vote
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

const VOTING_DURATION_MS = 15000;

export default TopicVotingScreen;
