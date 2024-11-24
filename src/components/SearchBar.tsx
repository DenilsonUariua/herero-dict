import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface SearchBarProps {
  onSearch: (term: string) => void;
  searchTerm: string;
}

export const SearchBar = ({ onSearch, searchTerm }: SearchBarProps) => {
  return (
    <div className="relative w-full max-w-xl mx-auto">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
      <Input
      value={searchTerm}
        className="pl-10 bg-card"
        placeholder="Search Herero words using English words..."
        onChange={(e) => onSearch(e.target.value)}
      />
    </div>
  );
};