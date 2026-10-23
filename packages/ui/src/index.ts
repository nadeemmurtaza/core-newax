export { cn } from './cn';
export type { ClassValue } from './cn';

// --- Phase 1: core foundations ---
export { Button, buttonClassName } from './button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './button';

export { Input, inputClassName } from './input';
export type { InputProps } from './input';

export { Card, cardClassName } from './card';

export { Label, labelClassName } from './label';

export { Textarea, textareaClassName } from './textarea';
export type { TextareaProps } from './textarea';

export { Checkbox, checkboxClassName } from './checkbox';
export type { CheckboxProps } from './checkbox';

export { Switch, switchClassName } from './switch';
export type { SwitchProps } from './switch';

export { Select, selectClassName } from './select';
export type { SelectProps } from './select';

export { Badge, badgeClassName } from './badge';
export type { BadgeProps, BadgeTone } from './badge';

export { Alert, alertClassName } from './alert';
export type { AlertProps, AlertTone } from './alert';

export { Spinner } from './spinner';
export type { SpinnerProps } from './spinner';

export { Skeleton } from './skeleton';

export { Tooltip } from './tooltip';
export type { TooltipProps } from './tooltip';

export { Dialog } from './dialog';
export type { DialogProps } from './dialog';

export { DropdownMenu } from './dropdown-menu';
export type { DropdownMenuProps, DropdownMenuItem } from './dropdown-menu';

export { FormField } from './form-field';
export type { FormFieldProps } from './form-field';

export { HelperText, FieldError } from './helper-text';

// --- Phase 2: operational interfaces ---
export { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from './table';

export { buildPaginationWindow } from './pagination-window';
export type { PaginationToken } from './pagination-window';

export { Pagination } from './pagination';
export type { PaginationProps } from './pagination';

export { Tabs } from './tabs';
export type { TabsProps, TabItem } from './tabs';

export { ToastViewport } from './toast';
export type { ToastViewportProps, ToastContent, ToastTone } from './toast';

export { DatePicker, DateRangePicker, datePickerClassName } from './date-picker';
export type { DatePickerProps, DateRangePickerProps } from './date-picker';

export { FileUpload } from './file-upload';
export type { FileUploadProps } from './file-upload';

export { EmptyState } from './empty-state';
export type { EmptyStateProps } from './empty-state';

export { ErrorState } from './error-state';
export type { ErrorStateProps } from './error-state';

export { ConfirmationDialog } from './confirmation-dialog';
export type { ConfirmationDialogProps } from './confirmation-dialog';

export { RetryPanel } from './retry-panel';
export type { RetryPanelProps } from './retry-panel';

export { ProgressBar } from './progress-bar';
export type { ProgressBarProps } from './progress-bar';

export { UploadProgress } from './upload-progress';
export type { UploadProgressProps } from './upload-progress';

export { ConnectionStatus } from './connection-status';
export type { ConnectionStatusProps, ConnectionState } from './connection-status';

// --- Phase 3: shared platform experiences ---
export {
  CookieConsentBanner,
  LegalNotice,
  PolicyUpdateBanner,
  ConsentPreferenceDialog,
  ConsentStatus,
} from './consent';
export type {
  CookieConsentBannerProps,
  LegalNoticeProps,
  PolicyUpdateBannerProps,
  ConsentCategory,
  ConsentPreferenceDialogProps,
  ConsentStatusProps,
} from './consent';

export { RadioCardGroup, CheckboxCardGroup } from './card-group';
export type { CardGroupOption, RadioCardGroupProps, CheckboxCardGroupProps } from './card-group';

export { DescriptionList } from './description-list';
export type { DescriptionListProps, KeyValuePair } from './description-list';

export { Stat } from './stat';
export type { StatProps } from './stat';

export { Divider } from './divider';
export type { DividerProps } from './divider';

export { VisuallyHidden } from './visually-hidden';

export { Accordion, Collapsible } from './accordion';
export type { AccordionProps, AccordionItem, CollapsibleProps } from './accordion';

export { Avatar, AvatarGroup, avatarClassName } from './avatar';
export type { AvatarProps, AvatarGroupProps, AvatarSize } from './avatar';

export { CopyButton } from './copy-button';
export type { CopyButtonProps } from './copy-button';
