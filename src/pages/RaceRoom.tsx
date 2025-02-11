import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import StatsOverview from '../components/StatsOverview'

const SAMPLE_TEXT = "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs. How vexingly quick daft zebras jump!"

const cursorStyle = "absolute w-0.5 h-[1.2em] bg-[#d1d0c5] left-0 top-1 animate-pulse transition-transform duration-75"

const RaceRoom = () => {
 
  const [text] = useState(SAMPLE_TEXT)
  const [userInput, setUserInput] = useState('')
  const [startTime, setStartTime] = useState<number | null>(null)
  const [wpm, setWpm] = useState(0)
  const [accuracy, setAccuracy] = useState(100)
  const [isFinished, setIsFinished] = useState(false)
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 })
  const textContainerRef = useRef<HTMLDivElement>(null)

  const resetGame = () => {
    setUserInput('')
    setStartTime(null)
    setWpm(0)
    setAccuracy(100)
    setIsFinished(false)
    setCursorPosition({ x: 0, y: 0 })
  }

  // Add keydown event listener for both typing and restart
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Add Tab key handler for restart
      if (e.key === 'Tab') {
        e.preventDefault()
        resetGame()
        return
      }

      if (isFinished) return

      // Ignore if any modifier keys are pressed
      if (e.metaKey || e.ctrlKey || e.altKey) return

      // Only handle alphanumeric keys, space, and punctuation
      if (e.key.length === 1) {
        e.preventDefault()
        if (!startTime) {
          setStartTime(Date.now())
        }

        const newInput = userInput + e.key
        setUserInput(newInput)

        // Calculate accuracy
        let correct = 0
        for (let i = 0; i < newInput.length; i++) {
          if (newInput[i] === text[i]) correct++
        }
        setAccuracy(Math.round((correct / newInput.length) * 100) || 100)

        // Calculate WPM
        const timeElapsed = (Date.now() - (startTime || Date.now())) / 1000 / 60
        const wordsTyped = newInput.length / 5
        setWpm(Math.round(wordsTyped / timeElapsed) || 0)

        // Check if finished - only compare lengths
        if (newInput.length === text.length) {
          setIsFinished(true)
        }
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        setUserInput(prev => prev.slice(0, -1))
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [text, userInput, startTime, isFinished])

  // Update cursor position when input changes
  useEffect(() => {
    if (textContainerRef.current) {
      const chars = Array.from(textContainerRef.current.querySelectorAll('span > span'))
      const currentChar = chars[userInput.length] || chars[0]
      if (currentChar) {
        const rect = currentChar.getBoundingClientRect()
        const containerRect = textContainerRef.current.getBoundingClientRect()
        const x = rect.left - containerRect.left
        const y = rect.top - containerRect.top
        setCursorPosition({ x, y })
      }
    }
  }, [userInput])

  return (
    <div className="inset-0 flex flex-col items-center p-4">
      <div className="w-full max-w-[80%] mt-[30vh]">
        {isFinished ? (
          <StatsOverview 
            wpm={wpm}
            accuracy={accuracy}
            startTime={startTime}
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
            
            {text.split(' ').map((word, wordIndex, wordArray) => {
              const previousWordsLength = wordArray
                .slice(0, wordIndex)
                .reduce((acc, word) => acc + word.length + 1, 0);

              return (
                <span key={wordIndex} className="flex">
                  {word.split('').map((char, charIndex) => {
                    const index = previousWordsLength + charIndex
                    
                    let color = 'text-[#646669]'
                    if (index < userInput.length) {
                      color = userInput[index] === char ? 'text-[#d1d0c5]' : 'text-red-500'
                    }
                    return (
                      <span 
                        key={charIndex}
                        className={`${color} ${index === userInput.length ? 'relative' : ''}`}
                      >
                        {char}
                      </span>
                    )
                  })}
                  {wordIndex < wordArray.length - 1 && (
                    <span className={`${
                      previousWordsLength + word.length < userInput.length 
                        ? 'text-[#d1d0c5]' 
                        : 'text-[#646669]'
                    } relative`}>
                      &nbsp;
                    </span>
                  )}
                </span>
              )
            })}
          </div>
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
  )
}

export default RaceRoom 