"use client";

import { useEffect, useState } from "react";
import AnimatedImage from "@/components/ui/animated-image";
import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Spinner } from "@/components/ui/spinner";
import { getAccessToken } from "@/lib/authSession";
import { getSeoulDateParts, parseDateKey } from "@/lib/kstDateTime";
import { compressImage } from "@/lib/compressImage";
import { invalidateProfileCache } from "@/lib/profileCache";
import { supabase } from "@/lib/supabaseClient";
import BottomSheet from "@/components/sheets/BottomSheet";
import { CalendarDays, Camera, ChevronLeft, User } from "lucide-react";
import { toast } from "sonner";

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const BUCKET = "record-media";
const STORAGE_PREFIX = "/storage/v1/object/public/record-media/";
const MIN_CAREER_YEAR = 1950;

const formatCareerDateLabel = (value: string | null): string => {
  if (!value) return "날짜 선택";
  const parsed = parseDateKey(value);
  if (!parsed) return "날짜 선택";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  return `${year}년 ${month}월`;
};

export default function ProfileEditPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [balletStartedAt, setBalletStartedAt] = useState<string | null>(null);
  const [dateDraft, setDateDraft] = useState(() => {
    const { year, month } = getSeoulDateParts();
    return { year, month };
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (loading) return;
      if (!user) {
        openLoginSheet();
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("nickname,avatar_url,ballet_started_at")
        .eq("id", user.id)
        .single();

      if (data) {
        setNickname(data.nickname ?? "");
        setAvatarUrl(data.avatar_url ?? null);
        setBalletStartedAt(data.ballet_started_at ?? null);
      }
    };

    fetchProfile();
  }, [user, loading]);

  const handleSave = async () => {
    if (!user || loading) return;
    if (nickname.length > 12) {
      toast("닉네임은 최대 12자까지 가능합니다.");
      return;
    }

    setSaving(true);
    let nextAvatarUrl = avatarUrl;
    if (imageFile) {
      const compressed = await compressImage(imageFile);
      const path = `${user.id}/profile/${Date.now()}-${imageFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, compressed);

      if (!uploadError) {
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        nextAvatarUrl = data.publicUrl;

        if (avatarUrl && avatarUrl.includes(STORAGE_PREFIX)) {
          const oldPath = avatarUrl.split(STORAGE_PREFIX)[1];
          const { error: storageError } = await supabase.storage
            .from(BUCKET)
            .remove([oldPath]);
          if (storageError) {
            console.error("Failed to delete old avatar", storageError);
          }
        }
      }
    }

    const accessToken = await getAccessToken(openLoginSheet);
    if (!accessToken) {
      setSaving(false);
      return;
    }

    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        nickname: nickname || null,
        avatar_url: nextAvatarUrl,
        ballet_started_at: balletStartedAt,
      }),
    });

    if (response.status === 409) {
      setSaving(false);
      toast("중복된 닉네임이에요.");
      return;
    }

    if (!response.ok) {
      setSaving(false);
      toast("저장에 실패했습니다.");
      return;
    }

    invalidateProfileCache(user.id);
    setSaving(false);
    router.replace("/profile");
  };

  if (loading) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen items-center justify-center">
          <Spinner size="lg" />
        </main>
      </MobileContainer>
    );
  }

  if (!user) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
          <p className="text-sm text-[#17171c]/70">
            로그인이 필요한 화면이에요.
          </p>
          <Button
            type="button"
            className="bg-[#17171c] text-white hover:bg-[#17171c]/90"
            onClick={openLoginSheet}
          >
            로그인하고 계속하기
          </Button>
        </main>
      </MobileContainer>
    );
  }

  const {
    year: currentYear,
    month: currentMonth,
  } = getSeoulDateParts();
  const years = Array.from(
    { length: currentYear - MIN_CAREER_YEAR + 1 },
    (_, idx) => currentYear - idx
  );
  const months = Array.from({ length: 12 }, (_, idx) => idx + 1);

  return (
    <MobileContainer>
      {saving ? <LoadingOverlay /> : null}
      <main className="px-4 pb-16">
        <header className="sticky top-0 z-20 bg-white h-12 mb-6 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="text-[#17171c]/70"
            onClick={() => router.back()}
            aria-label="뒤로"
          >
            <ChevronLeft className="size-6" />
          </Button>
          <h1 className="text-base font-semibold">프로필 설정</h1>
          <div className="w-9" />
        </header>

        <div className="space-y-6">
          <section className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-24 w-24 overflow-hidden rounded-full border border-[#17171c]/10 bg-[#17171c]/5">
                {avatarUrl ? (
                  <AnimatedImage
                    src={avatarUrl}
                    alt="프로필 이미지"
                    width={96}
                    height={96}
                    sizes="96px"
                    unoptimized={!!imageFile}
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[#17171c]/40">
                    <User className="h-8 w-8" />
                  </div>
                )}
              </div>
              <Label className="absolute -bottom-1 -right-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#17171c]/10 bg-white text-[#17171c]/60 shadow-sm">
                <Input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file && file.size <= MAX_IMAGE_SIZE) {
                      setImageFile(file);
                      setAvatarUrl(URL.createObjectURL(file));
                    } else {
                      setImageFile(null);
                    }
                  }}
                />
                <Camera className="h-4 w-4" />
              </Label>
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-[#17171c]/60">닉네임</Label>
              <span className="text-xs text-[#17171c]/40">
                {nickname.length}/12
              </span>
            </div>
            <Input
              type="text"
              className="h-10 text-base"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              maxLength={12}
            />
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-[#17171c]/60">발레 시작 날짜</Label>
              {balletStartedAt ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto px-1 text-xs text-[#17171c]/40 hover:text-[#17171c]/70"
                  onClick={() => setBalletStartedAt(null)}
                >
                  초기화
                </Button>
              ) : (
                <span className="text-xs text-[#17171c]/40" />
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full justify-start gap-2 text-left text-base font-normal"
              onClick={() => {
                const parsed = balletStartedAt ? parseDateKey(balletStartedAt) : null;
                const { year, month } = getSeoulDateParts();
                setDateDraft({
                  year: parsed?.getFullYear() ?? year,
                  month: parsed ? parsed.getMonth() + 1 : month,
                });
                setDateSheetOpen(true);
              }}
            >
              <CalendarDays className="h-4 w-4" />
              {formatCareerDateLabel(balletStartedAt)}
            </Button>
          </section>

          <Button
            type="button"
            className="h-[52px] w-full bg-[#17171c] text-white hover:bg-[#17171c]/90"
            onClick={handleSave}
            disabled={saving}
          >
            저장하기
          </Button>
        </div>
        <BottomSheet open={dateSheetOpen} onOpenChange={setDateSheetOpen}>
          <div className="grid grid-cols-2 gap-3">
            <div className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-[#17171c]/5 p-2">
              {years.map((year) => (
                <Button
                  key={`career-year-${year}`}
                  type="button"
                  variant={dateDraft.year === year ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => {
                    setDateDraft((prev) => {
                      if (year === currentYear && prev.month > currentMonth) {
                        return { year, month: currentMonth };
                      }
                      return { ...prev, year };
                    });
                  }}
                >
                  {year}년
                </Button>
              ))}
            </div>
            <div className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-[#17171c]/5 p-2">
              {months.map((month) => {
                const value = String(month).padStart(2, "0");
                const isFutureMonth =
                  dateDraft.year === currentYear && month > currentMonth;
                return (
                  <Button
                    key={`career-month-${month}`}
                    type="button"
                    variant={dateDraft.month === month ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setDateDraft((prev) => ({ ...prev, month }))}
                    disabled={isFutureMonth}
                  >
                    {value}월
                  </Button>
                );
              })}
            </div>
          </div>
          <div className="mt-4">
            <Button
              className="h-12 w-full bg-[#17171c] text-white hover:bg-[#17171c]/90"
              onClick={() => {
                const paddedMonth = String(dateDraft.month).padStart(2, "0");
                setBalletStartedAt(`${dateDraft.year}-${paddedMonth}-01`);
                setDateSheetOpen(false);
              }}
            >
              적용하기
            </Button>
          </div>
        </BottomSheet>
      </main>
    </MobileContainer>
  );
}
