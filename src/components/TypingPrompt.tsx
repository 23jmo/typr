import React, { useRef, useEffect } from 'react';
import { getCursorCoordinates } from "../utils/race";

const TEXT_SPLIT_PATTERN = /([^\s]+\s*)/g;

interface TypingPromptProps {
  text: string;
  userInput: string;
  isFinished: boolean;
  cursorPosition: { x: number; y: number };
  setCursorPosition: (position: { x: number; y: number }) => void;
  opponentCursors: { [playerId: string]: { position: number; color: string } };
  roomState: any; // TODO: Add proper type
}

const TypingPrompt: React.FC<TypingPromptProps> = ({
  text,
  userInput,
  isFinished,
  cursorPosition,
  setCursorPosition,
  opponentCursors,
  roomState,
}) => {
  const textContainerRef = useRef<HTMLDivElement>(null);

  // Cursor Position Update Effect
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
      } else if (!targetChar && chars.length === 0) {
        setCursorPosition({ x: 0, y: 0 });
      }
    }
  }, [userInput, text, setCursorPosition]);

  return (
    <div className="w-full max-w-[90%] mt-[30vh]">
      <div
        ref={textContainerRef}
        className="text-4xl font-mono relative select-none"
        style={{ 
          minHeight: '1.5em',
          lineHeight: '1.5em'
        }}
      >
        <div className="flex flex-wrap" style={{ gap: '0.5em 0' }}>
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

          {text.match(TEXT_SPLIT_PATTERN)?.map((part, index, parts) => {
            const startIndex = parts.slice(0, index).join('').length;

            return (
              <span 
                key={index} 
                className="inline-flex items-baseline break-inside-avoid"
                style={{ whiteSpace: 'pre' }}
              >
                {part.split('').map((char, charIndex) => {
                  const globalIndex = startIndex + charIndex;
                  let charColor = "text-[#646669]";
                  if (globalIndex < userInput.length) {
                    if (globalIndex < text.length) {
                      charColor = userInput[globalIndex] === text[globalIndex] ? "text-[#d1d0c5]" : "text-red-500";
                    } else {
                      charColor = "text-red-600";
                    }
                  }

                  return (
                    <span 
                      key={charIndex} 
                      className="char-wrapper inline-flex items-center justify-center" 
                      style={{ width: '0.6em', height: '1.2em' }}
                    >
                      <span
                        className={`${charColor}`}
                        style={{ lineHeight: '1.2em', verticalAlign: 'baseline' }}
                      >
                        {char === ' ' ? '\u00A0' : char}
                      </span>
                    </span>
                  );
                })}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TypingPrompt; 