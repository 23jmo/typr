export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

// Most recent entries should be at the top
const changelog: ChangelogEntry[] = [
  {
    version: "1.0.1",
    date: "May 2nd 2025",
    changes: [
      "Fixed bug in solo mode where WPM would skyrocket after a completed run",
      "Added timer in race room to end games, displayed in playerList (30s for ranked, customizable in customs)",
      "Increased window for matchmaking from 100 ELO to 500 ELO"
    ]
  },
  {
    version: "1.0.0",
    date: "May 1st 2025",
    changes: [
      "Release"
    ]
  }
];

export default changelog; 