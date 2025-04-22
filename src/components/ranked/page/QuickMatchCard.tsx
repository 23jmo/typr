import React from "react";
import { FaClock, FaUsers, FaBolt, FaChevronRight } from "react-icons/fa";

// Component props definition
interface QuickMatchCardProps {
  onFindMatch: () => void;
  isSearching: boolean;
}

/**
 * The Quick Match card component displays match details and provides
 * the Start Typing button to initiate matchmaking
 */
const QuickMatchCard: React.FC<QuickMatchCardProps> = ({
  onFindMatch,
  isSearching,
}) => {
  return (
    <div className="bg-[#2c2e31] rounded-lg p-6 mb-6">
      <h2 className="text-2xl font-bold mb-2 text-[#d1d0c5]">Quick Match</h2>
      <p className="text-[#646669] mb-6">
        Find a ranked match and start typing
      </p>

      {/* Match details */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Time */}
        <div className="text-center">
          <div className="flex justify-center mb-2">
            <div className="w-12 h-12 bg-[#323437] rounded-full flex items-center justify-center">
              <FaClock className="text-[#d1d0c5] text-xl" />
            </div>
          </div>
          <div className="font-bold text-[#d1d0c5]">1 minute</div>
          <div className="text-sm text-[#646669]">Time</div>
        </div>

        {/* Format */}
        <div className="text-center">
          <div className="flex justify-center mb-2">
            <div className="w-12 h-12 bg-[#323437] rounded-full flex items-center justify-center">
              <FaUsers className="text-[#d1d0c5] text-xl" />
            </div>
          </div>
          <div className="font-bold text-[#d1d0c5]">1v1</div>
          <div className="text-sm text-[#646669]">Format</div>
        </div>

        {/* ELO */}
        <div className="text-center">
          <div className="flex justify-center mb-2">
            <div className="w-12 h-12 bg-[#323437] rounded-full flex items-center justify-center">
              <FaBolt className="text-[#d1d0c5] text-xl" />
            </div>
          </div>
          <div className="font-bold text-[#d1d0c5]">±10-15</div>
          <div className="text-sm text-[#646669]">ELO</div>
        </div>
      </div>

      <p className="text-[#646669] mb-6">
        Race against an opponent of similar skill for 1 minute. The player with
        the highest WPM wins.
      </p>

      {/* Start Typing Button */}
      <button
        onClick={onFindMatch}
        disabled={isSearching}
        className="w-full bg-[#323437] hover:bg-[#e2b714] text-[#d1d0c5] hover:text-[#323437] font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="mr-2">Start Typing</span>
        <FaChevronRight />
      </button>
    </div>
  );
};

export default QuickMatchCard;
