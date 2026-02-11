"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Spinner } from "@/components/ui/spinner";
import FadeInImage from "@/components/ui/fade-in-image";
import { supabase } from "@/lib/supabaseClient";
import { Camera, ChevronLeft, User } from "lucide-react";
import { toast } from "sonner";

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const BUCKET = "record-media";

export default function ProfileEditPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (loading) return;
      if (!user) {
        openLoginSheet();
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("nickname,avatar_url")
        .eq("id", user.id)
        .single();

      if (data) {
        setNickname(data.nickname ?? "");
        setAvatarUrl(data.avatar_url ?? null);
      }
    };

    fetchProfile();
  }, [user, loading, openLoginSheet]);

  const handleSave = async () => {
    if (!user || loading) return;
    if (nickname.length > 12) {
      toast("닉네임은 최대 12자까지 가능합니다.");
      return;
    }

    setSaving(true);
    let nextAvatarUrl = avatarUrl;
    if (imageFile) {
      const path = `${user.id}/profile/${Date.now()}-${imageFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, imageFile);

      if (!uploadError) {
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        nextAvatarUrl = data.publicUrl;
      }
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        nickname: nickname || null,
        avatar_url: nextAvatarUrl,
      });

    if (updateError) {
      setSaving(false);
      toast("저장에 실패했습니다.");
      return;
    }

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

  return (
    <MobileContainer>
      {saving ? <LoadingOverlay /> : null}
      <main className="px-4 pb-16 pt-6">
        <header className="mb-6 flex items-center justify-between">
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
              <div className="h-24 w-24 overflow-hidden rounded-full border border-black/10 bg-black/5">
                {avatarUrl ? (
                  <FadeInImage
                    src={avatarUrl}
                    alt="프로필 이미지"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[#17171c]/40">
                    <User className="h-8 w-8" />
                  </div>
                )}
              </div>
              <Label className="absolute -bottom-1 -right-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-[#17171c]/60 shadow-sm">
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
            <Label className="text-xs text-[#17171c]/60">닉네임</Label>
            <Input
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              maxLength={12}
            />
            <p className="text-[11px] text-[#17171c]/40">
              {nickname.length}/12
            </p>
          </section>

          <Button
            type="button"
            className="h-12 w-full bg-[#17171c] text-white hover:bg-[#17171c]/90"
            onClick={handleSave}
            disabled={saving}
          >
            저장하기
          </Button>
        </div>
      </main>
    </MobileContainer>
  );
}
