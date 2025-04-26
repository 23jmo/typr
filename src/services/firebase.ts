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
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  deleteUser,
} from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
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
export const analytics = getAnalytics(app);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);

// Auth services
export const authService = {
  signInWithEmail: async (email: string, password: string) => {
    console.log("[AuthService] Attempting email sign in");
    const result = await signInWithEmailAndPassword(auth, email, password);
    console.log("[AuthService] Sign in successful, checking user data");
    const userData = await userService.getUserByUid(result.user.uid);
    const needsUsername =
      !userData?.username || userData?.username.length === 0;
    console.log("[AuthService] User needs username:", needsUsername);
    return { result, needsUsername };
  },

  signUpWithEmail: async (email: string, password: string) => {
    console.log("[AuthService] Attempting email sign up");
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    console.log("[AuthService] Sign up successful, creating user document");
    await userService.createUser(userCredential.user.uid, userCredential.user);
    console.log("[AuthService] User document created");
    return { result: userCredential, needsUsername: true };
  },

  signInWithGoogle: async () => {
    console.log("[AuthService] Attempting Google sign in");
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    console.log("[AuthService] Google sign in successful, checking user data");
    const userData = await userService.getUserByUid(result.user.uid);
    if (!userData) {
      console.log("[AuthService] New Google user, creating document");
      await userService.createUser(result.user.uid, result.user);
      return { result, needsUsername: true };
    }
    const needsUsername = !userData.username;
    console.log("[AuthService] User needs username:", needsUsername);
    return { result, needsUsername };
  },

  signOut: () => auth.signOut(),
};

// User stats service for centralized stats management
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

      // Calculate new average accuracy
      const newAverageAccuracy = Math.round(
        (currentStats.averageAccuracy * currentStats.gamesPlayed + gameResult.accuracy) /
          newGamesPlayed
      );

      // Check if this is a new best WPM
      const newBestWPM = Math.max(currentStats.bestWPM, gameResult.wpm);

      // Update Firestore
      await updateDoc(userRef, {
        "stats.overall.gamesPlayed": increment(1),
        "stats.overall.averageWPM": newAverageWPM,
        "stats.overall.bestWPM": newBestWPM,
        "stats.overall.averageAccuracy": newAverageAccuracy,
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
      const newWinRate = Math.round((newWins / newGamesPlayed) * 100);

      // Calculate new average WPM
      const totalWPM =
        currentRankedStats.averageWPM * currentRankedStats.gamesPlayed;
      const newAverageWPM = Math.round(
        (totalWPM + gameResult.wpm) / newGamesPlayed
      );

      // Calculate new average accuracy for ranked mode
      const totalAccuracy =
        currentRankedStats.averageAccuracy * currentRankedStats.gamesPlayed;
      const newAverageAccuracy = Math.round(
        (totalAccuracy + gameResult.accuracy) / newGamesPlayed
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
        "stats.ranked.averageAccuracy": newAverageAccuracy,
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

export const userService = {
  // Create new user document
  createUser: async (userId: string, authData: any): Promise<void> => {
    try {
      const userDoc: UserData = {
        uid: userId,
        email: authData.email,
        displayName: authData.displayName || null,
        photoURL: authData.photoURL || null,
        username: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stats: {
          overall: {
            gamesPlayed: 0,
            averageWPM: 0,
            bestWPM: 0,
            worstWPM: 0,
            totalWins: 0,
            totalLosses: 0,
            totalTies: 0,
            winRate: 0,
            averageAccuracy: 0,
            totalWordsTyped: 0,
            totalCharactersTyped: 0,
            totalMistakes: 0,
            totalTimePlayed: 0,
            elo: 1000,
            peakElo: 1000,
          },
          ranked: {
            gamesPlayed: 0,
            averageWPM: 0,
            bestWPM: 0,
            worstWPM: 0,
            totalWins: 0,
            totalLosses: 0,
            totalTies: 0,
            winRate: 0,
            averageAccuracy: 0,
            totalWordsTyped: 0,
            totalCharactersTyped: 0,
            totalMistakes: 0,
            totalTimePlayed: 0,
          },
        },
        games: [],
      };
      await setDoc(doc(db, "users", userId), userDoc);
    } catch (error: any) {
      console.error("Error creating user:", error);
      throw new Error(error.message || "Failed to create user");
    }
  },

  // Get user data
  getUser: async (userId: string): Promise<UserData | null> => {
    const docRef = doc(db, "users", userId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as UserData) : null;
  },

  // Update user stats after game (legacy method, redirects to userStatsService)
  updateUserStats: async (
    userId: string,
    gameResult: GameResult
  ): Promise<void> => {
    await userStatsService.updateUserStats(userId, {
      wpm: gameResult.wpm,
      accuracy: gameResult.accuracy,
      wordsTyped: gameResult.wordsTyped,
      charactersTyped: gameResult.charactersTyped,
      totalMistakes: gameResult.totalMistakes,
      timePlayed: gameResult.timePlayed,
      isRanked: false,
    });
  },

  isUsernameAvailable: async (username: string): Promise<boolean> => {
    const usernameQuery = query(
      collection(db, "users"),
      where("username", "==", username.toLowerCase())
    );
    const querySnapshot = await getDocs(usernameQuery);
    return querySnapshot.empty;
  },

  updateUsername: async (username: string): Promise<void> => {
    try {
      if (!auth.currentUser) throw new Error("Not authenticated");
      const currentUser = auth.currentUser; // Type assertion to avoid null checks

      console.log("[Firebase.tsx] Starting username update process");
      console.log("[Firebase.tsx] Checking username availability:", username);

      const usernameQuery = query(
        collection(db, "users"),
        where("username", "==", username.toLowerCase())
      );

      const querySnapshot = await getDocs(usernameQuery);
      if (!querySnapshot.empty) {
        console.log("[Firebase.tsx] Username already taken");
        throw new Error("Username already taken");
      }

      console.log("[Firebase.tsx] Username available, updating document");
      const userRef = doc(db, "users", currentUser.uid);

      try {
        await updateDoc(userRef, {
          username: username.toLowerCase(),
          updatedAt: new Date().toISOString(),
        });
        console.log("[Firebase.tsx] Username updated successfully");
      } catch (updateError: any) {
        console.error("[Firebase.tsx] Error during updateDoc:", updateError);
        console.error("[Firebase.tsx] Error details:", {
          code: updateError.code,
          message: updateError.message,
          stack: updateError.stack,
        });
        throw updateError;
      }
    } catch (error: any) {
      switch (error.code) {
        case "auth/username-already-taken":
          throw new Error("Username already taken");
        case "not-found":
          console.log("[Firebase.tsx] Username not found, creating a new user");
          await userService.createUser(
            auth.currentUser!.uid,
            auth.currentUser!
          );
          break;
        case "auth/invalid-credential":
          throw new Error("Invalid email or password");
        default:
          throw error;
      }
    }
  },

  getUserByUid: async (uid: string): Promise<UserData | null> => {
    const userDoc = await getDoc(doc(db, "users", uid));
    return userDoc.exists() ? (userDoc.data() as UserData) : null;
  },

  deleteAccount: async (): Promise<void> => {
    try {
      if (!auth.currentUser) throw new Error("Not authenticated");
      const userId = auth.currentUser.uid;
      
      console.log("[UserService] Starting account deletion process for:", userId);
      
      // First, delete all user data from Firestore
      // 1. Delete user document
      await deleteDoc(doc(db, "users", userId));
      console.log("[UserService] Deleted user document");
      
      // 2. Remove from matchmaking queue if present
      await deleteDoc(doc(db, "rankedQueue", userId));
      
      // 3. Delete Firebase Auth account
      await deleteUser(auth.currentUser);
      console.log("[UserService] Successfully deleted user account");
      
      // Sign out (though the account is already deleted)
      await auth.signOut();
    } catch (error: any) {
      console.error("[UserService] Error deleting account:", error);
      if (error.code === "auth/requires-recent-login") {
        throw new Error("For security reasons, please log out and log back in before deleting your account.");
      } else {
        throw new Error(error.message || "Failed to delete account");
      }
    }
  },
};

export const gameService = {
  // Create a new game room
  createRoom: async (roomId: string, creatorId: string): Promise<void> => {
    await setDoc(doc(db, "rooms", roomId), {
      createdBy: creatorId,
      createdAt: new Date().toISOString(),
      status: "waiting", // waiting, playing, finished
      players: [creatorId],
      text: "The quick brown fox jumps over the lazy dog", // Replace with your text generation logic
    });
  },

  // Join a game room
  joinRoom: async (roomId: string, userId: string): Promise<void> => {
    const roomRef = doc(db, "rooms", roomId);
    const room = await getDoc(roomRef);
    if (room.exists()) {
      const players = room.data().players;
      if (!players.includes(userId)) {
        await updateDoc(roomRef, {
          players: [...players, userId],
        });
      }
    }
  },

  // Save game result
  saveGameResult: async (result: GameResult): Promise<void> => {
    const resultRef = collection(db, "gameResults");
    await setDoc(doc(resultRef), {
      ...result,
      timestamp: new Date().toISOString(),
    });
  },

  // Get user's game history
  getUserHistory: async (userId: string): Promise<GameResult[]> => {
    const resultsRef = collection(db, "gameResults");
    const q = query(resultsRef, where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => doc.data() as GameResult);
  },
};

interface QueueData {
  userId: string;
  username: string | null;
  elo: number;
  joinedAt: FieldValue;
  region: string;
  searchRange: number;
  status: "searching" | "matched" | "accepted";
  matchId?: string;
}

export const matchmakingService = {
  // Join the matchmaking queue
  joinQueue: async (userId: string, userData: UserData) => {
    if (!userData.username) {
      throw new Error("Username required to join queue");
    }

    try {
      // Check if user is already in a game
      if (userData.currentGame) {
        console.log(
          "[Matchmaking] User has currentGame reference:",
          userData.currentGame
        );

        // Check if the game still exists and is not finished
        const gameDoc = await getDoc(
          doc(db, "gameRooms", userData.currentGame)
        );

        if (gameDoc.exists()) {
          const gameData = gameDoc.data();

          // Only redirect if the game is still active (not finished)
          if (gameData.status !== "finished") {
            console.log("[Matchmaking] User is in an active game, redirecting");
            return userData.currentGame;
          } else {
            console.log(
              "[Matchmaking] User's game is finished, cleaning up reference"
            );
            // Clean up the stale game reference
            await updateDoc(doc(db, "users", userId), {
              currentGame: deleteField(),
              "matchmaking.status": "idle",
            });
          }
        } else {
          console.log(
            "[Matchmaking] User's game no longer exists, cleaning up reference"
          );
          // Game doesn't exist anymore, clean up the reference
          await updateDoc(doc(db, "users", userId), {
            currentGame: deleteField(),
            "matchmaking.status": "idle",
          });
        }
      }

      // Check if user is already in queue
      const existingQueue = await getDoc(doc(db, "rankedQueue", userId));
      if (existingQueue.exists()) {
        console.log("[Matchmaking] User already in queue, updating status");
        await updateDoc(doc(db, "rankedQueue", userId), {
          status: "searching",
          searchRange: 100, // Reset search range
          joinedAt: serverTimestamp(),
        });
        return null;
      }

      // Ensure ELO is a valid number
      let userElo = userData.stats.overall.elo;
      if (typeof userElo !== "number" || isNaN(userElo)) {
        console.warn(
          `[Matchmaking] Invalid ELO value for user ${userId}: ${userElo}, defaulting to 1000`
        );
        userElo = 1000;

        // Fix the user's ELO in their profile
        try {
          await updateDoc(doc(db, "users", userId), {
            "stats.overall.elo": 1000,
            "stats.overall.peakElo": 1000,
          });
          console.log(`[Matchmaking] Fixed invalid ELO for user ${userId}`);
        } catch (eloFixError) {
          console.error("[Matchmaking] Error fixing user ELO:", eloFixError);
        }
      }

      const queueRef = doc(db, "rankedQueue", userId);
      const queueData: QueueData = {
        userId,
        username: userData.username,
        elo: userElo,
        joinedAt: serverTimestamp(),
        region: "us-central1",
        searchRange: 100, // Start with a narrower search range
        status: "searching",
      };

      console.log("[Matchmaking] Joining queue with data:", queueData);
      await setDoc(queueRef, queueData);
      return null;
    } catch (error) {
      console.error("[Matchmaking] Error joining queue:", error);
      throw error;
    }
  },

  // Leave the matchmaking queue
  leaveQueue: async (userId: string) => {
    try {
      console.log("[Matchmaking] Leaving queue");
      await deleteDoc(doc(db, "rankedQueue", userId));
    } catch (error) {
      console.error("[Matchmaking] Error leaving queue:", error);
    }
  },

  // Accept a match
  acceptMatch: async (userId: string, matchId: string) => {
    try {
      console.log(`[Matchmaking] User ${userId} accepting match ${matchId}`);
      await updateDoc(doc(db, "rankedQueue", userId), {
        status: "accepted",
        matchId,
      });
    } catch (error) {
      console.error("[Matchmaking] Error accepting match:", error);
    }
  },

  // Decline a match
  declineMatch: async (userId: string) => {
    try {
      console.log(`[Matchmaking] User ${userId} declining match`);
      // Remove from queue and let them rejoin if they want
      await deleteDoc(doc(db, "rankedQueue", userId));
    } catch (error) {
      console.error("[Matchmaking] Error declining match:", error);
    }
  },

  // Get match history for a user
  getMatchHistory: async (userId: string, limitCount = 10) => {
    try {
      // Query matches where this user was a player
      const matchesRef = collection(db, "matchHistory");
      const q = query(
        matchesRef,
        where(`players.${userId}`, "!=", null),
        orderBy("completedAt", "desc"),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const matches: any[] = [];

      querySnapshot.forEach((doc) => {
        matches.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      return matches;
    } catch (error) {
      console.error("[Matchmaking] Error getting match history:", error);
      return [];
    }
  },

  // Get leaderboard
  getLeaderboard: async (limitCount = 10) => {
    try {
      const usersRef = collection(db, "users");
      const q = query(
        usersRef,
        orderBy("stats.overall.elo", "desc"),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const leaderboard: any[] = [];

      querySnapshot.forEach((doc) => {
        const userData = doc.data() as UserData;
        leaderboard.push({
          uid: userData.uid,
          username: userData.username,
          elo: userData.stats.overall.elo,
          winRate: userData.stats.overall.winRate,
          gamesPlayed: userData.stats.overall.gamesPlayed,
        });
      });

      return leaderboard;
    } catch (error) {
      console.error("[Matchmaking] Error getting leaderboard:", error);
      return [];
    }
  },
};

// Leaderboard service for efficient leaderboard operations
export const leaderboardService = {
  // Get global leaderboard (top 5 users)
  getGlobalLeaderboard: async () => {
    try {
      const leaderboardDoc = await getDoc(doc(db, "leaderboards", "global"));

      if (leaderboardDoc.exists()) {
        return leaderboardDoc.data();
      } else {
        // Fallback to direct query if document doesn't exist
        const leaderboard = await matchmakingService.getLeaderboard(5);
        return {
          updatedAt: new Date().toISOString(),
          topUsers: leaderboard,
        };
      }
    } catch (error) {
      console.error("[Leaderboard] Error getting global leaderboard:", error);
      return { updatedAt: new Date().toISOString(), topUsers: [] };
    }
  },

  // Manual update function for testing purposes - uses Cloud Function
  updateLeaderboardNow: async () => {
    try {
      console.log(
        "[Leaderboard] Manually updating leaderboard via Cloud Function"
      );

      // Call the Cloud Function
      const updateLeaderboardFn = httpsCallable(
        functions,
        "updateLeaderboardManually"
      );
      const result = await updateLeaderboardFn();

      console.log("[Leaderboard] Cloud Function result:", result.data);

      // Wait a moment to ensure Firestore has updated
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Fetch the updated leaderboard with cache busting
      const leaderboardRef = doc(db, "leaderboards", "global");
      const leaderboardSnap = await getDoc(leaderboardRef);

      if (!leaderboardSnap.exists()) {
        throw new Error("Leaderboard document not found after update");
      }

      const leaderboardData = leaderboardSnap.data();
      console.log("[Leaderboard] Fresh data after update:", leaderboardData);

      return {
        success: true,
        updatedAt: leaderboardData.updatedAt,
        topUsers: leaderboardData.topUsers,
      };
    } catch (error) {
      console.error(
        "[Leaderboard] Error manually updating leaderboard:",
        error
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};
