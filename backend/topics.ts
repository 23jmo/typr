import OpenAI from "openai";
import { RoomData } from "./types";

// Configuration
export const COUNTDOWN_DURATION_MS = 3000;
export const VOTING_DURATION_MS = 15000; // 15 seconds for voting
export const AVAILABLE_TOPICS = [
  "programming",
  "science",
  "history",
  "movies",
  "books",
  "space",
  "nature",
  "technology",
];

// OpenAI configuration
let openai: OpenAI;

export const initOpenAI = (apiKey: string) => {
  openai = new OpenAI({
    apiKey: apiKey,
  });
};

// Text generation functions
export const generateRandomText = (length: number): string => {
  // Simple placeholder - replace with a better implementation if needed
  const words = ["the", "quick", "brown", "fox", "jumps", "over", "lazy", "dog", "pack", "my", "box", "with", "five", "dozen", "liquor", "jugs", "how", "vexingly", "daft", "zebras", "jump"];
  let result = "";
  for (let i = 0; i < length; i++) {
    result += words[Math.floor(Math.random() * words.length)] + " ";
  }
  return result.trim() + ".";
};

export const generateTextByTopic = async (topic: string, length: number): Promise<string> => {
  try {
    console.log(`Generating text for topic: ${topic}, length: ${length}`);
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Or your preferred model
      messages: [
        { role: "system", content: "You generate text passages for a typing race game. The text should be suitable for typing practice. Avoid overly complex punctuation or formatting." },
        {
          role: "user",
          content: `Generate a text passage of approximately ${length} words based on the topic: ${topic}. Ensure it's a single block of text.`,
        },
      ],
      max_tokens: length * 3, // Estimate tokens needed
    });
    const content = response.choices[0]?.message?.content;
    console.log(`Generated content (first 50 chars): ${content?.substring(0, 50)}...`);
    return content || generateRandomText(length); // Fallback
  } catch (error) {
    console.error("Error generating text via OpenAI:", error);
    return generateRandomText(length); // Fallback on error
  }
};

// Topic voting functions
export const startTopicVoting = (
  roomId: string, 
  rooms: { [roomId: string]: RoomData }, 
  broadcastRoomUpdate: (roomId: string) => void,
  handleVotingEnd: (roomId: string) => void
) => {
  const room = rooms[roomId];
  if (!room || (room.status !== 'finished' && room.status !== 'waiting')) {
    console.log(`[Vote Start] Cannot start voting for room ${roomId}. Status: ${room.status}`);
    return;
  }

  // Clear any existing timers
  if (room.countdownTimer) clearTimeout(room.countdownTimer);
  if (room.votingTimer) clearTimeout(room.votingTimer);
  room.countdownTimer = undefined;
  room.votingTimer = undefined;

  console.log(`[Vote Start] Starting topic voting for room ${roomId}`);
  room.status = 'voting';

  // Select topic options (e.g., 3 random unique topics)
  const shuffledTopics = [...AVAILABLE_TOPICS].sort(() => 0.5 - Math.random());
  room.topicOptions = shuffledTopics.slice(0, 3);

  room.votingEndTime = Date.now() + VOTING_DURATION_MS;

  // Reset player states for voting/next game
  Object.values(room.players).forEach(p => {
    p.progress = 0;
    p.wpm = 0;
    p.accuracy = 100;
    p.finished = false;
    p.finishTime = undefined;
    p.ready = false;
    p.vote = undefined;
    p.wantsPlayAgain = false; // Reset this flag
  });

  // Broadcast the voting start
  broadcastRoomUpdate(roomId);

  // Schedule the end of voting
  room.votingTimer = setTimeout(() => { handleVotingEnd(roomId); }, VOTING_DURATION_MS);
};

export const createHandleVotingEnd = (
  rooms: { [roomId: string]: RoomData },
  broadcastRoomUpdate: (roomId: string) => void,
  startCountdown: (roomId: string) => void
) => {
  return async (roomId: string) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'voting') {
      console.log(`[Vote End] Cannot end voting for room ${roomId}. Status: ${room?.status}`);
      return;
    }

    console.log(`[Vote End] Ending voting for room ${roomId}.`);

    // Clear the timer handle
    if (room.votingTimer) clearTimeout(room.votingTimer);
    room.votingTimer = undefined;

    // Tally votes
    const votes: { [topic: string]: number } = {};
    const connectedPlayers = Object.values(room.players).filter(p => p.connected);
    connectedPlayers.forEach(player => {
      if (player.vote) {
        votes[player.vote] = (votes[player.vote] || 0) + 1;
      }
    });
    console.log(`[Vote End] Votes tallied for room ${roomId}:`, votes);

    // Determine winning topic
    let winningTopic = "random"; // Default to random
    let maxVotes = 0;
    const potentialWinners: string[] = [];
    const options = room.topicOptions || AVAILABLE_TOPICS;

    for (const [topic, count] of Object.entries(votes)) {
      if (count > maxVotes) {
        maxVotes = count;
        potentialWinners.length = 0; // Clear previous winners
        potentialWinners.push(topic);
      } else if (count === maxVotes) {
        potentialWinners.push(topic);
      }
    }

    if (potentialWinners.length === 1) {
      winningTopic = potentialWinners[0];
    } else if (potentialWinners.length > 1) {
      // Tie-breaker: random choice among tied winners
      console.log(`[Vote End] Tie detected in room ${roomId}. Choosing randomly from:`, potentialWinners);
      winningTopic = potentialWinners[Math.floor(Math.random() * potentialWinners.length)];
    } else {
      // No votes or no options? Pick random from available options
      console.log(`[Vote End] No votes cast in room ${roomId}. Choosing random topic.`);
      winningTopic = options[Math.floor(Math.random() * options.length)] || "programming"; // Fallback topic
    }
    console.log(`[Vote End] Winning topic for room ${roomId}: ${winningTopic}`);

    // Generate text for the winning topic
    try {
      // Use room.textLength, fallback to a default if not set
      const textLength = room.textLength || 50; 
      room.text = await generateTextByTopic(winningTopic, textLength);
      room.topic = winningTopic; // Store the chosen topic
      room.textSource = 'topic'; // Update source
      console.log(`[Vote End] New text generated for room ${roomId}.`);

      // Transition to countdown
      startCountdown(roomId); // Start the next race countdown
    } catch (error) {
      console.error(`[Vote End] Failed to generate text or start countdown for room ${roomId}:`, error);
      // Handle error - maybe return to waiting? For now, log and proceed with default text?
      room.text = generateRandomText(room.textLength || 50);
      room.topic = "random"; // Fallback topic
      room.textSource = 'random';
      startCountdown(roomId);
    }
  };
}; 