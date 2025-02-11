
interface UserData {
  email: string | null
  photoURL: string | null
  displayName: string | null
  createdAt: string
  username: string | null
  stats: {
    overall: {
      gamesPlayed: number
      averageWPM: number
      bestWPM: number
      worstWPM: number
      totalWins: number
      totalLosses: number
      totalTies: number
      winRate: number
      averageAccuracy: number
      totalWordsTyped: number
      totalCharactersTyped: number
      totalMistakes: number
      totalTimePlayed: number
    }
    ranked: {
      gamesPlayed: number
      averageWPM: number
      bestWPM: number
      worstWPM: number
      totalWins: number
      totalLosses: number
      totalTies: number
      winRate: number
      averageAccuracy: number
      totalWordsTyped: number
      totalCharactersTyped: number
      totalMistakes: number
      totalTimePlayed: number
    }
  }
}


interface GameResult {
  wpm: number
  accuracy: number
  timestamp: string
  userId: string
  roomId: string
}

export type { UserData, GameResult }