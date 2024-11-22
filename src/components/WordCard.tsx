import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface WordDefinition {
  type: string;
  definition: string;
  example?: string;
}

interface WordCardProps {
  word: string;
  pronunciation: string;
  definitions: WordDefinition[];
}

export const WordCard = ({ word, pronunciation, definitions }: WordCardProps) => {
  return (
    <Card className="dictionary-card w-full max-w-xl mx-auto mt-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="text-2xl font-bold">{word}</span>
          <span className="text-sm text-muted-foreground">{pronunciation}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {definitions.map((def, index) => (
          <div key={index} className="space-y-2">
            <Badge variant="secondary" className="mb-2">
              {def.type}
            </Badge>
            <p className="text-foreground">{def.definition}</p>
            {def.example && (
              <p className="text-muted-foreground text-sm italic">
                &quot;{def.example}&quot;
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};