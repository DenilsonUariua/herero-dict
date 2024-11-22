import { useState } from "react";
import { SearchBar } from "@/components/SearchBar";
import { WordCard } from "@/components/WordCard";

// Mock data - replace with actual dictionary data
const mockWords = [
  {
    word: "Ombura",
    pronunciation: "om-BU-ra",
    definitions: [
      {
        type: "noun",
        definition: "Rain; rainfall",
        example: "Ombura mai roko - The rain is coming",
      },
      {
        type: "cultural",
        definition: "Symbol of blessing and prosperity in Herero culture",
      },
    ],
  },
  {
    word: "Omeva",
    pronunciation: "o-ME-va",
    definitions: [
      {
        type: "noun",
        definition: "Water",
        example: "Omeva omanengu - Clean water",
      },
    ],
  },
  {
    word: "Ondji",
    pronunciation: "ON-dji",
    definitions: [
      {
        type: "noun",
        definition: "House; home",
        example: "Ondji yandje - My house",
      },
    ],
  },
  {
    word: "Omuti",
    pronunciation: "o-MU-ti",
    definitions: [
      {
        type: "noun",
        definition: "Tree",
        example: "Omuti omunene - Big tree",
      },
    ],
  },
  {
    word: "Ongombe",
    pronunciation: "on-GOM-be",
    definitions: [
      {
        type: "noun",
        definition: "Cattle; cow",
        example: "Ongombe zetu - Our cattle",
      },
      {
        type: "cultural",
        definition: "Symbol of wealth and status in Herero culture",
      },
    ],
  },
];

const Index = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredWords = mockWords.filter((word) =>
    word.word.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen p-6 space-y-6">
      <header className="text-center space-y-4 mb-8">
        <h1 className="text-4xl font-bold text-foreground">
          Herero Dictionary
        </h1>
        <p className="text-muted-foreground">
          Discover the beauty of the Herero language
        </p>
      </header>

      <SearchBar onSearch={setSearchTerm} />
      
      <div className="space-y-6">
        {filteredWords.map((word, index) => (
          <WordCard key={index} {...word} />
        ))}
        {filteredWords.length === 0 && (
          <p className="text-center text-muted-foreground">
            No words found matching &quot;{searchTerm}&quot;
          </p>
        )}
      </div>
    </div>
  );
};

export default Index;