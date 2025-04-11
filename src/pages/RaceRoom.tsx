import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import FinishedScreen from "../components/ranked/FinishedScreen";
import { Player as PlayerData, GameData as RoomData } from "../types";
import { useUser } from "../contexts/UserContext";
import CountdownAnimation from "../components/CountdownAnimation";
import TopicVotingScreen from "../components/TopicVotingScreen";
import RaceLobby from "../components/RaceLobby";
import { GHOST_CURSOR_COLORS, BACKEND_URL, SAMPLE_TEXT } from "../constants/race";
import { getCursorCoordinates } from "../utils/race";

const RaceRoom = () => {
  // Route and User Context
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { userData } = useUser();
  const localUserId = userData?.uid;
  const localUsername = userData?.username || "Anonymous";

  // Socket Connection State
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomData | null>(null);

  // Game State
  const [userInput, setUserInput] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [isFinished, setIsFinished] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [wpmHistory, setWpmHistory] = useState<Array<{ wpm: number; time: number }>>([]);
  const [charStats, setCharStats] = useState({ correct: 0, incorrect: 0, extra: 0, missed: 0 });
  const [opponentCursors, setOpponentCursors] = useState<{ [playerId: string]: { position: number; color: string } }>({});
  const [countdown, setCountdown] = useState<number | null>(null);

  // Refs
  const textContainerRef = useRef<HTMLDivElement>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const text = roomState?.text || SAMPLE_TEXT;

  // =========================================
  // Socket Connection Effect
  // =========================================
  useEffect(() => {
    if (!roomId || !localUserId) {
      console.log("[RaceRoom] Waiting for roomId or userId...");
      return;
    }
    const currentUserData = userData;
    if (!currentUserData) {
        console.log("[RaceRoom] Waiting for userData...");
        return;
    }

    if (socket) {
        console.log("[RaceRoom] Socket already exists.");
        return;
    }

    console.log(`[RaceRoom] Connecting to socket server for room ${roomId}...`);
    const newSocket = io(BACKEND_URL);

    newSocket.on("connect", () => {
      console.log(`[RaceRoom] Socket connected: ${newSocket.id}`);
      setIsConnected(true);
      setSocketError(null);
      console.log(`[RaceRoom] Emitting joinRoom for user ${localUserId} in room ${roomId}`);
      newSocket.emit("joinRoom", { roomId, userData: currentUserData });
    });

    newSocket.on("disconnect", (reason) => {
      console.log(`[RaceRoom] Socket disconnected: ${reason}`);
      setIsConnected(false);
      setSocket(null);
      setRoomState(null);
      if (reason !== "io client disconnect") {
          setSocketError(`Disconnected: ${reason}. Attempting to reconnect...`);
      }
    });

    newSocket.on("connect_error", (err) => {
        console.error("[RaceRoom] Socket connection error:", err);
        setSocketError(`Connection failed: ${err.message}`);
        setIsConnected(false);
        setSocket(null);
    });

    newSocket.on("gameUpdate", (data: RoomData) => {
      console.log("[RaceRoom] Received gameUpdate:", data);
      setRoomState(data);

      if (data.status === "waiting" || data.status === "countdown") {
          resetLocalGameState();
      }
        if (data.players[localUserId]?.finished && !isFinished) {
            console.log("[RaceRoom] Setting local finished state based on server update.");
            setIsFinished(true);
        } else if (!data.players[localUserId]?.finished && isFinished) {
            console.log("[RaceRoom] Resetting local finished state based on server update.");
            setIsFinished(false);
        }
    });

    newSocket.on("opponentProgress", (data: { userId: string; progress: number; wpm: number }) => {
      setRoomState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          players: {
            ...prev.players,
            [data.userId]: {
              ...prev.players[data.userId],
              progress: data.progress,
              wpm: data.wpm,
              connected: true
            }
          }
        };
      });
    });

     newSocket.on("playerJoined", (player: PlayerData) => {
        console.log(`[RaceRoom] Player joined/reconnected: ${player.name}`);
    });

    newSocket.on("playerLeft", (data: { userId: string }) => {
        console.log(`[RaceRoom] Player left: ${data.userId}`);
    });

    newSocket.on("roomNotFound", () => {
      console.error(`[RaceRoom] Room ${roomId} not found on server.`);
      setSocketError(`Error: Room ${roomId} does not exist.`);
      navigate("/custom", { replace: true });
    });

    newSocket.on("error", (data: { message: string }) => {
      console.error("[RaceRoom] Received error from server:", data.message);
      setSocketError(`Server Error: ${data.message}`);
      if (data.message.includes("full") || data.message.includes("started")) {
          navigate("/custom", { replace: true });
      }
    });

    setSocket(newSocket);

    return () => {
      console.log("[RaceRoom] Disconnecting socket (Cleanup)...");
      newSocket.off("connect");
      newSocket.off("disconnect");
      newSocket.off("connect_error");
      newSocket.off("gameUpdate");
      newSocket.off("opponentProgress");
      newSocket.off("playerJoined");
      newSocket.off("playerLeft");
      newSocket.off("roomNotFound");
      newSocket.off("error");
      newSocket.disconnect();
      setSocket(null);
      setIsConnected(false);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [roomId, localUserId, navigate]);

  // =========================================
  // Countdown Timer Effect
  // =========================================
  useEffect(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    if (roomState?.status === "countdown" && roomState.countdownStartedAt) {
      const countdownDuration = 3;
      const countdownEnd = roomState.countdownStartedAt + countdownDuration * 1000;

      const updateCountdown = () => {
        const timeLeft = Math.ceil((countdownEnd - Date.now()) / 1000);

        if (timeLeft <= 0) {
          setCountdown(0);
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
        } else {
          setCountdown(timeLeft);
        }
      };

      updateCountdown();
      countdownIntervalRef.current = setInterval(updateCountdown, 500);

    } else {
      setCountdown(null);
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [roomState?.status, roomState?.countdownStartedAt]);

  // =========================================
  // Race Start Time Effect
  // =========================================
  useEffect(() => {
    if (roomState?.status === 'racing' && roomState.startTime && !startTime) {
        console.log(`[RaceRoom] Race started on server at ${roomState.startTime}. Setting local startTime.`);
        const now = Date.now();
        const serverStartTime = roomState.startTime;
        if (Math.abs(now - serverStartTime) < 5000) {
            setStartTime(serverStartTime);
        } else {
            console.warn("[RaceRoom] Server startTime differs significantly from client time. Using client time.");
            setStartTime(now);
        }
    }
  }, [roomState?.status, roomState?.startTime, startTime]);

  // =========================================
  // Keyboard Input Handler Effect
  // =========================================
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!socket || !roomState || isFinished) return;

      if (roomState.status !== "racing") return;

      if (!startTime && roomState.status === 'racing') {
         if (!roomState.startTime) {
             setStartTime(Date.now());
         }
      }

      if (e.metaKey || e.ctrlKey || (e.altKey && e.key !== "Backspace")) return;

      if (e.altKey && e.key === "Backspace") {
        return;
      }

      if (e.key.length === 1) {
        e.preventDefault();
        const newInput = userInput + e.key;
        setUserInput(newInput);

        const currentIndex = newInput.length - 1;
        let currentCorrect = charStats.correct;
        let currentIncorrect = charStats.incorrect;
        let currentExtra = charStats.extra;

        if (currentIndex >= text.length) {
          currentExtra++;
        } else if (newInput[currentIndex] === text[currentIndex]) {
          currentCorrect++;
        } else {
          currentIncorrect++;
        }

        const newCharStats = { correct: currentCorrect, incorrect: currentIncorrect, extra: currentExtra, missed: 0 };
        setCharStats(newCharStats);

        const totalChars = newCharStats.correct + newCharStats.incorrect + newCharStats.extra;
        const currentAccuracy = Math.round((newCharStats.correct / totalChars) * 100) || 100;
        setAccuracy(currentAccuracy);

        const timeElapsed = (Date.now() - (startTime || Date.now())) / 1000 / 60;
        const safeTimeElapsed = Math.max(timeElapsed, 0.001);
        const wordsTyped = newInput.length / 5;
        const currentWpm = Math.round(wordsTyped / safeTimeElapsed) || 0;
        setWpm(currentWpm);
        setWpmHistory((prev) => [...prev, { wpm: currentWpm, time: Date.now() - (startTime || Date.now()) }]);

        // Update local progress in roomState as well
        const progress = (newInput.length / text.length) * 100;
        socket.emit("updateProgress", {
          wpm: currentWpm,
          accuracy: currentAccuracy,
          progress: progress,
        });

        // Update local player's progress in roomState
        setRoomState(prev => {
          if (!prev || !localUserId) return prev;
          return {
            ...prev,
            players: {
              ...prev.players,
              [localUserId]: {
                ...prev.players[localUserId],
                progress: progress,
                wpm: currentWpm
              }
            }
          };
        });

        if (newInput.length === text.length) {
          setIsFinished(true);
          socket.emit("playerFinished", {
            finalWpm: currentWpm,
            finalAccuracy: currentAccuracy
          });
        }
      } else if (e.key === "Backspace") {
        e.preventDefault();
        if (userInput.length === 0) return;

        const deletedIndex = userInput.length - 1;
        let currentCorrect = charStats.correct;
        let currentIncorrect = charStats.incorrect;
        let currentExtra = charStats.extra;

        if (deletedIndex >= text.length) {
          currentExtra = Math.max(0, currentExtra - 1);
        } else if (userInput[deletedIndex] === text[deletedIndex]) {
          currentCorrect = Math.max(0, currentCorrect - 1);
        } else {
          currentIncorrect = Math.max(0, currentIncorrect - 1);
        }

        const newCharStats = { correct: currentCorrect, incorrect: currentIncorrect, extra: currentExtra, missed: 0 };
        setCharStats(newCharStats);

        setUserInput((prev) => {
          const newInput = prev.slice(0, -1);
          const progress = (newInput.length / text.length) * 100;
          socket.emit("updateProgress", {
            wpm,
            accuracy,
            progress: Math.max(0, progress),
          });

          // Update local player's progress in roomState
          setRoomState(prevState => {
            if (!prevState || !localUserId) return prevState;
            return {
              ...prevState,
              players: {
                ...prevState.players,
                [localUserId]: {
                  ...prevState.players[localUserId],
                  progress: Math.max(0, progress),
                  wpm
                }
              }
            };
          });

          return newInput;
        });
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [
    socket,
    roomState,
    userInput,
    startTime,
    isFinished,
    text,
    charStats,
    wpm,
    accuracy,
  ]);

  // =========================================
  // Alt+Delete Handler Effect
  // =========================================
  useEffect(() => {
    const handleAltDelete = (e: KeyboardEvent) => {
      if (!socket || !roomState || isFinished || roomState.status !== "racing" || userInput.length === 0) return;

      if ((e.key === "Backspace" || e.key === "Delete") && e.altKey) {
        e.preventDefault();
        e.stopPropagation();

        let lastSpaceIndex = userInput.lastIndexOf(" ");
        if (lastSpaceIndex === userInput.length - 1) {
          lastSpaceIndex = userInput.lastIndexOf(" ", lastSpaceIndex - 1);
        }

        const startIndexToDelete = lastSpaceIndex === -1 ? 0 : lastSpaceIndex + 1;
        const charsToDeleteCount = userInput.length - startIndexToDelete;
        const newUserInput = userInput.substring(0, startIndexToDelete);

        let currentCorrect = charStats.correct;
        let currentIncorrect = charStats.incorrect;
        let currentExtra = charStats.extra;

        for (let i = 0; i < charsToDeleteCount; i++) {
          const charIndex = startIndexToDelete + i;
          if (charIndex >= text.length) {
            currentExtra = Math.max(0, currentExtra - 1);
          } else if (userInput[charIndex] === text[charIndex]) {
            currentCorrect = Math.max(0, currentCorrect - 1);
          } else {
            currentIncorrect = Math.max(0, currentIncorrect - 1);
          }
        }

        const newCharStats = { correct: currentCorrect, incorrect: currentIncorrect, extra: currentExtra, missed: 0 };
        setCharStats(newCharStats);
        setUserInput(newUserInput);

        const progress = (newUserInput.length / text.length) * 100;
        
        socket.emit("updateProgress", {
          wpm,
          accuracy,
          progress: Math.max(0, progress),
        });

        // Update local player's progress in roomState
        setRoomState(prevState => {
          if (!prevState || !localUserId) return prevState;
          return {
            ...prevState,
            players: {
              ...prevState.players,
              [localUserId]: {
                ...prevState.players[localUserId],
                progress: Math.max(0, progress),
                wpm
              }
            }
          };
        });
      }
    };

    window.addEventListener("keydown", handleAltDelete, true);
    return () => window.removeEventListener("keydown", handleAltDelete, true);
  }, [socket, roomState, isFinished, userInput, text, charStats, wpm, accuracy]);

  // =========================================
  // Cursor Position Update Effect
  // =========================================
  useEffect(() => {
    if (textContainerRef.current) {
        const chars = Array.from(
          textContainerRef.current.querySelectorAll("span.char-wrapper > span")
        ) as HTMLElement[];

         if (chars.length === 0) return;

         const cursorIndex = Math.max(0, Math.min(userInput.length, chars.length));

         let targetChar: HTMLElement | null = null;

         if (cursorIndex === chars.length) {
             targetChar = chars[chars.length - 1];
              if (targetChar) {
                 const rect = targetChar.getBoundingClientRect();
                 const containerRect = textContainerRef.current.getBoundingClientRect();
                 const x = rect.right - containerRect.left;
                 const y = rect.top - containerRect.top;
                 setCursorPosition({ x, y });
             }
        } else {
             targetChar = chars[cursorIndex];
              if (targetChar) {
                 const rect = targetChar.getBoundingClientRect();
                 const containerRect = textContainerRef.current.getBoundingClientRect();
                 const x = rect.left - containerRect.left;
                 const y = rect.top - containerRect.top;
                 setCursorPosition({ x, y });
             }
         }

         if (!targetChar && chars.length > 0) {
             const firstChar = chars[0];
             const rect = firstChar.getBoundingClientRect();
             const containerRect = textContainerRef.current.getBoundingClientRect();
             const x = rect.left - containerRect.left;
             const y = rect.top - containerRect.top;
             setCursorPosition({ x, y });
              console.warn("[RaceRoom] Cursor positioning fallback used.");
         } else if (!targetChar && chars.length === 0){
              setCursorPosition({ x: 0, y: 0 });
         }
    }
  }, [userInput, text]);

  // =========================================
  // Opponent Cursors Update Effect
  // =========================================
  useEffect(() => {
    if (!roomState || !text || !localUserId) {
      setOpponentCursors({});
      return;
    }

    const newOpponentCursors: {
      [playerId: string]: { position: number; color: string };
    } = {};
    let colorIndex = 0;

    Object.entries(roomState.players).forEach(([playerId, player]) => {
      if (playerId === localUserId || !player.connected || player.finished) return;

      const characterPosition = Math.floor(
        ((player.progress || 0) / 100) * text.length
      );

      let domPosition = 0;
      let charCount = 0;
      const words = text.split(/(\s+)/);

      for (const part of words) {
        if (part.length === 0) continue;

        const partLen = part.length;

        if (charCount + partLen > characterPosition) {
          domPosition += characterPosition - charCount;
          break;
        }

        charCount += partLen;
        domPosition += partLen;

        if (charCount === characterPosition) {
          break;
        }
      }
      const maxDomPosition = text.length;
      domPosition = Math.min(domPosition, maxDomPosition);

      const color = GHOST_CURSOR_COLORS[colorIndex % GHOST_CURSOR_COLORS.length];
      colorIndex++;

      newOpponentCursors[playerId] = { position: domPosition, color };
    });

    setOpponentCursors(newOpponentCursors);
  }, [roomState, text, localUserId]);

  // =========================================
  // Game Actions
  // =========================================
  const toggleReady = () => {
    if (socket && roomState?.status === "waiting") {
      socket.emit("toggleReady");
    }
  };


  const resetLocalGameState = () => {
    console.log("[RaceRoom] Resetting local game state.");
    setUserInput("");
    setStartTime(null);
    setWpm(0);
    setAccuracy(100);
    setIsFinished(false);
    setWpmHistory([]);
    setCharStats({ correct: 0, incorrect: 0, extra: 0, missed: 0 });
    setCursorPosition({ x: 0, y: 0 });
    setOpponentCursors({});
  };

  // =========================================
  // Loading and Error States
  // =========================================
  if (!isConnected && !socketError) {
    return <div className="flex justify-center items-center min-h-screen">Connecting to room...</div>;
  }

  if (socketError) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen text-red-500">
        <p>Error: {socketError}</p>
        <button onClick={() => navigate('/custom')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Return to Custom Games
        </button>
      </div>
    );
  }

  if (!roomState) {
    return <div className="flex justify-center items-center min-h-screen">Loading room data...</div>;
  }

  // =========================================
  // Main Render
  // =========================================
  return (
    <div className="flex flex-col items-center min-h-screen p-4 bg-[#2c2e31] text-[#d1d0c5]">
      <div className="fixed top-0 left-0 bg-black bg-opacity-70 p-2 text-xs text-white z-50">
        User: {localUsername} ({localUserId?.substring(0,6)}), Room: {roomId}, Status:{" "}
        {roomState?.status}, Socket: {isConnected ? 'Connected' : 'Disconnected'}
        {socketError && <span className="text-red-400"> | Error: {socketError}</span>}
      </div>

       <div className="fixed top-10 left-4 space-y-2 z-40 bg-[#232527] p-3 rounded shadow-lg max-h-[80vh] overflow-y-auto">
         <h3 className="font-bold mb-2 border-b border-[#3c3e41] pb-1">Players ({Object.keys(roomState.players).length}/{roomState.playerLimit})</h3>
          {Object.values(roomState.players)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((player) => (
              <div
                key={player.id}
                className={`flex items-center space-x-2 p-1 rounded ${player.id === localUserId ? 'bg-[#3c3e41]' : ''}`}
              >
                <span
                  className={`w-3 h-3 rounded-full ${
                    player.connected ? "bg-green-500" : "bg-red-500"
                  }`}
                  title={player.connected ? 'Connected' : 'Disconnected'}
                />
                <span className="flex-1 truncate" title={player.name}>{player.name}</span>
                 {roomState.status === 'waiting' && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${player.ready ? 'bg-green-700 text-green-100' : 'bg-gray-600 text-gray-300'}`}>
                       {player.ready ? "Ready" : "Not Ready"}
                </span>
                 )}
                 {roomState.status === 'racing' && !player.finished && (
                  <div className="w-16 h-2 bg-gray-700 rounded overflow-hidden" title={`Progress: ${player.progress.toFixed(0)}%`}>
                    <div
                      className="h-full bg-blue-500 rounded transition-all duration-300"
                      style={{ width: `${player.progress || 0}%` }}
                    />
                  </div>
                )}
                 {player.finished && (
                    <span className="text-green-400" title="Finished">✓</span>
                 )}
                 {roomState.status === 'voting' && (
                    <span className="text-xs" title={player.vote ? `Voted for ${player.vote}` : 'Not voted'}>
                      {player.vote ? '🗳️' : '➖'}
                    </span>
                 )}
                 {(roomState.status === 'racing' || roomState.status === 'finished') && (
                     <span className="text-xs w-8 text-right">{player.wpm}</span>
                )}
              </div>
            ))}
        </div>

      {roomState.status === "waiting" && (
        <RaceLobby
          gameData={{...roomState, players: roomState.players}}
          roomId={roomId!}
          userId={localUserId!}
          username={localUsername}
          onToggleReady={toggleReady}
        />
      )}

      {roomState.status === "voting" && localUserId && (
        <TopicVotingScreen
          gameData={roomState}
          roomId={roomId!}
          socket={socket}
          localUserId={localUserId}
        />
      )}

      {(roomState.status === "countdown" || (roomState.status === "racing" && countdown === 0)) && (
        <div className="flex flex-col items-center justify-center mb-8 mt-[20vh]">
          <CountdownAnimation count={countdown} />
          <div className="text-lg text-gray-400 mt-2">
             {countdown !== 0 && countdown !== null ? "Race starting soon..." : ""}
             {countdown === 0 && "GO!"}
          </div>
        </div>
      )}

      {roomState.status === "racing" && (
        <div className="w-full max-w-[80%] mt-[30vh]">
          <div
            ref={textContainerRef}
            className="text-4xl leading-relaxed font-mono relative flex flex-wrap select-none"
            style={{ minHeight: '5em' }}
          >
            {!isFinished && (
              <span
                className="absolute w-0.5 h-[1.1em] bg-[#d1d0c5] top-[0.1em] animate-pulse transition-all duration-75 left-0 z-10"
                style={{
                  transform: `translate(${cursorPosition.x}px, ${cursorPosition.y}px)`,
                  transition: 'transform 0.075s linear'
                }}
              />
            )}

            {Object.entries(opponentCursors).map(
              ([playerId, { position, color }]) => {
                const coords = getCursorCoordinates(textContainerRef, position);
                if (!coords) return null;

                const playerName =
                  roomState?.players[playerId]?.name || "Opponent";

                return (
                  <div
                    key={`ghost-${playerId}`}
                    className="absolute z-0 pointer-events-none"
                    style={{
                      transform: `translate(${coords.x}px, ${coords.y}px)`,
                      transition: "transform 0.2s linear",
                    }}
                  >
                    <span
                      className={`absolute w-0.5 h-[1.1em] ${color} opacity-60 top-[0.1em]`}
                    />
                    <span
                      className={`absolute top-[-1.6em] left-[-50%] transform translate-x-[-50%]] text-xs ${color.replace(
                        "bg-",
                        "text-"
                      )} whitespace-nowrap px-1 rounded bg-black bg-opacity-50`}
                      style={{ transform: 'translateX(-50%)' }}
                    >
                      {playerName}
                    </span>
                  </div>
                );
              }
            )}

            {text.split("").map((char, index) => {
                 let charColor = "text-[#646669]";
                    if (index < userInput.length) {
                     if(index < text.length) {
                        charColor = userInput[index] === text[index] ? "text-[#d1d0c5]" : "text-red-500";
                     } else {
                         charColor = "text-red-600";
                     }

                 } else if (index === userInput.length && !isFinished) {
                 }

                 const isSpace = char === ' ';
                 const displayChar = isSpace ? '\u00A0' : char;

                    return (
                    <span key={index} className="char-wrapper inline-flex items-center justify-center" style={{ width: '0.6em', height: '1.2em' }}>
                      <span
                       className={`${charColor}`}
                       style={{ lineHeight: '1.2em', verticalAlign: 'baseline' }}
                      >
                       {displayChar}
                      </span>
                </span>
              );
            })}
          </div>
        </div>
      )}

       {roomState.status === "finished" && localUserId && (
        <FinishedScreen
           gameData={{...roomState, players: roomState.players}}
          wpm={wpm}
          accuracy={accuracy}
           startTime={startTime || roomState.startTime || 0}
          wpmHistory={wpmHistory}
          charStats={charStats}
           socket={socket}
           roomState={roomState}
           localUserId={localUserId}
        />
      )}

    </div>
  );
};

export default RaceRoom;
