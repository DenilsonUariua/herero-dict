import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface SearchBarProps {
  onSearch: (term: string) => void;
  searchTerm: string;
}

const DEBOUNCE_MS = 300;

export const SearchBar = ({ onSearch, searchTerm }: SearchBarProps) => {
  const [value, setValue] = useState(searchTerm);
  const timer = useRef<number | null>(null);

  // keep the field in sync when the parent resets the search
  useEffect(() => {
    setValue((prev) => (prev === searchTerm ? prev : searchTerm));
  }, [searchTerm]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const schedule = (next: string) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onSearch(next), DEBOUNCE_MS);
  };

  const handleChange = (next: string) => {
    setValue(next);
    schedule(next);
  };

  const handleClear = () => {
    setValue('');
    if (timer.current) window.clearTimeout(timer.current);
    onSearch('');
  };

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        className="bg-card pl-10 pr-10 text-base"
        placeholder="Search English or Otjiherero…"
        aria-label="Search the dictionary"
        enterKeyHint="search"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            if (timer.current) window.clearTimeout(timer.current);
            onSearch(value);
          }
        }}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
