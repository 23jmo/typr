// Hardcoded common English words
const words = [
  "the",
  "be",
  "to",
  "of",
  "and",
  "a",
  "in",
  "that",
  "have",
  "I",
  "it",
  "for",
  "not",
  "on",
  "with",
  "he",
  "as",
  "you",
  "do",
  "at",
  "this",
  "but",
  "his",
  "by",
  "from",
  "they",
  "we",
  "say",
  "her",
  "she",
  "or",
  "an",
  "will",
  "my",
  "one",
  "all",
  "would",
  "there",
  "their",
  "what",
  "so",
  "up",
  "out",
  "if",
  "about",
  "who",
  "get",
  "which",
  "go",
  "me",
  "when",
  "make",
  "can",
  "like",
  "time",
  "no",
  "just",
  "him",
  "know",
  "take",
  "people",
  "into",
  "year",
  "your",
  "good",
  "some",
  "could",
  "them",
  "see",
  "other",
  "than",
  "then",
  "now",
  "look",
  "only",
  "come",
  "its",
  "over",
  "think",
  "also",
  "back",
  "after",
  "use",
  "two",
  "how",
  "our",
  "work",
  "first",
  "well",
  "way",
  "even",
  "new",
  "want",
  "because",
  "any",
  "these",
  "give",
  "day",
  "most",
  "us",
];

// Generate random text with specified word count
export function generateRandomText(wordCount: number = 30): string {
  const selectedWords: string[] = [];

  for (let i = 0; i < wordCount; i++) {
    const randomIndex = Math.floor(Math.random() * words.length);
    selectedWords.push(words[randomIndex]);
  }

  let text = selectedWords.join(" ");
  text = text.charAt(0).toUpperCase() + text.slice(1);

  if (!text.endsWith(".")) {
    text += ".";
  }

  return text;
}

// Generate text with specific difficulty level
export function generateTextByDifficulty(
  difficulty: "easy" | "medium" | "hard",
  wordCount: number = 30
): string {
  // Filter words based on difficulty
  const filteredWords = words.filter((word) => {
    switch (difficulty) {
      case "easy":
        return word.length <= 5;
      case "medium":
        return word.length > 5 && word.length <= 8;
      case "hard":
        return word.length > 8;
      default:
        return true;
    }
  });

  const selectedWords: string[] = [];

  for (let i = 0; i < wordCount; i++) {
    const randomIndex = Math.floor(Math.random() * filteredWords.length);
    selectedWords.push(filteredWords[randomIndex]);
  }

  let text = selectedWords.join(" ");
  text = text.charAt(0).toUpperCase() + text.slice(1);

  if (!text.endsWith(".")) {
    text += ".";
  }

  return text;
}

// Generate text with specific topic
export async function generateTextByTopic(topic: string): Promise<string> {
  try {
    const response = await fetch("http://localhost:5001/api/openai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ topic }),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error generating text by topic:", error);
    // TODO: just generate random text for now - but i still wanna log the error
    return generateRandomText();
  }
}
