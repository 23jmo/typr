import { useRef, useState } from 'react'

interface WpmGraphProps {
  wpm: number
  wpmHistory: Array<{ wpm: number, time: number }>
}

const WpmGraph = ({ wpm, wpmHistory }: WpmGraphProps) => {
  const [hoveredPoint, setHoveredPoint] = useState<{ wpm: number; time: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // Graph dimensions
  const width = 800
  const height = 120
  const padding = 40

  // Calculate scales
  const maxWpm = Math.max(...wpmHistory.map(p => p.wpm), wpm, 150) // minimum y-axis of 150
  const maxTime = Math.max(...wpmHistory.map(p => p.time), 1)

  // Convert data points to SVG coordinates
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

  return (
    <div className="relative bg-[#232427] rounded-lg p-4">
      {hoveredPoint && (
        <div className="absolute top-2 right-2 bg-[#323437] border border-[#646669] rounded px-2 py-1 text-sm">
          <span className="text-[#e2b714]">{hoveredPoint.wpm} wpm</span>
          <span className="text-[#646669] ml-2">{hoveredPoint.time.toFixed(1)}s</span>
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[120px]"
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredPoint(null)}
      >
        {/* Grid lines */}
        <line x1={padding} y1={padding} x2={padding} y2={height-padding} stroke="#646669" strokeWidth="0.5" opacity="0.2" />
        <line x1={padding} y1={height-padding} x2={width-padding} y2={height-padding} stroke="#646669" strokeWidth="0.5" opacity="0.2" />
        
        {/* Y-axis labels */}
        <text x={5} y={padding} fill="#646669" className="text-[10px]" dominantBaseline="middle">
          {maxWpm}
        </text>
        <text x={5} y={height-padding} fill="#646669" className="text-[10px]" dominantBaseline="middle">
          0
        </text>

        {/* X-axis labels */}
        {[0, maxTime/2, maxTime].map((time, i) => (
          <text
            key={i}
            x={padding + (i * (width - padding * 2))/2}
            y={height-5}
            fill="#646669"
            className="text-[10px]"
            textAnchor="middle"
          >
            {Math.round(time)}s
          </text>
        ))}

        {/* WPM line */}
        <path
          d={pathData}
          fill="none"
          stroke="#e2b714"
          strokeWidth="2"
        />

        {/* Data points */}
        {points.map((point, i) => (
          <circle
            key={i}
            cx={point.x}
            cy={point.y}
            r={hoveredPoint?.time === point.time ? 3 : 0}
            fill="#e2b714"
          />
        ))}
      </svg>
    </div>
  )
}

export default WpmGraph 