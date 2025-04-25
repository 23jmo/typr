import React from 'react';
import { getMedalIcon, RankKey } from '../types/ranks';

interface RankIconProps {
  rankKey: RankKey;
  size?: number;
  className?: string;
}

/**
 * RankIcon component renders a medal icon for a specified rank
 * @param rankKey - The rank key (plastic, silver, gold, etc)
 * @param size - Optional size in pixels (default 40)
 * @param className - Optional additional className
 */
const RankIcon: React.FC<RankIconProps> = ({ rankKey, size = 40, className = '' }) => {
  return (
    <span className={`inline-block ${className}`}>
      {getMedalIcon(rankKey, size)}
    </span>
  );
};

export default RankIcon; 