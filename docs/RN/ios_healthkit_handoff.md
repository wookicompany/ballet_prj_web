# iOS HealthKit RN 전달 체크리스트

이번 릴리즈 범위는 `iOS WebView + Apple HealthKit`만 포함한다.

## 1) 초기 플랫폼 이벤트 (앱 -> 웹, 1회)

```json
{
  "type": "platform_info",
  "version": 1,
  "platform": "ios",
  "health_provider": "healthkit"
}
```

- 앱 로드 완료 직후 1회 전송
- 웹은 `platform === "ios"`일 때만 `⌚ 운동 불러오기` 영역 표시

## 2) 동기화 요청 (웹 -> 앱)

```json
{
  "type": "health_sync_request",
  "version": 1,
  "request_id": "string",
  "date": "YYYY-MM-DD",
  "activity": "barre"
}
```

- `request_id`는 웹이 생성한 고유값이며 응답 매칭에 필수
- `date`는 KST 기준 날짜 문자열

## 3) 동기화 응답 (앱 -> 웹)

성공:

```json
{
  "type": "health_sync_result",
  "version": 1,
  "request_id": "string",
  "status": "success",
  "workout": {
    "activity": "barre",
    "activity_label": "string|null",
    "source_name": "string|null",
    "device_name": "string|null",
    "total_energy_kcal": "number|null",
    "avg_bpm": "number|null",
    "max_bpm": "number|null"
  }
}
```

실패:

```json
{
  "type": "health_sync_result",
  "version": 1,
  "request_id": "string",
  "status": "error",
  "code": "NO_PERMISSION|NO_DATA|TIMEOUT|QUERY_FAILED",
  "message": "string"
}
```

## 4) 조회 정책 (고정)

- 권한 요청/조회 시점: `⌚ 운동 불러오기` 버튼 탭 시에만 실행
- 조회 대상: `HKWorkoutActivityType.barre`
- 조회 범위: KST 하루 범위
- 다건일 때: 최신 1건만 반환
- 데이터 없음: `status: "error", code: "NO_DATA"`로 반환

## 5) 개발 환경

- 라이브러리: `@kingstinct/react-native-healthkit`
- 실행 환경: Expo Dev Client 필수 (`Expo Go` 미지원)
