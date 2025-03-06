
interface UserStats {
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
      elo: number
      peakElo: number
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

interface UserData {
  uid: string
  email: string | null
  photoURL: string | null
  displayName: string | null
  createdAt: string
  updatedAt: string
  username: string | null
  stats: UserStats
  games: GameResult[]
}


interface GameResult {
  wpm: number
  accuracy: number
  timestamp: string
  userId: string | undefined
  roomId: string | null
  timePlayed: number
  wordsTyped: number
  charactersTyped: number
  totalMistakes: number
  totalWordsTyped: number
  totalCharactersTyped: number
  totalTimePlayed: number
}

export type { UserData, GameResult }