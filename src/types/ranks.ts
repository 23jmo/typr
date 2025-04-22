export const rankedIcons = {
  plastic: {
    name: "Plastic",
    icon: "🔵",
    minElo: 0,
    maxElo: 799,
  },
  silver: {
    name: "Silver",
    icon: "⚪",
    minElo: 800,
    maxElo: 1199,
  },
  gold: {
    name: "Gold",
    icon: "🟡",
    minElo: 1200,
    maxElo: 1499,
  },
  platinum: {
    name: "Platinum",
    icon: "💠",
    minElo: 1500,
    maxElo: 1799,
  },
  diamond: {
    name: "Diamond",
    icon: "💎",
    minElo: 1800,
    maxElo: 2199,
  },
  cherryMX: {
    name: "Cherry MX",
    icon: "🎯",
    minElo: 2000,
    maxElo: Infinity,
  },
};

// Create type for the keys of the rankedIcons object
export type RankKey = keyof typeof rankedIcons;
