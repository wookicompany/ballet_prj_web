export const REPORT_THRESHOLD = 3;

export const REPORT_REASON_CODES = [
  "SPAM",
  "ABUSE",
  "SEXUAL",
  "FALSE_INFO",
  "OTHER",
] as const;

export type ReportReasonCode = (typeof REPORT_REASON_CODES)[number];

export const REPORT_REASON_OPTIONS: Array<{
  code: ReportReasonCode;
  label: string;
}> = [
  { code: "SPAM", label: "광고/도배성 콘텐츠예요." },
  { code: "ABUSE", label: "욕설/혐오/괴롭힘이 포함된 내용이에요." },
  { code: "SEXUAL", label: "음란하거나 성적으로 불쾌감을 주는 내용이에요." },
  { code: "FALSE_INFO", label: "사실과 다른 허위 정보예요." },
  { code: "OTHER", label: "기타 사유예요." },
];

export const isReportReasonCode = (value: string): value is ReportReasonCode =>
  REPORT_REASON_CODES.includes(value as ReportReasonCode);
