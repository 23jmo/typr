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
} 