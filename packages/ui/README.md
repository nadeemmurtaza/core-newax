# @newaxhq/ui

The canonical NEWAX UI component library — `cn` plus every component
below, organized by responsibility so the package can grow without
becoming an unstructured warehouse.

Styled through `.nx-*` class hooks. The consuming app supplies the actual
look via its own `design-system` brand tokens / Tailwind theme — this
package owns structure, state, and accessible behavior, not colour.
Charts are a separate `@newaxhq/charts` package (not built yet), not part
of this library.

| Category                    | Components                                                                                                                                                                                                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core foundations            | `Button`, `Input`, `Card`, `Label`, `Textarea`, `Checkbox`, `Switch`, `Select`, `Badge`, `Alert`, `Spinner`, `Skeleton`, `Tooltip`, `Dialog`, `DropdownMenu`, `FormField`, `HelperText`, `FieldError`                                                                              |
| Operational interfaces      | `Table`/`TableHead`/`TableBody`/`TableRow`/`TableHeaderCell`/`TableCell`, `Pagination`, `Tabs`, `ToastViewport`, `DatePicker`/`DateRangePicker`, `FileUpload`, `EmptyState`, `ErrorState`, `ConfirmationDialog`, `RetryPanel`, `ProgressBar`, `UploadProgress`, `ConnectionStatus` |
| Shared platform experiences | `CookieConsentBanner`, `LegalNotice`, `PolicyUpdateBanner`, `ConsentPreferenceDialog`, `ConsentStatus`, `RadioCardGroup`, `CheckboxCardGroup`, `DescriptionList`, `Stat`, `Divider`, `VisuallyHidden`, `Accordion`/`Collapsible`, `Avatar`/`AvatarGroup`, `CopyButton`             |

Native elements chosen deliberately over custom widgets where they give
correct accessibility for free: `<select>` (not a custom Combobox yet),
`<input type="date">` (not a custom calendar), `<dialog>` for `Dialog`
(focus-trap/Escape/backdrop), `<details>` for `DropdownMenu`/`Accordion`.

**Consent is presentation only** — see `consent.tsx`'s module doc. These
components display choices and whatever policy text/categories the app
supplies; they decide nothing about which cookies run or what counts as
valid consent. A dedicated consent-management layer enforces that.

## Usage

```tsx
import { Button, FormField, Input, Card } from '@newaxhq/ui';

<Card>
  <FormField label="Email" error={errors.email}>
    <Input type="email" />
  </FormField>
  <Button variant="primary" size="md">
    Save
  </Button>
</Card>;
```

## What's not here (yet)

`Combobox`/`Autocomplete`, `NumberInput`/`PasswordInput`/`SearchInput`/
`OTPInput`, `ContextMenu`/`Popover`/`HoverCard`/`Drawer`/`Sheet`,
`TreeView`/`Timeline`/`Calendar` primitives, `ColorPicker`/`SignaturePad`/
`DragAndDrop`/`ResizablePanel`/`SplitPane` (the source doc itself
qualifies these as "if needed"/"where justified"), `ThemeProvider` (that's
`design-system`'s runtime, not duplicated here). Add any of these when an
app actually needs it twice, per `docs/package-governance/`.
