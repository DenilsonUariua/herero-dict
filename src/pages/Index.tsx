import { useState } from "react";
import { SearchBar } from "@/components/SearchBar";
import { WordCard } from "@/components/WordCard";
import {mockWords} from '../mock-data/words'

// Mock data - replace with actual dictionary data


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
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl mx-auto">
        {filteredWords.map((word, index) => (
          <WordCard key={index} {...word} />
        ))}
        {filteredWords.length === 0 && (
          <p className="text-center text-muted-foreground col-span-full">
            No words found matching &quot;{searchTerm}&quot;
          </p>
        )}
      </div>
    </div>
  );
};

export default Index;