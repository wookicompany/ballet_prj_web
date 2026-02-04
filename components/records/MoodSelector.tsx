"use client";

import { Button } from "@/components/ui/button";

const MOODS = ["😔", "🙁", "😐", "🙂", "😄"];

export default function MoodSelector({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex gap-2">
      {MOODS.map((emoji, index) => {
        const moodValue = index + 1;
        const isActive = value === moodValue;

        return (
          <Button
            key={emoji}
            type="button"
            variant="outline"
            size="icon"
            className={`h-9 w-9 rounded-full text-lg ${
              isActive
                ? "border-[#17171c] bg-[#17171c]/5"
                : "border-black/10"
            }`}
            onClick={() => onChange(moodValue)}
          >
            {emoji}
          </Button>
        );
      })}
    </div>
  );
}
