export class CronAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CronAuthError";
    this.status = status;
  }
}

const parseBearerToken = (headerValue: string | null) => {
  if (!headerValue) return null;
  const [scheme, token] = headerValue.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim();
};

export const assertCronAuthorized = (request: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    throw new CronAuthError("Missing required env: CRON_SECRET", 500);
  }

  const token = parseBearerToken(request.headers.get("authorization"));
  if (!token) {
    throw new CronAuthError("Missing Authorization header", 401);
  }
  if (token !== secret) {
    throw new CronAuthError("Invalid cron secret", 403);
  }
};

export const getSeoulYear = () =>
  Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      year: "numeric",
    }).format(new Date())
  );

export const isCronActiveYear = () => {
  const activeYear = process.env.CRON_ACTIVE_YEAR?.trim();
  if (!activeYear) return true;
  return String(getSeoulYear()) === activeYear;
};
