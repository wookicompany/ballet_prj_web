"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/lib/supabaseClient";
import { ChevronLeft, Paperclip } from "lucide-react";

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const BUCKET = "record-media";

export default function ProfileEditPage() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (loading) return;
      if (!user) {
        router.replace("/login");
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
  }, [user, router, loading]);

  const handleSave = async () => {
    if (!user || loading) return;
    if (nickname.length > 12) {
      setError("닉네임은 최대 12자까지 가능합니다.");
      return;
    }

    setSaving(true);
    setError(null);

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
      setError("저장에 실패했습니다.");
      return;
    }

    setSaving(false);
    router.replace("/profile");
  };

  const handleDeleteAccount = async () => {
    if (!user || loading) return;
    const confirmed = window.confirm(
      "회원탈퇴 시 모든 기록이 삭제됩니다. 진행할까요?"
    );
    if (!confirmed) return;

    await supabase.from("record_media").delete().eq("user_id", user.id);
    await supabase.from("records").delete().eq("user_id", user.id);
    await supabase.from("profiles").delete().eq("id", user.id);
    await signOut();
    router.replace("/login");
  };

  if (loading) {
    return null;
  }

  return (
    <MobileContainer>
      <main className="px-4 pb-12 pt-6">
        <header className="mb-6 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-[#17171c]/70"
            onClick={() => router.back()}
            aria-label="뒤로"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-base font-semibold">프로필 설정</h1>
          <div className="w-9" />
        </header>

        <div className="space-y-6">
          <section className="space-y-4">
            <div>
              <Label className="text-xs text-[#17171c]/60">프로필 이미지</Label>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-16 w-16 overflow-hidden rounded-full border border-black/10 bg-black/5">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="프로필 이미지"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <Label className="flex items-center gap-2 rounded-md border border-dashed border-black/10 px-3 py-2 text-xs text-[#17171c]/70">
                  이미지 선택
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
                  <Paperclip className="h-4 w-4" />
                </Label>
              </div>
            </div>
            <div>
              <Label className="text-xs text-[#17171c]/60">
                닉네임 (최대 12자)
              </Label>
              <Input
                type="text"
                className="mt-2"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                maxLength={12}
              />
            </div>
          </section>

          {error ? <p className="text-sm text-red-500">{error}</p> : null}

          <Button
            type="button"
            className="w-full bg-[#17171c] text-white hover:bg-[#17171c]/90"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "저장 중..." : "저장하기"}
          </Button>

          <Separator />

          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={signOut}
            >
              로그아웃
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              onClick={handleDeleteAccount}
            >
              회원탈퇴
            </Button>
          </div>
        </div>
      </main>
    </MobileContainer>
  );
}
