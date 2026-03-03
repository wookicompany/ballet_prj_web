"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

export default function TimePicker({ value, onChange, disabled = false }: Props) {
  const [rawHour = "00", rawMinute = "00"] = value.split(":");
  const hour = HOURS.includes(rawHour) ? rawHour : "00";
  const minute = MINUTES.includes(rawMinute) ? rawMinute : "00";

  return (
    <div className="flex items-center gap-2">
      <Select
        value={hour}
        onValueChange={(nextHour) => onChange(`${nextHour}:${minute}`)}
        disabled={disabled}
      >
        <SelectTrigger className="w-24">
          <SelectValue placeholder="시" />
        </SelectTrigger>
        <SelectContent>
          {HOURS.map((h) => (
            <SelectItem key={h} value={h}>
              {h}시
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={minute}
        onValueChange={(nextMinute) => onChange(`${hour}:${nextMinute}`)}
        disabled={disabled}
      >
        <SelectTrigger className="w-24">
          <SelectValue placeholder="분" />
        </SelectTrigger>
        <SelectContent>
          {MINUTES.map((m) => (
            <SelectItem key={m} value={m}>
              {m}분
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
