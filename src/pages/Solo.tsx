import { useState, useEffect, useRef } from "react";
import StatsOverview from "../components/StatsOverview";
import { GameResult } from "../types";
import { auth } from "../services/firebase";
import { userStatsService } from "../services/firebase";
import { generateTextByTopic } from "../utilities/random-text";


//TODO: add a graph of wpm and accuracy over time

const TextSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-8 bg-[#2c2e31] rounded mb-4"></div>
    <div className="h-8 bg-[#2c2e31] rounded mb-4"></div>
    <div className="h-8 bg-[#2c2e31] rounded mb-4"></div>
    <div className="h-8 bg-[#2c2e31] rounded w-3/4 mb-4"></div>
  </div>
);

const TypeText = ({
  onTextGenerated,
}: {
  onTextGenerated: (text: string) => void;
}) => {
  useEffect(() => {
    const generateText = async () => {
      const text = await generateTextByTopic("random"); // Wait for text generation
      onTextGenerated(text); // Call the callback with the generated text
    };
    generateText();
  }, []); // Empty dependency array means this runs once when component mounts

  return <TextSkeleton />; // Show skeleton while generating
};

const Solo = () => {
  const [text, setText] = useState("");
  const [userInput, setUserInput] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [isFinished, setIsFinished] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const textContainerRef = useRef<HTMLDivElement>(null);
  const [wpmHistory, setWpmHistory] = useState<
    Array<{ wpm: number; time: number }>
  >([]);

  const wpmInterval = useRef<NodeJS.Timeout | null>(null);

  // Add new state for character tracking
  const [charStats, setCharStats] = useState({
    correct: 0,
    incorrect: 0,
    extra: 0,
    missed: 0,
  });

  const resetGame = () => {
    setUserInput("");
    setStartTime(null);
    setWpm(0);
    setAccuracy(100);
    setIsFinished(false);
    setCursorPosition({ x: 0, y: 0 });
    setWpmHistory([]);
    if (wpmInterval.current) clearInterval(wpmInterval.current);
  };

  // Add keydown event listener for both typing and restart
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Add Tab key handler for restart
      if (e.key === "Tab") {
        e.preventDefault();
        resetGame();
        return;
      }

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
            // Extra character
            return { ...prev, extra: prev.extra + 1 };
          }

          if (newInput[currentIndex] === text[currentIndex]) {
            // Correct character
            return { ...prev, correct: prev.correct + 1 };
          } else {
            // Incorrect character
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

        // Add WPM point on every keystroke
        setWpmHistory((prev) => [
          ...prev,
          {
            wpm: currentWpm,
            time: (Date.now() - (startTime || Date.now())) / 1000,
          },
        ]);

        // Check if finished
        if (newInput.length === text.length) {
          setIsFinished(true);
        }
      } else if (e.key === "Backspace") {
        e.preventDefault();
        const deletedIndex = userInput.length - 1;

        // Remove the last character's stats
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
  }, [text, userInput, startTime, isFinished]);

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

  useEffect(() => {
    if (isFinished) {
      // Generate a unique gameId for solo games
      const gameId = `solo_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 9)}`;

      const gameResult = {
        wpm,
        accuracy,
        timestamp: new Date().toISOString(),
        userId: auth.currentUser?.uid,
        roomId: null,
        timePlayed: Date.now() - (startTime || Date.now()),
        wordsTyped: userInput.length,
        charactersTyped: userInput.length,
        totalMistakes: userInput.length - accuracy,
        totalWordsTyped: userInput.length,
        totalCharactersTyped: userInput.length,
        totalTimePlayed: Date.now() - (startTime || Date.now()),
      };
      if (auth.currentUser?.uid) {
        // Use the centralized service to update stats
        userStatsService.updateUserStats(auth.currentUser.uid, {
          wpm,
          accuracy,
          wordsTyped: userInput.length,
          charactersTyped: userInput.length,
          totalMistakes: userInput.length - accuracy,
          timePlayed: Date.now() - (startTime || Date.now()),
          isRanked: false,
          gameId,
        });
      }
      console.log("Race finished, final WPM history:", wpmHistory);
    }
  }, [isFinished]);

  return (
    <div className="inset-0 flex flex-col items-center p-4">
      <div className="w-full max-w-[80%] mt-[30vh]">
        {text ? (
          isFinished ? (
            <StatsOverview
              wpm={wpm}
              accuracy={accuracy}
              startTime={startTime}
              wpmHistory={wpmHistory}
              charStats={charStats}
            />
          ) : (
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
          )
        ) : (
          <TypeText onTextGenerated={setText} />
        )}

        <div className="flex justify-center items-center mt-10">
          <button
            onClick={resetGame}
            className="px-6 py-2 bg-[#e2b714] text-[#323437] rounded-2xl font-medium hover:bg-[#e2b714]/90 transition-colors flex items-center gap-2 justify-center outline-none"
          >
            <span>Restart</span>
            <kbd className="text-sm opacity-50">(Tab)</kbd>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Solo;
