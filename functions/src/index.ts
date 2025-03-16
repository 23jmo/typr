import {
  onDocumentUpdated,
  onDocumentCreated,
} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as functionsV1 from 'firebase-functions/v1';

admin.initializeApp();

interface Player {
  connected?: boolean;
  joinedAt?: any;
  name?: string;
  wpm?: number;
  accuracy?: number;
  progress?: number;
  ready: boolean;
  finished?: boolean;
  finishTime?: number;
  elo?: number;
  vote?: string; // The topic ID this player voted for
}

// Custom Game

interface GameData {
  players: { [key: string]: Player };
  status: "waiting" | "countdown" | "racing" | "finished" | "voting";
  text: string;
  startTime?: admin.firestore.Timestamp | number;
  countdownStartedAt?: admin.firestore.Timestamp | admin.firestore.FieldValue;
  createdAt?: admin.firestore.Timestamp | admin.firestore.FieldValue;
  winner?: string;
  timeLimit: number; // in seconds
  // Voting-related fields
  topicOptions?: string[]; // List of topics to vote on
  votingEndTime?: admin.firestore.Timestamp | number; // Timestamp when voting ends
  clientVotingEndTime?: number; // Client-side timestamp for voting end time calculations
  selectedTopic?: string; // The topic that was selected after voting
}

export const handlePlayerDisconnect = onDocumentUpdated(
  {
    document: "gameRooms/{roomId}",
    region: "us-central1",
  },
  async (event) => {
    if (!event.data) return;

    const newData = event.data.after.data() as GameData;
    const oldData = event.data.before.data() as GameData;

    logger.info("Function triggered with:", {
      roomId: event.params.roomId,
      oldPlayers: oldData?.players,
      newPlayers: newData?.players,
      isNewRoom: !oldData || !oldData.players,
    });

    // Skip if this is a new room creation or update
    if (
      !oldData ||
      !oldData.players ||
      Object.keys(oldData.players).length === 0
    ) {
      logger.info("Skipping - new room or initial player join");
      return;
    }

    // Check if room is at least 1 second old
    let roomCreatedAt = Date.now();
    if (newData.createdAt && "toMillis" in newData.createdAt) {
      roomCreatedAt = newData.createdAt.toMillis();
    }

    if (Date.now() - roomCreatedAt < 1000) {
      logger.info("Room too new, skipping deletion check");
      return;
    }

    // Check if there are players and all are disconnected
    const players = Object.values(newData.players || {});
    if (players.length > 0 && players.every((player) => !player.connected)) {
      logger.info("All players disconnected, deleting room");
      await event.data.after.ref.delete();
      return;
    }

    logger.info("Room persists - either has connected players or no players");
  }
);

export const handleGameStateChange = onDocumentUpdated(
  {
    document: "gameRooms/{roomId}",
    region: "us-central1",
  },
  async (event) => {
    if (!event.data) return;

    const newData = event.data.after.data() as GameData;
    const oldData = event.data.before.data() as GameData;

    logger.info("handleGameStateChange triggered:", {
      roomId: event.params.roomId,
      oldStatus: oldData.status,
      newStatus: newData.status,
      isRanked: "ranked" in newData && newData.ranked === true,
      players: Object.keys(newData.players || {}).length,
      connectedPlayers: Object.values(newData.players || {}).filter(
        (p) => p.connected
      ).length,
      readyPlayers: Object.values(newData.players || {}).filter((p) => p.ready)
        .length,
    });

    // For ranked games, if status is waiting and both players are connected, set to countdown
    if (
      "ranked" in newData &&
      newData.ranked === true &&
      newData.status === "waiting"
    ) {
      const connectedPlayers = Object.values(newData.players || {}).filter(
        (p) => p.connected
      );
      if (connectedPlayers.length === 2) {
        logger.info(
          "Ranked game with both players connected, setting status to countdown"
        );
        await event.data.after.ref.update({
          status: "countdown",
          countdownStartedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
      }
    }

    // Skip ranked games that are already in countdown state
    if (
      "ranked" in newData &&
      newData.ranked === true &&
      newData.status === "countdown"
    ) {
      logger.info("Skipping ranked game already in countdown state");
      return;
    }

    // If all players are ready and status is waiting, start countdown
    if (newData.status === "waiting") {
      const players = Object.values(newData.players || {});
      const connectedPlayers = players.filter((player) => player.connected);
      const allPlayersReady =
        connectedPlayers.length === 2 &&
        connectedPlayers.every((player) => player.ready);

      logger.info(`Connected Players Count: ${connectedPlayers.length}`);
      logger.info(`All Players Ready: ${allPlayersReady}`);

      if (allPlayersReady) {
        logger.info("All players ready, starting countdown");
        await event.data.after.ref.update({
          status: "countdown",
          countdownStartedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        logger.info("Not all players are ready or connected");
      }
    }

    // If all players are finished or time is up, determine winner
    if (newData.status === "racing") {
      // Skip winner check if we just started racing
      if (oldData.status === "countdown") {
        logger.info("Race just started, skipping winner check");
        return;
      }

      const allPlayersFinished = Object.values(newData.players || {})
        .filter((player) => player.connected) // Only consider connected players
        .every((player) => player.finished);

      // Get the start time in milliseconds
      const startTimeMs =
        newData.startTime instanceof admin.firestore.Timestamp
          ? newData.startTime.toMillis()
          : newData.startTime || Date.now();
      const timeElapsed = (Date.now() - startTimeMs) / 1000;

      logger.info("Race status:", {
        timeElapsed,
        timeLimit: newData.timeLimit,
        allPlayersFinished,
        players: newData.players,
      });

      if (allPlayersFinished || timeElapsed >= newData.timeLimit) {
        // Find player with highest WPM among connected players
        let highestWpm = -1;
        let winner = "";

        Object.entries(newData.players || {}).forEach(([playerId, player]) => {
          if (player.connected && player.wpm && player.wpm > highestWpm) {
            highestWpm = player.wpm;
            winner = playerId;
          }
        });

        if (winner) {
          logger.info(
            `Game finished. Winner: ${winner} with WPM: ${highestWpm}`
          );
          await event.data.after.ref.update({
            status: "finished",
            winner,
          });
        } else {
          logger.warn("No winner found among connected players");
        }
      }
    }
  }
);

// Ranked Mode

interface RankedQueue {
  userId: string;
  username: string;
  elo: number;
  joinedAt: admin.firestore.Timestamp;
  searchRange: number;
  status?: "searching" | "matched";
}

interface RankedGameData extends GameData {
  ranked: true;
  initialElo: { [key: string]: number };
}

export const handleRankedQueueUpdate = onDocumentCreated(
  {
    document: "rankedQueue/{userId}",
    region: "us-central1",
  },
  async (event) => {
    const queueData = event.data?.data() as RankedQueue;
    if (!queueData) return;

    // Skip if player is already matched
    if (queueData.status === "matched") return;

    try {
      // Calculate search range based on queue time
      const queueTime = Date.now() - queueData.joinedAt.toMillis();
      const searchRange = Math.min(
        400,
        queueData.searchRange + queueTime / 1000
      );

      logger.info(
        `Player ${queueData.userId} joined queue with ELO ${queueData.elo} and search range ${searchRange}`
      );

      // Find match within range - MODIFIED QUERY to fix Firestore limitations
      const snapshot = await admin
        .firestore()
        .collection("rankedQueue")
        .where("status", "==", "searching") // Only match with players who are searching
        .orderBy("joinedAt") // Order by join time to prioritize players who have been waiting
        .get();

      // Process results in memory to find a match
      let bestMatch: RankedQueue | null = null;
      let smallestEloDiff = Infinity;

      for (const doc of snapshot.docs) {
        const potentialMatch = doc.data() as RankedQueue;

        // Skip if same player
        if (potentialMatch.userId === queueData.userId) continue;

        // Check if within ELO range
        const eloDiff = Math.abs(queueData.elo - potentialMatch.elo);
        if (eloDiff <= searchRange && eloDiff < smallestEloDiff) {
          bestMatch = potentialMatch;
          smallestEloDiff = eloDiff;
        }
      }

      logger.info(
        `Found ${snapshot.size} potential matches, best match: ${
          bestMatch?.userId || "none"
        }`
      );

      if (bestMatch) {
        const opponent = bestMatch;
        logger.info(
          `Matching players: ${queueData.userId} (${queueData.elo}) and ${opponent.userId} (${opponent.elo})`
        );

        // Use a transaction to ensure both players are marked as matched
        const db = admin.firestore();
        await db.runTransaction(async (transaction) => {
          // Check if opponent is still available
          const opponentRef = db.collection("rankedQueue").doc(opponent.userId);
          const opponentDoc = await transaction.get(opponentRef);

          if (!opponentDoc.exists || opponentDoc.data()?.status === "matched") {
            logger.info(
              `Opponent ${opponent.userId} is no longer available for matching`
            );
            // Opponent is no longer available, update search range and try again
            transaction.update(
              db.collection("rankedQueue").doc(queueData.userId),
              {
                searchRange,
                status: "searching",
              }
            );
            return;
          }

          logger.info(`Both players available, marking as matched`);
          // Mark both players as matched
          transaction.update(opponentRef, { status: "matched" });
          transaction.update(
            db.collection("rankedQueue").doc(queueData.userId),
            {
              status: "matched",
            }
          );
        });

        // Now create the match
        await createRankedMatch(queueData, opponent);
      } else {
        logger.info(
          `No match found for player ${queueData.userId}, updating search range`
        );
        // Update search range if no match found
        await admin
          .firestore()
          .collection("rankedQueue")
          .doc(queueData.userId)
          .update({
            searchRange,
            status: "searching",
          });
      }
    } catch (error) {
      logger.error("Error in matchmaking:", error);
      // Reset player status if there was an error
      try {
        // Check if document exists before updating
        const queueDocRef = admin
          .firestore()
          .collection("rankedQueue")
          .doc(queueData.userId);
        const queueDoc = await queueDocRef.get();

        if (queueDoc.exists) {
          await queueDocRef.update({ status: "searching" });
          logger.info(
            `Reset status to searching for player ${queueData.userId}`
          );
        } else {
          logger.info(
            `Queue document for ${queueData.userId} no longer exists, skipping status reset`
          );
        }
      } catch (resetError) {
        logger.error("Error resetting player status:", resetError);
      }
    }
  }
);

export const handleRankedGameComplete = onDocumentUpdated(
  {
    document: "gameRooms/{roomId}",
    region: "us-central1",
  },
  async (event) => {
    if (!event.data) return;

    const newData = event.data.after.data() as RankedGameData;
    const oldData = event.data.before.data() as RankedGameData;

    // Log the game data for debugging
    logger.info("Previous game data:", oldData);
    logger.info("Updated game data:", newData);

    // Only process ranked games that just finished
    if (
      newData.ranked !== true ||
      newData.status !== "finished" ||
      oldData.status === "finished"
    ) {
      return;
    }

    try {
      const winner = newData.winner;
      if (!winner) return;

      const players = Object.keys(newData.players);
      const loser = players.find((id) => id !== winner);
      if (!loser) return;

      // Calculate ELO changes
      const winnerInitialElo = newData.initialElo[winner];
      const loserInitialElo = newData.initialElo[loser];

      // Validate ELO values
      if (typeof winnerInitialElo !== "number" || isNaN(winnerInitialElo)) {
        logger.error(`Invalid winner ELO: ${winnerInitialElo}`);
        return;
      }

      if (typeof loserInitialElo !== "number" || isNaN(loserInitialElo)) {
        logger.error(`Invalid loser ELO: ${loserInitialElo}`);
        return;
      }

      const expectedScore =
        1 / (1 + Math.pow(10, (loserInitialElo - winnerInitialElo) / 400));
      const eloChange = Math.round(32 * (1 - expectedScore));

      // Validate eloChange
      if (isNaN(eloChange) || !isFinite(eloChange)) {
        logger.error(`Invalid ELO change calculated: ${eloChange}`);
        return;
      }

      logger.info("ELO calculation:", {
        winnerInitialElo,
        loserInitialElo,
        expectedScore,
        eloChange,
      });

      // Update player stats
      const batch = admin.firestore().batch();

      // Get current user data to properly update peak ELO
      const winnerDoc = await admin.firestore().collection("users").doc(winner).get();
      const winnerData = winnerDoc.data();
      const currentWinnerElo = winnerData?.stats?.overall?.elo || winnerInitialElo;
      const currentWinnerPeakElo = winnerData?.stats?.overall?.peakElo || winnerInitialElo;
      
      // Calculate new ELO values
      const newWinnerElo = currentWinnerElo + eloChange;
      const newWinnerPeakElo = Math.max(newWinnerElo, currentWinnerPeakElo);

      // Get loser data
      const loserDoc = await admin.firestore().collection("users").doc(loser).get();
      const loserData = loserDoc.data();

      // Create recent match objects for both players
      const gameId = event.data.after.id;
      
      // For the winner
      const winnerMatch = {
        matchId: gameId,
        opponentId: loser,
        opponentName: newData.players[loser].name || "Opponent",
        timestamp: Date.now(),
        userWpm: newData.players[winner].wpm || 0,
        opponentWpm: newData.players[loser].wpm || 0,
        isWin: true,
        eloChange: eloChange,
        accuracy: newData.players[winner].accuracy || 0
      };

      // For the loser
      const loserMatch = {
        matchId: gameId,
        opponentId: winner,
        opponentName: newData.players[winner].name || "Opponent",
        timestamp: Date.now(),
        userWpm: newData.players[loser].wpm || 0,
        opponentWpm: newData.players[winner].wpm || 0,
        isWin: false,
        eloChange: -eloChange,
        accuracy: newData.players[loser].accuracy || 0
      };

      // Get current recent matches arrays or initialize empty ones
      const winnerRecentMatches = winnerData?.recentMatches || [];
      const loserRecentMatches = loserData?.recentMatches || [];

      // Add new matches at beginning and limit to 10
      const updatedWinnerMatches = [winnerMatch, ...winnerRecentMatches].slice(0, 10);
      const updatedLoserMatches = [loserMatch, ...loserRecentMatches].slice(0, 10);

      // Update winner stats
      const winnerRef = admin.firestore().collection("users").doc(winner);
      batch.update(winnerRef, {
        "stats.overall.elo": newWinnerElo,
        "stats.overall.peakElo": newWinnerPeakElo,
        "stats.overall.totalWins": admin.firestore.FieldValue.increment(1),
        currentGame: admin.firestore.FieldValue.delete(), // Clear currentGame reference
        "matchmaking.status": "idle", // Reset matchmaking status
        recentMatches: updatedWinnerMatches // Add recent matches
      });

      // Update loser stats
      const loserRef = admin.firestore().collection("users").doc(loser);
      batch.update(loserRef, {
        "stats.overall.elo": admin.firestore.FieldValue.increment(-eloChange),
        "stats.overall.totalLosses": admin.firestore.FieldValue.increment(1),
        currentGame: admin.firestore.FieldValue.delete(), // Clear currentGame reference
        "matchmaking.status": "idle", // Reset matchmaking status
        recentMatches: updatedLoserMatches // Add recent matches
      });

      await batch.commit();

      logger.info("Updated ELO ratings and recent matches:", {
        winner,
        loser,
        eloChange,
        winnerNewElo: newWinnerElo,
        winnerNewPeakElo: newWinnerPeakElo,
        loserNewElo: loserInitialElo - eloChange,
      });
    } catch (error) {
      logger.error("Error updating ELO ratings:", error);
    }
  }
);

async function createRankedMatch(player1: RankedQueue, player2: RankedQueue) {
  const gameId = admin.firestore().collection("gameRooms").doc().id;
  const db = admin.firestore();

  try {
    // Validate ELO values
    if (typeof player1.elo !== "number" || isNaN(player1.elo)) {
      logger.error(
        `Invalid ELO for player1 (${player1.userId}): ${player1.elo}`
      );
      player1.elo = 1000; // Default to 1000 if invalid
    }

    if (typeof player2.elo !== "number" || isNaN(player2.elo)) {
      logger.error(
        `Invalid ELO for player2 (${player2.userId}): ${player2.elo}`
      );
      player2.elo = 1000; // Default to 1000 if invalid
    }

    // Use a transaction to ensure atomicity
    await db.runTransaction(async (transaction) => {
      // Create the game room
      const gameRoomRef = db.collection("gameRooms").doc(gameId);

      // Get a random text for the typing test
      const textsRef = db.collection("typingTexts").doc("ranked");
      const textsDoc = await transaction.get(textsRef);
      const texts = textsDoc.exists
        ? textsDoc.data()?.texts
        : ["The quick brown fox jumps over the lazy dog."];
      const randomText = texts[Math.floor(Math.random() * texts.length)];

      // Create the game data
      const gameData: RankedGameData = {
        players: {
          [player1.userId]: {
            name: player1.username,
            connected: false,
            ready: true,
            elo: player1.elo,
          },
          [player2.userId]: {
            name: player2.username,
            connected: false,
            ready: true,
            elo: player2.elo,
          },
        },
        status: "countdown",
        countdownStartedAt: admin.firestore.FieldValue.serverTimestamp(),
        ranked: true,
        text: randomText || "The quick brown fox jumps over the lazy dog.",
        timeLimit: 60,
        initialElo: {
          [player1.userId]: player1.elo,
          [player2.userId]: player2.elo,
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Log the game data for debugging
      logger.info("Creating ranked match with data:", {
        player1: {
          userId: player1.userId,
          elo: player1.elo,
        },
        player2: {
          userId: player2.userId,
          elo: player2.elo,
        },
        initialElo: gameData.initialElo,
        status: gameData.status,
      });

      // Set the game room data
      transaction.set(gameRoomRef, gameData);

      // Remove players from queue
      transaction.delete(db.collection("rankedQueue").doc(player1.userId));
      transaction.delete(db.collection("rankedQueue").doc(player2.userId));

      // Update user documents with current game
      transaction.update(db.collection("users").doc(player1.userId), {
        currentGame: gameId,
        "matchmaking.status": "in_game",
        "matchmaking.lastGameAt": admin.firestore.FieldValue.serverTimestamp(),
      });

      transaction.update(db.collection("users").doc(player2.userId), {
        currentGame: gameId,
        "matchmaking.status": "in_game",
        "matchmaking.lastGameAt": admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    logger.info("Created ranked match:", {
      gameId,
      player1: player1.userId,
      player2: player2.userId,
      status: "countdown",
    });

    return gameId;
  } catch (error) {
    logger.error("Error creating ranked match:", error);

    // Try to reset players' status in the queue if the match creation failed
    try {
      const batch = db.batch();
      let updateCount = 0;

      // Check if players are still in the queue
      const player1DocRef = db.collection("rankedQueue").doc(player1.userId);
      const player1Doc = await player1DocRef.get();

      const player2DocRef = db.collection("rankedQueue").doc(player2.userId);
      const player2Doc = await player2DocRef.get();

      if (player1Doc.exists) {
        batch.update(player1DocRef, {
          status: "searching",
        });
        updateCount++;
      } else {
        logger.info(
          `Queue document for ${player1.userId} no longer exists, skipping status reset`
        );
      }

      if (player2Doc.exists) {
        batch.update(player2DocRef, {
          status: "searching",
        });
        updateCount++;
      } else {
        logger.info(
          `Queue document for ${player2.userId} no longer exists, skipping status reset`
        );
      }

      // Only commit if there are updates to make
      if (updateCount > 0) {
        await batch.commit();
        logger.info(`Reset status to searching for ${updateCount} player(s)`);
      }
    } catch (resetError) {
      logger.error("Error resetting players' status:", resetError);
    }

    throw error;
  }
}

// Add this new scheduled function to process stagnant queue
export const processStagnantQueue = onSchedule(
  {
    schedule: "every 2 minutes",
    region: "us-central1",
  },
  async (event) => {
    logger.info("Running scheduled matchmaking for stagnant queue");

    try {
      // Check if there are at least 2 players in queue
      const countSnapshot = await admin
        .firestore()
        .collection("rankedQueue")
        .where("status", "==", "searching")
        .count()
        .get();

      const count = countSnapshot.data().count;
      if (count < 2) {
        logger.info("Not enough players in queue for matching");
        return;
      }

      logger.info(`Found ${count} players in stagnant queue, processing...`);

      // Get players who have been waiting the longest
      const snapshot = await admin
        .firestore()
        .collection("rankedQueue")
        .where("status", "==", "searching")
        .orderBy("joinedAt")
        .limit(50) // Process in batches if queue is large
        .get();

      if (snapshot.empty) {
        logger.info("No players in queue with status 'searching'");
        return;
      }

      // Convert to array for easier processing
      const players = snapshot.docs.map((doc) => doc.data() as RankedQueue);

      // Keep track of matched players to avoid matching them again
      const matchedPlayerIds = new Set<string>();

      // Process each player
      for (const player of players) {
        // Skip if already matched in this run
        if (matchedPlayerIds.has(player.userId)) continue;

        // Calculate search range based on queue time
        const queueTime = Date.now() - player.joinedAt.toMillis();
        const searchRange = Math.min(400, 100 + queueTime / 1000);

        logger.info(
          `Processing player ${player.userId} with ELO ${player.elo} and search range ${searchRange}`
        );

        // Find best match for this player
        let bestMatch: RankedQueue | null = null;
        let smallestEloDiff = Infinity;

        for (const potentialMatch of players) {
          // Skip if same player or already matched
          if (
            potentialMatch.userId === player.userId ||
            matchedPlayerIds.has(potentialMatch.userId)
          )
            continue;

          // Check if within ELO range
          const eloDiff = Math.abs(player.elo - potentialMatch.elo);
          if (eloDiff <= searchRange && eloDiff < smallestEloDiff) {
            bestMatch = potentialMatch;
            smallestEloDiff = eloDiff;
          }
        }

        // If match found, create game and mark both as matched
        if (bestMatch) {
          logger.info(
            `Matching players: ${player.userId} (${player.elo}) and ${bestMatch.userId} (${bestMatch.elo})`
          );

          // Mark both players as matched to avoid matching them again in this run
          matchedPlayerIds.add(player.userId);
          matchedPlayerIds.add(bestMatch.userId);

          // Use a transaction to ensure both players are marked as matched
          const db = admin.firestore();
          await db.runTransaction(async (transaction) => {
            const player1Ref = db.collection("rankedQueue").doc(player.userId);
            const player2Ref = db
              .collection("rankedQueue")
              .doc(bestMatch!.userId);

            const player1Doc = await transaction.get(player1Ref);
            const player2Doc = await transaction.get(player2Ref);

            // Verify both players are still in queue and searching
            if (
              !player1Doc.exists ||
              player1Doc.data()?.status !== "searching"
            ) {
              logger.info(
                `Player ${player.userId} is no longer available for matching`
              );
              return;
            }

            if (
              !player2Doc.exists ||
              player2Doc.data()?.status !== "searching"
            ) {
              logger.info(
                `Player ${
                  bestMatch!.userId
                } is no longer available for matching`
              );
              return;
            }

            // Mark both as matched
            transaction.update(player1Ref, { status: "matched" });
            transaction.update(player2Ref, { status: "matched" });
          });

          // Create the match
          await createRankedMatch(player, bestMatch);
        } else {
          logger.info(`No suitable match found for player ${player.userId}`);
        }
      }

      logger.info(`Matched ${matchedPlayerIds.size / 2} pairs of players`);
    } catch (error) {
      logger.error("Error processing stagnant queue:", error);
    }
  }
);

/**
 * Scheduled function to update the global leaderboard daily at midnight
 * This ensures we only make one query per day to get the top users by ELO
 */
export const updateDailyLeaderboard = onSchedule({
  schedule: '0 0 * * *', // Run at midnight every day (cron syntax)
  timeZone: 'America/New_York', // Adjust to your preferred timezone
  retryCount: 3, // Retry up to 3 times if the function fails
}, async () => {
  try {
    logger.info("Starting daily leaderboard update");
    
    // Get top 5 users by ELO
    const topUsersQuery = await admin.firestore().collection("users")
      .orderBy("stats.overall.elo", "desc")
      .limit(5)
      .get();
    
    const topUsers: any[] = [];
    
    topUsersQuery.forEach(doc => {
      const userData = doc.data();
      
      // Skip users without proper data
      if (!userData.stats?.overall?.elo) return;
      
      // Get the user's rank based on ELO
      const elo = userData.stats.overall.elo;
      let rank = "Plastic";
      
      // Determine rank based on ELO ranges from ranks.ts
      if (elo >= 2000) {
        rank = "Cherry MX";
      } else if (elo >= 1800) {
        rank = "Diamond";
      } else if (elo >= 1500) {
        rank = "Platinum";
      } else if (elo >= 1200) {
        rank = "Gold";
      } else if (elo >= 800) {
        rank = "Silver";
      } else {
        rank = "Plastic";
      }
      
      topUsers.push({
        uid: userData.uid,
        username: userData.username || "Anonymous",
        elo: elo,
        rank: rank,
        averageWPM: userData.stats.overall.averageWPM || 0
      });
    });
    
    // Update the leaderboard document
    await admin.firestore().collection("leaderboards").doc("global").set({
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      topUsers: topUsers,
      lastScheduledUpdate: admin.firestore.FieldValue.serverTimestamp()
    });
    
    logger.info("Updated global leaderboard with top 5 users", { count: topUsers.length });
  } catch (error) {
    logger.error("Error updating global leaderboard:", error);
  }
});

/**
 * Function to initialize the leaderboard manually if needed
 * This can be called via an HTTP request
 */
export const initializeLeaderboard = functionsV1.https.onCall(async (data, context) => {
  try {
    // Check if authenticated and admin
    if (!context.auth || context.auth.token.admin !== true) {
      throw new Error("Unauthorized - only admins can initialize the leaderboard");
    }
    
    // Use the same logic as the scheduled function
    const topUsersQuery = await admin.firestore().collection("users")
      .orderBy("stats.overall.elo", "desc")
      .limit(5)
      .get();
    
    const topUsers: any[] = [];
    
    topUsersQuery.forEach(doc => {
      const userData = doc.data();
      
      // Skip users without proper data
      if (!userData.stats?.overall?.elo) return;
      
      // Get the user's rank based on ELO
      const elo = userData.stats.overall.elo;
      let rank = "Plastic";
      
      // Determine rank based on ELO ranges from ranks.ts
      if (elo >= 2000) {
        rank = "Cherry MX";
      } else if (elo >= 1800) {
        rank = "Diamond";
      } else if (elo >= 1500) {
        rank = "Platinum";
      } else if (elo >= 1200) {
        rank = "Gold";
      } else if (elo >= 800) {
        rank = "Silver";
      } else {
        rank = "Plastic";
      }
      
      logger.info(`Calculated rank for user with ELO ${elo}: ${rank}`);
      
      const userEntry = {
        uid: userData.uid,
        username: userData.username || "Anonymous",
        elo: elo,
        rank: rank,
        averageWPM: userData.stats.overall.averageWPM || 0
      };
      
      topUsers.push(userEntry);
    });
    
    // Create the leaderboard document
    await admin.firestore().collection("leaderboards").doc("global").set({
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      topUsers: topUsers,
      manuallyInitialized: true,
      initializedBy: context.auth.uid
    });
    
    return { 
      success: true, 
      message: "Leaderboard initialized successfully",
      count: topUsers.length
    };
  } catch (error) {
    logger.error("Error initializing leaderboard:", error);
    throw new functionsV1.https.HttpsError(
      "internal", 
      "Error initializing leaderboard: " + (error instanceof Error ? error.message : "Unknown error")
    );
  }
});

/**
 * Function to update the leaderboard manually for testing
 * This can be called by any authenticated user
 */
export const updateLeaderboardManually = functionsV1.https.onCall(async (data, context) => {
  try {
    // Check if authenticated
    if (!context.auth) {
      throw new Error("Authentication required");
    }
    
    logger.info("Manual leaderboard update requested by user:", context.auth.uid);
    
    // Get top 5 users by ELO
    const topUsersQuery = await admin.firestore().collection("users")
      .orderBy("stats.overall.elo", "desc")
      .limit(5)
      .get();
    
    const topUsers: any[] = [];
    
    // Log the number of users found
    logger.info(`Found ${topUsersQuery.size} users for leaderboard`);
    
    topUsersQuery.forEach(doc => {
      const userData = doc.data();
      
      // Skip users without proper data
      if (!userData.stats?.overall?.elo) {
        logger.warn(`User ${doc.id} has no ELO data, skipping`);
        return;
      }
      
      // Get the user's rank based on ELO
      const elo = userData.stats.overall.elo;
      let rank = "Plastic";
      
      // Determine rank based on ELO ranges from ranks.ts
      if (elo >= 2000) {
        rank = "Cherry MX";
      } else if (elo >= 1800) {
        rank = "Diamond";
      } else if (elo >= 1500) {
        rank = "Platinum";
      } else if (elo >= 1200) {
        rank = "Gold";
      } else if (elo >= 800) {
        rank = "Silver";
      } else {
        rank = "Plastic";
      }
      
      logger.info(`Calculated rank for user with ELO ${elo}: ${rank}`);
      
      const userEntry = {
        uid: userData.uid,
        username: userData.username || "Anonymous",
        elo: elo,
        rank: rank,
        averageWPM: userData.stats.overall.averageWPM || 0
      };
      
      logger.info(`Adding user to leaderboard: ${JSON.stringify(userEntry)}`);
      topUsers.push(userEntry);
    });
    
    // If no users with ELO were found, create some sample data
    if (topUsers.length === 0) {
      logger.warn("No users with ELO found, creating sample data");
      
      // Create sample data with correct ranks based on ranks.ts
      topUsers.push(
        { uid: "sample1", username: "TypeMaster99", elo: 2050, rank: "Cherry MX", averageWPM: 145 },
        { uid: "sample2", username: "SpeedDemon", elo: 1850, rank: "Diamond", averageWPM: 135 },
        { uid: "sample3", username: "KeyboardWarrior", elo: 1600, rank: "Platinum", averageWPM: 130 },
        { uid: "sample4", username: "SwiftKeys", elo: 1300, rank: "Gold", averageWPM: 120 },
        { uid: "sample5", username: "FastFingers", elo: 900, rank: "Silver", averageWPM: 115 }
      );
      
      logger.info("Created sample data with proper ranks");
    }
    
    // Create the timestamp
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    
    // Update the leaderboard document
    const leaderboardData = {
      updatedAt: timestamp,
      topUsers: topUsers,
      lastManualUpdate: timestamp,
      updatedBy: context.auth.uid
    };
    
    logger.info("Writing leaderboard data:", JSON.stringify(leaderboardData));
    
    await admin.firestore().collection("leaderboards").doc("global").set(leaderboardData);
    
    logger.info(`Manually updated leaderboard with ${topUsers.length} users`);
    
    // Return the data that was written
    return { 
      success: true, 
      message: "Leaderboard updated successfully",
      count: topUsers.length,
      topUsers: topUsers,
      updatedAt: new Date().toISOString() // Client-friendly timestamp
    };
  } catch (error) {
    logger.error("Error manually updating leaderboard:", error);
    throw new functionsV1.https.HttpsError(
      "internal", 
      "Error updating leaderboard: " + (error instanceof Error ? error.message : "Unknown error")
    );
  }
});
