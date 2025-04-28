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
  // For "random" topic, skip API call and use fallback directly
  if (topic.toLowerCase() === "random") {
    const randomTopics = ["programming", "science", "history", "literature", "sports", "technology", "music", "art"];
    const randomTopic = randomTopics[Math.floor(Math.random() * randomTopics.length)];
    return getTopicFallbackText(randomTopic);
  }

  try {
    const response = await fetch("http://localhost:5001/api/openai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ topic }),
    });

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error generating text by topic:", error);
    return getTopicFallbackText(topic);
  }
}

// Helper function to get fallback text for a topic
function getTopicFallbackText(topic: string): string {
  // Topic-specific fallback texts
  const fallbackTexts: { [key: string]: string[] } = {
    programming: [
      "JavaScript is a versatile programming language used for web development. Functions are first-class citizens in JavaScript, allowing them to be passed as arguments to other functions.",
      "Python is known for its readability and simplicity. List comprehensions provide a concise way to create lists based on existing lists.",
      "Object-oriented programming is a paradigm based on the concept of objects, which can contain data and code. Inheritance allows classes to inherit attributes and methods from other classes.",
    ],
    science: [
      "The scientific method is a systematic approach to understanding the natural world. It involves making observations, formulating hypotheses, conducting experiments, and drawing conclusions.",
      "Quantum mechanics is a fundamental theory in physics that describes nature at the smallest scales of energy levels of atoms and subatomic particles.",
      "The human genome contains approximately 3 billion base pairs of DNA. Genes are segments of DNA that contain instructions for building proteins.",
    ],
    history: [
      "The Renaissance was a period of European cultural, artistic, political, and scientific rebirth following the Middle Ages. It began in Florence, Italy in the 14th century.",
      "World War II was a global conflict that lasted from 1939 to 1945. It involved the majority of the world's nations forming two opposing military alliances: the Allies and the Axis.",
      "The Industrial Revolution was a period of major industrialization and innovation during the late 1700s and early 1800s. The transition included going from hand production methods to machines.",
    ],
    literature: [
      "Shakespeare wrote approximately 37 plays and 154 sonnets. His works explore themes such as life, love, death, revenge, grief, jealousy, and ambition.",
      "The novel as a literary form emerged in the early 18th century. It is characterized by its length, narrative structure, and focus on character development.",
      "Magical realism is a style of fiction that paints a realistic view of the world while also adding magical elements. It is often associated with Latin American literature.",
    ],
    sports: [
      "The Olympic Games are an international sports festival that began in ancient Greece. The modern Olympic Games were revived in the late 19th century.",
      "Soccer, also known as football in many countries, is the world's most popular sport. The FIFA World Cup is held every four years and is the most prestigious soccer tournament.",
      "Basketball was invented by Dr. James Naismith in 1891. The game is played by two teams of five players on a rectangular court.",
    ],
    technology: [
      "Artificial intelligence refers to the simulation of human intelligence in machines that are programmed to think like humans and mimic their actions.",
      "Blockchain is a decentralized, distributed ledger technology that records transactions across many computers. It ensures that records cannot be altered retroactively.",
      "Cloud computing is the delivery of computing services over the internet, including servers, storage, databases, networking, software, and analytics.",
    ],
    music: [
      "Classical music is art music produced or rooted in the traditions of Western culture. It encompasses a broad period from roughly the 11th century to the present day.",
      "Jazz is a music genre that originated in the African-American communities of New Orleans in the late 19th and early 20th centuries. It is characterized by swing and blue notes.",
      "Rock music is a broad genre of popular music that originated as rock and roll in the United States in the early 1950s. It is characterized by a strong beat and often played on electric guitars.",
    ],
    art: [
      "Impressionism is a 19th-century art movement characterized by small, thin, yet visible brush strokes, open composition, emphasis on light, and ordinary subject matter.",
      "Cubism is an early 20th-century art movement that revolutionized European painting and sculpture. It was pioneered by Pablo Picasso and Georges Braque.",
      "Abstract expressionism is a post-World War II art movement in American painting, developed in New York in the 1940s. It was the first specifically American movement to achieve international influence.",
    ],
  };

  // Get fallback texts for the specified topic, or use a default if not found
  const topicTexts = fallbackTexts[topic.toLowerCase()] || [
    "Error generating text! Fallback text"
  ];

  // Return a random text from the available options for this topic
  return topicTexts[Math.floor(Math.random() * topicTexts.length)];
}
