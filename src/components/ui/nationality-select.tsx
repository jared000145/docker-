import {CountryFlag} from './country-flag';
import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { COUNTRIES } from "@/lib/countries";
import { cn } from "@/lib/utils";

interface Props {
  value?: string | null;
  onChange: (nationality: string) => void;
  placeholder?: string;
  className?: string;
}

export const NationalitySelect = ({ value, onChange, placeholder = "Choisir la nationalité", className }: Props) => {
  const [open, setOpen] = useState(false);
  const current = useMemo(
    () => COUNTRIES.find((c) => c.nationality.toLowerCase() === String(value || "").toLowerCase()),
    [value],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-label="Nationalité"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="flex items-center gap-2 truncate">
            {current ? (
              <>
                <CountryFlag code={current.code} name={current.name}/>
                <span className="truncate">{current.nationality}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{value || placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-popover z-50" align="start">
        <Command>
          <CommandInput placeholder="Rechercher un pays…" />
          <CommandList className="max-h-64">
            <CommandEmpty>Aucun pays trouvé.</CommandEmpty>
            <CommandGroup>
              {COUNTRIES.map((c) => (
                <CommandItem
                  key={c.code}
                  value={`${c.nationality} ${c.name}`}
                  onSelect={() => {
                    onChange(c.nationality);
                    setOpen(false);
                  }}
                >
                  <CountryFlag code={c.code} name={c.name} className="mr-2"/>
                  <span className="flex-1 truncate">{c.nationality}</span>
                  <span className="text-xs text-muted-foreground mr-2">{c.name}</span>
                  {current?.code === c.code && <Check className="h-4 w-4" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default NationalitySelect;
