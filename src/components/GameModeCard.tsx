import React, { useState, useEffect } from "react";
import { IconType } from "react-icons";

interface GameModeCardProps {
  title: string;
  description: string;
  icon: IconType;
  onClick: () => void;
  color: string;
}

// Add the keyframes style to the document head once
const addStyleOnce = () => {
  if (!document.getElementById('game-mode-card-animations')) {
    const style = document.createElement('style');
    style.id = 'game-mode-card-animations';
    style.innerHTML = `
      @keyframes slideBackground {
        0% { background-position: 0px 0px; }
        100% { background-position: 1000px 0px; }
      }
    `;
    document.head.appendChild(style);
  }
};

const GameModeCard: React.FC<GameModeCardProps> = ({
  title,
  description,
  icon: Icon,
  onClick,
  color,
}) => {
  const baseColor = color.replace('text-', '').replace('500', '') as 'blue' | 'yellow' | 'green';
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Handle window resize and check if it's mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    // Initial check
    checkIfMobile();
    
    // Add event listener
    window.addEventListener('resize', checkIfMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);
  
  // Add the keyframes style on component mount
  useEffect(() => {
    addStyleOnce();
  }, []);
  
  return (
    <div
      className={`flex flex-col items-center cursor-pointer 
        overflow-hidden transition-all duration-300
        ${isHovered ? 'shadow-lg' : ''}
        bg-[#2a2a2a] hover:bg-[#333333]
        z-0 ${isHovered ? 'z-10' : ''}
        h-full`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: isHovered ? (isMobile ? '100%' : '36%') : (isMobile ? '100%' : '33.33%'),
        transition: "all 0.3s ease-in-out",
      }}
    >
      {/* Main banner area with icon and title */}
      <div 
        className={`w-full h-full flex flex-col justify-center items-center bg-gradient-to-b from-${baseColor}-900 to-${baseColor}-700 relative overflow-hidden py-8`}
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div 
            className="absolute w-full h-full" 
            style={{
              backgroundImage: "url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJ3aGl0ZSIgZmlsbC1ydWxlPSJldmVub2RkIj48Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMiIvPjwvZz48L3N2Zz4=')",
              backgroundSize: "60px 60px",
              animation: isHovered ? "slideBackground 8s linear infinite" : "none"
            }}
          />
        </div>
        
        {/* Content container - centers elements vertically */}
        <div className="flex flex-col items-center justify-center z-10 py-8">
          {/* Main icon */}
          <div className={`text-6xl md:text-8xl lg:text-9xl text-white transition-transform duration-300 ${isHovered ? 'scale-110' : 'scale-100'} mb-8`}>
            <Icon />
          </div>
          
          {/* Title - now below the icon */}
          <h3 className="text-xl md:text-2xl lg:text-3xl font-bold text-white text-center mb-4 transition-transform duration-300">
            {title}
          </h3>
          
          {/* Description - only visible on hover */}
          <div 
            className={`mt-2 px-4 md:px-6 py-2 text-center transition-all duration-300 max-w-md
              ${isHovered ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-4'}`}
          >
            <p className="text-white text-sm md:text-xl">{description}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameModeCard; 