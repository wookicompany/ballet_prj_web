"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { ChevronLeft } from "lucide-react";

type RecordItem = {
  id: string;
  start_time: string;
  end_time: string;
  content: string;
};

function toMinutes(time: string) {
  const [hh, mm, ss] = time.split(":").map((value) => Number(value));
  return hh * 60 + mm + (ss ? Math.round(ss / 60) : 0);
}

export default function DayPage() {
  const router = useRouter();
  const params = useParams<{ date: string }>();
  const { user } = useAuth();
  const [records, setRecords] = useState<RecordItem[]>([]);

  const dateStr = params.date;

  useEffect(() => {
    const fetchRecords = async () => {
      if (!user) {
        setRecords([]);
        return;
      }
      const { data } = await supabase
        .from("records")
        .select("id,start_time,end_time,content")
        .eq("user_id", user.id)
        .eq("record_date", dateStr)
        .is("deleted_at", null)
        .order("start_time");

      setRecords((data as RecordItem[]) ?? []);
    };

    fetchRecords();
  }, [user, dateStr]);

  const hourLabels = useMemo(() => {
    return Array.from({ length: 24 }, (_, idx) => idx);
  }, []);

  return (
    <main className="flex min-h-screen flex-col bg-white text-[#17171c]">
      <header className="flex items-center justify-between px-4 pt-6">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-[#17171c]/70"
          onClick={() => router.push("/calendar")}
          aria-label="캘린더로 이동"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <p className="text-xs text-[#17171c]/60">일별 타임라인</p>
          <h1 className="text-base font-semibold">{dateStr}</h1>
        </div>
        <div className="w-9" />
      </header>

      <section className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
        <div className="relative h-[1440px]">
          {hourLabels.map((hour) => (
            <div
              key={hour}
              className="absolute left-0 flex h-10 w-full items-start px-1 text-[11px] text-[#17171c]/45"
              style={{ top: `${hour * 60}px` }}
            >
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
          {records.map((record) => {
            const start = toMinutes(record.start_time);
            const end = toMinutes(record.end_time);
            const height = Math.max(end - start, 10);

            return (
              <Button
                key={record.id}
                type="button"
                className="absolute left-12 right-2 h-auto items-start rounded-xl bg-[#17171c] px-3 py-2 text-left text-xs text-white shadow-md"
                style={{ top: `${start}px`, height: `${height}px` }}
                onClick={() => router.push(`/record/${record.id}`)}
              >
                <div className="font-semibold">
                  {record.start_time.slice(0, 5)} - {record.end_time.slice(0, 5)}
                </div>
                <div className="line-clamp-2 text-[11px] text-white/80">
                  {record.content}
                </div>
              </Button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
