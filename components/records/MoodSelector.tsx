"use client";

import { Button } from "@/components/ui/button";

const MOODS = [1, 2, 3, 4, 5];

export default function MoodSelector({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex gap-2">
      {MOODS.map((moodValue) => {
        const isActive = value === moodValue;

        return (
          <Button
            key={`mood-${moodValue}`}
            type="button"
            variant="outline"
            size="icon"
            className={`h-[58px] w-[58px] rounded-full p-0 ${
              isActive
                ? "border-[#17171c] bg-[#17171c]/5"
                : "border-black/10"
            }`}
            onClick={() => onChange(moodValue)}
          >
            <img
              src={`/mood/cat-${moodValue}.svg`}
              alt={`기분 ${moodValue}단계`}
              className="h-10 w-10"
            />
          </Button>
        );
      })}
    </div>
  );
}
