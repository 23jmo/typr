const admin = require("firebase-admin");
const serviceAccount = require("./path/to/serviceAccountKey.json");

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function migrateUserStats() {
  try {
    // Get all documents that need updating
    const snapshot = await db.collection("userStats").get();

    // Batch updates for better performance
    const batchSize = 500;
    let batch = db.batch();
    let operationCount = 0;

    console.log(`Found ${snapshot.size} documents to process`);

    for (const doc of snapshot.docs) {
      // Only update if the new property doesn't exist
      if (!doc.data().newProperty) {
        batch.update(doc.ref, {
          newProperty: "defaultValue",
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
        operationCount++;
      }

      // Commit batch when it reaches batch size
      if (operationCount === batchSize) {
        await batch.commit();
        batch = db.batch();
        operationCount = 0;
        console.log("Batch committed");
      }
    }

    // Commit any remaining operations
    if (operationCount > 0) {
      await batch.commit();
      console.log("Final batch committed");
    }

    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    // Terminate the Firebase Admin app
    await admin.app().delete();
  }
}

// Run the migration
migrateUserStats();
