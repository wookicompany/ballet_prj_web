"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import AdminPageHeader from "@/components/admin/AdminPageHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { formatAdminDateTime, getAdminToken } from "@/lib/adminUtils";
import { invalidateBrandHomeCache } from "@/lib/brandHomeCache";
import { compressImage } from "@/lib/compressImage";
import { supabase } from "@/lib/supabaseClient";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";

const BUCKET = "brands";

type LikedUser = {
  like_id: string;
  user_id: string;
  created_at: string;
  nickname: string | null;
  avatar_url: string | null;
};

type Brand = {
  id: string;
  name_ko: string;
  name_en: string | null;
  logo_url: string | null;
  website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  threads_url: string | null;
  youtube_url: string | null;
  x_url: string | null;
  naver_blog_url: string | null;
  tiktok_url: string | null;
  is_active: boolean;
  sort_order: number;
};

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

export default function AdminBrandDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likedUsers, setLikedUsers] = useState<LikedUser[]>([]);
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

  useEffect(() => {
    const fetchBrand = async () => {
      const token = await getAdminToken();
      if (!token) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/brands/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          toast("브랜드 정보를 불러오지 못했습니다.");
          router.push("/wookicompany/admin/brands");
          return;
        }
        const data: { brand: Brand; like_count: number; liked_users: LikedUser[] } = await res.json();
        const b = data.brand;
        setLikeCount(data.like_count ?? 0);
        setLikedUsers(data.liked_users ?? []);
        setForm({
          name_ko: b.name_ko,
          name_en: b.name_en ?? "",
          website_url: b.website_url ?? "",
          instagram_url: b.instagram_url ?? "",
          facebook_url: b.facebook_url ?? "",
          threads_url: b.threads_url ?? "",
          youtube_url: b.youtube_url ?? "",
          x_url: b.x_url ?? "",
          naver_blog_url: b.naver_blog_url ?? "",
          tiktok_url: b.tiktok_url ?? "",
          is_active: b.is_active,
          sort_order: String(b.sort_order),
        });
        setLogoPreview(b.logo_url);
      } finally {
        setLoading(false);
      }
    };
    fetchBrand();
  }, [id, router]);

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
      let logo_url: string | undefined = undefined;

      if (logoFile) {
        const compressed = await compressImage(logoFile);
        const ext = logoFile.name.split(".").pop() ?? "jpg";
        const path = `${id}.${ext}`;
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

      const body: Record<string, unknown> = {
        name_ko: form.name_ko.trim(),
        name_en: form.name_en.trim() || null,
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
      };
      if (logo_url !== undefined) body.logo_url = logo_url;

      const res = await fetch(`/api/admin/brands/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        toast("브랜드 수정에 실패했습니다.");
        setSaving(false);
        return;
      }

      toast("브랜드가 수정되었습니다.");
      invalidateBrandHomeCache();
      router.push("/wookicompany/admin/brands");
    } catch {
      toast("브랜드 수정 중 오류가 발생했습니다.");
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const token = await getAdminToken();
      if (!token) {
        toast("로그인이 필요합니다.");
        setDeleting(false);
        return;
      }
      const res = await fetch(`/api/admin/brands/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        toast("브랜드 삭제에 실패했습니다.");
        setDeleting(false);
        return;
      }
      toast("브랜드가 삭제되었습니다.");
      invalidateBrandHomeCache();
      router.push("/wookicompany/admin/brands");
    } catch {
      toast("브랜드 삭제 중 오류가 발생했습니다.");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="브랜드 수정" />
        <Card>
          <CardContent className="space-y-4 pt-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="브랜드 수정"
        actions={
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deleting}>
                삭제
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>브랜드를 삭제할까요?</AlertDialogTitle>
                <AlertDialogDescription>
                  삭제된 브랜드는 복구할 수 없습니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>삭제</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        }
      />

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
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name_en">브랜드명 (영문)</Label>
                <Input
                  id="name_en"
                  value={form.name_en}
                  onChange={(e) => set("name_en", e.target.value)}
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
                {saving ? "저장 중..." : "저장하기"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>찜한 사용자 (총 {likeCount.toLocaleString("ko-KR")}명)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {likedUsers.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">찜한 사용자가 없습니다.</p>
          ) : (
            <ul className="divide-y">
              {likedUsers.map((u) => (
                <li key={u.like_id}>
                  <Link
                    href={`/wookicompany/admin/members/${u.user_id}`}
                    className="flex items-center gap-3 px-6 py-3 hover:bg-muted/40"
                  >
                    <Avatar className="size-7 shrink-0">
                      <AvatarImage src={u.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {(u.nickname ?? u.user_id).slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{u.nickname ?? "-"}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatAdminDateTime(u.created_at)}</p>
                    </div>
                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
