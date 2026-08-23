import { ClipboardPaste, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState, useCallback } from "react";

interface TextInputProps {
  onTextSubmit?: (text: string) => void;
}

export default function TextInput({ onTextSubmit }: TextInputProps) {
  const [text, setText] = useState("");

  const handleClear = useCallback(() => {
    setText("");
  }, []);

  const handleAnalyze = useCallback(() => {
    if (text.trim()) {
      onTextSubmit?.(text);
    }
  }, [text, onTextSubmit]);

  return (
    <div className="w-full space-y-4">
      <div className="relative">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Paste obstacle data here. Supported coordinate formats include decimal degrees and DMS.\n\nExamples:\nObstacleID,Latitude,Longitude,Height,Type\nOBS-001,47.4502,-122.3088,485,Tower\nOBS-002 47° 27' 00.72\" N 122° 18' 31.68\" W 650 120\nOBS-003 47-27-00.72N 122-18-31.68W 650 120`}
          className="min-h-[300px] font-mono text-sm resize-y"
          data-testid="input-obstacle-data"
        />
        {text && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2"
            onClick={handleClear}
            data-testid="button-clear-text"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        Accepted coordinates: signed decimal degrees (47.4502, -122.3088), DMS with symbols,
        decimal degrees with N/S/E/W, and FAA-style hyphenated DMS. Header rows are ignored.
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ClipboardPaste className="w-4 h-4" />
          <span>{text.split("\n").filter(line => line.trim()).length} lines</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleClear}
            disabled={!text}
            data-testid="button-clear"
          >
            Clear
          </Button>
          <Button
            onClick={handleAnalyze}
            disabled={!text.trim()}
            data-testid="button-analyze"
          >
            Analyze Data
          </Button>
        </div>
      </div>
    </div>
  );
}
