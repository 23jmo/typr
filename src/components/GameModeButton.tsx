import React from "react";

interface GameModeButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

const GameModeButton = ({
  onClick,
  children,
  className,
}: GameModeButtonProps) => {
  return (
    <div>
      <button
        onClick={onClick}
        className={`${className} bg-yellow-600 text-white w-lg w-min-md p-4 m-2 rounded-md hover:bg-yellow-600/90 transition-colors`}
      >
        {children}
      </button>
    </div>
  );
};

export default GameModeButton;
