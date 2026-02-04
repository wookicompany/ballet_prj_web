"use client";

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
          <button
            key={emoji}
            type="button"
            className={`flex h-9 w-9 items-center justify-center rounded-full border text-lg ${
              isActive
                ? "border-[#17171c] bg-[#17171c]/5"
                : "border-black/10"
            }`}
            onClick={() => onChange(moodValue)}
          >
            {emoji}
          </button>
        );
      })}
    </div>
  );
}
