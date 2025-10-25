import { useState, useCallback, DragEvent } from 'react'
import { UploadCloud, X, File as FileIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FileUploaderProps {
  onFileSelect: (file: File | null) => void
  acceptedFormats: string
  instructionText: string
}

export function FileUploader({
  onFileSelect,
  acceptedFormats,
  instructionText,
}: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFileChange = (selectedFile: File | null) => {
    setFile(selectedFile)
    onFileSelect(selectedFile)
  }

  const onDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      handleFileChange(event.dataTransfer.files[0])
    }
  }, [])

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(true)
  }

  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
  }

  return (
    <div className="w-full">
      {file ? (
        <div className="flex items-center justify-between rounded-lg border bg-secondary p-4">
          <div className="flex items-center gap-3">
            <FileIcon className="h-6 w-6 text-primary" />
            <span className="font-medium">{file.name}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleFileChange(null)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      ) : (
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={cn(
            'flex min-h-[200px] w-full flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors',
            isDragging ? 'border-primary bg-primary/5' : 'border-border',
          )}
        >
          <label
            htmlFor="file-upload"
            className="flex cursor-pointer flex-col items-center justify-center gap-4 p-8 text-center"
          >
            <UploadCloud className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{instructionText}</p>
            <Button
              type="button"
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              Selecionar Arquivo
            </Button>
            <span className="text-xs text-muted-foreground">
              Formatos aceitos: {acceptedFormats}
            </span>
          </label>
          <input
            id="file-upload"
            type="file"
            className="hidden"
            accept={acceptedFormats}
            onChange={(e) =>
              handleFileChange(e.target.files ? e.target.files[0] : null)
            }
          />
        </div>
      )}
    </div>
  )
}
