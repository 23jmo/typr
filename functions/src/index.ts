import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import * as admin from 'firebase-admin'
import * as logger from "firebase-functions/logger"

admin.initializeApp()

interface Player {
  connected?: boolean
  joinedAt?: any
  name?: string
}

interface GameData {
  players: { [key: string]: Player }
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

  // Log all player states before checking for disconnects
  logger.info('Player states:', {
    oldPlayerStates: Object.entries(oldData.players || {}).map(([id, player]) => ({
      id,
      connected: player.connected
    })),
    newPlayerStates: Object.entries(newData.players || {}).map(([id, player]) => ({
      id,
      connected: player.connected
    }))
  })

  // Check if any player's connection status changed from true to false
  const disconnectedPlayers = Object.entries(newData.players || {})
    .filter(([playerId, newPlayer]) => {
      const oldPlayer = oldData.players?.[playerId]
      // Only count as disconnect if player existed before and connection changed from true to false
      const isDisconnect = oldPlayer && 
                          oldPlayer.connected === true && 
                          newPlayer.connected === false
      if (isDisconnect) {
        logger.info(`Player ${playerId} disconnected`, {
          oldState: oldPlayer?.connected,
          newState: newPlayer.connected
        })
      }
      return isDisconnect
    })

  if (disconnectedPlayers.length > 0) {
    // Count how many players are still connected
    const connectedPlayers = Object.entries(newData.players || {})
      .filter(([_, player]) => player.connected === true)
    
    logger.info('Connection summary:', {
      totalPlayers: Object.keys(newData.players || {}).length,
      disconnectedCount: disconnectedPlayers.length,
      connectedCount: connectedPlayers.length,
      connectedPlayers: connectedPlayers.map(([id]) => id)
    })

    // Only delete if no players are connected
    if (connectedPlayers.length === 0) {
      await event.data.after.ref.delete()
      logger.info(`Deleted room ${event.params.roomId} - all players disconnected`)
    }
  }
})
