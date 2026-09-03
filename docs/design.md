# 마이발레 디자인 시스템

마이발레의 디자인 토큰, 컴포넌트 규칙, 레이아웃 가이드라인.
에이전트가 UI를 구현할 때 이 문서를 최우선 참조한다.

---

## 색상 토큰

모든 색상은 `app/globals.css`의 CSS 변수로 관리한다. **컬러값 하드코딩 금지.**

| 토큰 | 값 | 용도 |
|---|---|---|
| `--brand` | `#E8517C` | 브랜드 강조. 최소한으로 사용 |
| `--alert` | `#FF154A` | 미읽음/알림 신호색. 브랜드와 분리(알림 대비 우선) |
| `--background` | `#ffffff` (`oklch(1 0 0)`) | 앱 전체 배경 |
| `--primary` | `#17171C` (`oklch(0.205 0 0)`) | 기본 텍스트, default 버튼 |
| `--secondary` | `#F7F7F7` (`oklch(0.97 0 0)`) | 보조 배경, secondary 버튼 |
| `--border` | `#EBEBEB` (`oklch(0.922 0 0)`) | 구분선, 테두리 |
| `--muted-foreground` | `#8C8C8C` (`oklch(0.556 0 0)`) | 보조 텍스트, placeholder |
| `--destructive` | 빨강 | 삭제 액션 전용 |

### 브랜드 컬러 사용 규칙

`--brand` (`#E8517C`)는 **브랜드 강조 액센트**로만, 최소한으로 사용한다. 현재 사용처:
- 공연 리뷰 별점(선택/채움)
- 브랜드 찜 하트(활성 fill·아웃라인 stroke, `text-brand` + `currentColor`)
- 어드민 광고 accent 슬라이더(`accent-brand`)

일반 버튼, 헤더, 섹션 타이틀에는 사용하지 않는다. (참고: Switch ON 배경은 브랜드색이 아니라 베이스 다크 `#17171c`를 사용한다.)

미읽음/알림 신호(빨간 점 등)는 브랜드색으로 통일하지 않고 별도 `--alert`(`#FF154A`) 토큰을 사용한다. 알림 신호는 브랜딩보다 **대비·주목도가 우선**이므로 의도적으로 분리한다. 하드코딩 금지(토큰만 사용).

**예정(planned) 상태**(캘린더 반복·예정 등록) 표기에도 `--brand`·`--alert` 어느 쪽도 쓰지 않는다 — 베이스 다크 `#17171c`의 투명도 스케일만 사용. 자세한 내용은 "[예정(Planned)·완료(Done) 상태 표현](#예정planned완료done-상태-표현)" 절 참조.

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
- **활성 탭**: `font-bold text-[#17171c]`
- 비활성 탭: `text-[#17171c]/60`
- 높이: `h-14` (56px)
- 상단 구분선: `border-t border-[#17171c]/5`

### MobileContainer (`components/layout/MobileContainer.tsx`)

- 배경: `bg-background` (CSS 변수, `#ffffff`)
- 너비: `max-w-[430px] mx-auto`
- 하단 패딩: `pb-[calc(5rem+env(safe-area-inset-bottom))]`
- 그림자: `shadow-sm`

### Switch (`components/ui/switch.tsx`)

- **ON 상태**: `data-[state=checked]:bg-[#17171c]` (베이스 다크. 브랜드색 아님)
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

### 미디어 썸네일 (기록/리뷰 이미지 그리드)

- 목록·카드에 노출되는 썸네일은 원본 비율과 무관하게 **`object-cover`로 크롭**해 통일한다. `object-contain`은 업로드 미리보기, 포스터 이미지, 확대뷰어(ImageViewer) 등 원본 비율 보존이 목적인 예외 케이스에만 쓴다.
- 공통 스타일: `rounded-md`, `border border-[#17171c]/5`, `bg-white`(로딩 중 배경).
- **list 프리셋** — 리뷰 목록·카드 등 여러 항목이 나열되는 곳: 썸네일 `64px`(`h-16 w-16`), 최대 3장 노출 후 4번째부터는 표시하지 않고 3번째 칸에 `absolute inset-0 flex items-center justify-center rounded-md bg-black/50` 오버레이로 `+N`(남은 장수) 표기. 예: `app/profile/reviews/page.tsx`, `app/performance/[id]/page.tsx` 리뷰 목록.
- **detail 프리셋** — 리뷰 상세 등 단일 게시물 전체를 보여주는 곳: 썸네일 `80px`(`h-20 w-20`), 동일한 크롭·보더 스타일이되 `flex-wrap`으로 **전체 장수를 노출**(cap·`+N` 없음). 예: `app/performance/[id]/reviews/[reviewId]/page.tsx`.
- 썸네일 탭 시 확대(ImageViewer)는 이미지에 직접 핸들러가 있는 곳(공연 상세 인라인 리뷰·리뷰 상세)에서 제공한다. 프로필 목록처럼 카드 전체가 리뷰로 이동하는 곳은 카드 내비게이션을 유지한다(썸네일 개별 확대 없음). 시각 표준(크롭·크기·`+N`)은 통일하되 인터랙션은 맥락을 따른다.

---

## 예정(Planned)·완료(Done) 상태 표현

> 근거: `docs/PRD/recurring-planned-records.md` §9 (pd 확정 UX). 캘린더 반복·예정 등록 기능의 시각 규칙. 신규 컴포넌트는 만들지 않고 기존 shadcn/ui 컴포넌트(Button·Badge·BottomSheet·AlertDialog·Calendar)만 재사용한다.

### 색상 원칙 (최우선)

- **예정(planned) 상태는 `--brand`, `--alert` 어느 쪽도 사용하지 않는다.** 베이스 다크 `#17171c`의 **투명도 스케일만**으로 표현한다(`/40`, `/30`, `/20` 등). "예정"은 브랜드 강조 대상도 경고 신호도 아닌 중립 상태.
- **완료(done)는 기존 무드 이미지 그대로** — 별도 배지·표기를 추가하지 않는다("무표기 = 완료"가 원칙). 완료를 위해 새 색이나 아이콘을 만들지 않는다.
- **놓친(지난) 예정도 경고가 아니다.** `--alert`(#FF154A)를 쓰지 않고, opacity만 더 낮춰(`/20`) "지난"을 표현한다.

### 무드 슬롯 표현 (캘린더 셀 / day뷰 / 상세)

| 상태 | 표현 | 스타일 |
|---|---|---|
| 완료 — 감정 있음 | 무드 이미지 | `mood_dark_face_{1~8}.png` 그대로 (기존과 동일, 무표기) |
| 예정 — 오늘/미래 | 점선 원 | `rounded-full border-2 border-dashed border-[#17171c]/40` |
| 예정 — 지난(놓친) | 더 옅은 점선 원 | `border-dashed border-[#17171c]/20` (opacity만 낮춤, 색상 변경 없음) |
| 빈 날 | 없음 | 기존과 동일 |

> 2026-08-31 갱신: "감정 기록 없이 완료" 플로우를 제거하면서 "완료 — 감정 없음(채운 원)" 상태 자체가 더 이상 발생하지 않는다. 완료는 항상 감정을 동반하므로 캘린더 무드 슬롯은 무드 얼굴/예정 점선 원/무표기 3분기로 단순화됐다.

- **완료 표기 구분**: 감정 있는 완료는 무드 얼굴, 예정은 점선 원 — solid(무드 얼굴) vs dashed(예정)로 상태를 구분한다.

- 점선 원은 무드 이미지 슬롯과 같은 자리·같은 크기를 쓴다 — 캘린더 셀 무드 슬롯(컨테이너 최대 52px, 실제 시각 크기 32~48px대), day뷰·상세 리스트(`h-12 w-12` = 48px, 기존 "무드 없음" 플레이스홀더 `bg-[#17171c]/5` 자리를 대체).
- **dashed 테두리는 32~48px 이상의 큰 요소에만 쓴다** — 점선이 실제로 지각 가능한 최소 크기다. 이보다 작은 인디케이터(배지·도트)에는 점선을 쓰지 않는다(아래 "작은 도트" 참고).
- 오늘 날짜의 상단 날짜 숫자 원(`bg-[#17171c] text-white rounded-full`, 기존 캘린더 셀 구현과 동일)은 **그 날의 기록 상태와 무관하게 항상 유지**한다 — 예정만 있는 날도 today 원은 흐리게 하지 않는다. (현재 코드가 이미 이 동작이라 변경 불요, 회귀시키지 않도록 명문화.)

### 캘린더 셀 카운트 배지

| 케이스 | 배지 |
|---|---|
| 완료만 (2건+) | 기존 그대로 — solid 채움 배지 `bg-primary text-white rounded-full`(완료 건수만 카운트) |
| 예정만 | outline 배지 — `Badge` outline variant의 형태(`rounded-full px-3 py-0.5 text-xs`)를 따르되 이 용도에서는 테두리색을 `border-[#17171c]/30 text-[#17171c]/70 bg-background`로 오버라이드(기본 `border-border`는 대비가 너무 옅어 이 맥락에선 부족). 예정 건수 표기. |
| 혼합(완료+예정 같은 날) | **완료 채움 배지 + 예정 outline 배지 둘 다 노출.** 완료 배지는 기존 위치(우측 상단) 유지, 예정 outline 배지는 반대 코너 등 겹치지 않는 자리에 배치. 예정을 완료처럼 채워진 걸로 보이게 하지 않는다. |

### 작은 도트(6px) — 공간이 부족한 압축 표기

- 완료 배지가 이미 자리를 차지해 outline 배지를 더 넣을 여백이 없는 압축된 위치에서 "예정도 있음"만 보조로 알려야 할 때는, outline/점선 대신 **`size-1.5`(6px) solid 저투명 도트** `bg-[#17171c]/30`를 쓴다.
- 이유: 6px 크기에서는 점선·outline 링이 뭉개져 지각되지 않는다 — 이 스케일에서는 저투명 solid fill로만 "보조 정보 있음"을 표현한다.
- 6px 도트는 **개수 없이 존재만** 알리는 용도로 한정한다. 개수 표기가 필요하면 위 outline 배지 크기를 확보해야 한다.

### 반복·예정 등록 컴포넌트 (전부 기존 컴포넌트 재사용, 신규 컴포넌트 없음)

**1) 진입 — BottomSheet 선택지**

기존 `BottomSheet`(vaul) + 기록 상세 메뉴와 동일한 `Button variant="outline" className="h-12 w-full justify-start text-sm"` 패턴(`app/record/[id]/page.tsx`의 수정하기/삭제하기 메뉴와 동일 스타일)을 재사용한다.

```
┌─────────────────────────────┐
│          ─────  (핸들)         │
│                                │
│  [PenLine]      오늘 기록 남기기  │
│  [CalendarPlus] 예정 등록하기    │
│  [Repeat]       반복 예정 등록하기│
│                                │
└─────────────────────────────┘
```
> 버튼 라벨은 pd 제안(디자인 초안) — 최종 카피는 pm 확인 필요. 아이콘은 lucide-react에서 의미가 맞는 것으로 선택(예시로 PenLine / CalendarPlus / Repeat 표기).

**2) 반복 등록 폼 — 요일 멀티선택 pill**

- 새 패턴이지만 `MoodSelector`의 active/inactive 토큰 규칙을 그대로 따른다.
- 최소 터치 타깃 44px 준수를 위해 **`size-11`(44px) 원형 pill**, `flex justify-between` 또는 `grid-cols-7 gap-2`로 월~일 7개 배치.
- **선택됨(활성)**: `border-[#17171c] bg-[#17171c] text-white rounded-full` — 요일은 다중선택이라 MoodSelector(테두리+연한 배경)보다 더 강한 대비(배경 채움)로 "선택됨"을 명확히 한다.
- **비선택(비활성)**: `border-[#17171c]/10 text-[#17171c]/60 rounded-full`
- 종료일: 기존 `Calendar` 컴포넌트 재사용, **자유 선택**(2026-09-03 갱신 — 개선③: 3개월 상한 제거). 선택 가능 범위는 시작일 이후로만 제한(`before: 시작일`은 기존 "비활성" 스타일 유지), 상한 날짜 자체가 없어졌으므로 `after` 차단은 두지 않는다.
- 종료일 아래 동적 안내 캡션(`text-xs text-[#17171c]/50`, 기존 캡션 스타일 재사용): 종료일 미선택 시 캡션 없음 → 종료일 선택 후 예정 개수(N) > 0이면 **"예정 N개를 만들 거예요."** → N = 0이면 **"선택한 요일과 종료일로는 예정을 만들 수 없어요."** → 생성 후보가 서버 안전 가드(1000건)를 넘어서면 **"기간이 너무 길어서 예정을 만들 수 없어요. 종료일을 조금 더 가깝게 선택해 다시 시도해 주세요."**(이 경우 등록 버튼도 비활성화). 상한 수치는 사용자에게 사전 노출하지 않고, 캡션은 항상 실측/실계산 값에만 근거한다(가짜 "N개" 표기 금지).

```
    월     화     수     목     금     토     일
  ( ● )  ( ○ )  ( ● )  ( ○ )  ( ○ )  ( ○ )  ( ○ )
   ↑ 선택됨(검정 채움, size-11)   ↑ 비선택(옅은 테두리)
```

**3) 결과 요약 — toast / BottomSheet**

- 스킵 없이 단순 성공: `sonner` toast 1줄(카피는 아래 표).
- 스킵이 하나라도 발생: BottomSheet로 결과 요약(§9.8).
- (2026-09-03 갱신 — 개선③: 3개월 상한 제거로 "캡" 안내 줄은 결과 BottomSheet에서 사라졌다. 종료일이 서버 안전 가드(1000건)를 넘어서는 경우는 애초에 등록 버튼이 비활성화되므로 이 화면까지 도달하지 않는다.)

```
┌─────────────────────────────┐
│          ─────                │
│                                │
│    예정 등록을 완료했어요        │
│                                │
│    · 예정 12개를 만들었어요      │
│    · 겹치는 날짜 2일은 건너뛰었어요│
│                                │
│         [ 확인 ]  (Button default)│
└─────────────────────────────┘
```

**4) 예정 상세 — 상태 전환 메뉴**

기존 기록 상세 메뉴 BottomSheet(수정하기/삭제하기)에 `status='planned'`일 때만 항목을 추가한다. 스타일은 기존 메뉴와 동일하게 전부 `variant="outline" className="h-12 w-full justify-start text-sm"`, 파괴적 삭제 항목만 `text-red-500`(기존 "삭제하기"와 동일 패턴).

```
┌───────────────────────────────────────────────────┐
│  [PenLine]     기록하기(planned) / 수정하기(done)      (기본)
│  [Trash2]      삭제하기                              (빨강)
│  [Trash2]      남은 예정 전체 삭제 / 다음 예정 전체 삭제  ← recurrence_id 있을 때만 (빨강)
└───────────────────────────────────────────────────┘
```

> 2026-08-31 갱신: "무드 없이 완료 처리" 메뉴 항목(및 확인 AlertDialog)을 제거했다. planned 기록의 유일한 완료 경로는 편집 화면에서 감정을 입력하는 것뿐이라, 메뉴 첫 항목 라벨이 상태별로 갈린다 — planned면 "기록하기", done이면 "수정하기"(이동 대상은 동일하게 `/record/[id]/edit`).

- "남은 예정 전체 삭제"/"다음 예정 전체 삭제"는 대량 삭제이므로 기존 "삭제하기"와 동일하게 `text-red-500`.

**5) 예정 미디어 섹션**

- 2026-08-31 갱신: 예정 상태에서도 미디어 업로드 섹션을 **완료와 동일하게 그대로 노출**한다(숨김·대체 caption 제거). 예정에서도 사진을 바로 첨부할 수 있다.

### 로딩·실패 표현

- 반복 생성 / 완료 전환 / 남은 전체 삭제 요청 중에는 **기존 `LoadingOverlay`(`components/ui/loading-overlay.tsx`) 재사용**. 새 로딩 컴포넌트를 만들지 않는다.
- **낙관적(optimistic) 업데이트를 도입하지 않는다** — 서버 응답 전에 화면을 먼저 바꿔두지 않으므로, 실패 시 되돌리는(rollback) 로직 자체가 필요 없다. 실패는 toast로만 안내.

### 카피 규칙 (전부 어요체)

| 상황 | 카피 |
|---|---|
| 무드 질문 라벨 | **"오늘 발레는 어땠나요?"** — 기존 앱 라벨(`app/record/new/page.tsx`, `app/record/[id]/edit/page.tsx`)과 동일하게 통일. "오늘 기분은 어땠나요?"는 쓰지 않는다. |
| 완료→예정 되돌리기 시도 차단 | "완료된 기록은 다시 예정으로 되돌릴 수 없어요." (toast) |
| 0회 생성(스킵, 등록 버튼은 선계산으로 원천 비활성) | "선택한 요일과 종료일로는 예정을 만들 수 없어요." (toast, 서버 0건 응답 시) |
| 생성 성공(스킵 없음) | "예정 N개를 만들었어요." (toast) |
| 생성 성공(스킵 있음) | 결과 요약 BottomSheet — "예정 N개를 만들었어요" / "겹치는 날짜 M일은 건너뛰었어요" |
| 종료일 선택 폼의 동적 안내 caption (2026-09-03 추가 — 개선③) | 미선택 시 캡션 없음 → N > 0이면 "예정 N개를 만들 거예요." → N = 0이면 "선택한 요일과 종료일로는 예정을 만들 수 없어요." → 서버 안전 가드(1000건) 초과 시 "기간이 너무 길어서 예정을 만들 수 없어요. 종료일을 조금 더 가깝게 선택해 다시 시도해 주세요."(등록 버튼도 함께 비활성화) |
| 지난(놓친) 예정 caption | **"지난 예정이에요"** — "지난 일정"이 아닌 "지난 예정"으로 통일(기능 용어 "예정"과 일관). |
| 지난 예정 액션 | [기록하기] [삭제] — `/record/[id]/edit`로 이동해 감정을 남기면 완료로 저장됨(2026-08-31 갱신, 구 [완료로 표시]/무드 없이 완료 확인 다이얼로그 대체) |
| 남은 전체 삭제(예정 카드에서) | "남은 예정 전체 삭제" |
| 남은 전체 삭제(완료 카드에서) | "다음 예정 전체 삭제" |
| 삭제 확인 AlertDialog 제목(항상 표시) | planned: "이 반복의 예정을 모두 삭제할까요?" / done: "이 반복의 남은 예정을 모두 삭제할까요?" (2026-08-31 갱신) |
| 삭제 확인 AlertDialog 설명(항상 표시) | "완료하지 않은 예정은 지난 것도 함께 삭제돼요. 감정을 기록해 완료한 날은 그대로 남아요." (2026-08-31 갱신) |
| 삭제 부분 실패 | "일부 예정을 삭제하지 못했어요. 다시 시도해 주세요." (toast) |

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
