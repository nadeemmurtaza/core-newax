import { useState } from 'react';
import { cn } from './cn';
import { Button, type ButtonProps } from './button';

export interface CopyButtonProps extends Omit<ButtonProps, 'onClick'> {
  readonly value: string;
  readonly copiedLabel?: string;
}

/** Guards against clipboard access being unavailable (insecure context,
 * permission denied, older browser) instead of throwing on click. */
export function CopyButton({
  value,
  copiedLabel = 'Copied',
  children,
  className,
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Button {...props} className={cn(className)} onClick={handleClick}>
      {copied ? copiedLabel : children}
    </Button>
  );
}
