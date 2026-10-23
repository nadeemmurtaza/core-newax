import { cn } from './cn';
import { ProgressBar } from './progress-bar';

export interface UploadProgressProps {
  readonly fileName: string;
  readonly progress: number;
  readonly status: 'uploading' | 'done' | 'error';
  readonly errorMessage?: string;
  readonly className?: string;
}

export function UploadProgress({
  fileName,
  progress,
  status,
  errorMessage,
  className,
}: UploadProgressProps) {
  return (
    <div className={cn('nx-upload-progress', className)}>
      <p className="nx-upload-progress-name">{fileName}</p>
      {status === 'uploading' ? (
        <ProgressBar value={progress} label={`Uploading ${fileName}`} />
      ) : status === 'error' ? (
        <p role="alert" className="nx-upload-progress-error">
          {errorMessage ?? 'Upload failed.'}
        </p>
      ) : (
        <p className="nx-upload-progress-done">Done</p>
      )}
    </div>
  );
}
