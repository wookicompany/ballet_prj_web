# 마이발레 디자인 시스템

마이발레의 디자인 토큰, 컴포넌트 규칙, 레이아웃 가이드라인.
에이전트가 UI를 구현할 때 이 문서를 최우선 참조한다.

---

## 색상 토큰

모든 색상은 `app/globals.css`의 CSS 변수로 관리한다. **컬러값 하드코딩 금지.**

| 토큰 | 값 | 용도 |
|---|---|---|
| `--brand` | `#E8517C` | 브랜드 강조. 최소한으로 사용 |
| `--background` | `#ffffff` (`oklch(1 0 0)`) | 앱 전체 배경 |
| `--primary` | `#17171C` (`oklch(0.205 0 0)`) | 기본 텍스트, default 버튼 |
| `--secondary` | `#F7F7F7` (`oklch(0.97 0 0)`) | 보조 배경, secondary 버튼 |
| `--border` | `#EBEBEB` (`oklch(0.922 0 0)`) | 구분선, 테두리 |
| `--muted-foreground` | `#8C8C8C` (`oklch(0.556 0 0)`) | 보조 텍스트, placeholder |
| `--destructive` | 빨강 | 삭제 액션 전용 |

### 브랜드 컬러 사용 규칙

`--brand` (`#E8517C`)는 아래 **2가지 용도**에만 사용한다:
- 탭바 활성 탭 아이콘·레이블
- Switch ON 상태 배경

일반 버튼, 헤더, 섹션 타이틀 등에는 사용하지 않는다.

### 배경 관련

- `bg-white` 대신 반드시 `bg-background` 사용 (토큰값 `#ffffff`)
- 카드 배경은 `bg-card` (`#fff`, 흰색 그대로 유지). 앱 배경이 `#FAFAF8`로 바뀌어도 카드는 흰색을 유지해 배경 위에 떠 보이는 대비 효과를 준다.
- 어드민 등 웹 전용 화면은 예외

---

## 타이포그래피

폰트: **Pretendard 단일** (`app/globals.css` CDN 로드)

| 용도 | Tailwind | 크기 | 굵기 |
|---|---|---|---|
| 화면 제목 | `text-2xl font-extrabold tracking-tight` | 24px | 800 |
| 헤더 타이틀 | `text-lg font-bold` | 18px | 700 |
| 섹션 타이틀 | `text-base font-semibold` | 16px | 600 |
| Body / 입력 | `text-sm font-medium` | 14px | 500 |
| Caption | `text-[13px]` | 13px | 400 |
| 탭바 레이블 | `text-[10px] font-bold` | 10px | 700 |

> APP_AGENTS.md 규칙과 연동: 텍스트 입력 시 `text-base`, 조회 시 `text-sm`, 조회 헤더 `text-base`, 플레이스홀더 `text-xs`.

---

## Radius Scale

`--radius: 0.625rem (10px)` 기준.

| Tailwind | 값 |
|---|---|
| `rounded-sm` | 6px |
| `rounded-md` | 8px |
| `rounded-lg` | 10px |
| `rounded-xl` | 14px |
| `rounded-2xl` | 18px |
| `rounded-3xl` | 22px |
| `rounded-4xl` | 26px |
| `rounded-full` | 원형 |

---

## 컴포넌트 규칙

### Button (`components/ui/button.tsx`)

| Variant | 배경 | 텍스트 | 눌림 피드백 |
|---|---|---|---|
| `default` | `bg-primary` (#17171C) | 흰색 | `active:opacity-90` |
| `outline` | `bg-background` + border | `--primary` | `active:opacity-70` |
| `secondary` | `bg-secondary` (#F7F7F7) | `--primary` | `active:opacity-90` |
| `ghost` | 없음 | `--primary` | `active:opacity-70` |
| `destructive` | 빨강 | 흰색 | `active:opacity-90` |

**Size**: `xs(h-6)` / `sm(h-8)` / `default(h-9)` / `lg(h-10)` / `icon-xs` / `icon-sm` / `icon(size-9)` / `icon-lg`

- `hover:bg-*`를 추가하지 않는다. 모바일 WebView 터치 시 배경 깜빡임 방지.
- `<Button>` 컴포넌트는 `sendHapticToApp()`이 내장되어 있어 햅틱 피드백 자동 처리.
- FloatingButton: `size-12 rounded-full bg-[#17171c] text-white`, `bottom-[72px]` 고정, `shadow-lg`.

### Badge (`components/ui/badge.tsx`)

| Variant | 스타일 | 예시 |
|---|---|---|
| `default` | `bg-primary text-white` | 공연중 |
| `secondary` | `bg-secondary text-[--primary]` | 공연예정 |
| `outline` | `border-border text-[--primary]` | 공연완료 |
| brand 커스텀 | `bg-[--brand] text-white font-bold` | D-7 |

기본 형태: `rounded-full px-3 py-0.5 text-xs font-medium`

### Input (`components/ui/input.tsx`)

- 높이: `h-9` (36px)
- 테두리: `border-input rounded-md`
- 포커스: `border-ring ring-ring/50 ring-[3px]`
- 커서: `caret-[#17171c]`
- 플레이스홀더: `text-xs` (y축 중앙 정렬)

### Card (`components/ui/card.tsx`)

- `rounded-xl` (14px) + `border-border` + `shadow-sm` + `bg-card`
- 내부: `CardHeader` / `CardContent` / `CardFooter` 구조 유지

### TabBar (`components/navigation/TabBar.tsx`)

- 배경: `bg-background` (`#ffffff`)
- **활성 탭**: `font-bold text-[#E8517C]` (brand color)
- 비활성 탭: `text-[#17171c]/60`
- 높이: `h-14` (56px)
- 상단 구분선: `border-t border-[#17171c]/5`

### MobileContainer (`components/layout/MobileContainer.tsx`)

- 배경: `bg-background` (CSS 변수, `#ffffff`)
- 너비: `max-w-[430px] mx-auto`
- 하단 패딩: `pb-[calc(5rem+env(safe-area-inset-bottom))]`
- 그림자: `shadow-sm`

### Switch (`components/ui/switch.tsx`)

- **ON 상태**: `data-[state=checked]:bg-[--brand]`
- **OFF 상태**: `bg-input`
- Size: `sm(h-3.5 w-6)` / `default(h-[1.15rem] w-8)` / `lg(h-5 w-10)`
- `<Switch>` 컴포넌트는 `sendHapticToApp()` 내장.

### Calendar 날짜 상태 (`components/ui/calendar.tsx`)

| 상태 | 스타일 |
|---|---|
| 일반 | 기본 텍스트 |
| **오늘** | `bg-[#17171c] text-white rounded-full` (검정 원형) |
| 선택됨 | `bg-primary text-primary-foreground` (검정) |
| 비활성 | `text-muted-foreground opacity-50` |
| 외부 날짜 | `text-muted-foreground` |

### MoodSelector (`components/records/MoodSelector.tsx`)

- 8단계 고양이 이미지: `/mood/mood_dark_face_{1~8}.png`
- 레이아웃: `grid-cols-4 gap-2`
- **활성**: `border-[#17171c] bg-[#17171c]/5 rounded-full`
- **비활성**: `border-[#17171c]/10 rounded-full`

### BottomSheet (`components/sheets/BottomSheet.tsx` / vaul Drawer)

- `vaul` 라이브러리 기반
- 핸들: `h-1 w-10 bg-[#17171c]/15 rounded-full mx-auto mt-2.5`
- 패딩: `px-4 pt-6 pb-12`

### Avatar (`components/ui/avatar.tsx`)

- `rounded-full` + `bg-muted` (fallback)
- Size: `sm(24px)` / `default(32px)` / `lg(40px)`
- AvatarBadge: `bg-primary`

### Spinner (`components/ui/spinner.tsx`)

- Loader2 아이콘 + `animate-spin`
- 색상: `text-[#17171c]/60`
- Size: `sm(16px)` / `md(20px)` / `lg(24px)`

### Skeleton (`components/ui/skeleton.tsx`)

- `bg-accent animate-pulse rounded-md`

---

## 레이아웃 가이드라인

| 항목 | 값 |
|---|---|
| 최대 너비 | `max-w-[430px] mx-auto` |
| 최소 터치 타깃 | `min-h-[44px]` |
| 하단 탭바 높이 | 56px (`h-14`) |
| 플로팅 버튼 위치 | `bottom-[72px] right-4` 고정 |
| Safe Area (TabBar) | `pb-[env(safe-area-inset-bottom)]` |
| Safe Area (MobileContainer) | `pb-[calc(5rem+env(safe-area-inset-bottom))]` |

---

## 터치·햅틱 피드백

### 터치 피드백 (눌림 표현)

- `hover:bg-*` 클래스를 일반 사용자 앱 화면에 사용하지 않는다.
- 눌림은 `active:opacity-*`로만 표현한다:
  - Solid 버튼 (default, secondary, destructive): `active:opacity-90`
  - Ghost·Outline 버튼: `active:opacity-70`

### 햅틱 피드백

- `<Button>`: 내부 `sendHapticToApp()` 자동 내장
- `<Switch>`: 내부 `sendHapticToApp()` 자동 내장
- 네이티브 `<button>` 직접 사용 시: `onClick` 첫 줄에 `sendHapticToApp()` 명시 필수
- import: `import { sendHapticToApp } from "@/lib/reactNativeWebView"`

---

## Shadow Scale

| 클래스 | 용도 |
|---|---|
| `shadow-xs` | 아웃라인 버튼, 입력 필드 |
| `shadow-sm` | 카드, MobileContainer |
| `shadow-lg` | 플로팅 버튼 |

---

## 에러/안내 메시지

- 에러·안내: `sonner` toast 사용 (인라인 텍스트 대신)
- 확인/경고 다이얼로그: `AlertDialog` 사용 (`window.confirm` 금지)
- 톤앤보이스: 다정한 **어요체** (`~해요`, `~예요`, `~드려요`)

---

## 어드민 예외

`/wookicompany/admin` 하위는 웹 데스크톱 최적화 화면이므로 이 디자인 가이드의 모바일 전용 규칙(MobileContainer, hover 금지 등)을 적용하지 않는다. 어드민 규칙은 `docs/ADMIN_AGENTS.md` 참조.
