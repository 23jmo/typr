/**
 * Utility functions for WPM (Words Per Minute) calculations
 */

/**
 * Calculate WPM based on correct characters only
 * Formula: (correct characters / 5) / minutes
 * 
 * @param correctChars Number of correctly typed characters
 * @param timeInMilliseconds Time elapsed in milliseconds
 * @returns Calculated WPM (Words Per Minute)
 */
export const calculateWpm = (correctChars: number, timeInMilliseconds: number): number => {
  // Ensure time is positive
  const safeTimeInMs = Math.max(timeInMilliseconds, 1);
  
  // Convert milliseconds to minutes
  const timeInMinutes = safeTimeInMs / 1000 / 60;
  
  // Calculate words (1 word = 5 characters)
  const words = correctChars / 5;
  
  // Calculate WPM
  const wpm = Math.round(words / timeInMinutes) || 0;
  
  return wpm;
};

/**
 * Calculate raw WPM based on all characters typed
 * This is the legacy calculation that doesn't account for accuracy
 * 
 * @param totalChars Total number of characters typed (correct or incorrect)
 * @param timeInMilliseconds Time elapsed in milliseconds
 * @returns Calculated raw WPM
 */
export const calculateRawWpm = (totalChars: number, timeInMilliseconds: number): number => {
  // Ensure time is positive
  const safeTimeInMs = Math.max(timeInMilliseconds, 1);
  
  // Convert milliseconds to minutes
  const timeInMinutes = safeTimeInMs / 1000 / 60;
  
  // Calculate words (1 word = 5 characters)
  const words = totalChars / 5;
  
  // Calculate WPM
  const wpm = Math.round(words / timeInMinutes) || 0;
  
  return wpm;
}; 