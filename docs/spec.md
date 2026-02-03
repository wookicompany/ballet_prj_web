# 구현 스펙 (MVP)

이 문서는 PRD를 바탕으로 결정된 구현 사항을 기록한다.

## 1) 화면/라우팅

- 기본 진입 경로: `/calendar`
- 라우트 네이밍
  - `/login`
  - `/calendar`
  - `/day/[date]`
  - `/record/new`
  - `/record/[id]`
  - `/record/[id]/edit`
  - `/profile`
  - `/profile/edit`
- 네비게이션
  - 하단 탭: `캘린더` / `프로필`
  - 플로팅 버튼: 기록 생성(`/record/new`)
  - 상세 화면은 탭 없이 단일 페이지로 진입

## 2) 데이터 모델 (Record)

### 필수

- `date` (YYYY-MM-DD)
- `start_time`, `end_time`
- `content` (기록 내용)

### 선택

- `media` (사진 최대 3장, 영상 1개)
- `mood` (5단계 체크)
- `location`, `level`, `instructor`
- `class_review`
- `bar_order`, `center_order`
- `new_learned`, `feedback`, `did_well`, `improve_next`

## 3) 인증/로그인

- 로그인 제공자: 카카오 + 구글
- 세션 유지: Supabase Auth 기본 세션 사용
- 로그인 성공 후 이동: `/calendar`

## 4) 일별 타임라인 UI

- 기본 단위: 1시간 단위 구획
- 최소 표시 단위: 10분까지 구분되어 보이게 구현
- 진입/동작
  - 일별 상세 화면 우측 하단에 `+` 플로팅 버튼 배치
  - 플로팅 버튼 클릭 시 기록 생성(`/record/new`)으로 이동
  - 기록이 있는 시간 블록 클릭 시 해당 기록 상세(`/record/[id]`)로 이동
  - 기록이 없는 영역 클릭은 동작하지 않음

## 5) 미디어 처리

- 저장 위치: Supabase Storage
- 용량 제한
  - 이미지: 20MB/장
  - 영상: 50MB/개
- 업로드 방식: 업로드 완료 후 URL 저장

## 6) 프로필/통계

- 가입일: Supabase Auth `created_at` 사용
- 기록 개수: 삭제된 기록 제외
- 누적 발레 시간: 삭제된 기록 제외, `(end_time - start_time)` 합산
- 계산 방식: 실시간 계산

## 7) 모바일 퍼스트 UI

- 모바일 전용 화면으로 구현
- 웹/PC 접속 시에도 모바일 UI로 고정하고 중앙 정렬
- 기준 레이아웃 폭: `max-w-[430px]` + `mx-auto`
- 기본 터치 타깃: 최소 높이 44px
- 하단 탭 높이: 56px 기준
- 플로팅 버튼: 우측 하단 고정 (안전 여백 고려)