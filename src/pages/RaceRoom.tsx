import { useState, useEffect, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {
  getFirestore,
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import StatsOverview from "../components/StatsOverview";

import { GameResult } from "../types";
import { auth, userService } from "../services/firebase";
import FinishedScreen from "../components/ranked/FinishedScreen";
import { GameData, Player } from "../types";
import { useUser } from "../contexts/UserContext";

const SAMPLE_TEXT =
  "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs. How vexingly quick daft zebras jump!";

const cursorStyle =
  "absolute w-0.5 h-[1.2em] bg-[#d1d0c5] left-0 top-1 animate-pulse transition-transform duration-75";

// Add ghost cursor colors
const GHOST_CURSOR_COLORS = [
  "bg-red-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-teal-500",
];

const RaceRoom = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { userData } = useUser();
  const username = userData?.username || "Anonymous";
  const userId = userData?.uid;

  const [text] = useState(SAMPLE_TEXT);
  const [userInput, setUserInput] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [isFinished, setIsFinished] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const textContainerRef = useRef<HTMLDivElement>(null);

  const [gameData, setGameData] = useState<GameData | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  const updateTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Add new state for WPM history
  const [wpmHistory, setWpmHistory] = useState<
    Array<{ wpm: number; time: number }>
  >([]);

  // Add character tracking state
  const [charStats, setCharStats] = useState({
    correct: 0,
    incorrect: 0,
    extra: 0,
    missed: 0,
  });

  // Add state for opponent cursor positions
  const [opponentCursors, setOpponentCursors] = useState<{
    [playerId: string]: { position: number; color: string };
  }>({});

  // Add a check to ensure user is logged in with a username
  useEffect(() => {
    if (!userData || !userData.username || !userData.uid) {
      console.error("User not logged in or missing username/uid");
      return;
    }
  }, [userData, navigate]);

  // Function to update player data
  const throttleUpdate = () => {
    if (updateTimeout.current || !userId) return;

    // Skip updates during countdown
    if (countdown !== null && countdown > 0) return;

    updateTimeout.current = setTimeout(async () => {
      const db = getFirestore();
      const roomRef = doc(db, "gameRooms", roomId!);

      try {
        await updateDoc(roomRef, {
          [`players.${userId}.progress`]:
            (userInput.length / text.length) * 100,
          [`players.${userId}.wpm`]: wpm,
          [`players.${userId}.accuracy`]: accuracy,
          // Optionally, include other fields if necessary
        });
      } catch (error) {
        console.error("Error updating player data:", error);
      } finally {
        updateTimeout.current = null;
      }
    }, 1000); // Throttle interval in milliseconds
  };

  // Update the connection setup effect
  useEffect(() => {
    if (!roomId || !userId) return;

    const db = getFirestore();
    const roomRef = doc(db, "gameRooms", roomId);

    const setupPresence = async () => {
      // Wait for userData to be available
      if (!userData) {
        console.log("[Race Room]: Waiting for user data...");
        // We'll handle this in the userData dependency below
        return;
      }

      try {
        const roomDoc = await getDoc(roomRef);
        if (!roomDoc.exists()) {
          console.error("Room does not exist");
          return;
        }

        const roomData = roomDoc.data() as GameData;

        // Check if the player already exists in the room
        if (roomData.players && roomData.players[userId]) {
          // Player exists, just update connected status
          console.log(
            "[Race Room]: Updating existing player connection status"
          );
          await updateDoc(roomRef, {
            [`players.${userId}.connected`]: true,
            [`players.${userId}.name`]: username,
            [`players.${userId}.wpm`]: 0,
            [`players.${userId}.accuracy`]: 100,
            [`players.${userId}.progress`]: 0,
            [`players.${userId}.ready`]: false,
            [`players.${userId}.connected`]: true,
            [`players.${userId}.finished`]: false,
            [`players.${userId}.joinedAt`]: serverTimestamp(),
          });
        } else {
          // Player doesn't exist, this shouldn't happen normally as they should be added in CustomRoom.tsx
          // But as a fallback, add them to the room with default values
          console.log("[Race Room]: Player not found in room, adding player");
          const username = userData?.username || "Anonymous";
          console.log("[Race Room]: Using username:", username);
          await updateDoc(roomRef, {
            [`players.${userId}`]: {
              name: username,
              wpm: 0,
              accuracy: 100,
              progress: 0,
              ready: false,
              connected: true,
              finished: false,
              joinedAt: serverTimestamp(),
            },
          });
        }

        // Set up cleanup for tab close/refresh
        window.addEventListener("beforeunload", handleDisconnect);
      } catch (error) {
        console.error("Error setting up presence:", error);
      }
    };

    setupPresence();

    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      const data = snapshot.data() as GameData;
      if (data) {
        console.log("[Race Room]: Game data updated:", data);
        setGameData(data);
      }
    });

    return () => {
      unsubscribe();
      window.removeEventListener("beforeunload", handleDisconnect);
      handleDisconnect();
    };
  }, [roomId, userId, userData]);

  // Update handleDisconnect function
  const handleDisconnect = async () => {
    if (!userId || !roomId) return;

    try {
      const db = getFirestore();
      const roomRef = doc(db, "gameRooms", roomId);
      await updateDoc(roomRef, {
        [`players.${userId}.connected`]: false,
      });
    } catch (error) {
      console.error("Error handling disconnect:", error);
    }
  };

  // Update the keydown event listener to handle completion
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Add Tab key handler for restart

      if (isFinished) return;

      // Prevent typing during countdown
      if (countdown !== null && countdown > 0) return;

      // Only allow typing during racing mode
      if (gameData?.status !== "racing") return;

      // Ignore if Alt+Delete/Backspace (handled by dedicated handler)
      if ((e.key === "Delete" || e.key === "Backspace") && e.altKey) {
        return;
      }

      // Ignore if any other modifier keys are pressed
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Only handle alphanumeric keys, space, and punctuation
      if (e.key.length === 1) {
        e.preventDefault();
        if (!startTime) {
          setStartTime(Date.now());
        }

        const newInput = userInput + e.key;
        setUserInput(newInput);

        // Check just the new character
        const currentIndex = newInput.length - 1;

        setCharStats((prev) => {
          if (currentIndex >= text.length) {
            return { ...prev, extra: prev.extra + 1 };
          }

          if (newInput[currentIndex] === text[currentIndex]) {
            return { ...prev, correct: prev.correct + 1 };
          } else {
            return { ...prev, incorrect: prev.incorrect + 1 };
          }
        });

        // Calculate accuracy based on current stats
        const totalChars =
          charStats.correct + charStats.incorrect + charStats.extra;
        setAccuracy(Math.round((charStats.correct / totalChars) * 100) || 100);

        // Calculate WPM and add to history
        const timeElapsed =
          (Date.now() - (startTime || Date.now())) / 1000 / 60;
        // Ensure timeElapsed is never negative
        const safeTimeElapsed = Math.max(timeElapsed, 0.001); // Minimum positive value to avoid division by zero
        const wordsTyped = newInput.length / 5;
        const currentWpm = Math.round(wordsTyped / safeTimeElapsed) || 0;
        setWpm(currentWpm);
        setWpmHistory((prev) => [
          ...prev,
          {
            wpm: currentWpm,
            time: Date.now() - (startTime || Date.now()),
          },
        ]);

        // Check if finished
        if (newInput.length === text.length) {
          setIsFinished(true);
          // Update player's finished status immediately
          if (userId && roomId) {
            const db = getFirestore();
            updateDoc(doc(db, "gameRooms", roomId), {
              [`players.${userId}.finished`]: true,
              [`players.${userId}.finishTime`]: serverTimestamp(),
            }).catch(console.error);
          }
        }
      } else if (e.key === "Backspace") {
        e.preventDefault();
        const deletedIndex = userInput.length - 1;

        setCharStats((prev) => {
          if (deletedIndex >= text.length) {
            return { ...prev, extra: prev.extra - 1 };
          }

          if (userInput[deletedIndex] === text[deletedIndex]) {
            return { ...prev, correct: prev.correct - 1 };
          } else {
            return { ...prev, incorrect: prev.incorrect - 1 };
          }
        });

        setUserInput((prev) => prev.slice(0, -1));
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [
    text,
    userInput,
    startTime,
    isFinished,
    userId,
    roomId,
    countdown,
    gameData,
  ]);

  // Update cursor position when input changes
  useEffect(() => {
    if (textContainerRef.current) {
      const chars = Array.from(
        textContainerRef.current.querySelectorAll("span > span")
      );
      const currentChar = chars[userInput.length] || chars[0];
      if (currentChar) {
        const rect = currentChar.getBoundingClientRect();
        const containerRect = textContainerRef.current.getBoundingClientRect();
        const x = rect.left - containerRect.left;
        const y = rect.top - containerRect.top;
        setCursorPosition({ x, y });
      }
    }
  }, [userInput]);

  // Update the game state effect
  useEffect(() => {
    if (!gameData) return;

    // Reset local state when game returns to waiting
    if (gameData.status === "waiting") {
      resetGame();
    }

    // Handle countdown
    if (gameData.status === "countdown" && gameData.countdownStartedAt) {
      // Reset game state at the start of countdown
      resetGame();

      const countdownDuration = 3; // 3 seconds countdown
      const countdownEnd =
        (gameData.countdownStartedAt as any).toMillis() +
        countdownDuration * 1000;
      // Don't set startTime during countdown - it will be set when the race begins
      const timeLeft = Math.ceil((countdownEnd - Date.now()) / 1000);

      if (timeLeft > 0) {
        setCountdown(timeLeft);
        const timer = setInterval(() => {
          const newTimeLeft = Math.ceil((countdownEnd - Date.now()) / 1000);
          setCountdown(newTimeLeft);

          if (newTimeLeft <= 0) {
            clearInterval(timer);
            // Set startTime when the race actually begins
            setStartTime(Date.now());
            updateDoc(doc(getFirestore(), "gameRooms", roomId!), {
              status: "racing",
              startTime: serverTimestamp(),
            });
          }
        }, 1000);
        return () => clearInterval(timer);
      }
    }

    // Handle race completion
    if (gameData.status === "finished" && gameData.winner) {
      setIsFinished(true);
    }
  }, [gameData]);

  // Add effect to check if all players are ready and start countdown
  useEffect(() => {
    if (!gameData || !roomId || gameData.status !== "waiting") return;

    // Check if all players are ready
    const allPlayersReady = Object.values(gameData.players).every(
      (player) => player.ready && player.connected
    );

    // If all players are ready, start the countdown
    if (allPlayersReady) {
      console.log("All players ready, starting countdown");
      const db = getFirestore();
      updateDoc(doc(db, "gameRooms", roomId), {
        status: "countdown",
        countdownStartedAt: serverTimestamp(),
      }).catch((error) => {
        console.error("Error starting countdown:", error);
      });
    }
  }, [gameData, roomId]);

  // Update the progress effect with throttling
  useEffect(() => {
    if (!userId || !roomId || !gameData || gameData.status !== "racing") return;

    // Skip updates during countdown
    if (countdown !== null && countdown > 0) return;

    throttleUpdate();
  }, [userInput, wpm, accuracy, countdown, userId, roomId, gameData]);

  const toggleReady = async () => {
    if (!userId || !roomId) return;
    const newReadyState = !ready;
    setReady(newReadyState);

    try {
      console.log(`Setting player ${userId} ready state to ${newReadyState}`);
      await updateDoc(doc(getFirestore(), "gameRooms", roomId), {
        [`players.${userId}.ready`]: newReadyState,
      });
    } catch (error) {
      console.error("Error toggling ready state:", error);
    }
  };

  const resetGame = () => {
    setUserInput("");
    setStartTime(null);
    setWpm(0);
    setAccuracy(100);
    setIsFinished(false);
    setWpmHistory([]);
    setCharStats({
      correct: 0,
      incorrect: 0,
      extra: 0,
      missed: 0,
    });
    // Reset cursor position
    setCursorPosition({ x: 0, y: 0 });
  };

  // Add a dedicated handler for Alt+Delete/Backspace
  useEffect(() => {
    const handleAltDelete = (e: KeyboardEvent) => {
      if (isFinished) return;

      // Prevent typing during countdown
      if (countdown !== null && countdown > 0) return;

      // Only allow typing during racing mode
      if (gameData?.status !== "racing") return;

      // Check for Alt+Delete or Alt+Backspace
      if ((e.key === "Delete" || e.key === "Backspace") && e.altKey) {
        console.log("Alt+Delete/Backspace dedicated handler triggered");
        e.preventDefault();
        e.stopPropagation();

        // Find the last word boundary
        const lastSpaceIndex = userInput.lastIndexOf(" ");

        if (lastSpaceIndex === -1) {
          // No spaces, delete everything
          const charsToDelete = userInput.length;

          // Update character stats
          setCharStats((prev) => {
            const newStats = { ...prev };

            // Count how many characters of each type we're deleting
            for (let i = 0; i < charsToDelete; i++) {
              const charIndex = i;

              if (charIndex >= text.length) {
                newStats.extra = Math.max(0, newStats.extra - 1);
              } else if (userInput[charIndex] === text[charIndex]) {
                newStats.correct = Math.max(0, newStats.correct - 1);
              } else {
                newStats.incorrect = Math.max(0, newStats.incorrect - 1);
              }
            }

            return newStats;
          });

          setUserInput("");
        } else {
          // Delete from the last space to the end
          const charsToDelete = userInput.length - lastSpaceIndex;

          // Update character stats
          setCharStats((prev) => {
            const newStats = { ...prev };

            // Count how many characters of each type we're deleting
            for (let i = 0; i < charsToDelete; i++) {
              const charIndex = lastSpaceIndex + 1 + i;

              if (charIndex >= text.length) {
                newStats.extra = Math.max(0, newStats.extra - 1);
              } else if (userInput[charIndex] === text[charIndex]) {
                newStats.correct = Math.max(0, newStats.correct - 1);
              } else {
                newStats.incorrect = Math.max(0, newStats.incorrect - 1);
              }
            }

            return newStats;
          });

          setUserInput((prev) => prev.substring(0, lastSpaceIndex + 1));
        }
      }
    };

    window.addEventListener("keydown", handleAltDelete, true); // Use capture phase
    return () => window.removeEventListener("keydown", handleAltDelete, true);
  }, [userInput, isFinished, text, countdown, gameData]);

  // Update character stats when userInput changes
  useEffect(() => {
    // Skip calculations during countdown
    if (countdown !== null && countdown > 0) return;

    // Only update stats during racing mode
    if (gameData?.status !== "racing") return;

    // Calculate accuracy based on current stats
    const totalChars =
      charStats.correct + charStats.incorrect + charStats.extra;
    setAccuracy(Math.round((charStats.correct / totalChars) * 100) || 100);

    // Calculate WPM
    if (startTime) {
      const timeElapsed = (Date.now() - startTime) / 1000 / 60;
      const wordsTyped = userInput.length / 5;
      const currentWpm = Math.round(wordsTyped / timeElapsed) || 0;
      setWpm(currentWpm);
    }
  }, [userInput, charStats, startTime, countdown, gameData]);

  // Function to get cursor coordinates for a specific position in the text
  const getCursorCoordinates = (
    position: number
  ): { x: number; y: number } | null => {
    if (!textContainerRef.current) return null;

    // Get all character spans (including spaces)
    const chars = Array.from(
      textContainerRef.current.querySelectorAll("span > span")
    );

    if (!chars.length) return null;

    // Ensure position is within bounds
    const safePosition = Math.min(position, chars.length - 1);
    if (safePosition < 0) return null;

    // Get the DOM element at the calculated position
    const char = chars[safePosition];
    if (!char) return null;

    const rect = char.getBoundingClientRect();
    const containerRect = textContainerRef.current.getBoundingClientRect();

    return {
      x: rect.left - containerRect.left,
      y: rect.top - containerRect.top,
    };
  };

  // Calculate opponent cursor positions based on their progress
  useEffect(() => {
    if (!gameData || !text) return;

    const newOpponentCursors: {
      [playerId: string]: { position: number; color: string };
    } = {};
    let colorIndex = 0;

    Object.entries(gameData.players).forEach(([playerId, player]) => {
      // Skip the current user
      if (playerId === userId) return;

      // Calculate the character position based on progress percentage
      const characterPosition = Math.floor(
        ((player.progress || 0) / 100) * text.length
      );

      // Map the character position to the DOM position
      // This accounts for the way the text is rendered with separate spans for each character and spaces
      let domPosition = 0;
      let charCount = 0;
      const words = text.split(" ");

      // Count characters including spaces until we reach or exceed the target position
      for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
        const word = words[wordIndex];

        // Check if adding this word (and the following space) would exceed our target position
        if (charCount + word.length > characterPosition) {
          // The target position is within this word
          domPosition += characterPosition - charCount;
          break;
        }

        // Add this word's length to our character count
        charCount += word.length;
        domPosition += word.length;

        // Add a space after the word (except for the last word)
        if (wordIndex < words.length - 1) {
          charCount += 1;
          domPosition += 1;
        }

        // If we've exactly reached our target, break
        if (charCount === characterPosition) {
          break;
        }
      }

      // Assign a color from the array
      const color =
        GHOST_CURSOR_COLORS[colorIndex % GHOST_CURSOR_COLORS.length];
      colorIndex++;

      // Store the DOM position (not the character position)
      newOpponentCursors[playerId] = { position: domPosition, color };
    });

    setOpponentCursors(newOpponentCursors);
  }, [gameData, text, userId]);

  return (
    <div className="flex flex-col items-center min-h-screen p-4">
      {/* Debug info */}
      <div className="fixed top-0 left-0 bg-black bg-opacity-50 p-2 text-xs text-white">
        Username: {username}, UserID: {userId}, Room: {roomId}, Status:{" "}
        {gameData?.status}
      </div>

      <div className="fixed top-4 left-4 right-4">
        <div className="flex justify-between max-w-md mx-auto">
          <div className="text-xl">WPM: {wpm}</div>
          <div className="text-xl">Accuracy: {accuracy}%</div>
        </div>
      </div>

      {/* Player list */}
      <div className="fixed top-20 left-4 space-y-2">
        {gameData &&
          Object.entries(gameData.players)
            .sort((a, b) => {
              const aTime = a[1].joinedAt?.toMillis?.() || 0;
              const bTime = b[1].joinedAt?.toMillis?.() || 0;
              return aTime - bTime;
            })
            .map(([playerId, player]) => (
              <div
                key={playerId}
                className="flex items-center space-x-2"
              >
                <span
                  className={`${
                    player.connected ? "text-green-500" : "text-red-500"
                  }`}
                >
                  ●
                </span>
                <span>{player.name}</span>
                <span>{player.ready ? "(Ready)" : "(Not Ready)"}</span>
                {gameData.status === "racing" && (
                  <div className="w-24 h-2 bg-gray-700 rounded">
                    <div
                      className="h-full bg-green-500 rounded"
                      style={{ width: `${player.progress || 0}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
      </div>

      {/* Game status */}
      {gameData?.status === "waiting" && (
        <button
          onClick={toggleReady}
          className={`px-4 py-2 rounded ${
            gameData.players[username]?.ready ? "bg-green-500" : "bg-yellow-500"
          }`}
        >
          {gameData.players[username]?.ready ? "Ready!" : "Click when ready"}
        </button>
      )}

      {gameData?.status === "countdown" && (
        <div className="text-6xl font-bold mb-8">{countdown}</div>
      )}

      {/* Existing typing interface */}
      {gameData?.status === "racing" && (
        <div className="w-full max-w-[80%] mt-[30vh]">
          <div
            ref={textContainerRef}
            className="text-4xl leading-relaxed font-mono relative flex flex-wrap select-none"
          >
            {/* User cursor */}
            {!isFinished && (
              <span
                className="absolute w-0.5 h-[1.1em] bg-[#d1d0c5] top-[0.1em] animate-pulse transition-all duration-75 left-0 z-10"
                style={{
                  transform: `translate(${cursorPosition.x}px, ${cursorPosition.y}px)`,
                }}
              />
            )}

            {/* Ghost cursors for opponents */}
            {Object.entries(opponentCursors).map(
              ([playerId, { position, color }]) => {
                const coords = getCursorCoordinates(position);
                if (!coords) return null;

                const playerName =
                  gameData?.players[playerId]?.name || "Opponent";

                return (
                  <div
                    key={`ghost-${playerId}`}
                    className="absolute z-0"
                    style={{
                      transform: `translate(${coords.x}px, ${coords.y}px)`,
                      transition: "transform 0.5s ease-out",
                    }}
                  >
                    {/* Ghost cursor */}
                    <span
                      className={`absolute w-0.5 h-[1.1em] ${color} opacity-70 top-[0.1em]`}
                    />

                    {/* Player name tooltip */}
                    <span
                      className={`absolute top-[-1.5em] left-[-1em] text-xs ${color.replace(
                        "bg-",
                        "text-"
                      )} whitespace-nowrap`}
                    >
                      {playerName}
                    </span>
                  </div>
                );
              }
            )}

            {/* Text content */}
            {text.split(" ").map((word, wordIndex, wordArray) => {
              const previousWordsLength = wordArray
                .slice(0, wordIndex)
                .reduce((acc, word) => acc + word.length + 1, 0);

              return (
                <span
                  key={wordIndex}
                  className="flex"
                >
                  {word.split("").map((char, charIndex) => {
                    const index = previousWordsLength + charIndex;

                    let color = "text-[#646669]";
                    if (index < userInput.length) {
                      color =
                        userInput[index] === char
                          ? "text-[#d1d0c5]"
                          : "text-red-500";
                    }
                    return (
                      <span
                        key={charIndex}
                        className={`${color} ${
                          index === userInput.length ? "relative" : ""
                        }`}
                      >
                        {char}
                      </span>
                    );
                  })}
                  {wordIndex < wordArray.length - 1 && (
                    <span
                      className={`${
                        previousWordsLength + word.length < userInput.length
                          ? "text-[#d1d0c5]"
                          : "text-[#646669]"
                      } relative`}
                    >
                      &nbsp;
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Winner screen and Stats */}
      {gameData?.status === "finished" && (
        <FinishedScreen
          gameData={gameData}
          wpm={wpm}
          accuracy={accuracy}
          startTime={startTime || 0}
          wpmHistory={wpmHistory}
          charStats={charStats}
        />
      )}
    </div>
  );
};

export default RaceRoom;
