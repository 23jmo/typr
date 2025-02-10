import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'

const SAMPLE_TEXT = "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs. How vexingly quick daft zebras jump!"

const RaceRoom = () => {
  const { roomId } = useParams()
  const [text, setText] = useState(SAMPLE_TEXT)
  const [userInput, setUserInput] = useState('')
  const [startTime, setStartTime] = useState<number | null>(null)
  const [wpm, setWpm] = useState(0)
  const [accuracy, setAccuracy] = useState(100)
  const [isFinished, setIsFinished] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (!startTime) {
      setStartTime(Date.now())
    }

    setUserInput(value)

    // Calculate accuracy
    let correct = 0
    for (let i = 0; i < value.length; i++) {
      if (value[i] === text[i]) correct++
    }
    setAccuracy(Math.round((correct / value.length) * 100) || 100)

    // Calculate WPM
    const timeElapsed = (Date.now() - (startTime || Date.now())) / 1000 / 60
    const wordsTyped = value.length / 5
    setWpm(Math.round(wordsTyped / timeElapsed) || 0)

    // Check if finished
    if (value === text) {
      setIsFinished(true)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="flex justify-between mb-4">
          <div className="text-xl">WPM: {wpm}</div>
          <div className="text-xl">Accuracy: {accuracy}%</div>
        </div>

        <div className="text-xl leading-relaxed font-mono">
          {text.split('').map((char, index) => {
            let color = 'text-[#646669]'
            if (index < userInput.length) {
              color = userInput[index] === char ? 'text-[#d1d0c5]' : 'text-red-500'
            }
            return (
              <span key={index} className={color}>
                {char}
              </span>
            )
          })}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={userInput}
          onChange={handleInput}
          disabled={isFinished}
          className="w-full p-2 rounded bg-[#2c2e31] border border-[#646669] focus:outline-none focus:border-[#d1d0c5]"
        />

        {isFinished && (
          <div className="text-center text-2xl text-green-500">
            Completed! Final WPM: {wpm} | Accuracy: {accuracy}%
          </div>
        )}
      </div>
    </div>
  )
}

export default RaceRoom 