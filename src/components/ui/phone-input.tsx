import {CountryFlag} from './country-flag';
import { useMemo, useState, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { COUNTRIES, splitPhone } from "@/lib/countries";
import { cn } from "@/lib/utils";

interface Props {
  value?: string | null;
  onChange: (fullNumber: string) => void;
  placeholder?: string;
  className?: string;
}

export const PhoneInput = ({ value, onChange, placeholder = "Numéro de téléphone", className }: Props) => {
  const parsed = useMemo(() => splitPhone(value), [value]);
  const [open, setOpen] = useState(false);
  const [countryCode,setCountryCode]=useState(()=>COUNTRIES.find(c=>c.dial===parsed.dial)?.code||'GA');
  const country=COUNTRIES.find(c=>c.code===countryCode)||COUNTRIES[0];
  useEffect(()=>{if(value?.trim().startsWith('+')&&parsed.dial!==country.dial)setCountryCode(COUNTRIES.find(c=>c.dial===parsed.dial)?.code||'GA');},[value,parsed.dial,country.dial]);

  const emit = (dial: string, num: string) => {
    const clean = num.replace(/[^\d\s-]/g, "").trim();
    onChange(clean ? `${dial} ${clean}` : "");
  };

  return (
    <div className={cn("flex gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" aria-label="Indicatif du pays" aria-expanded={open} className="w-[120px] shrink-0 justify-between font-normal px-2">
            <span className="flex items-center gap-1.5 truncate">
              <CountryFlag code={country.code} name={country.name}/>
              <span className="text-sm">{country.dial}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0 bg-popover z-50" align="start">
          <Command>
            <CommandInput placeholder="Pays ou indicatif…" />
            <CommandList className="max-h-64">
              <CommandEmpty>Aucun pays trouvé.</CommandEmpty>
              <CommandGroup>
                {COUNTRIES.map((c) => (
                  <CommandItem
                    key={c.code}
                    value={`${c.name} ${c.dial}`}
                    onSelect={() => {
                      setCountryCode(c.code);emit(c.dial, parsed.number);
                      setOpen(false);
                    }}
                  >
                    <CountryFlag code={c.code} name={c.name} className="mr-2"/>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-xs text-muted-foreground mr-2">{c.dial}</span>
                    {c.code === country.code && <Check className="h-4 w-4" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        value={parsed.number}
        inputMode="tel"
        placeholder={placeholder}
        onChange={(e)=>{const value=e.target.value;if(value.trim().startsWith('+')){const next=splitPhone(value);setCountryCode(COUNTRIES.find(c=>c.dial===next.dial)?.code||country.code);emit(next.dial,next.number);}else emit(country.dial,value);}}
      />
    </div>
  );
};

export default PhoneInput;
