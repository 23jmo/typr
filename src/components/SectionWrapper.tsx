import React, { ReactNode } from "react";

interface SectionWrapperProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Wrapper component for sections that provides consistent styling for titles and content
 * Responsive padding for different screen sizes
 */
const SectionWrapper: React.FC<SectionWrapperProps> = ({
  title,
  subtitle,
  children,
  className = "",
}) => {
  return (
    <div className={`bg-[#2c2e31] rounded-lg p-3 sm:p-4 md:p-6 ${className}`}>
      <h2 className="text-lg sm:text-xl font-bold text-[#d1d0c5] mb-1 sm:mb-2">{title}</h2>
      {subtitle && <p className="text-[#646669] text-xs sm:text-sm mb-3 sm:mb-4 md:mb-6">{subtitle}</p>}
      {children}
    </div>
  );
};

export default SectionWrapper; 