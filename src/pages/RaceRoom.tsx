import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import {
  getFirestore,
  doc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import {
  getDatabase,
  ref,
  onValue,
  set,
  onDisconnect,
} from "firebase/database";
import { useUser } from "../contexts/UserContext";
import StatsOverview from "../components/StatsOverview";
import { GameResult } from "../types";
import { auth, userService } from "../services/firebase";

interface Player {
  connected?: boolean;
  joinedAt?: any;
  name?: string;
  wpm?: number;
  accuracy?: number;
  progress?: number;
  ready?: boolean;
}

interface GameData {
  players: { [key: string]: Player };
  status: "waiting" | "countdown" | "racing" | "finished";
  text: string;
  startTime?: number;
  countdownStartedAt?: number;
  winner?: string;
  timeLimit: number; // in seconds
}

const SAMPLE_TEXT =
  "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs. How vexingly quick daft zebras jump!";

const cursorStyle =
  "absolute w-0.5 h-[1.2em] bg-[#d1d0c5] left-0 top-1 animate-pulse transition-transform duration-75";

//TODO: add a graph of wpm and accuracy over time

const RaceRoom = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const username = location.state?.username;

  const [text] = useState(SAMPLE_TEXT);
  const [userInput, setUserInput] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [isFinished, setIsFinished] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const textContainerRef = useRef<HTMLDivElement>(null);

  const [gameData, setGameData] = useState<GameData | null>(null);
  const [ready, setReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

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

  // Function to update player data
  const throttleUpdate = () => {
    if (updateTimeout.current) return;

    updateTimeout.current = setTimeout(async () => {
      const db = getFirestore();
      const roomRef = doc(db, "gameRooms", roomId!);

      try {
        await updateDoc(roomRef, {
          [`players.${username}.progress`]:
            (userInput.length / text.length) * 100,
          [`players.${username}.wpm`]: wpm,
          [`players.${username}.accuracy`]: accuracy,
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
    if (!username || !roomId) return;

    const db = getFirestore();
    const roomRef = doc(db, "gameRooms", roomId);

    const setupPresence = async () => {
      try {
        const roomDoc = await getDoc(roomRef);
        if (!roomDoc.exists()) {
          console.error("Room does not exist");
          return;
        }

        // Mark as connected
        await updateDoc(roomRef, {
          [`players.${username}.connected`]: true,
        });

        // Set up cleanup for tab close/refresh
        window.addEventListener("beforeunload", handleDisconnect);
      } catch (error) {
        console.error("Error setting up presence:", error);
      }
    };

    setupPresence();

    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      const data = snapshot.data() as GameData;
      if (data) setGameData(data);
    });

    return () => {
      unsubscribe();
      window.removeEventListener("beforeunload", handleDisconnect);
      handleDisconnect();
    };
  }, [roomId, username]);

  // Update handleDisconnect function
  const handleDisconnect = async () => {
    if (!username || !roomId) return;

    try {
      const db = getFirestore();
      const roomRef = doc(db, "gameRooms", roomId);
      await updateDoc(roomRef, {
        [`players.${username}.connected`]: false,
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

      // Ignore if any modifier keys are pressed
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
        const wordsTyped = newInput.length / 5;
        const currentWpm = Math.round(wordsTyped / timeElapsed) || 0;
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
          if (username && roomId) {
            const db = getFirestore();
            updateDoc(doc(db, "gameRooms", roomId), {
              [`players.${username}.finished`]: true,
              [`players.${username}.finishTime`]: serverTimestamp(),
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
  }, [text, userInput, startTime, isFinished, username, roomId]);

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

  // Add effect to handle game state changes
  useEffect(() => {
    if (!gameData) return;

    // Handle countdown
    if (gameData.status === "countdown" && gameData.countdownStartedAt) {
      const countdownDuration = 3; // 3 seconds countdown
      const countdownEnd =
        (gameData.countdownStartedAt as any).toMillis() +
        countdownDuration * 1000;
      setStartTime(countdownEnd); // Set start time to when countdown ends
      const timeLeft = Math.ceil((countdownEnd - Date.now()) / 1000);

      if (timeLeft > 0) {
        setCountdown(timeLeft);
        const timer = setInterval(() => {
          const newTimeLeft = Math.ceil((countdownEnd - Date.now()) / 1000);
          setCountdown(newTimeLeft);

          if (newTimeLeft <= 0) {
            clearInterval(timer);
            // Start the race
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

  // Update the progress effect with throttling
  useEffect(() => {
    if (!username || !roomId || !gameData || gameData.status !== "racing")
      return;

    throttleUpdate();
  }, [userInput, wpm, accuracy]);

  const toggleReady = async () => {
    if (!username || !roomId) return;
    const newReadyState = !ready;
    setReady(newReadyState);
    await updateDoc(doc(getFirestore(), "gameRooms", roomId), {
      [`players.${username}.ready`]: newReadyState,
    });
  };

  // Reset charStats when game resets
  const resetGame = () => {
    setUserInput("");
    setStartTime(null);
    setWpm(0);
    setAccuracy(100);
    setIsFinished(false);
    setCursorPosition({ x: 0, y: 0 });
    setWpmHistory([]);
    setCharStats({
      correct: 0,
      incorrect: 0,
      extra: 0,
      missed: 0,
    });
    if (updateTimeout.current) clearTimeout(updateTimeout.current);
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-4">
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
            ready ? "bg-green-500" : "bg-yellow-500"
          }`}
        >
          {ready ? "Ready!" : "Click when ready"}
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
            {!isFinished && (
              <span
                className="absolute w-0.5 h-[1.1em] bg-[#d1d0c5] top-[0.1em] animate-pulse transition-all duration-75 left-0"
                style={{
                  transform: `translate(${cursorPosition.x}px, ${cursorPosition.y}px)`,
                }}
              />
            )}

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
        <div className="fixed inset-0 bg-[#323437] bg-opacity-95 flex flex-col items-center justify-center">
          <div className="text-center text-2xl mb-8">
            <h2 className="text-4xl mb-4">
              {gameData.winner === username
                ? "You won!"
                : `${gameData.players[gameData.winner!]?.name} won!`}
            </h2>
            <div className="space-y-2">
              {Object.entries(gameData.players).map(([playerId, player]) => (
                <div key={playerId}>
                  {player.name}: {player.wpm} WPM, {player.accuracy}% accuracy
                </div>
              ))}
            </div>
          </div>

          <StatsOverview
            wpm={wpm}
            accuracy={accuracy}
            startTime={startTime}
            wpmHistory={wpmHistory}
            charStats={charStats}
          />
        </div>
      )}
    </div>
  );
};

export default RaceRoom;
