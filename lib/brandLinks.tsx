import { Home } from "lucide-react";

import { openUrlInApp, sendHapticToApp } from "@/lib/reactNativeWebView";

export type BrandLinkFields = {
  website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  threads_url: string | null;
  youtube_url: string | null;
  x_url: string | null;
  naver_blog_url: string | null;
  tiktok_url: string | null;
};

export type BrandLinkItem = {
  key: keyof BrandLinkFields;
  label: string;
  linkType: string;
  icon: React.ReactNode;
};

export const BRAND_LINK_ITEMS: BrandLinkItem[] = [
  {
    key: "website_url",
    label: "홈페이지",
    linkType: "website",
    icon: <Home className="size-5 text-[#17171c]/60" />,
  },
  {
    key: "instagram_url",
    label: "인스타그램",
    linkType: "instagram",
    icon: (
      <svg className="size-5 text-[#17171c]/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
        <circle cx="12" cy="12" r="4"/>
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    key: "facebook_url",
    label: "페이스북",
    linkType: "facebook",
    icon: (
      <svg className="size-5 text-[#17171c]/60" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  {
    key: "threads_url",
    label: "스레드",
    linkType: "threads",
    icon: (
      <svg className="size-5 text-[#17171c]/60" viewBox="0 0 192 192" fill="currentColor">
        <path d="M141.537 88.9883C140.71 88.5919 139.87 88.2104 139.019 87.8451C137.537 60.5382 122.616 44.905 97.5619 44.745C97.4484 44.7443 97.3355 44.7443 97.222 44.7443C82.2364 44.7443 69.7731 51.1409 62.102 62.7807L75.881 72.2328C81.6116 63.5383 90.6052 61.6848 97.2286 61.6848C97.3051 61.6848 97.3819 61.6848 97.4576 61.6855C105.707 61.7381 111.932 64.1366 115.961 68.814C118.893 72.2193 120.854 76.925 121.825 82.8638C114.511 81.6207 106.601 81.2385 98.145 81.7233C74.3247 83.0954 59.0111 96.9879 60.0396 116.292C60.5615 126.084 65.4397 134.508 73.775 140.011C80.8224 144.663 89.899 146.938 99.3323 146.423C111.79 145.74 121.563 140.987 128.381 132.296C133.559 125.696 136.834 117.143 138.28 106.366C144.217 109.949 148.617 114.664 151.047 120.332C155.179 129.967 155.42 145.8 142.501 158.708C131.182 170.016 117.576 174.908 97.0135 175.059C74.2042 174.89 56.9538 167.575 45.7381 153.317C35.2355 139.966 29.8077 120.682 29.6052 96C29.8077 71.3178 35.2355 52.0336 45.7381 38.6827C56.9538 24.4249 74.2039 17.11 97.0132 16.9405C119.988 17.1113 137.539 24.4614 149.184 38.788C154.894 45.8136 159.199 54.6488 162.037 64.9503L178.184 60.6422C174.744 47.9622 169.331 37.0357 161.965 27.974C147.036 9.60668 125.202 0.195148 97.0695 0H96.9569C68.8816 0.19447 47.2921 9.6418 32.7883 28.0282C19.8819 44.4864 13.2244 67.3157 13.0007 95.9325L13 96L13.0007 96.0675C13.2244 124.684 19.8819 147.514 32.7883 163.972C47.2921 182.358 68.8816 191.806 96.9569 192H97.0695C122.03 191.827 139.624 185.292 154.118 170.811C173.081 151.866 172.51 128.119 166.26 113.541C161.776 103.087 153.227 94.5962 141.537 88.9883ZM98.4405 129.507C88.0005 130.095 77.1544 125.409 76.6196 115.372C76.2232 107.93 81.9158 99.626 99.0812 98.6368C101.047 98.5234 102.976 98.468 104.871 98.468C111.106 98.468 116.939 99.0737 122.242 100.233C120.264 124.575 108.995 128.946 98.4405 129.507Z"/>
      </svg>
    ),
  },
  {
    key: "youtube_url",
    label: "유튜브",
    linkType: "youtube",
    icon: (
      <svg className="size-5 text-[#17171c]/60" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
  },
  {
    key: "x_url",
    label: "X (트위터)",
    linkType: "x",
    icon: (
      <svg className="size-5 text-[#17171c]/60" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
  {
    key: "naver_blog_url",
    label: "네이버 블로그",
    linkType: "naver_blog",
    icon: (
      <svg className="size-4 text-[#17171c]/60" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z"/>
      </svg>
    ),
  },
  {
    key: "tiktok_url",
    label: "틱톡",
    linkType: "tiktok",
    icon: (
      <svg className="size-5 text-[#17171c]/60" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.52V6.76a4.85 4.85 0 01-1.02-.07z"/>
      </svg>
    ),
  },
];

// website 우선, 없으면 BRAND_LINK_ITEMS 순서상 첫 번째 존재하는 링크
export const getFirstAvailableLink = (
  brand: BrandLinkFields
): { item: BrandLinkItem; url: string } | null => {
  for (const item of BRAND_LINK_ITEMS) {
    const url = brand[item.key];
    if (url) return { item, url };
  }
  return null;
};

export const openBrandLink = (
  brandId: string,
  brandName: string,
  url: string,
  linkType: string
) => {
  sendHapticToApp();
  void fetch(`/api/brands/${brandId}/link-click`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ link_type: linkType }),
    keepalive: true,
  }).catch(() => {
    // 클릭 추적은 부가 기능이라 실패해도 무시
  });
  if (linkType === "website") {
    // 홈페이지 열기 = 브랜드 관심 시그널 — 인기 랭킹(view수 + 찜수×10)용 view 기록
    void fetch(`/api/brands/${brandId}/view`, {
      method: "POST",
      keepalive: true,
    }).catch(() => {});
  }
  const opened = openUrlInApp(url, brandName);
  if (!opened) window.open(url, "_blank", "noopener,noreferrer");
};
