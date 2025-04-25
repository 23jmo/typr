import React, { useRef, useEffect, useState, useCallback } from 'react';
import { getCursorCoordinates } from "../utils/race";
import { keyboardSoundService } from '../services/audioService';

const TEXT_SPLIT_PATTERN = /([^\s]+\s*)/g;

interface TypingPromptProps {
  text: string;
  userInput: string;
  isFinished: boolean;
  cursorPosition: { x: number; y: number };
  setCursorPosition: (position: { x: number; y: number }) => void;
  opponentCursors: { [playerId: string]: { position: number; color: string } };
  roomState: any; // TODO: Add proper type
  onInputChange?: (newInput: string) => void;
  onInputSubmit?: () => void;
}

const TypingPrompt: React.FC<TypingPromptProps> = ({
  text,
  userInput,
  isFinished,
  cursorPosition,
  setCursorPosition,
  opponentCursors,
  roomState,
  onInputChange,
  onInputSubmit,
}) => {
  const textContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [localInput, setLocalInput] = useState('');
  const [prevInputLength, setPrevInputLength] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const outerContainerRef = useRef<HTMLDivElement>(null);

  // Sync props with local state
  useEffect(() => {
    setLocalInput(userInput);
  }, [userInput]);

  // Update the mobile detection and add iOS detection
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      return /android|iPad|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    };
    
    const isIOS = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      return /iPad|iPhone|iPod/i.test(userAgent) && !(window as any).MSStream;
    };
    
    setIsMobile(checkMobile());
    
    // For iOS, we need to use a slightly different approach
    if (isIOS() && inputRef.current) {
      // iOS requires user interaction before focusing
      const handleFirstTouch = () => {
        if (inputRef.current && !isFinished) {
          inputRef.current.focus();
          // Remove event listener after first touch
          document.removeEventListener('touchstart', handleFirstTouch);
        }
      };
      
      document.addEventListener('touchstart', handleFirstTouch);
      
      // Cleanup
      return () => {
        document.removeEventListener('touchstart', handleFirstTouch);
      };
    }
  }, [isFinished]);

  // Auto-focus input field
  useEffect(() => {
    // Focus the input when component mounts or when race starts
    if (inputRef.current && !isFinished) {
      inputRef.current.focus();
      
      // For mobile devices, ensure keyboard appears
      if (isMobile) {
        // For iOS specifically, blur and focus again to ensure keyboard shows up
        if (/iPad|iPhone|iPod/i.test(navigator.userAgent) && !(window as any).MSStream) {
          inputRef.current.blur();
          inputRef.current.focus();
        }
      }
    }
  }, [isFinished, isMobile]);

  // Handle input changes from the hidden field
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (isFinished) return;
    
    const value = e.target.value;
    // For mobile, we're using the last character typed
    if (isMobile && value.length > 0) {
      const lastChar = value.charAt(value.length - 1);
      // Add last character to existing input
      const newInput = userInput + lastChar;
      if (onInputChange) {
        onInputChange(newInput);
      }
      // Clear the input field to get ready for next character
      e.target.value = '';
    }
  }, [isFinished, isMobile, userInput, onInputChange]);

  // Handle input key presses
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isFinished) return;
    
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (userInput.length > 0) {
        const newInput = userInput.slice(0, -1);
        if (onInputChange) {
          onInputChange(newInput);
        }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (onInputSubmit) {
        onInputSubmit();
      }
    }
  }, [isFinished, userInput, onInputChange, onInputSubmit]);

  // Re-focus on the input when user clicks on the text container
  const handleContainerClick = useCallback(() => {
    if (inputRef.current && !isFinished) {
      inputRef.current.focus();
    }
  }, [isFinished]);

  // Handle touchstart event for mobile devices
  const handleContainerTouch = useCallback((e: React.TouchEvent) => {
    if (inputRef.current && !isFinished) {
      // Prevent default only to avoid double-tap zoom
      e.preventDefault();
      inputRef.current.focus();
    }
  }, [isFinished]);

  // Track changes in user input to play sounds based on character correctness
  useEffect(() => {
    // Skip if the length hasn't changed (no new keypresses)
    if (userInput.length === prevInputLength) {
      setPrevInputLength(userInput.length);
      return;
    }

    // Only check for input increases (typing new characters)
    if (userInput.length > prevInputLength) {
      const lastCharIndex = userInput.length - 1;
      
      // Check if character is correct or not to determine sound
      // This is an additional sound layer on top of the main keypress sounds
      if (lastCharIndex < text.length) {
        const isCorrect = userInput[lastCharIndex] === text[lastCharIndex];
        
        if (!isCorrect) {
          // Only play error sound from this component if enabled in settings
          // The parent components already handle basic keypress sounds
          const settings = keyboardSoundService.getSettings();
          if (settings.enabled && settings.theme !== 'silent') {
            keyboardSoundService.playSound('error').catch(err => 
              console.error('Error playing error sound:', err)
            );
          }
        }
      }
    }
    
    setPrevInputLength(userInput.length);
  }, [userInput, text]);

  // Function to check and scroll text into center view
  const scrollTextToCenter = useCallback((targetElement: HTMLElement) => {
    if (!targetElement) return;
    
    const viewportHeight = window.innerHeight;
    const elementRect = targetElement.getBoundingClientRect();
    
    // Calculate ideal position (center in viewport)
    const idealPosition = viewportHeight / 2;
    const elementCenter = elementRect.top + (elementRect.height / 2);
    
    // Only scroll if the element is not reasonably centered already
    if (Math.abs(idealPosition - elementCenter) > 100) {
      const scrollAmount = window.pageYOffset + (elementCenter - idealPosition);
      window.scrollTo({
        top: scrollAmount,
        behavior: 'smooth'
      });
    }
  }, []);

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
          
          // Use the scrollTextToCenter for better positioning
          scrollTextToCenter(targetChar);
        }
      } else {
        targetChar = chars[cursorIndex];
        if (targetChar) {
          const rect = targetChar.getBoundingClientRect();
          const containerRect = textContainerRef.current.getBoundingClientRect();
          const x = rect.left - containerRect.left;
          const y = rect.top - containerRect.top;
          setCursorPosition({ x, y });
          
          // Use the scrollTextToCenter for better positioning
          scrollTextToCenter(targetChar);
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
  }, [userInput, text, setCursorPosition, scrollTextToCenter]);

  return (
    <div 
      ref={outerContainerRef}
      className="w-full max-w-[95%] sm:max-w-[90%] mt-[12vh] sm:mt-[12vh] md:mt-[10vh] lg:mt-[30vh] mx-auto"
    >
      {/* Hidden input for mobile keyboard */}
      <input
        ref={inputRef}
        type="text"
        value={localInput}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        className="opacity-0 absolute h-1 w-1 -z-10"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck="false"
        autoFocus={!isFinished}
        aria-label="Type here"
        style={{ 
          // Force iOS to show keyboard
          fontSize: '16px',
          // Position offscreen but still accessible
          position: 'absolute',
          top: '0',
          left: '0',
          opacity: 0,
          height: '1px',
          width: '1px',
          pointerEvents: 'none'
        }}
      />
      
      <div
        ref={textContainerRef}
        className="text-3xl sm:text-2xl md:text-3xl lg:text-4xl font-mono relative select-none"
        style={{ 
          minHeight: '1.5em',
          lineHeight: '1.5em'
        }}
        onClick={handleContainerClick}
        onTouchStart={handleContainerTouch}
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
                    className={`absolute top-[-1.6em] left-[-50%] text-[8px] sm:text-[10px] md:text-xs ${color.replace(
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
                      style={{ width: 'calc(0.6em)', height: 'calc(1.2em)' }}
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