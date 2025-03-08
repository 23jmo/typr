interface UserStats {
  overall: {
    gamesPlayed: number;
    averageWPM: number;
    bestWPM: number;
    worstWPM: number;
    totalWins: number;
    totalLosses: number;
    totalTies: number;
    winRate: number;
    averageAccuracy: number;
    totalWordsTyped: number;
    totalCharactersTyped: number;
    totalMistakes: number;
    totalTimePlayed: number;
    elo: number;
    peakElo: number;
  };
  ranked: {
    gamesPlayed: number;
    averageWPM: number;
    bestWPM: number;
    worstWPM: number;
    totalWins: number;
    totalLosses: number;
    totalTies: number;
    winRate: number;
    averageAccuracy: number;
    totalWordsTyped: number;
    totalCharactersTyped: number;
    totalMistakes: number;
    totalTimePlayed: number;
  };
}

interface UserData {
  uid: string;
  email: string | null;
  photoURL: string | null;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
  username: string | null;
  stats: UserStats;
  games: GameResult[];
  currentGame?: string; // ID of the current game the user is in
}

interface GameResult {
  wpm: number;
  accuracy: number;
  timestamp: string;
  userId: string | undefined;
  roomId: string | null;
  timePlayed: number;
  wordsTyped: number;
  charactersTyped: number;
  totalMistakes: number;
  totalWordsTyped: number;
  totalCharactersTyped: number;
  totalTimePlayed: number;
}

interface Player {
  connected?: boolean;
  joinedAt?: any;
  name?: string;
  wpm?: number;
  accuracy?: number;
  progress?: number;
  ready?: boolean;
  finished?: boolean;
  vote?: string; // The topic ID this player voted for
}

interface GameData {
  players: { [key: string]: Player };
  status: "waiting" | "countdown" | "racing" | "finished" | "voting";
  text: string;
  startTime?: number;
  countdownStartedAt?: number;
  winner?: string;
  timeLimit: number; // in seconds
  // New voting-related fields
  topicOptions?: string[]; // List of topics to vote on
  votingEndTime?: number | any; // Timestamp when voting ends (server-side)
  clientVotingEndTime?: number; // Client-side timestamp for voting end time calculations
  selectedTopic?: string; // The topic that was selected after voting
}

export type { UserData, GameResult, GameData, Player };
