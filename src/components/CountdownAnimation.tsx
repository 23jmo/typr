import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CountdownAnimationProps {
  count: number | null;
}

const CountdownAnimation: React.FC<CountdownAnimationProps> = ({ count }) => {
  const [displayCount, setDisplayCount] = useState<number | null>(count);
  const [showGo, setShowGo] = useState(false);

  // Update the displayed count whenever the actual count changes
  useEffect(() => {
    setDisplayCount(count);
    
    // Show "GO!" message when countdown reaches 0
    if (count === 0) {
      setShowGo(true);
      // Hide "GO!" message after 1 second
      const timer = setTimeout(() => {
        setShowGo(false);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setShowGo(false);
    }
  }, [count]);

  return (
    <div className="relative w-48 h-32 flex items-center justify-center">
      <AnimatePresence mode="popLayout">
        {displayCount !== null && displayCount > 0 && (
          <motion.div
            key={displayCount}
            initial={{ y: 50, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -50, opacity: 0, scale: 0.8 }}
            transition={{ 
              type: "spring", 
              stiffness: 300, 
              damping: 20,
              duration: 0.5 
            }}
            className="absolute text-center"
          >
            <motion.span 
              className="text-8xl font-bold text-white drop-shadow-lg inline-block"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ 
                duration: 1,
                repeat: Infinity,
                repeatType: "loop"
              }}
            >
              {displayCount}
            </motion.span>
          </motion.div>
        )}

        {showGo && (
          <motion.div
            key="go"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            exit={{ scale: 2, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute text-center z-50"
            style={{ pointerEvents: 'none' }}
          >
            <span className="text-8xl font-bold text-white drop-shadow-lg whitespace-nowrap">GO!</span>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Add subtle glow effect */}
      <div className="absolute inset-0 bg-gradient-radial from-white/5 to-transparent opacity-50 pointer-events-none mix-blend-overlay" />
    </div>
  );
};

export default CountdownAnimation; 