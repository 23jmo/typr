import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as functionsV1 from 'firebase-functions/v1';

admin.initializeApp();

/**
 * Scheduled function to update the global leaderboard hourly
 * This ensures we refresh the leaderboard every hour to keep it up to date
 */
export const updateHourlyLeaderboard = onSchedule({
  schedule: '0 * * * *', // Run at the top of every hour (cron syntax)
  timeZone: 'America/New_York', // Adjust to your preferred timezone
  retryCount: 3, // Retry up to 3 times if the function fails
}, async () => {
  try {
    logger.info("Starting hourly leaderboard update");
    
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
