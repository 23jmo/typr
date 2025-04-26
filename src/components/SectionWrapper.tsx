import React, { ReactNode } from "react";

interface SectionWrapperProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Wrapper component for sections that provides consistent styling for titles and content
 */
const SectionWrapper: React.FC<SectionWrapperProps> = ({
  title,
  subtitle,
  children,
  className = "",
}) => {
  return (
    <div className={`bg-[#2c2e31] rounded-lg p-6 ${className}`}>
      <h2 className="text-xl font-bold text-[#d1d0c5] mb-2">{title}</h2>
      {subtitle && <p className="text-[#646669] text-sm mb-6">{subtitle}</p>}
      {children}
    </div>
  );
};

export default SectionWrapper; 