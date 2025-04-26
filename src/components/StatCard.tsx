import React, { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
  additionalInfo?: string;
  icon: ReactNode;
}

/**
 * Displays a single statistic card with title, value, and optional change indicator
 * Responsive design for different screen sizes
 */
const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  isPositive = true,
  additionalInfo,
  icon,
}) => {
  return (
    <div className="bg-[#2c2e31] rounded-lg p-3 sm:p-4 md:p-6 flex flex-col">
      <div className="flex justify-between items-start mb-2 sm:mb-4">
        <span className="text-[#646669] text-sm sm:text-base">{title}</span>
        <span className="text-[#646669]">{icon}</span>
      </div>
      <div className="text-2xl sm:text-3xl md:text-4xl text-[#d1d0c5] font-bold">{value}</div>
      
      {change && (
        <div className={`${isPositive ? 'text-[#4ade80]' : 'text-[#ef4444]'} mt-1 text-xs sm:text-sm`}>
          {change}
        </div>
      )}
      
      {additionalInfo && !change && (
        <div className="text-[#646669] mt-1 text-xs sm:text-sm">{additionalInfo}</div>
      )}
    </div>
  );
};

export default StatCard; 