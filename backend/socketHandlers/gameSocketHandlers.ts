import { Server, Socket } from "socket.io";
import { RoomData } from "../types";
import {
  doc,
  getDoc,
  updateDoc,
  increment,
  deleteField,
  arrayUnion,
} from "firebase/firestore";

import { db, userStatsService } from "../services/firebase";

interface ProgressData {
  progress: number;
  wpm: number;
  accuracy: number;
}

interface FinishData {
  finalWpm?: number;
  finalAccuracy?: number;
}

// Dependencies that will be injected
let io: Server;
let rooms: { [roomId: string]: RoomData } = {};
let roomManager: any;

// Initialize the module with required dependencies
export const initGameSocketHandlers = (
  ioRef: Server,
  roomsRef: { [roomId: string]: RoomData },
  roomManagerRef: any
) => {
  io = ioRef;
  rooms = roomsRef;
  roomManager = roomManagerRef;

  console.log("[GameSocketHandlers] Module initialized");
  return {
    setupGameSocketHandlers,
    handleToggleReady,
    handleUpdateProgress,
    handlePlayerFinished,
    handleRequestPlayAgain,
  };
};

// Setup game-related socket event handlers
export const setupGameSocketHandlers = (socket: Socket) => {
  // Handle ready toggle
  socket.on("toggleReady", handleToggleReady(socket));

  // Handle progress update
  socket.on("updateProgress", handleUpdateProgress(socket));

  // Handle player finishing
  socket.on("playerFinished", handlePlayerFinished(socket));

  // Handle Play Again
  socket.on("requestPlayAgain", handleRequestPlayAgain(socket));
};

// Handler for toggleReady event
export const handleToggleReady = (socket: Socket) => () => {
  const userId = (socket as any).userId;
  const roomId = (socket as any).roomId;
  console.log(
    `[Socket] Received toggleReady from user ${userId} in room ${roomId}`
  );

  if (!userId || !roomId || !rooms[roomId] || !rooms[roomId].players[userId]) {
    console.log(
      `[Socket] Invalid toggleReady request: userId=${userId}, roomId=${roomId}`
    );
    return;
  }

  const room = rooms[roomId];
  const player = room.players[userId];

  // Can only toggle ready in 'waiting' state
  if (room.status !== "waiting") {
    console.log(
      `[Socket] Cannot toggle ready in room ${roomId} (status: ${room.status})`
    );
    return;
  }

  player.ready = !player.ready;
  console.log(
    `[Socket] Player ${player.name} in room ${roomId} set ready state to ${player.ready}`
  );

  // Broadcast the updated player state immediately
  roomManager.broadcastRoomUpdate(roomId);

  // Check if all connected players are ready
  const connectedPlayers = Object.values(room.players).filter(
    (p) => p.connected
  );
  // Ensure minimum players are connected AND ready
  const allReady =
    connectedPlayers.length >= 2 && connectedPlayers.every((p) => p.ready);

  if (allReady) {
    // Call the function to handle countdown logic
    roomManager.startCountdown(roomId);
  }
};

// Handler for updateProgress event
export const handleUpdateProgress =
  (socket: Socket) => (data: ProgressData) => {
    const userId = (socket as any).userId;
    const roomId = (socket as any).roomId;

    if (
      !userId ||
      !roomId ||
      !rooms[roomId] ||
      !rooms[roomId].players[userId]
    ) {
      console.warn(
        `[Socket] Invalid progress update: userId=${userId}, roomId=${roomId}`
      );
      return;
    }

    const room = rooms[roomId];
    const player = room.players[userId];

    // Only update during racing state
    if (room.status !== "racing") {
      console.warn(
        `[Socket] Progress update rejected - room ${roomId} not in racing state (${room.status})`
      );
      return;
    }

    // Basic validation
    if (
      typeof data.progress !== "number" ||
      typeof data.wpm !== "number" ||
      typeof data.accuracy !== "number"
    ) {
      console.warn(
        `[Socket] Invalid progress data received from ${userId} in room ${roomId}:`,
        data
      );
      return;
    }

    player.progress = Math.max(0, Math.min(100, data.progress));
    player.wpm = Math.max(0, data.wpm);
    player.accuracy = Math.max(0, Math.min(100, data.accuracy));

    // Update stats tracking
    const now = Date.now();
    const gameStartTime = room.startTime || now;
    player.timePlayed = Math.floor((now - gameStartTime) / 1000); // Convert to seconds
    player.wordsTyped = Math.floor(
      (player.progress * room.text.split(" ").length) / 100
    );
    player.charactersTyped = Math.floor(
      (player.progress * room.text.length) / 100
    );
    player.mistakes = Math.floor(
      (1 - player.accuracy / 100) * player.charactersTyped
    );

    console.log(
      `[Socket] Updated stats for ${player.name} in room ${roomId}:`,
      {
        progress: player.progress,
        wpm: player.wpm,
        accuracy: player.accuracy,
        wordsTyped: player.wordsTyped,
        charactersTyped: player.charactersTyped,
        mistakes: player.mistakes,
        timePlayed: player.timePlayed,
      }
    );

    // Broadcast progress to others in the room
    socket.to(roomId).emit("opponentProgress", {
      userId,
      progress: player.progress,
      wpm: player.wpm,
    });
  };

// Handler for playerFinished event
export const handlePlayerFinished =
  (socket: Socket) => async (data: FinishData) => {
    const userId = (socket as any).userId;
    const roomId = (socket as any).roomId;
    console.log(
      `[Socket] Received playerFinished from ${userId} in room ${roomId}`
    );

    if (!userId || !roomId || !rooms[roomId] || !rooms[roomId].players[userId])
      return;

    const room = rooms[roomId];
    const player = room.players[userId];

    if (room.status !== "racing" || player.finished) return;

    player.finished = true;
    player.finishTime = Date.now();
    player.wpm = data.finalWpm ?? player.wpm;
    player.accuracy = data.finalAccuracy ?? player.accuracy;
    player.progress = 100;

    roomManager.broadcastRoomUpdate(roomId);

    const allPlayers = Object.values(room.players);
    const activePlayers = allPlayers.filter((p) => p.connected);
    const allActivePlayersFinished =
      activePlayers.length > 0 && activePlayers.every((p) => p.finished);

    if (allActivePlayersFinished) {
      console.log(`[Game End] All players finished in room ${roomId}`);
      room.status = "finished";

      // Determine winner based on highest WPM
      let winnerId: string | undefined = undefined;
      let highestWpm = -1;
      activePlayers.forEach((p) => {
        if (p.wpm && p.wpm > highestWpm) {
          highestWpm = p.wpm;
          winnerId = p.id;
        }
      });
      room.winner = winnerId;

      // Handle ELO updates for ranked games
      if (room.isRanked && room.initialElo && winnerId) {
        try {
          const loser = activePlayers.find((p) => p.id !== winnerId)?.id;
          if (!loser) return;

          const winnerInitialElo = room.initialElo[winnerId] || 1000;
          const loserInitialElo = room.initialElo[loser] || 1000;

          // Validate ELO values
          if (!isFinite(winnerInitialElo) || !isFinite(loserInitialElo)) {
            console.error("Invalid ELO values detected");
            return;
          }

          // Calculate ELO change with validation
          const expectedScore =
            1 / (1 + Math.pow(10, (loserInitialElo - winnerInitialElo) / 400));
          const eloChange = Math.round(32 * (1 - expectedScore));

          if (!isFinite(eloChange)) {
            console.error("Invalid ELO change calculated");
            return;
          }

          // Update winner's stats
          const winnerRef = doc(db, "users", winnerId);
          const winnerDoc = await getDoc(winnerRef);
          const winnerData = winnerDoc.data();

          // Validate and sanitize all numeric values
          const currentWinnerElo = Math.max(
            0,
            winnerData?.stats?.overall?.elo || winnerInitialElo
          );
          const currentWinnerPeakElo = Math.max(
            0,
            winnerData?.stats?.overall?.peakElo || winnerInitialElo
          );
          const newWinnerElo = Math.max(0, currentWinnerElo + eloChange);
          const newWinnerPeakElo = Math.max(newWinnerElo, currentWinnerPeakElo);

          // Validate player stats
          const winnerWpm = Math.max(0, room.players[winnerId].wpm || 0);
          const winnerAccuracy = Math.min(
            100,
            Math.max(0, room.players[winnerId].accuracy || 0)
          );
          const winnerWordsTyped = Math.max(
            0,
            room.players[winnerId].wordsTyped || 0
          );
          const winnerCharsTyped = Math.max(
            0,
            room.players[winnerId].charactersTyped || 0
          );
          const winnerMistakes = Math.max(
            0,
            room.players[winnerId].mistakes || 0
          );
          const winnerTimePlayed = Math.max(
            0,
            room.players[winnerId].timePlayed || 0
          );

          // Create match history objects with validated data
          const winnerMatch = {
            matchId: roomId,
            opponentId: loser,
            opponentName: room.players[loser].name || "Opponent",
            timestamp: Date.now(),
            userWpm: winnerWpm,
            opponentWpm: Math.max(0, room.players[loser].wpm || 0),
            isWin: true,
            eloChange: eloChange,
            accuracy: winnerAccuracy,
          };

          const loserMatch = {
            matchId: roomId,
            opponentId: winnerId,
            opponentName: room.players[winnerId].name || "Opponent",
            timestamp: Date.now(),
            userWpm: Math.max(0, room.players[loser].wpm || 0),
            opponentWpm: winnerWpm,
            isWin: false,
            eloChange: -eloChange,
            accuracy: Math.min(
              100,
              Math.max(0, room.players[loser].accuracy || 0)
            ),
          };

          // Update winner's stats with validated data
          await userStatsService.updateUserStats(winnerId, {
            wpm: winnerWpm,
            accuracy: winnerAccuracy,
            wordsTyped: winnerWordsTyped,
            charactersTyped: winnerCharsTyped,
            totalMistakes: winnerMistakes,
            timePlayed: winnerTimePlayed,
            isRanked: true,
            isWinner: true,
          });

          await updateDoc(winnerRef, {
            "stats.overall.elo": newWinnerElo,
            "stats.overall.peakElo": newWinnerPeakElo,
            "stats.overall.totalWins": increment(1),
            "stats.overall.totalWordsTyped": increment(winnerWordsTyped),
            "stats.overall.totalCharactersTyped": increment(winnerCharsTyped),
            "stats.overall.totalMistakes": increment(winnerMistakes),
            "stats.overall.totalTimePlayed": increment(winnerTimePlayed),
            "stats.overall.averageWPM": winnerWpm,
            "stats.overall.bestWPM": Math.max(
              winnerWpm,
              Math.max(0, winnerData?.stats?.overall?.bestWPM || 0)
            ),
            "stats.overall.worstWPM": Math.min(
              winnerWpm,
              Math.max(0, winnerData?.stats?.overall?.worstWPM || winnerWpm)
            ),
            "stats.overall.winRate": Math.round(
              (((winnerData?.stats?.overall?.totalWins || 0) + 1) /
                ((winnerData?.stats?.overall?.gamesPlayed || 0) + 1)) *
                100
            ),
            "stats.overall.gamesPlayed": increment(1),
            currentGame: deleteField(),
            "matchmaking.status": "idle",
            recentMatches: arrayUnion(winnerMatch),
          });

          // Update loser's stats with validated data
          const loserRef = doc(db, "users", loser);
          await updateDoc(loserRef, {
            "stats.overall.elo": increment(-eloChange),
            "stats.overall.totalLosses": increment(1),
            "stats.overall.totalWordsTyped": increment(
              Math.max(0, room.players[loser].wordsTyped || 0)
            ),
            "stats.overall.totalCharactersTyped": increment(
              Math.max(0, room.players[loser].charactersTyped || 0)
            ),
            "stats.overall.totalMistakes": increment(
              Math.max(0, room.players[loser].mistakes || 0)
            ),
            "stats.overall.totalTimePlayed": increment(
              Math.max(0, room.players[loser].timePlayed || 0)
            ),
            "stats.overall.averageWPM": Math.max(
              0,
              room.players[loser].wpm || 0
            ),
            "stats.overall.bestWPM": Math.max(
              Math.max(0, room.players[loser].wpm || 0),
              Math.max(0, winnerData?.stats?.overall?.bestWPM || 0)
            ),
            "stats.overall.worstWPM": Math.min(
              Math.max(0, room.players[loser].wpm || 0),
              Math.max(
                0,
                winnerData?.stats?.overall?.worstWPM ||
                  room.players[loser].wpm ||
                  0
              )
            ),
            "stats.overall.winRate": Math.round(
              ((winnerData?.stats?.overall?.totalWins || 0) /
                ((winnerData?.stats?.overall?.gamesPlayed || 0) + 1)) *
                100
            ),
            "stats.overall.gamesPlayed": increment(1),
            currentGame: deleteField(),
            "matchmaking.status": "idle",
            recentMatches: arrayUnion(loserMatch),
          });

          console.log(`[Game End] Updated winner stats for ${winnerId}:`, {
            elo: newWinnerElo,
            peakElo: newWinnerPeakElo,
            wpm: winnerWpm,
            accuracy: winnerAccuracy,
            wordsTyped: winnerWordsTyped,
            charactersTyped: winnerCharsTyped,
            mistakes: winnerMistakes,
            timePlayed: winnerTimePlayed,
          });
        } catch (error) {
          console.error(
            `[Game End] Error updating ELO ratings for room ${roomId}:`,
            error
          );
        }
      }

      roomManager.broadcastRoomUpdate(roomId);
    }
  };

// Handler for requestPlayAgain event
export const handleRequestPlayAgain = (socket: Socket) => () => {
  const userId = (socket as any).userId;
  const roomId = (socket as any).roomId;

  if (!userId || !roomId || !rooms[roomId] || !rooms[roomId].players[userId]) {
    console.log(`[Play Again] Invalid request from socket ${socket.id}`);
    return;
  }

  const room = rooms[roomId];
  const player = room.players[userId];

  // Can only request play again when game is finished
  if (room.status !== "finished") {
    console.log(
      `[Play Again] Cannot request play again in room ${roomId} (status: ${room.status})`
    );
    return;
  }

  player.wantsPlayAgain = true;
  console.log(
    `[Play Again] Player ${player.name} wants to play again in room ${roomId}`
  );

  // Broadcast the update so UIs can show who wants to play again
  roomManager.broadcastRoomUpdate(roomId);

  // Check if all currently connected players want to play again
  const connectedPlayers = Object.values(room.players).filter(
    (p) => p.connected
  );
  const allWantToPlayAgain =
    connectedPlayers.length > 0 &&
    connectedPlayers.every((p) => p.wantsPlayAgain);

  if (allWantToPlayAgain) {
    console.log(
      `[Play Again] All connected players want to play again in room ${roomId}. Starting topic voting.`
    );
    // --- INITIATE VOTING ---
    roomManager.startTopicVotingWithDeps(roomId);
  }
};
