import { Player as PlayerData } from "../types";
import { FaCircle, FaCheck, FaVoteYea, FaMinus, FaGripVertical } from "react-icons/fa";
import { useState, useEffect } from "react";
import { Rnd } from "react-rnd";

interface PlayerListProps {
  players: Record<string, PlayerData>;
  localUserId: string | undefined;
  roomStatus: string;
  playerLimit: number;
}

const PlayerList = ({ players, localUserId, roomStatus, playerLimit }: PlayerListProps) => {
  // Don't render anything if we're in the waiting state
  if (roomStatus === 'waiting') {
    return null;
  }

  // Get stored position from localStorage or use default
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('playerListPosition');
    return saved ? JSON.parse(saved) : { x: 20, y: 60 };
  });

  // Save position to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('playerListPosition', JSON.stringify(position));
  }, [position]);
  
  return (
    <Rnd
      default={{
        x: position.x,
        y: position.y,
        width: "auto",
        height: "auto"
      }}
      dragHandleClassName="drag-handle"
      bounds="window"
      onDragStop={(e, d) => {
        setPosition({ x: d.x, y: d.y });
      }}
      enableResizing={false}
      style={{ zIndex: 9999 }}
    >
      <div className="bg-[#232527] p-2 rounded shadow-lg max-h-[80vh] overflow-y-auto w-[220px]">
        <h3 className="drag-handle font-bold mb-1 text-sm border-b border-[#3c3e41] pb-1 flex items-center gap-2 cursor-move">
          <FaGripVertical className="text-gray-500" />
          <span className="flex-1">
            Players ({Object.keys(players).length}/{playerLimit})
          </span>
        </h3>
        <div className="space-y-1">
          {Object.values(players)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((player) => (
              <div
                key={player.id}
                className={`flex items-center space-x-2.5 p-1 rounded ${player.id === localUserId ? 'bg-[#3c3e41]' : ''}`}
              >
                <FaCircle 
                  size={8}
                  className={player.connected ? "text-green-500" : "text-red-500"}
                  title={player.connected ? 'Connected' : 'Disconnected'}
                />
                <span className="flex-1 truncate" title={player.name}>{player.name}</span>
                {roomStatus === 'racing' && !player.finished && (
                  <div className="w-16 h-2 bg-gray-700 rounded overflow-hidden" title={`Progress: ${player.progress.toFixed(0)}%`}>
                    <div
                      className="h-full bg-blue-500 rounded transition-all duration-300"
                      style={{ width: `${player.progress || 0}%` }}
                    />
                  </div>
                )}
                {player.finished && (
                  <FaCheck className="text-green-400" size={12} title="Finished" />
                )}
                {roomStatus === 'voting' && (
                  <span title={player.vote ? `Voted for ${player.vote}` : 'Not voted'}>
                    {player.vote ? <FaVoteYea size={12} className="text-blue-300" /> : <FaMinus size={12} className="text-gray-500" />}
                  </span>
                )}
                {(roomStatus === 'racing' || roomStatus === 'finished') && (
                  <span className="text-xs w-8 text-right">{player.wpm}</span>
                )}
              </div>
            ))}
        </div>
      </div>
    </Rnd>
  );
};

export default PlayerList; 