import { useState } from "react";
import { SearchBar } from "@/components/SearchBar";
import { WordCard } from "@/components/WordCard";
import useFetchWords from "@/hooks/useFetchWords";

const Index = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const {words, currentPage, totalPages, totalWords, nextPage, prevPage, goToPage, changeLimit, refresh} = useFetchWords()
  const filteredWords = words.filter((word) =>
    word.definitions.some((definition) => definition.definition.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen p-6 space-y-6">
      <header className="text-center space-y-4 mb-8">
        <h1 className="text-4xl font-bold text-foreground">
          Otjherero Dictionary
        </h1>
        <p className="text-muted-foreground">
          Discover the beauty of the Otjiherero language
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

      <div className="flex items-center justify-center gap-4">
          <button
            onClick={prevPage}
            disabled={currentPage === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Previous
          </button>

          <span className="flex items-center gap-1">
            Page 
            <select 
              value={currentPage}
              onChange={(e) => goToPage(Number(e.target.value))}
              className="border rounded p-1"
            >
              {[...Array(totalPages)].map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
            of {totalPages}
          </span>

          <button
            onClick={nextPage}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
    </div>
  );
};

export default Index;