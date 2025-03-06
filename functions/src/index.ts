import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import * as admin from 'firebase-admin'
import * as logger from "firebase-functions/logger"

admin.initializeApp()

interface Player {
  connected?: boolean
  joinedAt?: any
  name?: string
  wpm?: number
  accuracy?: number
  progress?: number
  ready: boolean
  finished?: boolean
  finishTime?: number
}

interface GameData {
  players: { [key: string]: Player }
  status: 'waiting' | 'countdown' | 'racing' | 'finished'
  text: string
  startTime?: admin.firestore.Timestamp | number
  countdownStartedAt?: admin.firestore.Timestamp
  createdAt?: admin.firestore.Timestamp
  winner?: string
  timeLimit: number // in seconds
}

export const handlePlayerDisconnect = onDocumentUpdated({
  document: 'gameRooms/{roomId}',
  region: 'us-central1'
}, async (event) => {
  if (!event.data) return

  const newData = event.data.after.data() as GameData
  const oldData = event.data.before.data() as GameData
  
  logger.info('Function triggered with:', { 
    roomId: event.params.roomId,
    oldPlayers: oldData?.players,
    newPlayers: newData?.players,
    isNewRoom: !oldData || !oldData.players
  })

  // Skip if this is a new room creation or update
  if (!oldData || !oldData.players || Object.keys(oldData.players).length === 0) {
    logger.info('Skipping - new room or initial player join')
    return
  }

  // Check if room is at least 1 second old
  const roomCreatedAt = newData.createdAt?.toMillis() || Date.now()
  if (Date.now() - roomCreatedAt < 1000) {
    logger.info('Room too new, skipping deletion check')
    return
  }

  // Check if there are players and all are disconnected
  const players = Object.values(newData.players || {})
  if (players.length > 0 && players.every(player => !player.connected)) {
    logger.info('All players disconnected, deleting room')
    await event.data.after.ref.delete()
    return
  }

  logger.info('Room persists - either has connected players or no players')
})

export const handleGameStateChange = onDocumentUpdated({
  document: 'gameRooms/{roomId}',
  region: 'us-central1'
}, async (event) => {
  if (!event.data) return

  const newData = event.data.after.data() as GameData
  const oldData = event.data.before.data() as GameData
  
  // If all players are ready and status is waiting, start countdown
  if (newData.status === 'waiting') {
    const players = Object.values(newData.players || {})
    const connectedPlayers = players.filter(player => player.connected)
    const allPlayersReady = connectedPlayers.length === 2 && 
      connectedPlayers.every(player => player.ready)

    logger.info(`Connected Players Count: ${connectedPlayers.length}`)
    logger.info(`All Players Ready: ${allPlayersReady}`)

    if (allPlayersReady) {
      logger.info('All players ready, starting countdown')
      await event.data.after.ref.update({
        status: 'countdown',
        countdownStartedAt: admin.firestore.FieldValue.serverTimestamp()
      })
    } else {
      logger.info('Not all players are ready or connected')
    }
  }
  
  // If all players are finished or time is up, determine winner
  if (newData.status === 'racing') {
    // Skip winner check if we just started racing
    if (oldData.status === 'countdown') {
      logger.info('Race just started, skipping winner check')
      return
    }

    const allPlayersFinished = Object.values(newData.players || {})
      .filter(player => player.connected)  // Only consider connected players
      .every(player => player.finished)
    
    // Get the start time in milliseconds
    const startTimeMs = (newData.startTime instanceof admin.firestore.Timestamp) 
      ? newData.startTime.toMillis() 
      : (newData.startTime || Date.now())
    const timeElapsed = (Date.now() - startTimeMs) / 1000

    logger.info('Race status:', {
      timeElapsed,
      timeLimit: newData.timeLimit,
      allPlayersFinished,
      players: newData.players
    })

    if (allPlayersFinished || timeElapsed >= newData.timeLimit) {
      // Find player with highest WPM among connected players
      let highestWpm = -1
      let winner = ''
      
      Object.entries(newData.players || {}).forEach(([playerId, player]) => {
        if (player.connected && player.wpm && player.wpm > highestWpm) {
          highestWpm = player.wpm
          winner = playerId
        }
      })

      if (winner) {
        logger.info(`Game finished. Winner: ${winner} with WPM: ${highestWpm}`)
        await event.data.after.ref.update({
          status: 'finished',
          winner
        })
      } else {
        logger.warn('No winner found among connected players')
      }
    }
  }
})

