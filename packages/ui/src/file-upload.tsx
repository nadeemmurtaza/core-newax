import { useId, useState, type DragEvent } from 'react';
import { cn } from './cn';

export interface FileUploadProps {
  readonly label: string;
  readonly accept?: string;
  readonly multiple?: boolean;
  readonly onFilesSelected: (files: FileList) => void;
  readonly className?: string;
}

/** Drag-and-drop over a native file input, not a replacement for it --
 * the input stays present and reachable (keyboard/screen reader), the
 * drop zone is a convenience layered on top. */
export function FileUpload({
  label,
  accept,
  multiple = false,
  onFilesSelected,
  className,
}: FileUploadProps) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length > 0) {
      onFilesSelected(event.dataTransfer.files);
    }
  };

  return (
    <div
      className={cn('nx-file-upload', dragging && 'nx-file-upload-dragging', className)}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <label htmlFor={inputId} className="nx-file-upload-label">
        {label}
      </label>
      <input
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        className="nx-file-upload-input"
        onChange={(event) => {
          if (event.target.files && event.target.files.length > 0) {
            onFilesSelected(event.target.files);
          }
        }}
      />
    </div>
  );
}
