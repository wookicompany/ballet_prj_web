"use client";

import Image from "next/image";
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
            <span className="flex aspect-square w-full items-center justify-center rounded-full overflow-hidden p-2">
              <Image
                src={`/mood/mood_dark_face_${moodValue}.png`}
                alt={`기분 ${moodValue}단계`}
                width={1600}
                height={1600}
                unoptimized
                draggable={false}
                className="h-full w-full object-contain"
              />
            </span>
          </Button>
        );
      })}
    </div>
  );
}
