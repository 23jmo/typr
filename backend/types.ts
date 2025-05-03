export interface PlayerData {
  id: string;
  name: string;
  wpm: number;
  accuracy: number;
  progress: number;
  ready: boolean;
  connected: boolean;
  finished: boolean;
  finishTime?: number | null; // Store finish timestamp (milliseconds)
  vote?: string | null;
  wantsPlayAgain?: boolean;
  // Stats tracking fields
  wordsTyped?: number;
  charactersTyped?: number;
  mistakes?: number;
  timePlayed?: number;
}

export interface RoomData {
  id: string;
  name: string;
  status: "waiting" | "voting" | "countdown" | "racing" | "finished";
  createdAt: number; // Timestamp in milliseconds
  timeLimit: number;
  textLength: number; // Target word count (approx)
  playerLimit: number;
  isRanked: boolean;
  initialElo?: { [playerId: string]: number };
  players: { [playerId: string]: PlayerData };
  text: string;
  textSource: "random" | "topic" | "custom";
  topic?: string | null;
  hostId: string;
  countdownStartedAt?: number | null;
  votingEndTime?: number | null; // Timestamp for voting end
  topicOptions?: string[];
  startTime?: number | null; // Race start timestamp (milliseconds)
  winner?: string | null; // Player ID of the winner
  // Add timers if needed (NodeJS.Timeout)
  countdownTimer?: NodeJS.Timeout | null;
  votingTimer?: NodeJS.Timeout | null;
  raceTimer?: NodeJS.Timeout | null; // Timer to auto-finish race after time limit
}

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

// Define CharStats type
export interface CharStats {
  correct: number;
  incorrect: number;
  extra: number;
  missed: number;
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
  matchId: string; // Reference to full match data if needed
  opponentId: string; // User ID of opponent
  opponentName: string; // Username of opponent
  timestamp: number; // Unix timestamp of match completion
  userWpm: number; // User's WPM
  opponentWpm: number; // Opponent's WPM
  isWin: boolean; // Whether the user won
  eloChange: number; // ELO points gained/lost
  accuracy: number; // User's accuracy percentage
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

// Updated Player type to match backend/socket usage
interface Player {
  id: string; // Added ID
  name: string;
  wpm: number;
  accuracy: number;
  progress: number;
  ready: boolean;
  connected: boolean;
  finished: boolean;
  finishTime?: number | null; // Allows null
  vote?: string;
  wantsPlayAgain?: boolean; // Added
  // Keep optional original fields if still used elsewhere?
  joinedAt?: any;
}

// Updated GameData type to match backend/socket usage (consider renaming to RoomData)
interface GameData {
  // Or rename to RoomData
  id: string; // Added ID
  name: string; // Added name
  status: "waiting" | "voting" | "countdown" | "racing" | "finished";
  createdAt: number; // Added
  timeLimit: number;
  textLength: number; // Added
  playerLimit: number; // Added (replaced maxPlayers?)
  isRanked: boolean; // Added
  players: { [playerId: string]: Player }; // Use updated Player type
  text: string;
  textSource: "random" | "topic" | "custom"; // Added
  topic?: string | null; // Added (allows null)
  hostId: string; // Added
  countdownStartedAt?: number; // Kept from original
  votingEndTime?: number | null; // Added (allows null, removed any type)
  topicOptions?: string[]; // Kept from original
  startTime?: number; // Kept from original
  winner?: string; // Kept from original
  // Remove fields no longer directly part of socket room state if desired
  // clientVotingEndTime?: number;
  // selectedTopic?: string;
}

export type { UserData, GameResult, GameData, Player }
