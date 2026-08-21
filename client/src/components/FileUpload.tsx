import { Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useCallback } from "react";

interface FileUploadProps {
  onFileUpload?: (file: File) => void | Promise<void>;
}

export default function FileUpload({ onFileUpload }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback((file: File) => {
    setSelectedFile(file);
    void onFileUpload?.(file);
  }, [onFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  return (
    <div className="w-full">
      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-md p-10 text-center transition-colors ${
            isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          }`}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-medium text-foreground mb-1">Upload obstacle list</h3>
              <p className="text-sm text-muted-foreground mb-2">Drag and drop, or browse for a file.</p>
              <p className="text-xs text-muted-foreground">CSV and TXT are supported.</p>
            </div>
            <label htmlFor="file-upload">
              <Button variant="outline" asChild>
                <span className="cursor-pointer">Browse Files</span>
              </Button>
            </label>
            <input
              id="file-upload"
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        </div>
      ) : (
        <div className="border border-border rounded-md p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB · submitted for analysis</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSelectedFile(null)} aria-label="Clear selected file">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
