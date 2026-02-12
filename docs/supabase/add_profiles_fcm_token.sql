-- FCM 푸시 알림용 토큰 저장 (RN WebView 연동)
-- Supabase 대시보드 SQL Editor 또는 마이그레이션으로 실행
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS fcm_token text;

COMMENT ON COLUMN public.profiles.fcm_token IS 'FCM device token for push notifications (RN app)';
