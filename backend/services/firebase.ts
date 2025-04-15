import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  serverTimestamp,
  FieldValue,
  orderBy,
  limit,
  deleteField,
  increment,
  arrayUnion,
} from "firebase/firestore";

import { initializeApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";

import { UserData, GameResult } from "../types";

const firebaseConfig = {
  apiKey: "AIzaSyAuVEYjR9vcHXoxR0F3OVwecYgIPzxqhwQ",
  authDomain: "typr-84dbd.firebaseapp.com",
  projectId: "typr-84dbd",
  storageBucket: "typr-84dbd.firebasestorage.app",
  messagingSenderId: "663496765151",
  appId: "1:663496765151:web:e618e0aa874338108ec36a",
  measurementId: "G-88CHFMN7DX",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const functions = getFunctions(app);

export const userStatsService = {
  // Update overall stats (used by both solo and ranked modes)
  updateOverallStats: async (
    userId: string,
    gameResult: {
      wpm: number;
      accuracy: number;
      wordsTyped: number;
      charactersTyped: number;
      totalMistakes: number;
      timePlayed: number;
      gameId?: string;
    }
  ): Promise<void> => {
    if (!userId) return;

    try {
      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();

      if (!userData) return;

      // Check if this game has already been processed
      if (
        gameResult.gameId &&
        userData.processedGames &&
        userData.processedGames.includes(gameResult.gameId)
      ) {
        console.log("Game already processed in overall stats, skipping update");
        return;
      }

      const currentStats = userData.stats.overall;
      const newGamesPlayed = currentStats.gamesPlayed + 1;

      // Calculate new average WPM
      const newAverageWPM = Math.round(
        (currentStats.averageWPM * currentStats.gamesPlayed + gameResult.wpm) /
          newGamesPlayed
      );

      // Check if this is a new best WPM
      const newBestWPM = Math.max(currentStats.bestWPM, gameResult.wpm);

      // Update Firestore
      await updateDoc(userRef, {
        "stats.overall.gamesPlayed": increment(1),
        "stats.overall.averageWPM": newAverageWPM,
        "stats.overall.bestWPM": newBestWPM,
        "stats.overall.totalWordsTyped": increment(gameResult.wordsTyped),
        "stats.overall.totalCharactersTyped": increment(
          gameResult.charactersTyped
        ),
        "stats.overall.totalMistakes": increment(gameResult.totalMistakes),
        "stats.overall.totalTimePlayed": increment(gameResult.timePlayed),
        ...(gameResult.gameId
          ? { processedGames: arrayUnion(gameResult.gameId) }
          : {}),
      });

      console.log("Successfully updated overall stats for user:", userId);
    } catch (error) {
      console.error("Error updating overall stats:", error);
    }
  },

  // Update ranked-specific stats
  updateRankedStats: async (
    userId: string,
    gameResult: {
      wpm: number;
      accuracy: number;
      wordsTyped: number;
      charactersTyped: number;
      totalMistakes: number;
      timePlayed: number;
      isWinner: boolean;
      gameId?: string;
    }
  ): Promise<void> => {
    if (!userId) return;

    try {
      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();

      if (!userData) return;

      // Check if this game has already been processed
      if (
        gameResult.gameId &&
        userData.processedRankedGames &&
        userData.processedRankedGames.includes(gameResult.gameId)
      ) {
        console.log("Game already processed in ranked stats, skipping update");
        return;
      }

      const currentRankedStats = userData.stats.ranked;
      const newGamesPlayed = currentRankedStats.gamesPlayed + 1;
      const newWins =
        currentRankedStats.totalWins + (gameResult.isWinner ? 1 : 0);
      const newLosses =
        currentRankedStats.totalLosses + (gameResult.isWinner ? 0 : 1);
      const newWinRate = Math.round((newWins / newGamesPlayed) * 100);

      // Calculate new average WPM
      const totalWPM =
        currentRankedStats.averageWPM * currentRankedStats.gamesPlayed;
      const newAverageWPM = Math.round(
        (totalWPM + gameResult.wpm) / newGamesPlayed
      );

      // Check if this is a new best WPM
      const isNewBest = gameResult.wpm > currentRankedStats.bestWPM;
      const newBestWPM = isNewBest
        ? gameResult.wpm
        : currentRankedStats.bestWPM;

      // Update Firestore
      await updateDoc(userRef, {
        "stats.ranked.gamesPlayed": increment(1),
        "stats.ranked.averageWPM": newAverageWPM,
        "stats.ranked.bestWPM": newBestWPM,
        "stats.ranked.totalWins": increment(gameResult.isWinner ? 1 : 0),
        "stats.ranked.totalLosses": increment(gameResult.isWinner ? 0 : 1),
        "stats.ranked.winRate": newWinRate,
        "stats.ranked.totalWordsTyped": increment(gameResult.wordsTyped),
        "stats.ranked.totalCharactersTyped": increment(
          gameResult.charactersTyped
        ),
        "stats.ranked.totalMistakes": increment(gameResult.totalMistakes),
        "stats.ranked.totalTimePlayed": increment(gameResult.timePlayed),
        ...(gameResult.gameId
          ? { processedRankedGames: arrayUnion(gameResult.gameId) }
          : {}),
      });

      console.log("Successfully updated ranked stats for user:", userId);
    } catch (error) {
      console.error("Error updating ranked stats:", error);
    }
  },

  // Main method to update all relevant stats based on game type
  updateUserStats: async (
    userId: string,
    gameResult: {
      wpm: number;
      accuracy: number;
      wordsTyped: number;
      charactersTyped: number;
      totalMistakes: number;
      timePlayed: number;
      isRanked?: boolean;
      isWinner?: boolean;
      gameId?: string;
    }
  ): Promise<void> => {
    if (!userId) return;

    try {
      // Generate a gameId if one wasn't provided
      const gameId =
        gameResult.gameId ||
        `game_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const gameResultWithId = { ...gameResult, gameId };

      // Always update overall stats
      await userStatsService.updateOverallStats(userId, gameResultWithId);

      // If it's a ranked game, also update ranked stats
      if (gameResult.isRanked && gameResult.isWinner !== undefined) {
        await userStatsService.updateRankedStats(userId, {
          ...gameResultWithId,
          isWinner: gameResult.isWinner,
        });
      }

      console.log("Successfully updated all stats for user:", userId);
    } catch (error) {
      console.error("Error updating user stats:", error);
    }
  },
};
