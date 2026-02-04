"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getMonthBounds(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start, end };
}

export default function CalendarPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [recordCounts, setRecordCounts] = useState<Record<string, number>>({});

  const { start, end } = useMemo(
    () => getMonthBounds(currentDate),
    [currentDate]
  );

  useEffect(() => {
    const fetchCounts = async () => {
      if (!user) {
        setRecordCounts({});
        return;
      }

      const { data, error } = await supabase
        .from("records")
        .select("record_date")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .gte("record_date", formatDate(start))
        .lte("record_date", formatDate(end));

      if (error || !data) {
        setRecordCounts({});
        return;
      }

      const counts: Record<string, number> = {};
      data.forEach((record) => {
        counts[record.record_date] = (counts[record.record_date] ?? 0) + 1;
      });
      setRecordCounts(counts);
    };

    fetchCounts();
  }, [user, start, end]);

  const monthLabel = `${currentDate.getFullYear()}년 ${
    currentDate.getMonth() + 1
  }월`;
  const todayStr = formatDate(new Date());

  const cells = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const result: Array<{ date: Date | null; day: number | null }> = [];
    for (let i = 0; i < 42; i += 1) {
      const dayNumber = i - firstDay + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) {
        result.push({ date: null, day: null });
      } else {
        result.push({
          date: new Date(year, month, dayNumber),
          day: dayNumber,
        });
      }
    }
    return result;
  }, [currentDate]);

  return (
    <main className="flex min-h-[calc(100vh-56px)] flex-col px-4 pb-6 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xl font-semibold">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-[#17171c]/70"
            onClick={() =>
              setCurrentDate(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
              )
            }
            aria-label="이전 달"
          >
            &lt;
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-[#17171c]/70"
            onClick={() =>
              setCurrentDate(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
              )
            }
            aria-label="다음 달"
          >
            &gt;
          </Button>
        </div>
      </header>

      <section className="grid flex-1 grid-cols-7 gap-2 auto-rows-fr">
        {cells.map((cell, index) => {
          const isEmpty = !cell.date;
          const dateStr = cell.date ? formatDate(cell.date) : "";
          const count = recordCounts[dateStr] ?? 0;
          const isToday = dateStr === todayStr;

          return (
            <Button
              key={`${index}-${dateStr}`}
              type="button"
              variant="outline"
              className={`relative flex h-full min-h-20 flex-col items-center justify-start gap-2 rounded-lg border-transparent bg-transparent p-1 text-sm hover:bg-black/5 ${
                isEmpty ? "opacity-40" : ""
              }`}
              disabled={isEmpty}
              onClick={() => {
                if (!cell.date) return;
                router.push(`/day/${dateStr}`);
              }}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full ${
                  isToday ? "bg-[#ff273d] text-white" : "text-[#17171c]"
                }`}
              >
                {cell.day ?? ""}
              </span>
              {count > 0 ? (
                <div className="relative h-3 w-3">
                  <span className="absolute inset-0 rounded-full bg-[#17171c]" />
                  {count >= 2 ? (
                    <Badge className="absolute -right-3 -top-2 min-w-5 justify-center rounded-full bg-[#17171c] px-1 text-[10px] text-white">
                      {count}
                    </Badge>
                  ) : null}
                </div>
              ) : null}
            </Button>
          );
        })}
      </section>
    </main>
  );
}
