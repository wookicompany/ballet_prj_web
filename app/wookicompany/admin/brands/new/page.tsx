"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getAdminToken } from "@/lib/adminUtils";
import { invalidateBrandHomeCache } from "@/lib/brandHomeCache";
import { compressImage } from "@/lib/compressImage";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

const BUCKET = "brands";

type FormState = {
  name_ko: string;
  name_en: string;
  website_url: string;
  instagram_url: string;
  facebook_url: string;
  threads_url: string;
  youtube_url: string;
  x_url: string;
  naver_blog_url: string;
  tiktok_url: string;
  is_active: boolean;
  sort_order: string;
};

export default function AdminBrandNewPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    name_ko: "",
    name_en: "",
    website_url: "",
    instagram_url: "",
    facebook_url: "",
    threads_url: "",
    youtube_url: "",
    x_url: "",
    naver_blog_url: "",
    tiktok_url: "",
    is_active: true,
    sort_order: "0",
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const set = (key: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name_ko.trim()) {
      toast("브랜드명(한글)을 입력해줘요.");
      return;
    }

    setSaving(true);
    try {
      let logo_url: string | null = null;

      if (logoFile) {
        const compressed = await compressImage(logoFile);
        const ext = logoFile.name.split(".").pop() ?? "jpg";
        const path = `${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, compressed, { upsert: true });
        if (uploadError) {
          toast("로고 업로드에 실패했어요.");
          setSaving(false);
          return;
        }
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
        logo_url = urlData.publicUrl;
      }

      const token = await getAdminToken();
      if (!token) {
        toast("로그인이 필요합니다.");
        setSaving(false);
        return;
      }

      const res = await fetch("/api/admin/brands", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name_ko: form.name_ko.trim(),
          name_en: form.name_en.trim() || null,
          logo_url,
          website_url: form.website_url.trim() || null,
          instagram_url: form.instagram_url.trim() || null,
          facebook_url: form.facebook_url.trim() || null,
          threads_url: form.threads_url.trim() || null,
          youtube_url: form.youtube_url.trim() || null,
          x_url: form.x_url.trim() || null,
          naver_blog_url: form.naver_blog_url.trim() || null,
          tiktok_url: form.tiktok_url.trim() || null,
          is_active: form.is_active,
          sort_order: Number(form.sort_order) || 0,
        }),
      });

      if (!res.ok) {
        toast("브랜드 생성에 실패했습니다.");
        setSaving(false);
        return;
      }

      toast("브랜드가 생성되었습니다.");
      invalidateBrandHomeCache();
      router.push("/wookicompany/admin/brands");
    } catch {
      toast("브랜드 생성 중 오류가 발생했습니다.");
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader title="새 브랜드 등록" />

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="space-y-5 pt-6">
            <div className="flex flex-col items-start gap-2">
              <Label>로고 이미지</Label>
              <div
                className="flex size-24 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[#17171c]/20 bg-[#f5f5f7]"
                onClick={() => fileInputRef.current?.click()}
              >
                {logoPreview ? (
                  <Image
                    src={logoPreview}
                    alt="로고 미리보기"
                    width={96}
                    height={96}
                    unoptimized
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-[#17171c]/40">업로드</span>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoChange}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name_ko">
                  브랜드명 (한글) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name_ko"
                  value={form.name_ko}
                  onChange={(e) => set("name_ko", e.target.value)}
                  placeholder="예: 국립발레단"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name_en">브랜드명 (영문)</Label>
                <Input
                  id="name_en"
                  value={form.name_en}
                  onChange={(e) => set("name_en", e.target.value)}
                  placeholder="예: Korea National Ballet"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>SNS / 링크</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    { key: "website_url", label: "홈페이지" },
                    { key: "instagram_url", label: "인스타그램" },
                    { key: "facebook_url", label: "페이스북" },
                    { key: "threads_url", label: "스레드" },
                    { key: "youtube_url", label: "유튜브" },
                    { key: "x_url", label: "X (트위터)" },
                    { key: "naver_blog_url", label: "네이버 블로그" },
                    { key: "tiktok_url", label: "틱톡" },
                  ] as { key: keyof FormState; label: string }[]
                ).map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <Label htmlFor={key} className="text-xs text-muted-foreground">
                      {label}
                    </Label>
                    <Input
                      id={key}
                      value={form[key] as string}
                      onChange={(e) => set(key, e.target.value)}
                      placeholder="https://"
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sort_order">노출 순서</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => set("sort_order", e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  id="is_active"
                  checked={form.is_active}
                  onCheckedChange={(v) => set("is_active", v)}
                />
                <Label htmlFor="is_active">노출 활성화</Label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={saving}
              >
                취소
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "저장 중..." : "생성하기"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
