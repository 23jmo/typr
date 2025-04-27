import { Player as PlayerData } from "../types";

interface PlayerListProps {
  players: Record<string, PlayerData>;
  localUserId: string | undefined;
  roomStatus: string;
  playerLimit: number;
}

const PlayerList = ({ players, localUserId, roomStatus, playerLimit }: PlayerListProps) => {
  return (
    <div className="fixed top-15 left-4 space-y-1 z-40 bg-[#232527] p-2 rounded shadow-lg max-h-[80vh] overflow-y-auto max-w-[180px]">
      <h3 className="font-bold mb-1 text-sm border-b border-[#3c3e41] pb-1">
        Players ({Object.keys(players).length}/{playerLimit})
      </h3>
      {Object.values(players)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((player) => (
          <div
            key={player.id}
            className={`flex items-center space-x-2 p-1 rounded ${player.id === localUserId ? 'bg-[#3c3e41]' : ''}`}
          >
            <span
              className={`w-3 h-3 rounded-full ${
                player.connected ? "bg-green-500" : "bg-red-500"
              }`}
              title={player.connected ? 'Connected' : 'Disconnected'}
            />
            <span className="flex-1 truncate" title={player.name}>{player.name}</span>
            {roomStatus === 'waiting' && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${player.ready ? 'bg-green-700 text-green-100' : 'bg-gray-600 text-gray-300'}`}>
                {player.ready ? "Ready" : "Not Ready"}
              </span>
            )}
            {roomStatus === 'racing' && !player.finished && (
              <div className="w-16 h-2 bg-gray-700 rounded overflow-hidden" title={`Progress: ${player.progress.toFixed(0)}%`}>
                <div
                  className="h-full bg-blue-500 rounded transition-all duration-300"
                  style={{ width: `${player.progress || 0}%` }}
                />
              </div>
            )}
            {player.finished && (
              <span className="text-green-400" title="Finished">✓</span>
            )}
            {roomStatus === 'voting' && (
              <span className="text-xs" title={player.vote ? `Voted for ${player.vote}` : 'Not voted'}>
                {player.vote ? '🗳️' : '➖'}
              </span>
            )}
            {(roomStatus === 'racing' || roomStatus === 'finished') && (
              <span className="text-xs w-8 text-right">{player.wpm}</span>
            )}
          </div>
        ))}
    </div>
  );
};

export default PlayerList; 