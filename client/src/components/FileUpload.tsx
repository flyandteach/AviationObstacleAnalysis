import { Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useCallback } from "react";

interface FileUploadProps {
  onFileUpload?: (file: File) => void;
}

export default function FileUpload({ onFileUpload }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setSelectedFile(files[0]);
      onFileUpload?.(files[0]);
    }
  }, [onFileUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      onFileUpload?.(files[0]);
    }
  }, [onFileUpload]);

  const handleClear = useCallback(() => {
    setSelectedFile(null);
  }, []);

  return (
    <div className="w-full">
      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-md p-12 text-center transition-colors
            ${isDragging 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50'
            }
          `}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-medium text-foreground mb-1">
                Upload Obstacle List
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Drag and drop your file here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                Supports CSV, XLS, XLSX formats
              </p>
            </div>
            <label htmlFor="file-upload">
              <Button variant="outline" asChild data-testid="button-browse-file">
                <span className="cursor-pointer">
                  Browse Files
                </span>
              </Button>
            </label>
            <input
              id="file-upload"
              type="file"
              accept=".csv,.xls,.xlsx"
              className="hidden"
              onChange={handleFileSelect}
              data-testid="input-file-upload"
            />
          </div>
        </div>
      ) : (
        <div className="border border-border rounded-md p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground" data-testid="text-filename">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClear}
              data-testid="button-clear-file"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4 flex gap-2">
            <Button className="flex-1" data-testid="button-process-file">
              Process File
            </Button>
            <Button variant="outline" onClick={handleClear} data-testid="button-cancel">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
