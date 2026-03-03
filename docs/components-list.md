# 전체 컴포넌트 목록

라이트 모드만 사용하도록 정리한 컴포넌트 목록입니다.  
테마 변수(`:root`)는 `globals.css`에서 라이트로 고정되어 있어, `bg-background` 등은 모두 라이트 팔레트를 따릅니다.  
`dark:` 클래스는 상위에 `.dark`가 없으면 적용되지 않으므로, 현재 구조에서는 추가 수정 없이 라이트만 노출됩니다.

---

## 컴포넌트 디렉터리별 (33개)

### auth (3개)

| 파일 | 테마/다크 사용 | 비고 |
|------|----------------|------|
| `auth/AuthProvider.tsx` | 없음 | 인증 상태/로직 |
| `auth/LoginSheetProvider.tsx` | `contentClassName`으로 시트 배경 흰색 고정, 버튼은 `bg-[#FEE500]`/`bg-black`/`bg-white` 등 고정색 | 로그인 시트 |
| `auth/ConsentSheetProvider.tsx` | `bg-white`, `text-[#17171c]`, `bg-[#17171c]` 등 고정색 | 동의 시트 |

### layout (1개)

| 파일 | 테마/다크 사용 | 비고 |
|------|----------------|------|
| `layout/MobileContainer.tsx` | `bg-white`, `text-[#17171c]` 고정 | 모바일 래퍼 |

### navigation (2개)

| 파일 | 테마/다크 사용 | 비고 |
|------|----------------|------|
| `navigation/TabBar.tsx` | `bg-white`, `border-black/5`, `text-[#17171c]` 고정 | 하단 탭바 |
| `navigation/FloatingButton.tsx` | `bg-[#17171c]` 고정 | 플로팅 버튼 |

### records (1개)

| 파일 | 테마/다크 사용 | 비고 |
|------|----------------|------|
| `records/MoodSelector.tsx` | `border-[#17171c]`, `bg-[#17171c]/5` 등 고정색 | 기분 선택기 |

### sheets (1개)

| 파일 | 테마/다크 사용 | 비고 |
|------|----------------|------|
| `sheets/BottomSheet.tsx` | 없음 (상위에서 `contentClassName` 전달) | 바텀 시트 래퍼 |

### analytics (1개)

| 파일 | 테마/다크 사용 | 비고 |
|------|----------------|------|
| `analytics/GoogleAnalyticsPageView.tsx` | 없음 | GA 페이지뷰 |

### ui (24개)

| 파일 | 테마 변수 사용 | dark: 사용 | 비고 |
|------|----------------|-----------|------|
| `ui/alert-dialog.tsx` | `bg-background`, `bg-muted`, `text-muted-foreground` | 없음 | 알림 다이얼로그 |
| `ui/aspect-ratio.tsx` | 없음 | 없음 | 비율 래퍼 |
| `ui/badge.tsx` | `text-foreground`, `bg-accent`, `accent-foreground`, destructive 등 | `dark:aria-invalid`, `dark:focus-visible`, `dark:bg-destructive/60` | 뱃지 |
| `ui/button.tsx` | `bg-primary`, `bg-background`, `bg-accent` 등 | `dark:aria-invalid`, `dark:bg-input/30`, `dark:border-input`, `dark:hover:bg-input/50`, `dark:hover:bg-accent/50`, `dark:bg-destructive/60` | 버튼 |
| `ui/calendar.tsx` | `bg-background`, `border-input`, `bg-popover`, `text-muted-foreground`, `bg-accent`, `bg-primary` 등 | `dark:hover:text-accent-foreground` | 캘린더 |
| `ui/card.tsx` | `bg-card`, `text-card-foreground`, `text-muted-foreground` | 없음 | 카드 |
| `ui/carousel.tsx` | 없음 | 없음 | 캐러셀 |
| `ui/checkbox.tsx` | `border-input`, `bg-primary`, `border-primary` 등 | `dark:bg-input/30`, `dark:data-[state=checked]:bg-primary`, `dark:aria-invalid` | 체크박스 |
| `ui/drawer.tsx` | `bg-background`, `bg-muted`, `text-foreground`, `text-muted-foreground` | 없음 | 드로어(시트) |
| `ui/hover-card.tsx` | `bg-popover`, `text-popover-foreground` | 없음 | 호버 카드 |
| `ui/image-viewer.tsx` | 없음 (`bg-black/80`, `bg-white/15`, `text-white` 고정) | 없음 | 이미지 뷰어 |
| `ui/input.tsx` | `text-foreground`, `text-muted-foreground`, `bg-primary`, `border-input` 등 | `dark:bg-input/30`, `dark:aria-invalid` | 입력 |
| `ui/label.tsx` | 없음 (테마 색상 없음) | 없음 | 라벨 |
| `ui/loading-overlay.tsx` | 없음 (`bg-white/80` 고정) | 없음 | 로딩 오버레이 |
| `ui/popover.tsx` | `bg-popover`, `text-popover-foreground`, `text-muted-foreground` | 없음 | 팝오버 |
| `ui/select.tsx` | `border-input`, `text-muted-foreground`, `bg-popover`, `bg-accent` 등 | `dark:aria-invalid`, `dark:bg-input/30`, `dark:hover:bg-input/50` | 셀렉트 |
| `ui/separator.tsx` | `bg-border` | 없음 | 구분선 |
| `ui/skeleton.tsx` | `bg-accent` | 없음 | 스켈레톤 |
| `ui/spinner.tsx` | 없음 (`text-[#17171c]/60` 고정) | 없음 | 스피너 |
| `ui/switch.tsx` | `bg-primary`, `bg-input`, `bg-background`, `bg-foreground`, `bg-primary-foreground` | `dark:data-[state=unchecked]:bg-input/80`, `dark:data-[state=unchecked]:bg-foreground`, `dark:data-[state=checked]:bg-primary-foreground` | 스위치 |
| `ui/table.tsx` | `bg-muted`, `text-foreground`, `text-muted-foreground` | 없음 | 테이블 |
| `ui/textarea.tsx` | `border-input`, `text-muted-foreground` 등 | `dark:aria-invalid`, `dark:bg-input/30` | 텍스트영역 |
| `ui/tooltip.tsx` | `bg-foreground`, `text-background`, `fill-foreground` | 없음 | 툴팁 |
| `ui/animated-image.tsx` | 없음 (className 전달만) | 없음 | 애니메이션 이미지 |

---

## 요약

- **페이지**: 31개 (동일 라우트는 `docs/screens-list.md` 참고)
- **컴포넌트**: 33개 (auth 3, layout 1, navigation 2, records 1, sheets 1, analytics 1, ui 24)
- **테마 변수**: `:root`가 라이트로 고정되어 있어 `bg-background`, `text-foreground`, `bg-muted`, `bg-popover`, `bg-card`, `bg-accent`, `border-input` 등은 모두 라이트 값 사용
- **dark: 클래스**: `button`, `input`, `textarea`, `select`, `checkbox`, `badge`, `switch`, `calendar` 등에 있으나, 상위에 `.dark`가 없으면 적용되지 않음 → **현재 앱은 라이트만 노출**

추가로 특정 화면/컴포넌트에서 배경·텍스트를 라이트로 고정하고 싶다면, 해당 페이지나 시트에 `contentClassName`/`className`으로 `!bg-white text-[#17171c]` 등을 지정하면 됩니다.
