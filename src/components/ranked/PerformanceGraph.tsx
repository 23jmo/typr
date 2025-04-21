import React, { useState, useRef, useEffect } from "react";
import { MatchData } from "../../types";

interface PerformanceGraphProps {
  matches: MatchData[];
}

const PerformanceGraph: React.FC<PerformanceGraphProps> = ({ matches }) => {
  // If no matches, display a message
  if (!matches || matches.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-[#646669] text-lg">No match history available yet. Play some ranked games to see your performance!</p>
      </div>
    );
  }

  // State for tracking which point is being hovered
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  // State for tooltip opacity animation
  const [tooltipOpacity, setTooltipOpacity] = useState(0);
  
  // Ref for animation frame
  const animationRef = useRef<number | null>(null);
  
  // Effect to handle tooltip fade animation
  useEffect(() => {
    // Clear any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    // If a point is hovered, animate opacity from 0 to 1
    if (hoveredPoint !== null) {
      let startTime: number | null = null;
      const duration = 150; // Animation duration in ms
      
      const animateTooltip = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        setTooltipOpacity(progress);
        
        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animateTooltip);
        }
      };
      
      animationRef.current = requestAnimationFrame(animateTooltip);
    } else {
      // Immediately hide tooltip when not hovering
      setTooltipOpacity(0);
    }
    
    // Cleanup animation on unmount or when hoveredPoint changes
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [hoveredPoint]);
  
  // Calculate max WPM for scaling
  const maxWpm = Math.max(...matches.map(match => match.userWpm)) + 10;
  const minWpm = Math.max(0, Math.min(...matches.map(match => match.userWpm)) - 10);
  
  // SVG dimensions - using aspect ratio to maintain proportions
  const svgWidth = "100%"; // Use 100% width to fill container
  const svgHeight = 350; // Slightly reduced height
  const viewBoxWidth = 700; // Reference width for viewBox
  const viewBoxHeight = 400; // Reference height for viewBox
  const padding = 40;
  const graphWidth = viewBoxWidth - (padding * 2);
  const graphHeight = viewBoxHeight - (padding * 2);
  
  // Reverse matches array to display oldest to newest (left to right)
  const reversedMatches = [...matches].reverse();
  
  // Calculate point positions - start from index 1 to leave space for the 0 point
  const points = reversedMatches.map((match, index) => {
    // Adjust the x position to start from position 1 instead of 0
    const x = padding + ((index + 1) * (graphWidth / (reversedMatches.length + 1)));
    const y = viewBoxHeight - padding - ((match.userWpm - minWpm) / (maxWpm - minWpm) * graphHeight);
    return { 
      x, 
      y, 
      isWin: match.isWin, 
      wpm: match.userWpm,
      match: match // Store the full match data for hover tooltip
    };
  });
  
  // Generate path for the line - start from the first actual data point
  const linePath = points.map((point, index) => 
    (index === 0 ? 'M' : 'L') + `${point.x},${point.y}`
  ).join(' ');
  
  // Function to determine tooltip position to keep it within bounds
  const getTooltipPosition = (pointX: number, pointY: number, tooltipWidth: number) => {
    // Default position is to the right of the point
    let x = pointX + 15;
    let y = pointY - 70;
    
    // If tooltip would go off the right edge, place it to the left of the point
    if (x + tooltipWidth > viewBoxWidth - padding) {
      x = pointX - tooltipWidth - 15; // width + offset
    }
    
    // If tooltip would go off the top, place it below the point
    if (y < padding) {
      y = pointY + 15;
    }
    
    return { x, y };
  };
  
  // Function to calculate the width needed for the tooltip content
  const calculateTooltipWidth = (point: typeof points[0]) => {
    // Base width for padding
    const sidePadding = 30; // Increased padding (15px on each side)
    
    // Estimate text widths (approximate character width in pixels)
    // Increased from 6.5 to 8 to account for wider characters and font rendering
    const charWidth = 8;
    
    // Calculate widths of each line
    const opponentWidth = `Opponent: ${point.match.opponent}`.length * charWidth;
    const yourWpmWidth = `Your WPM: ${point.match.userWpm}`.length * charWidth;
    const opponentWpmWidth = `Opponent WPM: ${point.match.opponentWpm}`.length * charWidth;
    const accuracyWidth = `Accuracy: ${point.match.accuracy?.toFixed(1) || "N/A"}%`.length * charWidth;
    // Combined result and ELO on one line
    const resultWidth = `Result: ${point.match.isWin ? "Win" : "Loss"} (${point.match.isWin ? "+" : ""}${point.match.eloChange} ELO)`.length * charWidth;
    
    // Get the maximum width needed
    const maxContentWidth = Math.max(
      opponentWidth,
      yourWpmWidth,
      opponentWpmWidth,
      accuracyWidth,
      resultWidth
    );
    
    // Return the calculated width with padding, with a higher minimum width
    return Math.max(220, Math.ceil(maxContentWidth + sidePadding));
  };
  
  return (
    <div className="w-full overflow-x-auto">
      <svg 
        width={svgWidth} 
        height={svgHeight} 
        className="mx-auto" 
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} 
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Y-axis */}
        <line 
          x1={padding} 
          y1={padding} 
          x2={padding} 
          y2={viewBoxHeight - padding} 
          stroke="#646669" 
          strokeWidth="1" 
        />
        
        {/* X-axis */}
        <line 
          x1={padding} 
          y1={viewBoxHeight - padding} 
          x2={viewBoxWidth - padding} 
          y2={viewBoxHeight - padding} 
          stroke="#646669" 
          strokeWidth="1" 
        />
        
        {/* Y-axis labels */}
        <text x={padding - 10} y={padding} fill="#d1d0c5" textAnchor="end" fontSize="12">{maxWpm}</text>
        <text x={padding - 10} y={viewBoxHeight - padding} fill="#d1d0c5" textAnchor="end" fontSize="12">{minWpm}</text>
        <text x={padding - 10} y={(viewBoxHeight / 2)} fill="#d1d0c5" textAnchor="end" fontSize="12">
          {Math.round((maxWpm + minWpm) / 2)}
        </text>
        
        {/* Line connecting points - starts from first actual data point */}
        <path d={linePath} fill="none" stroke="#646669" strokeWidth="2" />
        
        {/* Data points with hover effects */}
        {points.map((point, index) => (
          <g key={index}>
            {/* WPM text above point */}
            <text 
              x={point.x} 
              y={point.y - 10} 
              fill="#d1d0c5" 
              textAnchor="middle" 
              fontSize="10"
            >
              {point.wpm}
            </text>
            
            {/* Visible circle */}
            <circle 
              cx={point.x} 
              cy={point.y} 
              r={hoveredPoint === index ? "8" : "6"} 
              fill={point.isWin ? "#4ade80" : "#ef4444"} 
              stroke={hoveredPoint === index ? "#ffffff" : "none"}
              strokeWidth="2"
              style={{ transition: "r 0.2s ease-in-out" }}
            />
            
            {/* Larger transparent circle for better hover target - centered on the actual data point */}
            <circle 
              cx={point.x} 
              cy={point.y} 
              r="15" 
              fill="transparent" 
              onMouseEnter={() => setHoveredPoint(index)}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          </g>
        ))}
        
        {/* Y-axis label */}
        <text 
          x={10} 
          y={viewBoxHeight / 2} 
          fill="#d1d0c5" 
          textAnchor="middle" 
          fontSize="12"
          transform={`rotate(-90, 10, ${viewBoxHeight / 2})`}
        >
          WPM
        </text>
        
        {/* X-axis label */}
        <text 
          x={viewBoxWidth / 2} 
          y={viewBoxHeight - 10} 
          fill="#d1d0c5" 
          textAnchor="middle" 
          fontSize="12"
        >
          Matches Played
        </text>
        
        {/* Tooltips rendered last to ensure they appear on top */}
        {hoveredPoint !== null && (() => {
          const point = points[hoveredPoint];
          const tooltipWidth = calculateTooltipWidth(point);
          const tooltipPos = getTooltipPosition(point.x, point.y, tooltipWidth);
          
          return (
            <g style={{ pointerEvents: 'none' }}>
              {/* Tooltip background with fade animation */}
              <rect 
                x={tooltipPos.x} 
                y={tooltipPos.y} 
                width={tooltipWidth} 
                height="120" 
                rx="5" 
                ry="5" 
                fill="#1e1e1e" 
                stroke="#323437" 
                strokeWidth="1" 
                opacity={tooltipOpacity.toString()}
                filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.2))"
              />
              
              {/* Tooltip content with fade animation */}
              <text 
                x={tooltipPos.x + 15} 
                y={tooltipPos.y + 20} 
                fill="#d1d0c5" 
                fontSize="12" 
                fontWeight="500"
                opacity={tooltipOpacity.toString()}
              >
                <tspan x={tooltipPos.x + 15} dy="0">Opponent: {point.match.opponent}</tspan>
                <tspan x={tooltipPos.x + 15} dy="20">Your WPM: {point.match.userWpm}</tspan>
                <tspan x={tooltipPos.x + 15} dy="20">Opponent WPM: {point.match.opponentWpm}</tspan>
                <tspan x={tooltipPos.x + 15} dy="20">Accuracy: {point.match.accuracy?.toFixed(1) || "N/A"}%</tspan>
                <tspan x={tooltipPos.x + 15} dy="20">
                  Result: <tspan fill={point.match.isWin ? "#4ade80" : "#ef4444"} fontWeight="600">
                    {point.match.isWin ? "Win" : "Loss"}
                  </tspan>
                  <tspan fill={point.match.isWin ? "#4ade80" : "#ef4444"} fontWeight="600">
                    {" "}({point.match.isWin ? "+" : ""}{point.match.eloChange} ELO)
                  </tspan>
                </tspan>
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
};

export default PerformanceGraph; 