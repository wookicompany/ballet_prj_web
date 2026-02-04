"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabaseClient";

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const BUCKET = "record-media";

export default function ProfileEditPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
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
  }, [user, router]);

  const handleSave = async () => {
    if (!user) return;
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
    if (!user) return;
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

  return (
    <MobileContainer>
      <main className="px-4 pb-10 pt-6">
        <header className="mb-6 flex items-center justify-between">
          <button
            type="button"
            className="text-sm text-[#17171c]/70"
            onClick={() => router.back()}
          >
            뒤로
          </button>
          <h1 className="text-base font-semibold">프로필 설정</h1>
          <div className="w-10" />
        </header>

        <div className="space-y-4">
          <div>
            <p className="text-sm">프로필 이미지</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-16 w-16 overflow-hidden rounded-full border border-black/10 bg-black/5">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="프로필 이미지"
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <input
                type="file"
                accept="image/*"
                className="text-sm"
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
            </div>
          </div>
          <label className="block text-sm">
            닉네임 (최대 12자)
            <input
              type="text"
              className="mt-2 w-full rounded-md border border-black/10 p-2"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              maxLength={12}
            />
          </label>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          <button
            type="button"
            className="w-full rounded-md bg-[#17171c] py-3 text-sm font-semibold text-white"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "저장 중..." : "저장하기"}
          </button>
          <button
            type="button"
            className="w-full rounded-md border border-black/10 py-3 text-sm font-semibold text-[#17171c]"
            onClick={signOut}
          >
            로그아웃
          </button>
          <button
            type="button"
            className="w-full rounded-md border border-red-500 py-3 text-sm font-semibold text-red-500"
            onClick={handleDeleteAccount}
          >
            회원탈퇴
          </button>
        </div>
      </main>
    </MobileContainer>
  );
}
