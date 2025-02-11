import { useRef, useState } from 'react'
import WpmGraph from './WpmGraph'

interface StatsOverviewProps {
  wpm: number
  accuracy: number
  startTime: number | null
  wpmHistory: Array<{ wpm: number, time: number }>
}

const StatsOverview = ({ wpm, accuracy, startTime, wpmHistory }: StatsOverviewProps) => {
  const [hoveredPoint, setHoveredPoint] = useState<{ wpm: number; time: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const width = 800
  const height = 200
  const padding = 40
  
  const maxWpm = Math.max(...wpmHistory.map(p => p.wpm), wpm, 150) // minimum y-axis of 150
  const maxTime = Math.max(...wpmHistory.map(p => p.time))

  const points = wpmHistory.map(point => ({
    x: (point.time / maxTime) * (width - padding * 2) + padding,
    y: height - ((point.wpm / maxWpm) * (height - padding * 2) + padding),
    wpm: point.wpm,
    time: point.time
  }))

  const pathData = points.length > 0 
    ? `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`
    : ''

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || points.length === 0) return
    const rect = svgRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const closest = points.reduce((prev, curr) => {
      const prevDist = Math.abs(prev.x - x)
      const currDist = Math.abs(curr.x - x)
      return prevDist < currDist ? prev : curr
    }, points[0])
    setHoveredPoint({ wpm: closest.wpm, time: closest.time })
  }

  // Calculate character stats
  const calculateCharStats = () => {
    let correct = 0
    let incorrect = 0
    let extra = 0
    let missed = 0

    wpmHistory.forEach((point, i) => {
      if (i === 0) {
        correct = point.wpm * 5 // Approximate characters from WPM
        incorrect = Math.round((100 - accuracy) * correct / 100)
        correct = correct - incorrect
      }
    })

    return `${correct}/${incorrect}/${extra}/${missed}`
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Main Stats - Side by side with proper spacing */}
      <div className="flex items-baseline gap-12 mb-8">
        <div className="flex items-baseline gap-2">
          <div className="text-[#e2b714] text-7xl font-bold">{wpm}</div>
          <div className="text-[#646669] text-xl">wpm</div>
        </div>
        <div className="flex items-baseline gap-2">
          <div className="text-[#e2b714] text-7xl font-bold">{accuracy}%</div>
          <div className="text-[#646669] text-xl">acc</div>
        </div>
      </div>

      {/* Test Info - More compact grid */}
      <div className="grid grid-cols-4 gap-12 mb-6 text-left">
        <div>
          <div className="text-[#646669] text-sm mb-1">test type</div>
          <div className="text-[#e2b714] text-sm">words {Math.round(wpm * ((Date.now() - (startTime || Date.now())) / 1000 / 60))}</div>
          <div className="text-[#e2b714] text-sm">english</div>
        </div>
        <div>
          <div className="text-[#646669] text-sm mb-1">raw</div>
          <div className="text-[#e2b714] text-xl">{Math.round(wpm * (accuracy/100))}</div>
        </div>
        <div>
          <div className="text-[#646669] text-sm mb-1">characters</div>
          <div className="text-[#e2b714] text-xl">{calculateCharStats()}</div>
        </div>
        <div>
          <div className="text-[#646669] text-sm mb-1">time</div>
          <div className="text-[#e2b714] text-xl">
            {((Date.now() - (startTime || Date.now())) / 1000).toFixed(0)}s
          </div>
        </div>
      </div>

      {/* Graph */}
      <WpmGraph wpm={wpm} wpmHistory={wpmHistory} />
    </div>
  )
}

export default StatsOverview 