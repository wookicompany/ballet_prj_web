"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import BottomSheet from "@/components/sheets/BottomSheet";
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
  const [monthSheetOpen, setMonthSheetOpen] = useState(false);
  const [monthDraft, setMonthDraft] = useState(() => ({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  }));

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
  const yearOptions = useMemo(() => {
    const currentYear = currentDate.getFullYear();
    const startYear = 2025;
    const endYear = currentYear + 5;
    return Array.from({ length: endYear - startYear + 1 }, (_, index) => {
      return startYear + index;
    });
  }, [currentDate]);
  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, index) => index + 1),
    []
  );
  const yearButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const monthButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (!monthSheetOpen) return;

    const handleScroll = () => {
      yearButtonRefs.current[monthDraft.year]?.scrollIntoView({
        block: "center",
      });
      monthButtonRefs.current[monthDraft.month]?.scrollIntoView({
        block: "center",
      });
    };

    const frame = window.setTimeout(handleScroll, 0);
    return () => window.clearTimeout(frame);
  }, [monthSheetOpen, monthDraft.year, monthDraft.month]);

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
        <div className="flex items-center gap-2">
          <p className="text-xl font-semibold">{monthLabel}</p>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-[#17171c]/70"
            aria-label="연월 선택"
            onClick={() => {
              setMonthDraft({
                year: currentDate.getFullYear(),
                month: currentDate.getMonth() + 1,
              });
              setMonthSheetOpen(true);
            }}
          >
            <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
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
      <BottomSheet
        open={monthSheetOpen}
        onOpenChange={setMonthSheetOpen}
        title="연월을 선택해 주세요"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="no-scrollbar max-h-56 space-y-1 overflow-y-auto rounded-md border border-black/5 p-2">
            {yearOptions.map((year) => (
              <Button
                key={`calendar-year-${year}`}
                ref={(node) => {
                  yearButtonRefs.current[year] = node;
                }}
                type="button"
                variant={monthDraft.year === year ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() =>
                  setMonthDraft((prev) => ({
                    ...prev,
                    year,
                  }))
                }
              >
                {year}년
              </Button>
            ))}
          </div>
          <div className="no-scrollbar max-h-56 space-y-1 overflow-y-auto rounded-md border border-black/5 p-2">
            {monthOptions.map((month) => (
              <Button
                key={`calendar-month-${month}`}
                ref={(node) => {
                  monthButtonRefs.current[month] = node;
                }}
                type="button"
                variant={monthDraft.month === month ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() =>
                  setMonthDraft((prev) => ({
                    ...prev,
                    month,
                  }))
                }
              >
                {String(month).padStart(2, "0")}월
              </Button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <Button
            className="w-full bg-[#17171c] text-white hover:bg-[#17171c]/90"
            onClick={() => {
              setCurrentDate(
                new Date(monthDraft.year, monthDraft.month - 1, 1)
              );
              setMonthSheetOpen(false);
            }}
          >
            적용하기
          </Button>
        </div>
      </BottomSheet>
    </main>
  );
}
