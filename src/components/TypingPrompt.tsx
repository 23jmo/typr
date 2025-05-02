import React, { useRef, useEffect, useState, useCallback } from 'react';
import { keyboardSoundService } from '../services/audioService';

const TEXT_SPLIT_PATTERN = /([^\s]+\s*)/g;
const VISIBLE_LINES = 3; // Number of lines to show at once
const LINE_HEIGHT_EM = 1.5; // Corresponds to style below (lineHeight: '1.5em')
const TOP_PADDING_REM = 1; // Added padding-top in rem units

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
  resetScrollSignal?: number;
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
  resetScrollSignal,
}) => {
  const textContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [localInput, setLocalInput] = useState('');
  const [prevInputLength, setPrevInputLength] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const outerContainerRef = useRef<HTMLDivElement>(null);
  const [lineHeightPx, setLineHeightPx] = useState(0); // Store line height in pixels
  const [remInPx, setRemInPx] = useState(16); // Store 1rem in pixels, default 16

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

  // Add handlers for tab visibility change and window focus to handle returning to the race after switching tabs
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isFinished) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            
            // Special handling for iOS devices
            if (isMobile && /iPad|iPhone|iPod/i.test(navigator.userAgent) && !(window as any).MSStream) {
              inputRef.current.blur();
              inputRef.current.focus();
            }
          }
        }, 100);
      }
    };
    
    const handleWindowFocus = () => {
      if (!isFinished && inputRef.current) {
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }, 100);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [isFinished, isMobile]);

  // Calculate line height in pixels after mount and on resize
  useEffect(() => {
    const calculateMetrics = () => {
      // Calculate rem in pixels
      const rootFontSize = parseFloat(
        window.getComputedStyle(document.documentElement).fontSize
      );
      setRemInPx(rootFontSize * TOP_PADDING_REM); // Calculate padding in px
      console.log(`1rem = ${rootFontSize}px, Padding Top = ${rootFontSize * TOP_PADDING_REM}px`); // Debug log

      // Calculate line height in pixels
      if (textContainerRef.current) {
        const computedStyle = window.getComputedStyle(textContainerRef.current);
        // Use fontSize and lineHeight style to calculate pixel height
        const fontSize = parseFloat(computedStyle.fontSize);
        const calculatedLineHeight = fontSize * LINE_HEIGHT_EM;
        setLineHeightPx(calculatedLineHeight);
        console.log("Calculated Line Height (px):", calculatedLineHeight); // Debug log
      }
    };

    calculateMetrics(); // Initial calculation
    window.addEventListener('resize', calculateMetrics);

    return () => {
      window.removeEventListener('resize', calculateMetrics);
    };
  }, []); // Runs once on mount and cleans up

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

  // Cursor Position Update & Scrolling Effect
  useEffect(() => {
    if (textContainerRef.current && lineHeightPx > 0) { // Ensure lineHeightPx is calculated
      const container = textContainerRef.current;
      
      // Function to calculate and set the cursor position
      const calculateAndSetPosition = () => {
        // Ensure container and lineHeightPx are still valid in this scope
        if (!textContainerRef.current || lineHeightPx <= 0) return;
        
        const currentContainer = textContainerRef.current;
        const currentChars = Array.from(
          currentContainer.querySelectorAll("span.char-wrapper > span")
        ) as HTMLElement[];

        if (currentChars.length === 0) {
          setCursorPosition({ x: 0, y: 0 });
          return;
        }

        const currentCursorIndex = Math.max(0, Math.min(userInput.length, currentChars.length));
        let currentTargetChar: HTMLElement | null = null;
        let finalX = 0;
        let finalRelativeY = 0;

        if (currentCursorIndex < currentChars.length) {
          currentTargetChar = currentChars[currentCursorIndex];
        } else if (currentChars.length > 0) {
          currentTargetChar = currentChars[currentChars.length - 1];
        }

        if (currentTargetChar) {
          const currentRect = currentTargetChar.getBoundingClientRect();
          const currentContainerRect = currentContainer.getBoundingClientRect();

          if (currentCursorIndex === currentChars.length) {
            finalX = currentRect.right - currentContainerRect.left;
          } else {
            finalX = currentRect.left - currentContainerRect.left;
          }
          finalRelativeY = currentRect.top - currentContainerRect.top;
          
          // Debug log moved inside here
          // console.log("Setting position inside calculateAndSetPosition. RelativeY:", finalRelativeY);
          setCursorPosition({ x: finalX, y: finalRelativeY });

        } else if (currentChars.length > 0) {
          // Fallback for beginning
          const firstChar = currentChars[0];
          const currentRect = firstChar.getBoundingClientRect();
          const currentContainerRect = currentContainer.getBoundingClientRect();
          finalX = currentRect.left - currentContainerRect.left;
          finalRelativeY = currentRect.top - currentContainerRect.top;
          setCursorPosition({ x: finalX, y: finalRelativeY });
        } else {
           setCursorPosition({ x: 0, y: 0 }); // Should be caught earlier, but good fallback
        }
      };
      
      // --- Initial Calculation & Scroll Check ---
      // Need to calculate positions *before* deciding to scroll
      const initialChars = Array.from(
        container.querySelectorAll("span.char-wrapper > span")
      ) as HTMLElement[];

      if (initialChars.length === 0) {
        calculateAndSetPosition(); // Set to 0,0
        return;
      }
      
      const initialCursorIndex = Math.max(0, Math.min(userInput.length, initialChars.length));
      let initialTargetChar: HTMLElement | null = null;
      
      if (initialCursorIndex < initialChars.length) {
        initialTargetChar = initialChars[initialCursorIndex];
      } else if (initialChars.length > 0) {
        initialTargetChar = initialChars[initialChars.length - 1];
      }
      
      let shouldScroll = false;
      let newScrollTop = container.scrollTop;
      
      if (initialTargetChar && lineHeightPx > 0) { // Ensure lineHeightPx is valid
        const initialRect = initialTargetChar.getBoundingClientRect();
        const initialContainerRect = container.getBoundingClientRect();
        const initialRelativeY = initialRect.top - initialContainerRect.top;
        const initialContentY = initialRelativeY + container.scrollTop;

        // Calculate the pixel position for the top of the 3rd visible line
        const thirdLineTopBoundary = container.scrollTop + (VISIBLE_LINES - 1) * lineHeightPx;
        
        // Trigger scroll if the calculated top of the current line hits the top of the 3rd visible line
        // Using initialContentY directly might be more robust against small lineHeightPx inaccuracies
        // We trigger if the character's top position enters the last visible line space
        if (initialContentY >= thirdLineTopBoundary) {
          shouldScroll = true;
          // Calculate the amount to scroll: line height (1.5em) + gap (0.5em) = 2.0em
          // Pixel equivalent: (2.0 / 1.5) * lineHeightPx = (4/3) * lineHeightPx
          const scrollAmount = (4 / 3) * lineHeightPx;
          newScrollTop = container.scrollTop + scrollAmount;
          // Ensure scroll position doesn't exceed maximum possible scroll
          newScrollTop = Math.min(newScrollTop, container.scrollHeight - container.clientHeight);
        }
      } 
      // End of initial calculation & scroll check

      // --- Perform Scroll & Schedule/Set Position ---
      if (shouldScroll) {
        console.log(`Scrolling Up. Current ScrollTop: ${container.scrollTop}, Target: ${newScrollTop}, Amount: ${(4/3)*lineHeightPx}`); 
        container.scrollTo({ top: newScrollTop, behavior: 'auto' });
        // Schedule the definitive position calculation for the next frame
        requestAnimationFrame(calculateAndSetPosition);
      } else {
        // No scroll needed, calculate and set position immediately in this frame
        calculateAndSetPosition();
      }
    }
  }, [userInput, text, setCursorPosition, lineHeightPx, remInPx]);

  // Scroll to top when resetScrollSignal changes (for Solo restart)
  useEffect(() => {
    if (resetScrollSignal && textContainerRef.current) {
      textContainerRef.current.scrollTop = 0;
    }
  }, [resetScrollSignal]);

  return (
    <div 
      ref={outerContainerRef}
      className="w-full mt-[12vh] sm:mt-[12vh] md:mt-[10vh] lg:mt-[30vh] mx-auto px-6.5 md:px-6"
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
        className="text-3xl sm:text-2xl md:text-3xl lg:text-4xl font-mono relative select-none pt-4 px-6.5 overflow-x-visible overflow-y-hidden"
        style={{
          // Adjust height calculation to include top padding (remInPx)
          // Keep slight extra buffer (0.6 * lineHeightPx)
          height: lineHeightPx > 0 && remInPx > 0 
                  ? `${VISIBLE_LINES * lineHeightPx + (0.6 * lineHeightPx) + remInPx}px` 
                  : 'auto',
          lineHeight: `${LINE_HEIGHT_EM}em`,
          cursor: 'text',
        }}
        onClick={handleContainerClick}
        onTouchStart={handleContainerTouch}
      >
        {/* Cursor needs to be positioned relative to the scrolling container */}
        {/* Its Y position needs to account for the container's scrollTop */}
        {!isFinished && (
          <span
            className="absolute w-0.5 bg-[#d1d0c5] top-0 left-0 animate-pulse transition-all duration-75 z-10 pointer-events-none"
            style={{
              // Use pixel values based on calculated lineHeightPx for positioning and height
              top: `${lineHeightPx * 0.1}px`,
              height: `${lineHeightPx * 0.8}px`,
              // IMPORTANT: Subtract scrollTop so the cursor stays aligned with the text as it scrolls
              // This fixes the bug where the cursor jumps to a higher line when scrolling
              transform: `translate(${cursorPosition.x}px, ${cursorPosition.y + (textContainerRef.current?.scrollTop ?? 0)}px)`,
              transition: 'transform 0.075s linear',
            }}
          />
        )}

        {/* Inner div for the actual text content that will scroll */}
        {/* The cursor and opponent cursors are positioned relative to textContainerRef, */}
        {/* but the content scrolls underneath them. */}
        <div className="flex flex-wrap relative overflow-x-visible" style={{ gap: '0.5em 0' }}>
          {/* Opponent Cursors - Their position also needs to be relative to the potentially scrolled content */}
          {Object.entries(opponentCursors).map(
            ([playerId, { position, color }]) => {
              // --- Direct Opponent Cursor Calculation ---
              let opponentX = 0;
              let opponentRelativeY = 0;
              const container = textContainerRef.current;

              if (container && lineHeightPx > 0) { // Ensure container and line height are available
                const chars = Array.from(
                  container.querySelectorAll("span.char-wrapper > span")
                ) as HTMLElement[];

                if (chars.length > 0) {
                  const opponentCursorIndex = Math.max(0, Math.min(position, chars.length));
                  let targetChar: HTMLElement | null = null;

                  if (opponentCursorIndex < chars.length) {
                    targetChar = chars[opponentCursorIndex];
                  } else { // Position is at the end of the text
                    targetChar = chars[chars.length - 1];
                  }

                  if (targetChar) {
                    const targetRect = targetChar.getBoundingClientRect();
                    const containerRect = container.getBoundingClientRect();
                    // Get the computed left padding of the container
                    const containerStyle = window.getComputedStyle(container);
                    const paddingLeft = parseFloat(containerStyle.paddingLeft) || 0;

                    // If at the end, position is after the last char; otherwise, it's before the target char
                    // Subtract paddingLeft to correct for the offset
                    opponentX = (opponentCursorIndex === chars.length)
                      ? targetRect.right - containerRect.left - paddingLeft
                      : targetRect.left - containerRect.left - paddingLeft;

                    opponentRelativeY = targetRect.top - containerRect.top;
                  } else {
                    // Fallback if targetChar is somehow null (shouldn't happen if chars.length > 0)
                    const firstCharRect = chars[0].getBoundingClientRect();
                     const containerRect = container.getBoundingClientRect();
                    // Also apply padding correction to the fallback
                    const containerStyle = window.getComputedStyle(container);
                    const paddingLeft = parseFloat(containerStyle.paddingLeft) || 0;
                    opponentX = firstCharRect.left - containerRect.left - paddingLeft;
                    opponentRelativeY = firstCharRect.top - containerRect.top;
                  }
                }
                 // If chars.length is 0, coords remain 0,0
              }
              // --- End Direct Calculation ---

              // Fallback if calculation failed (e.g., container not ready)
              // Removed call to getCursorCoordinates

              const playerName =
                roomState?.players[playerId]?.name || "Opponent";

              // Calculate final Y, accounting for scroll
              // IMPORTANT: Add scrollTop here so the cursor moves with the text content
              const finalOpponentY = opponentRelativeY + (container?.scrollTop ?? 0);

              return (
                <div
                  key={`ghost-${playerId}`}
                  className="absolute z-0 pointer-events-none"
                  style={{
                    // Apply calculated X and the scroll-adjusted Y
                    // Subtract remInPx to compensate for the container's top padding
                    transform: `translate(${opponentX}px, ${finalOpponentY - remInPx}px)`,
                    transition: "transform 0.2s linear", // Keep smooth transition
                  }}
                >
                  {/* Opponent Cursor Visual */}
                  <span
                    className={`absolute w-0.5 ${color} opacity-60`}
                    style={{
                      height: `${lineHeightPx * 0.8}px`, // Use calculated line height
                      top: `${lineHeightPx * 0.1}px`,    // Use calculated line height
                    }}
                  />
                  {/* Opponent Name Tag */}
                  <span
                    className={`absolute left-[-50%] text-[8px] sm:text-[10px] md:text-xs ${color.replace(
                      "bg-",
                      "text-"
                    )} whitespace-nowrap px-1 rounded`}
                    style={{
                      transform: 'translateX(-50%)',
                      // Adjust top position conditionally based on mobile
                      // Desktop: Original negative offset + padding compensation
                      // Mobile: Original negative offset only
                      top: `${isMobile ? -lineHeightPx * 0.6 : -lineHeightPx * 0.6 + remInPx}px`,
                    }}
                  >
                    {playerName}
                  </span>
                </div>
              );
            }
          )}

          {/* Render the text characters */}
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
                      // Remove explicit height, rely on inner span's line-height
                      style={{ width: 'calc(0.6em)' /* height removed */ }}
                    >
                      <span
                        className={`${charColor}`}
                        // Ensure character aligns correctly within its box
                        style={{ lineHeight: `${LINE_HEIGHT_EM}em`, verticalAlign: 'baseline' }}
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