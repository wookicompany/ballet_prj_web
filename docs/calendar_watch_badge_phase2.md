# 캘린더 워치 연동 배지 (2차 범위)

1차 릴리즈는 기록 생성/수정의 HealthKit 연동까지 포함하고, 캘린더 배지는 2차 범위로 분리한다.

## 반영 위치

- 대상: `app/(tabs)/calendar/page.tsx`
- 날짜 셀 우하단 보조 표식 영역
- 기존 mood/count UI와 시각적 충돌 금지

## 배지 노출 규칙

- `records`의 아래 컬럼 중 하나 이상 값이 있으면 워치 연동 기록으로 판정
  - `workout_activity_label`
  - `workout_source_name`
  - `workout_device_name`
  - `workout_total_energy_kcal`
  - `workout_avg_bpm`
  - `workout_max_bpm`
- 같은 날짜에 다건이면 날짜 셀에 1개 배지만 표시
- 툴팁/상세 텍스트는 2차 설계 시점에 결정 (초기에는 아이콘/점 배지 우선)

## 접근성/디자인 가이드

- 모바일 우선 크기(터치 방해 금지)
- 대비 충분한 단색 아이콘 사용
- `lucide-react` 아이콘 우선 사용
