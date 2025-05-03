import React, { useState } from "react";
import { FaHistory, FaChevronUp, FaChevronDown } from "react-icons/fa";
import changelog, { ChangelogEntry } from "../data/changelog";

const Changelog: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="absolute bottom-4 left-4 z-20">
      <div className="bg-[#2c2e31] text-[#d1d0c5] rounded-lg shadow-lg overflow-hidden transition-all duration-300"
        style={{ 
          width: isExpanded ? '320px' : '220px',
          maxWidth: '90vw'
        }}
      >
        {/* Header with toggle */}
        <div 
          className="flex items-center justify-between p-3 cursor-pointer hover:bg-[#323437] transition-colors"
          onClick={toggleExpanded}
        >
          <div className="flex items-center">
            <FaHistory className="mr-2 text-[#e2b714]" />
            <h3 className="font-medium">Changelog</h3>
            <span className="ml-2 text-xs bg-[#e2b714] text-black px-1.5 py-0.5 rounded">
              {changelog[0].version}
            </span>
          </div>
          <div>
            {isExpanded ? (
              <FaChevronDown className="text-[#a1a1a1]" />
            ) : (
              <FaChevronUp className="text-[#a1a1a1]" />
            )}
          </div>
        </div>

        {/* Expanded changelog content */}
        {isExpanded && (
          <div className="max-h-80 overflow-y-auto p-4 border-t border-[#3c3e41]">
            {changelog.map((entry: ChangelogEntry, index: number) => (
              <div key={entry.version} className={index > 0 ? "mt-6" : ""}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-[#e2b714]">
                    v{entry.version}
                  </h4>
                  <span className="text-xs text-[#a1a1a1]">{entry.date}</span>
                </div>
                <ul className="space-y-2">
                  {entry.changes.map((change: string, changeIndex: number) => (
                    <li key={changeIndex} className="flex items-center">
                      <span className="text-[#e2b714] mr-2 mt-0.5 flex-shrink-0">•</span>
                      <span className="text-xs">{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Changelog; 