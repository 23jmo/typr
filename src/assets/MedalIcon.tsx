import React from 'react';

interface MedalIconProps {
  primaryColor: string;
  secondaryColor: string;
  ribbonColor: string;
  size?: number;
  className?: string;
}

const MedalIcon: React.FC<MedalIconProps> = ({
  primaryColor,
  secondaryColor,
  ribbonColor,
  size = 40,
  className = '',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Ribbon */}
      <path
        d="M7.5 13.5V20L12 17L16.5 20V13.5"
        fill={ribbonColor}
        stroke={secondaryColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Medal body */}
      <circle
        cx="12"
        cy="8"
        r="7"
        fill={primaryColor}
        stroke={secondaryColor}
        strokeWidth="1.5"
      />
      
      {/* Inner circle */}
      <circle
        cx="12"
        cy="8"
        r="4"
        fill={secondaryColor}
        stroke={secondaryColor}
        strokeWidth="0.5"
      />
      
      {/* Star */}
      <path
        d="M12 5.5L12.9 7.3L14.9 7.6L13.5 9L13.8 11L12 10L10.2 11L10.5 9L9.1 7.6L11.1 7.3L12 5.5Z"
        fill={primaryColor}
        stroke={primaryColor}
        strokeWidth="0.3"
      />
    </svg>
  );
};

export default MedalIcon; 