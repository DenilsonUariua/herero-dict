import { SearchBar } from "@/components/SearchBar";
import { WordCard } from "@/components/WordCard";
import useFetchWords from "@/hooks/useFetchWords";
import CountUp from 'react-countup';

const Index = () => {
  // const [searchTerm, setSearchTerm] = useState("");
  const {
    words,
    currentPage,
    totalPages,
    totalWords,
    loading,
    nextPage,
    prevPage,
    goToPage,
    changeLimit,
    refresh,
    handleSearch,
    searchTerm,
  } = useFetchWords();

  const showMessage = () => {
    if (words.length === 0 && !loading) {
      return (
        <p className="text-center text-muted-foreground col-span-full">
          No words found matching &quot;{searchTerm}&quot;
        </p>
      );
    }
    if (loading && words.length === 0) {
      return (
        <p className="text-center text-muted-foreground col-span-full">
          Loading...
        </p>
      );
    }
  };

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

      <SearchBar onSearch={handleSearch} searchTerm={searchTerm} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl mx-auto">
        {words.map((word, index) => (
          <WordCard key={index} {...word} refresh={refresh}/>
        ))}
        {showMessage()}
      </div>

      {words.length > 0 && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={prevPage}
            disabled={currentPage === 1}
            className="bg-stone-500 text-white px-3 py-1 border rounded disabled:opacity-50 hover:scale-105 hover:bg-stone-700 transition-colors duration-300 disabled:pointer-events-none hover:text-white"
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
            className="bg-stone-500 text-white px-3 py-1 border rounded disabled:opacity-50 hover:scale-105 hover:bg-stone-700 transition-colors duration-300 disabled:pointer-events-none hover:text-white"
          >
            Next
          </button>
        </div>
      )}
      <div className="flex items-center justify-center gap-4 flex-row">
        <p className="text-2xl font-extrabold">Total Words:</p>
        <CountUp className="text-2xl font-extrabold" start={0} end={totalWords} separator="," duration={5} />
      </div>
      <footer className="flex items-center justify-center fixed bottom-1 font-thin right-4">
        <p className="text-xs">Developed by <a className="underline" href="https://github.com/DenilsonUariua" target="_blank">Tjarirove</a></p>
      </footer>
    </div>
  );
};

export default Index;
