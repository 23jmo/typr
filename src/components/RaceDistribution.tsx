import React from "react";

interface WpmRange {
  range: string;
  min: number;
  max: number;
  count: number;
}

interface RaceDistributionProps {
  wpmRanges: WpmRange[];
}

/**
 * Displays a histogram of WPM distribution across races
 * Shows the frequency of races within different WPM ranges
 */
const RaceDistribution: React.FC<RaceDistributionProps> = ({ wpmRanges }) => {
  if (!wpmRanges || wpmRanges.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[#646669]">No race data available</p>
      </div>
    );
  }

  // Find the maximum count to properly scale the bars
  const maxCount = Math.max(...wpmRanges.map((r) => r.count));

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex items-end justify-around">
        {wpmRanges.map((range) => (
          <div key={range.range} className="flex flex-col items-center">
            {/* Display count above the bar */}
            <div className="text-[#d1d0c5] text-xs mb-1">
              {range.count > 0 ? range.count : ""}
            </div>
            
            {/* Vertical bar */}
            <div
              className="bg-[#e2b714] w-12 rounded-t transition-all duration-300 ease-in-out"
              style={{
                height: `${Math.max(20, (range.count / Math.max(maxCount, 1)) * 270)}px`,
                opacity: range.count > 0 ? 1 : 0.3,
              }}
            ></div>
            
            {/* Range label */}
            <div className="text-[#646669] text-xs mt-2">{range.range}</div>
          </div>
        ))}
      </div>
      
      {/* X-axis label */}
      <div className="text-[#646669] text-sm text-center mt-4">
        WPM
      </div>
    </div>
  );
};

export default RaceDistribution; 