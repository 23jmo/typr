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

// Define match data type
export interface MatchData {
  opponent: string;
  timeAgo: string;
  userWpm: number;
  opponentWpm: number;
  isWin: boolean;
  eloChange: number;
  accuracy?: number; // Optional accuracy field
}

// Define recent match data type for storing in user document
export interface RecentMatch {
  matchId: string;        // Reference to full match data if needed
  opponentId: string;     // User ID of opponent
  opponentName: string;   // Username of opponent
  timestamp: number;      // Unix timestamp of match completion
  userWpm: number;        // User's WPM
  opponentWpm: number;    // Opponent's WPM
  isWin: boolean;         // Whether the user won
  eloChange: number;      // ELO points gained/lost
  accuracy: number;       // User's accuracy percentage
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
  recentMatches?: RecentMatch[]; // Array of recent matches, limited to 10
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
  maxPlayers?: number; // Maximum number of players allowed in the game
  // New voting-related fields
  topicOptions?: string[]; // List of topics to vote on
  votingEndTime?: number | any; // Timestamp when voting ends (server-side)
  clientVotingEndTime?: number; // Client-side timestamp for voting end time calculations
  selectedTopic?: string; // The topic that was selected after voting
}

export type { UserData, GameResult, GameData, Player, RecentMatch };
