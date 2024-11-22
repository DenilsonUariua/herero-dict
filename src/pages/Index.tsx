import { useState } from "react";
import { SearchBar } from "@/components/SearchBar";
import { WordCard } from "@/components/WordCard";

// Mock data - replace with actual dictionary data
const mockWord = {
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
};

const Index = () => {
  const [searchTerm, setSearchTerm] = useState("");

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
      
      <WordCard {...mockWord} />
    </div>
  );
};

export default Index;