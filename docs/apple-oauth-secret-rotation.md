# Apple OAuth Secret 6개월 갱신 가이드

이 문서는 Supabase `Auth > Providers > Apple`의 `Secret Key (for OAuth)` 값을 6개월마다 갱신하는 절차를 정리합니다.

## 왜 갱신이 필요한가

- Apple OAuth Client Secret(JWT)은 만료 시간이 필요합니다.
- 현재 프로젝트는 `exp = iat + 15777000초`(약 6개월) 기준으로 발급합니다.
- 만료된 Secret은 Apple 로그인 실패의 원인이 됩니다.

## 준비물

- `Team ID` (Apple Developer)
- `Client ID` (Service ID, 예: `com.wookicompany.myballet.web`)
- `Key ID` (예: `NMYYZNUS3R`)
- Private key 파일 (`.p8`)
  - 로컬 경로 예: `docs/AuthKey_NMYYZNUS3R.p8`
  - 이 파일은 Git에 커밋하지 않습니다.

## 실행 방법 (로컬)

프로젝트 루트에서 아래 명령을 실행합니다.

사전 확인:

- `jsonwebtoken`이 없다면 먼저 설치: `npm i -D jsonwebtoken`

```bash
TEAM_ID="96X94J868X" \
CLIENT_ID="com.wookicompany.myballet.web" \
KEY_ID="NMYYZNUS3R" \
P8_PATH="./docs/AuthKey_NMYYZNUS3R.p8" \
OUT_PATH="./docs/apple_client_secret.txt" \
node -e '
const fs = require("fs");
const jwt = require("jsonwebtoken");

const teamId = process.env.TEAM_ID;
const clientId = process.env.CLIENT_ID;
const keyId = process.env.KEY_ID;
const p8Path = process.env.P8_PATH;
const outPath = process.env.OUT_PATH;

if (!teamId || !clientId || !keyId || !p8Path || !outPath) {
  throw new Error("필수 환경변수 누락: TEAM_ID, CLIENT_ID, KEY_ID, P8_PATH, OUT_PATH");
}

const privateKey = fs.readFileSync(p8Path, "utf8");
const now = Math.floor(Date.now() / 1000);
const token = jwt.sign(
  {
    iss: teamId,
    iat: now,
    exp: now + 15777000, // 약 6개월
    aud: "https://appleid.apple.com",
    sub: clientId
  },
  privateKey,
  {
    algorithm: "ES256",
    header: { alg: "ES256", kid: keyId, typ: "JWT" }
  }
);

fs.writeFileSync(outPath, `${token}\n`);
console.log(`Apple client secret saved: ${outPath}`);
'
```

## Supabase 반영 방법

1. Supabase Dashboard로 이동
2. `Authentication` > `Providers` > `Apple`
3. `Secret Key (for OAuth)`에 `docs/apple_client_secret.txt`의 값을 전체 복사해서 붙여넣기
4. `Save` 클릭
5. Apple Developer `Services ID` 설정에서 아래 값이 유지되는지 확인
   - Domain: `gmwksosexoaknrqifwrj.supabase.co`
   - Return URL: `https://gmwksosexoaknrqifwrj.supabase.co/auth/v1/callback`
6. 실제 로그인 테스트
   - 앱에서 `Apple로 시작하기` 클릭
   - 콜백 후 세션 생성/로그인 완료 확인

## 운영 체크리스트

- 갱신 주기: 6개월
- 권장: 만료 2주 전 캘린더 리마인더 등록
- 갱신 후 확인:
  - Apple 로그인 성공
  - 신규 가입/기존 로그인 모두 정상
  - 로그아웃 후 재로그인 정상

## 보안 주의사항

- `.p8` 파일과 생성된 `apple_client_secret.txt`는 로컬 보관만 합니다.
- 두 파일 모두 Git 커밋 금지(`.gitignore` 적용).
- 유출 의심 시 Apple Key 폐기 후 재발급하고 Secret 재등록합니다.

## 현재 정책 메모

- 회원탈퇴 시 Apple 계정 revoke는 이번 단계에서 수행하지 않습니다.
- 현재는 서비스 내부 소프트 삭제 + 로컬 세션 종료를 표준으로 사용합니다.
- Apple revoke 연동이 필요해지면 별도 작업으로 `account/delete` API에 추가합니다.
