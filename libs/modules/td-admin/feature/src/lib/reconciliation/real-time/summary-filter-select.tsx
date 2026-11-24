import { useController, type Control, type FieldValues, type Path } from 'react-hook-form';
import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@myorg/shared/ui';

export interface SummaryFilterOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export function SummaryFilterSelect<T extends FieldValues>({ name, control, label, options }: {
  name: Path<T>;
  control: Control<T>;
  label: string;
  options: SummaryFilterOption[];
}) {
  const { field } = useController({ name, control });
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Select value={field.value} onValueChange={field.onChange}>
        <SelectTrigger id={name} ref={field.ref} onBlur={field.onBlur}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
