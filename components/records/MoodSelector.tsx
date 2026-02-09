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
    <div className="grid w-full grid-cols-5 gap-2">
      {MOODS.map((moodValue) => {
        const isActive = value === moodValue;

        return (
          <Button
            key={`mood-${moodValue}`}
            type="button"
            variant="outline"
            className={`h-auto w-full aspect-square rounded-full p-0 ${
              isActive
                ? "border-[#17171c] bg-[#17171c]/5"
                : "border-black/10"
            }`}
            onClick={() => onChange(moodValue)}
          >
            <span className="block aspect-square w-full rounded-full overflow-hidden p-2">
              <img
                src={`/mood/cat-${moodValue}.svg`}
                alt={`기분 ${moodValue}단계`}
                className="h-full w-full object-contain"
              />
            </span>
          </Button>
        );
      })}
    </div>
  );
}
