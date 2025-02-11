import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { getAnalytics } from 'firebase/analytics'

import { UserData, GameResult } from '../types'

const firebaseConfig = {
  apiKey: "AIzaSyAuVEYjR9vcHXoxR0F3OVwecYgIPzxqhwQ",
  authDomain: "typr-84dbd.firebaseapp.com",
  projectId: "typr-84dbd",
  storageBucket: "typr-84dbd.firebasestorage.app",
  messagingSenderId: "663496765151",
  appId: "1:663496765151:web:e618e0aa874338108ec36a",
  measurementId: "G-88CHFMN7DX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig)
export const analytics = getAnalytics(app)
export const db = getFirestore(app)
export const auth = getAuth(app)

// Auth services
export const authService = {
  signInWithEmail: async (email: string, password: string) => {
    console.log('[AuthService] Attempting email sign in')
    const result = await signInWithEmailAndPassword(auth, email, password)
    console.log('[AuthService] Sign in successful, checking user data')
    const userData = await userService.getUserByUid(result.user.uid)
    const needsUsername = !userData?.username || userData?.username.length === 0
    console.log('[AuthService] User needs username:', needsUsername)
    return { result, needsUsername }
  },

  signUpWithEmail: async (email: string, password: string) => {
    console.log('[AuthService] Attempting email sign up')
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    console.log('[AuthService] Sign up successful, creating user document')
    await userService.createUser(userCredential.user.uid, userCredential.user)
    console.log('[AuthService] User document created')
    return { result: userCredential, needsUsername: true }
  },

  signInWithGoogle: async () => {
    console.log('[AuthService] Attempting Google sign in')
    const provider = new GoogleAuthProvider()
    const result = await signInWithPopup(auth, provider)
    console.log('[AuthService] Google sign in successful, checking user data')
    const userData = await userService.getUserByUid(result.user.uid)
    if (!userData) {
      console.log('[AuthService] New Google user, creating document')
      await userService.createUser(result.user.uid, result.user)
      return { result, needsUsername: true }
    }
    const needsUsername = !userData.username
    console.log('[AuthService] User needs username:', needsUsername)
    return { result, needsUsername }
  },

  signOut: () => auth.signOut()
}

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
          }
        },
        games: []
      }
      await setDoc(doc(db, 'users', userId), userDoc)
    } catch (error: any) {
      console.error('Error creating user:', error)
      throw new Error(error.message || 'Failed to create user')
    }
  },

  // Get user data
  getUser: async (userId: string): Promise<UserData | null> => {
    const docRef = doc(db, 'users', userId)
    const docSnap = await getDoc(docRef)
    return docSnap.exists() ? docSnap.data() as UserData : null
  },

  // Update user stats after game
  updateUserStats: async (userId: string, gameResult: GameResult): Promise<void> => {
    const userRef = doc(db, 'users', userId)
    const userData = await getDoc(userRef)
    const currentData = userData.data() as UserData

    const newGamesPlayed = currentData.stats.overall.gamesPlayed + 1
    const newAverageWPM = Math.round(
      (currentData.stats.overall.averageWPM * currentData.stats.overall.gamesPlayed + gameResult.wpm) / newGamesPlayed
    )
    const newBestWPM = Math.max(currentData.stats.overall.bestWPM, gameResult.wpm)

    await updateDoc(userRef, {
      'stats.overall.gamesPlayed': newGamesPlayed,
      'stats.overall.averageWPM': newAverageWPM,
      'stats.overall.bestWPM': newBestWPM,
      'stats.overall.totalWordsTyped': currentData.stats.overall.totalWordsTyped + gameResult.wordsTyped,
      'stats.overall.totalCharactersTyped': currentData.stats.overall.totalCharactersTyped + gameResult.charactersTyped,
      'stats.overall.totalMistakes': currentData.stats.overall.totalMistakes + gameResult.totalMistakes,
      'stats.overall.totalTimePlayed': currentData.stats.overall.totalTimePlayed + gameResult.timePlayed, 
    })
  },

  isUsernameAvailable: async (username: string): Promise<boolean> => {
    
    const usernameQuery = query(
      collection(db, 'users'),
      where('username', '==', username.toLowerCase())
    )
    const querySnapshot = await getDocs(usernameQuery)
    return querySnapshot.empty

  },

  updateUsername: async (username: string): Promise<void> => {
    try {
      if (!auth.currentUser) throw new Error('Not authenticated')
      const currentUser = auth.currentUser // Type assertion to avoid null checks
      
      console.log('[Firebase.tsx] Starting username update process')
      console.log('[Firebase.tsx] Checking username availability:', username)
      
      const usernameQuery = query(
        collection(db, 'users'),
        where('username', '==', username.toLowerCase())
      )

      const querySnapshot = await getDocs(usernameQuery)
      if (!querySnapshot.empty) {
        console.log('[Firebase.tsx] Username already taken')
        throw new Error('Username already taken')
      }

      console.log('[Firebase.tsx] Username available, updating document')
      const userRef = doc(db, 'users', currentUser.uid)
      
      try {
        await updateDoc(userRef, {
          username: username.toLowerCase(),
          updatedAt: new Date().toISOString()
        })
        console.log('[Firebase.tsx] Username updated successfully')
      } catch (updateError: any) {
        console.error('[Firebase.tsx] Error during updateDoc:', updateError)
        console.error('[Firebase.tsx] Error details:', {
          code: updateError.code,
          message: updateError.message,
          stack: updateError.stack
        })
        throw updateError
      }
    } 
    catch (error: any) {
      switch (error.code) { 
        case 'auth/username-already-taken':
          throw new Error('Username already taken')
        case 'not-found':
          console.log('[Firebase.tsx] Username not found, creating a new user')
          await userService.createUser(auth.currentUser!.uid, auth.currentUser!)
          break
        case 'auth/invalid-credential':
          throw new Error('Invalid email or password')
        default:
          throw error
      }
    }
  },

  getUserByUid: async (uid: string): Promise<UserData | null> => {
    const userDoc = await getDoc(doc(db, 'users', uid))
    return userDoc.exists() ? userDoc.data() as UserData : null
  }
}

export const gameService = {
  // Create a new game room
  createRoom: async (roomId: string, creatorId: string): Promise<void> => {
    await setDoc(doc(db, 'rooms', roomId), {
      createdBy: creatorId,
      createdAt: new Date().toISOString(),
      status: 'waiting', // waiting, playing, finished
      players: [creatorId],
      text: "The quick brown fox jumps over the lazy dog", // Replace with your text generation logic
    })
  },

  // Join a game room
  joinRoom: async (roomId: string, userId: string): Promise<void> => {
    const roomRef = doc(db, 'rooms', roomId)
    const room = await getDoc(roomRef)
    if (room.exists()) {
      const players = room.data().players
      if (!players.includes(userId)) {
        await updateDoc(roomRef, {
          players: [...players, userId]
        })
      }
    }
  },

  // Save game result
  saveGameResult: async (result: GameResult): Promise<void> => {
    const resultRef = collection(db, 'gameResults')
    await setDoc(doc(resultRef), {
      ...result,
      timestamp: new Date().toISOString()
    })
  },

  // Get user's game history
  getUserHistory: async (userId: string): Promise<GameResult[]> => {
    const resultsRef = collection(db, 'gameResults')
    const q = query(resultsRef, where('userId', '==', userId))
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => doc.data() as GameResult)
  }
} 