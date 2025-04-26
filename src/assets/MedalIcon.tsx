import React from 'react';
import { FaMedal, FaCrown, FaTrophy } from 'react-icons/fa';

interface MedalIconProps {
  position: number;
  size?: number;
  className?: string;
}

const MedalIcon: React.FC<MedalIconProps> = ({ position, size = 24, className = "" }) => {
  // Gold, Silver, Bronze for top 3, then numbers
  if (position === 1) {
    return <FaCrown size={size} className={`text-yellow-400 ${className}`} />;
  } else if (position === 2) {
    return <FaMedal size={size} className={`text-gray-300 ${className}`} />;
  } else if (position === 3) {
    return <FaMedal size={size} className={`text-yellow-700 ${className}`} />;
  } else {
    // For positions beyond 3, return a number
    return <span className={`font-bold text-[#646669] ${className}`}>{position}</span>;
  }
};

export default MedalIcon; 