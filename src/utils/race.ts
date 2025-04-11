export const getCursorCoordinates = (
  textContainerRef: React.RefObject<HTMLDivElement | null>,
  domPosition: number
): { x: number; y: number } | null => {
  if (!textContainerRef.current) return null;

  const chars = Array.from(
    textContainerRef.current.querySelectorAll("span.char-wrapper > span")
  ) as HTMLElement[];

  if (chars.length === 0) return null;

  const safePosition = Math.max(0, Math.min(domPosition, chars.length));
  let targetChar: HTMLElement | null = null;
  let x = 0;
  let y = 0;

  if (safePosition === chars.length) {
    targetChar = chars[chars.length - 1];
    if (targetChar) {
      const rect = targetChar.getBoundingClientRect();
      const containerRect = textContainerRef.current.getBoundingClientRect();
      x = rect.right - containerRect.left;
      y = rect.top - containerRect.top;
    }
  } else {
    targetChar = chars[safePosition];
    if (targetChar) {
      const rect = targetChar.getBoundingClientRect();
      const containerRect = textContainerRef.current.getBoundingClientRect();
      x = rect.left - containerRect.left;
      y = rect.top - containerRect.top;
    }
  }

  if (!targetChar && chars.length > 0) {
    const firstChar = chars[0];
    const rect = firstChar.getBoundingClientRect();
    const containerRect = textContainerRef.current.getBoundingClientRect();
    x = rect.left - containerRect.left;
    y = rect.top - containerRect.top;
  } else if (!targetChar && chars.length === 0) {
    return { x: 0, y: 0 };
  }

  return { x, y };
};

export const resetLocalGameState = (
  setters: {
    setUserInput: (value: string) => void;
    setStartTime: (value: number | null) => void;
    setWpm: (value: number) => void;
    setAccuracy: (value: number) => void;
    setIsFinished: (value: boolean) => void;
    setWpmHistory: (value: Array<{ wpm: number; time: number }>) => void;
    setCharStats: (value: { correct: number; incorrect: number; extra: number; missed: number }) => void;
    setCursorPosition: (value: { x: number; y: number }) => void;
  },
  updateTimeout: React.MutableRefObject<NodeJS.Timeout | null>
) => {
  setters.setUserInput("");
  setters.setStartTime(null);
  setters.setWpm(0);
  setters.setAccuracy(100);
  setters.setIsFinished(false);
  setters.setWpmHistory([]);
  setters.setCharStats({ correct: 0, incorrect: 0, extra: 0, missed: 0 });
  setters.setCursorPosition({ x: 0, y: 0 });
  if (updateTimeout.current) clearTimeout(updateTimeout.current);
}; 