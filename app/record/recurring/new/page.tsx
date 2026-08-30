"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";

import { format, addMonths } from "date-fns";
import { ko } from "date-fns/locale";
import { ko as dayPickerKo } from "react-day-picker/locale";
import PageHeader from "@/components/layout/PageHeader";
import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { ensureSessionOrLogin, getAccessToken } from "@/lib/authSession";
import { getSeoulTimeParts, getSeoulTodayDate, parseDateKey } from "@/lib/kstDateTime";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import BottomSheet from "@/components/sheets/BottomSheet";
import { BAR_ORDER_TAGS, CENTER_ORDER_TAGS } from "@/lib/orderTags";
import { getLocationsCache, setLocationsCache } from "@/lib/locationsCache";
import {
  getInstructorLevelsCache,
  setInstructorLevelsCache,
} from "@/lib/instructorLevelsCache";
import { getBarOrdersCache, setBarOrdersCache } from "@/lib/barOrdersCache";
import {
  getCenterOrdersCache,
  setCenterOrdersCache,
} from "@/lib/centerOrdersCache";
import { invalidateProfileCache } from "@/lib/profileCache";
import { invalidateProfileRecordsCache } from "@/lib/profileRecordsCache";
import { markRecordDatesChanged } from "@/lib/recordChangeFlags";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  Check,
  Layers,
  ListOrdered,
  MapPin,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

const LOCATION_DELIMITER = " | ";
const ADDRESS_DELIMITER = " || ";
const MAX_OCCURRENCES = 26;

// 월~일 순서로 노출하되, 값은 Postgres EXTRACT(DOW)/JS Date.getDay()와 동일한
// 0=일 ~ 6=토 규약을 그대로 사용한다(서버 create_record_recurrences RPC와 일치).
const WEEKDAY_OPTIONS = [
  { label: "월", value: 1 },
  { label: "화", value: 2 },
  { label: "수", value: 3 },
  { label: "목", value: 4 },
  { label: "금", value: 5 },
  { label: "토", value: 6 },
  { label: "일", value: 0 },
];

const buildLocationValue = (
  name: string,
  base: string,
  detail: string
) => {
  const trimmedName = name.trim();
  const trimmedBase = base.trim();
  const trimmedDetail = detail.trim();
  if (!trimmedName && !trimmedBase && !trimmedDetail) return "";

  const normalizedBase =
    trimmedDetail && trimmedBase.endsWith(trimmedDetail)
      ? trimmedBase.slice(0, -trimmedDetail.length).trim()
      : trimmedBase;
  const shouldAppendDetail =
    trimmedDetail && normalizedBase && !normalizedBase.includes(trimmedDetail);
  const address = normalizedBase
    ? shouldAppendDetail
      ? `${normalizedBase}${ADDRESS_DELIMITER}${trimmedDetail}`
      : normalizedBase
    : trimmedDetail
      ? `${ADDRESS_DELIMITER}${trimmedDetail}`
      : "";

  if (!trimmedName) return address;
  if (!address) return trimmedName;
  return `${trimmedName}${LOCATION_DELIMITER}${address}`;
};

const createRequestId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

// 로컬 달력 셀의 Y/M/D를 그대로 문자열로 만든다 — Intl/KST 타임존 재해석을 거치지 않아야
// react-day-picker가 렌더링한 "그 날짜"와 어긋나지 않는다(CLAUDE.md 날짜 규칙).
const formatDateKeyFromLocalDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

// fromDate는 이미 "오늘 이전 불가" 규칙(D5)이 적용된 값이어야 한다 — 서버 RPC의
// v_starts_on = GREATEST(선택한 시작일, 오늘) 재계산과 동일한 값을 클라에서 미리 반영해 둔다.
const countPlannedOccurrences = (
  weekdaySet: Set<number>,
  fromDate: Date,
  untilDateKey: string
): number => {
  if (weekdaySet.size === 0 || !untilDateKey) return 0;
  const untilDate = parseDateKey(untilDateKey);
  if (!untilDate) return 0;
  const capDate = addMonths(fromDate, 3);
  const cappedUntil =
    untilDate.getTime() > capDate.getTime() ? capDate : untilDate;
  if (cappedUntil.getTime() < fromDate.getTime()) return 0;

  let count = 0;
  const cursor = new Date(fromDate.getTime());
  while (cursor.getTime() <= cappedUntil.getTime() && count < MAX_OCCURRENCES) {
    if (weekdaySet.has(cursor.getDay())) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
};

type SavedLocation = {
  id: string;
  name: string;
  address_base: string | null;
  address_detail: string | null;
};

type SavedInstructorLevel = {
  id: string;
  instructor: string;
  level: string;
};

type SavedBarOrder = {
  id: string;
  name: string;
  order_text: string;
};

type SavedCenterOrder = {
  id: string;
  name: string;
  order_text: string;
};

type RecurrenceResponse = {
  recurrenceId: string | null;
  created: string[];
  skipped: string[];
};

type ResultSummary = {
  createdCount: number;
  skippedCount: number;
  wasCapped: boolean;
};

export default function RecordRecurringNewPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { openLoginSheet } = useLoginSheet();

  const [saving, setSaving] = useState(false);
  const submittingRef = useRef(false);
  const requestIdRef = useRef<string | null>(null);

  const today = useMemo(() => getSeoulTodayDate(), []);

  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  // D5(착수일은 오늘 이후만): 기본값은 오늘이고, 시작일 피커에서 과거 날짜는 선택 자체를 막는다.
  const [startDate, setStartDate] = useState(() => formatDateKeyFromLocalDate(getSeoulTodayDate()));
  const [untilDate, setUntilDate] = useState("");

  const [startSheetOpen, setStartSheetOpen] = useState(false);
  const [endSheetOpen, setEndSheetOpen] = useState(false);
  const [startDateSheetOpen, setStartDateSheetOpen] = useState(false);
  const [startDateDraft, setStartDateDraft] = useState<Date | undefined>(undefined);
  const [untilSheetOpen, setUntilSheetOpen] = useState(false);
  const [untilDraft, setUntilDraft] = useState<Date | undefined>(undefined);

  // 서버 RPC와 동일하게 "선택한 시작일"을 오늘 미만으로 내려가지 않게 클라에서도 고정한다
  // (GREATEST(선택값, 오늘) — §D5 재확인 방어).
  const effectiveStartDate = useMemo(() => {
    const parsed = parseDateKey(startDate);
    if (!parsed) return today;
    return parsed.getTime() < today.getTime() ? today : parsed;
  }, [startDate, today]);
  const endDateCapDate = useMemo(
    () => addMonths(effectiveStartDate, 3),
    [effectiveStartDate]
  );

  const [resultSheetOpen, setResultSheetOpen] = useState(false);
  const [resultSummary, setResultSummary] = useState<ResultSummary | null>(
    null
  );

  const [showLocation, setShowLocation] = useState(false);
  const [showLevelInstructor, setShowLevelInstructor] = useState(false);
  const [showBarOrder, setShowBarOrder] = useState(false);
  const [showCenterOrder, setShowCenterOrder] = useState(false);

  const [locationName, setLocationName] = useState("");
  const [locationBase, setLocationBase] = useState("");
  const [locationDetail, setLocationDetail] = useState("");
  const [instructor, setInstructor] = useState("");
  const [level, setLevel] = useState("");
  const [barOrderTags, setBarOrderTags] = useState<string[]>([]);
  const [centerOrderTags, setCenterOrderTags] = useState<string[]>([]);
  const [barOrderInput, setBarOrderInput] = useState("");
  const [centerOrderInput, setCenterOrderInput] = useState("");

  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const [instructorSheetOpen, setInstructorSheetOpen] = useState(false);
  const [barOrderSheetOpen, setBarOrderSheetOpen] = useState(false);
  const [centerOrderSheetOpen, setCenterOrderSheetOpen] = useState(false);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [savedInstructorLevels, setSavedInstructorLevels] = useState<
    SavedInstructorLevel[]
  >([]);
  const [savedBarOrders, setSavedBarOrders] = useState<SavedBarOrder[]>([]);
  const [savedCenterOrders, setSavedCenterOrders] = useState<
    SavedCenterOrder[]
  >([]);
  const [savedLocationsLoading, setSavedLocationsLoading] = useState(false);
  const [savedInstructorLoading, setSavedInstructorLoading] = useState(false);
  const [savedBarOrdersLoading, setSavedBarOrdersLoading] = useState(false);
  const [savedCenterOrdersLoading, setSavedCenterOrdersLoading] =
    useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null
  );
  const [selectedInstructorId, setSelectedInstructorId] = useState<
    string | null
  >(null);
  const [selectedBarOrderId, setSelectedBarOrderId] = useState<string | null>(
    null
  );
  const [selectedCenterOrderId, setSelectedCenterOrderId] = useState<
    string | null
  >(null);

  const hours = useMemo(
    () => Array.from({ length: 24 }, (_, idx) => String(idx).padStart(2, "0")),
    []
  );
  const minutes = useMemo(
    () => Array.from({ length: 60 }, (_, idx) => String(idx).padStart(2, "0")),
    []
  );
  const [startDraft, setStartDraft] = useState({ hour: "00", minute: "00" });
  const [endDraft, setEndDraft] = useState({ hour: "00", minute: "00" });
  const startHourListRef = useRef<HTMLDivElement>(null);
  const startMinuteListRef = useRef<HTMLDivElement>(null);
  const endHourListRef = useRef<HTMLDivElement>(null);
  const endMinuteListRef = useRef<HTMLDivElement>(null);

  const formatMeridiem = (hour: string) => (Number(hour) < 12 ? "오전" : "오후");
  const formatHour12 = (hour: string) => {
    const value = Number(hour);
    const normalized = value % 12 === 0 ? 12 : value % 12;
    return String(normalized);
  };
  const formatTimeDisplay = (hour: string, minute: string) =>
    `${formatMeridiem(hour)} ${formatHour12(hour)}시 ${minute}분`;
  // app/record/new/page.tsx의 getClampedNowTime과 동일한 로직 — 값이 없는 시간 피커를 열 때
  // 00:00 대신 현재 KST 시각으로 드래프트를 채운다(이른 새벽엔 최소 6시로 클램프).
  const getClampedNowTime = () => {
    const { hour, minute } = getSeoulTimeParts();
    const hourValue = Math.max(hour, 6);
    return {
      hour: String(hourValue).padStart(2, "0"),
      minute: String(minute).padStart(2, "0"),
    };
  };

  useEffect(() => {
    if (!startSheetOpen) return;
    requestAnimationFrame(() => {
      startHourListRef.current
        ?.querySelector(`[data-value="${startDraft.hour}"]`)
        ?.scrollIntoView({ block: "center" });
      startMinuteListRef.current
        ?.querySelector(`[data-value="${startDraft.minute}"]`)
        ?.scrollIntoView({ block: "center" });
    });
  }, [startSheetOpen, startDraft]);

  useEffect(() => {
    if (!endSheetOpen) return;
    requestAnimationFrame(() => {
      endHourListRef.current
        ?.querySelector(`[data-value="${endDraft.hour}"]`)
        ?.scrollIntoView({ block: "center" });
      endMinuteListRef.current
        ?.querySelector(`[data-value="${endDraft.minute}"]`)
        ?.scrollIntoView({ block: "center" });
    });
  }, [endSheetOpen, endDraft]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      openLoginSheet();
    }
  }, [user, loading, openLoginSheet]);

  const toggleWeekday = (value: number) => {
    setWeekdays((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    );
  };

  const plannedCount = useMemo(
    () => countPlannedOccurrences(new Set(weekdays), effectiveStartDate, untilDate),
    [weekdays, effectiveStartDate, untilDate]
  );

  // 시작일을 바꾸면 종료일의 하한(시작일)과 상한(시작일+3개월)이 즉시 바뀐다 — 이미 골라둔
  // 종료일이 새 구간을 벗어나면 조용히 다른 날짜로 밀어 넣지 않고 선택을 비워 재선택을 유도한다.
  useEffect(() => {
    if (!untilDate) return;
    const parsed = parseDateKey(untilDate);
    if (!parsed) return;
    if (
      parsed.getTime() < effectiveStartDate.getTime() ||
      parsed.getTime() > endDateCapDate.getTime()
    ) {
      setUntilDate("");
    }
  }, [effectiveStartDate, endDateCapDate, untilDate]);

  const addOrderTags = (
    rawValue: string,
    setTags: Dispatch<SetStateAction<string[]>>
  ) => {
    const nextTags = rawValue
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (nextTags.length === 0) return;
    setTags((prev) => {
      const merged = [...prev];
      nextTags.forEach((tag) => {
        if (!merged.includes(tag)) merged.push(tag);
      });
      return merged;
    });
  };

  const handleOrderInputKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    value: string,
    setValue: Dispatch<SetStateAction<string>>,
    setTags: Dispatch<SetStateAction<string[]>>
  ) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key !== "Enter") return;
    event.preventDefault();
    addOrderTags(value, setTags);
    setValue("");
  };

  const fetchSavedLocations = useCallback(async () => {
    if (!user) return;
    const cached = getLocationsCache<{ items: SavedLocation[] }>();
    if (cached) {
      setSavedLocations(cached.items);
      return;
    }
    setSavedLocationsLoading(true);
    const accessToken = await getAccessToken(openLoginSheet);
    if (!accessToken) {
      setSavedLocationsLoading(false);
      return;
    }
    const response = await fetch("/api/saved-locations", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      setSavedLocationsLoading(false);
      toast("저장된 장소를 불러오지 못했어요.");
      return;
    }
    const payload = (await response.json()) as { items: SavedLocation[] };
    const items = payload.items ?? [];
    setSavedLocations(items);
    setLocationsCache<{ items: SavedLocation[] }>({ items });
    setSavedLocationsLoading(false);
  }, [openLoginSheet, user]);

  const fetchSavedInstructorLevels = useCallback(async () => {
    if (!user) return;
    const cached = getInstructorLevelsCache<{ items: SavedInstructorLevel[] }>();
    if (cached) {
      setSavedInstructorLevels(cached.items);
      return;
    }
    setSavedInstructorLoading(true);
    const accessToken = await getAccessToken(openLoginSheet);
    if (!accessToken) {
      setSavedInstructorLoading(false);
      return;
    }
    const response = await fetch("/api/saved-instructor-levels", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      setSavedInstructorLoading(false);
      toast("저장된 선생님 & 레벨을 불러오지 못했어요.");
      return;
    }
    const payload = (await response.json()) as {
      items: SavedInstructorLevel[];
    };
    const items = payload.items ?? [];
    setSavedInstructorLevels(items);
    setInstructorLevelsCache<{ items: SavedInstructorLevel[] }>({ items });
    setSavedInstructorLoading(false);
  }, [openLoginSheet, user]);

  const fetchSavedBarOrders = useCallback(async () => {
    if (!user) return;
    const cached = getBarOrdersCache<{ items: SavedBarOrder[] }>();
    if (cached) {
      setSavedBarOrders(cached.items);
      return;
    }
    setSavedBarOrdersLoading(true);
    const accessToken = await getAccessToken(openLoginSheet);
    if (!accessToken) {
      setSavedBarOrdersLoading(false);
      return;
    }
    const response = await fetch("/api/saved-bar-orders", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      setSavedBarOrdersLoading(false);
      toast("저장된 바 순서를 불러오지 못했어요.");
      return;
    }
    const payload = (await response.json()) as { items: SavedBarOrder[] };
    const items = payload.items ?? [];
    setSavedBarOrders(items);
    setBarOrdersCache<{ items: SavedBarOrder[] }>({ items });
    setSavedBarOrdersLoading(false);
  }, [openLoginSheet, user]);

  const fetchSavedCenterOrders = useCallback(async () => {
    if (!user) return;
    const cached = getCenterOrdersCache<{ items: SavedCenterOrder[] }>();
    if (cached) {
      setSavedCenterOrders(cached.items);
      return;
    }
    setSavedCenterOrdersLoading(true);
    const accessToken = await getAccessToken(openLoginSheet);
    if (!accessToken) {
      setSavedCenterOrdersLoading(false);
      return;
    }
    const response = await fetch("/api/saved-center-orders", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      setSavedCenterOrdersLoading(false);
      toast("저장된 센터 순서를 불러오지 못했어요.");
      return;
    }
    const payload = (await response.json()) as {
      items: SavedCenterOrder[];
    };
    const items = payload.items ?? [];
    setSavedCenterOrders(items);
    setCenterOrdersCache<{ items: SavedCenterOrder[] }>({ items });
    setSavedCenterOrdersLoading(false);
  }, [openLoginSheet, user]);

  useEffect(() => {
    if (!locationSheetOpen) return;
    setSelectedLocationId(null);
    void fetchSavedLocations();
  }, [fetchSavedLocations, locationSheetOpen, user?.id]);

  useEffect(() => {
    if (!instructorSheetOpen) return;
    setSelectedInstructorId(null);
    void fetchSavedInstructorLevels();
  }, [fetchSavedInstructorLevels, instructorSheetOpen, user?.id]);

  useEffect(() => {
    if (!barOrderSheetOpen) return;
    setSelectedBarOrderId(null);
    void fetchSavedBarOrders();
  }, [barOrderSheetOpen, fetchSavedBarOrders, user?.id]);

  useEffect(() => {
    if (!centerOrderSheetOpen) return;
    setSelectedCenterOrderId(null);
    void fetchSavedCenterOrders();
  }, [centerOrderSheetOpen, fetchSavedCenterOrders, user?.id]);

  const handleApplyLocation = () => {
    const selected = savedLocations.find((item) => item.id === selectedLocationId);
    if (!selected) {
      toast("선택된 장소가 없어요.");
      return;
    }
    setShowLocation(true);
    setLocationName(selected.name);
    setLocationBase(selected.address_base ?? "");
    setLocationDetail(selected.address_detail ?? "");
    setLocationSheetOpen(false);
  };

  const handleApplyInstructorLevel = () => {
    const selected = savedInstructorLevels.find(
      (item) => item.id === selectedInstructorId
    );
    if (!selected) {
      toast("선택된 선생님 & 레벨이 없어요.");
      return;
    }
    setShowLevelInstructor(true);
    setInstructor(selected.instructor);
    setLevel(selected.level);
    setInstructorSheetOpen(false);
  };

  const handleApplyBarOrder = () => {
    const selected = savedBarOrders.find(
      (item) => item.id === selectedBarOrderId
    );
    if (!selected) {
      toast("선택된 바 순서가 없어요.");
      return;
    }
    const tags = selected.order_text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setShowBarOrder(true);
    setBarOrderTags(tags);
    setBarOrderSheetOpen(false);
  };

  const handleApplyCenterOrder = () => {
    const selected = savedCenterOrders.find(
      (item) => item.id === selectedCenterOrderId
    );
    if (!selected) {
      toast("선택된 센터 순서가 없어요.");
      return;
    }
    const tags = selected.order_text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setShowCenterOrder(true);
    setCenterOrderTags(tags);
    setCenterOrderSheetOpen(false);
  };

  const handleResultSheetOpenChange = (next: boolean) => {
    setResultSheetOpen(next);
    if (!next) {
      router.replace("/calendar");
    }
  };

  const handleSubmit = async () => {
    if (!user || submittingRef.current) return;

    if (weekdays.length === 0 || !startTime || !endTime || !untilDate) {
      toast("필수 항목을 입력해 주세요.");
      return;
    }
    if (endTime <= startTime) {
      toast("종료 시간이 시작 시간보다 빠를 수 없어요.");
      return;
    }
    if (plannedCount === 0) {
      toast("선택한 요일과 종료일로는 예정을 만들 수 없어요.");
      return;
    }

    submittingRef.current = true;
    setSaving(true);
    try {
      const session = await ensureSessionOrLogin(openLoginSheet);
      if (!session) return;

      if (!requestIdRef.current) {
        requestIdRef.current = createRequestId();
      }

      const resolvedLocation = showLocation
        ? buildLocationValue(locationName, locationBase, locationDetail)
        : "";

      // §11.1 안전망: UI가 (시작일 기준) 3개월 상한 이후 날짜 선택을 막지만(§9.5), 페이지를
      // 열어둔 채 자정을 넘기는 등의 경합에 대비해 제출 시점 기준으로도 다시 계산해 둔다.
      const freshToday = getSeoulTodayDate();
      const parsedStartDate = parseDateKey(startDate);
      const freshEffectiveStart =
        parsedStartDate && parsedStartDate.getTime() > freshToday.getTime()
          ? parsedStartDate
          : freshToday;
      const freshCapDate = addMonths(freshEffectiveStart, 3);
      const selectedUntilDate = parseDateKey(untilDate);
      const wasCapped = !!(
        selectedUntilDate && selectedUntilDate.getTime() > freshCapDate.getTime()
      );

      let response: Response;
      try {
        response = await fetch("/api/records/recurrences", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            weekdays,
            start_time: startTime,
            end_time: endTime,
            start_date: startDate,
            until_date: untilDate,
            client_request_id: requestIdRef.current,
            location: resolvedLocation,
            instructor: showLevelInstructor ? instructor : "",
            level: showLevelInstructor ? level : "",
            bar_order: showBarOrder ? barOrderTags.join(", ") : "",
            center_order: showCenterOrder ? centerOrderTags.join(", ") : "",
          }),
        });
      } catch {
        toast("네트워크 연결을 확인하고 다시 시도해 주세요.");
        return;
      }

      if (!response.ok) {
        toast("반복 수업 추가에 실패했어요.");
        return;
      }

      const payload = (await response.json()) as RecurrenceResponse;
      const created = payload.created ?? [];
      const skipped = payload.skipped ?? [];

      if (created.length === 0) {
        // #16/§9.6: 클라 선계산으로 등록 버튼을 이미 막아두지만, 서버가 0건으로 응답하는
        // 경합(예: 같은 슬롯 동시 생성)도 동일한 카피로 안내한다.
        toast("선택한 요일과 종료일로는 예정을 만들 수 없어요.");
        return;
      }

      // §11.3: 생성된 예정 날짜가 여러 달에 걸칠 수 있다. 프로필 캐시는 유저 단위라 1회
      // 호출로 충분(§11.3)하고, 날짜별 정밀도가 필요한 day뷰 캐시는 created 전체를 순회해
      // 각 날짜에 dirty flag를 남긴다. 캘린더 페이지는 이 flag가 하나라도 있으면 자체적으로
      // invalidateCalendarCache()를 호출해 전체 캐시를 무효화한다(app/(tabs)/calendar/page.tsx
      // handleRefresh 참조) — 여기서 별도로 호출할 필요 없음.
      invalidateProfileCache(user.id);
      invalidateProfileRecordsCache(user.id);
      markRecordDatesChanged(created);

      if (skipped.length === 0 && !wasCapped) {
        toast(`예정 ${created.length}개를 만들었어요.`);
        router.replace("/calendar");
        return;
      }

      setResultSummary({
        createdCount: created.length,
        skippedCount: skipped.length,
        wasCapped,
      });
      setResultSheetOpen(true);
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen items-center justify-center">
          <Spinner size="lg" />
        </main>
      </MobileContainer>
    );
  }

  if (!user) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="text-xs text-[#17171c]/70">
            로그인하면 반복 수업을 추가할 수 있어요.
          </p>
        </main>
      </MobileContainer>
    );
  }

  return (
    <MobileContainer>
      {saving ? <LoadingOverlay /> : null}
      <main className="px-4 pb-12">
        <PageHeader title="반복 수업 추가" className="mb-6" />

        <div className="space-y-8">
          <section className="space-y-4">
            <div>
              <Label className="text-sm text-[#17171c]/60">
                반복할 요일<span className="-ml-[1px] text-[#17171c]/50">*</span>
              </Label>
              <div className="mt-2 flex justify-between">
                {WEEKDAY_OPTIONS.map((option) => {
                  const selected = weekdays.includes(option.value);
                  return (
                    <Button
                      key={option.value}
                      type="button"
                      variant="outline"
                      className={cn(
                        "size-11 rounded-full border p-0 text-sm font-medium",
                        selected
                          ? "border-[#17171c] bg-[#17171c] text-white"
                          : "border-[#17171c]/10 bg-transparent text-[#17171c]/60"
                      )}
                      onClick={() => toggleWeekday(option.value)}
                    >
                      {option.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <Label className="text-sm text-[#17171c]/60">
                  시작일<span className="-ml-[1px] text-[#17171c]/50">*</span>
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 h-12 w-full justify-start gap-2 text-left text-sm font-normal"
                  onClick={() => {
                    setStartDateDraft(parseDateKey(startDate) ?? today);
                    setStartDateSheetOpen(true);
                  }}
                >
                  <CalendarDays className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {format(parseDateKey(startDate) ?? today, "MM월 dd일(EEE)", {
                      locale: ko,
                    })}
                  </span>
                </Button>
              </div>
              <div>
                <Label className="text-sm text-[#17171c]/60">
                  종료일<span className="-ml-[1px] text-[#17171c]/50">*</span>
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 h-12 w-full justify-start gap-2 text-left text-sm font-normal"
                  onClick={() => {
                    setUntilDraft(untilDate ? parseDateKey(untilDate) ?? undefined : undefined);
                    setUntilSheetOpen(true);
                  }}
                >
                  <CalendarDays className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {untilDate
                      ? format(parseDateKey(untilDate) ?? effectiveStartDate, "MM월 dd일(EEE)", {
                          locale: ko,
                        })
                      : "종료일 선택"}
                  </span>
                </Button>
              </div>
            </div>
            <p className="text-xs text-[#17171c]/50">
              시작일부터 최대 3개월까지 추가할 수 있어요.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <Label className="text-sm text-[#17171c]/60">
                  시작 시간<span className="-ml-[1px] text-[#17171c]/50">*</span>
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 h-12 w-full justify-start text-left text-sm font-normal"
                  onClick={() => {
                    if (startTime) {
                      const [hour, minute] = startTime.split(":");
                      setStartDraft({ hour, minute });
                    } else {
                      setStartDraft(getClampedNowTime());
                    }
                    setStartSheetOpen(true);
                  }}
                >
                  {startTime
                    ? formatTimeDisplay(...(startTime.split(":") as [string, string]))
                    : "시간 선택"}
                </Button>
              </div>
              <div>
                <Label className="text-sm text-[#17171c]/60">
                  종료 시간<span className="-ml-[1px] text-[#17171c]/50">*</span>
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 h-12 w-full justify-start text-left text-sm font-normal"
                  onClick={() => {
                    if (endTime) {
                      const [hour, minute] = endTime.split(":");
                      setEndDraft({ hour, minute });
                    } else {
                      setEndDraft(getClampedNowTime());
                    }
                    setEndSheetOpen(true);
                  }}
                >
                  {endTime
                    ? formatTimeDisplay(...(endTime.split(":") as [string, string]))
                    : "시간 선택"}
                </Button>
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="location-options"
                checked={showLocation}
                onCheckedChange={(checked) => {
                  const next = !!checked;
                  setShowLocation(next);
                  if (!next) {
                    setLocationName("");
                    setLocationBase("");
                    setLocationDetail("");
                  }
                }}
              />
              <Label htmlFor="location-options" className="text-sm text-[#17171c]/70">
                장소 입력
              </Label>
            </div>
            {showLocation ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-[#17171c]/60">장소</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 shrink-0 px-4 text-xs"
                    onClick={() => setLocationSheetOpen(true)}
                  >
                    불러오기
                  </Button>
                </div>
                <Input
                  type="text"
                  className="h-12 text-base placeholder:text-sm"
                  placeholder="장소 이름을 입력해 주세요"
                  value={locationName}
                  onChange={(event) => setLocationName(event.target.value)}
                />
                <Input
                  type="text"
                  className="h-12 text-base placeholder:text-sm"
                  placeholder="주소를 입력해 주세요"
                  value={locationBase}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setLocationBase((prev) => {
                      if (nextValue !== prev && locationDetail) {
                        setLocationDetail("");
                      }
                      return nextValue;
                    });
                  }}
                />
                <Input
                  type="text"
                  className="h-12 text-base placeholder:text-sm"
                  placeholder="상세 주소를 입력해 주세요 (선택사항)"
                  value={locationDetail}
                  onChange={(event) => setLocationDetail(event.target.value)}
                />
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <Checkbox
                id="level-instructor-options"
                checked={showLevelInstructor}
                onCheckedChange={(checked) => {
                  const next = !!checked;
                  setShowLevelInstructor(next);
                  if (!next) {
                    setInstructor("");
                    setLevel("");
                  }
                }}
              />
              <Label
                htmlFor="level-instructor-options"
                className="text-sm text-[#17171c]/70"
              >
                선생님 &amp; 레벨 입력
              </Label>
            </div>
            {showLevelInstructor ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[#17171c]/60">선생님 &amp; 레벨</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 shrink-0 px-4 text-xs"
                    onClick={() => setInstructorSheetOpen(true)}
                  >
                    불러오기
                  </Button>
                </div>
                <div className="space-y-3">
                  <Input
                    type="text"
                    className="h-12 text-base placeholder:text-sm"
                    placeholder="선생님을 입력해 주세요"
                    value={instructor}
                    onChange={(event) => setInstructor(event.target.value)}
                  />
                  <Input
                    type="text"
                    className="h-12 text-base placeholder:text-sm"
                    placeholder="레벨을 입력해 주세요"
                    value={level}
                    onChange={(event) => setLevel(event.target.value)}
                  />
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <Checkbox
                id="bar-order-options"
                checked={showBarOrder}
                onCheckedChange={(checked) => {
                  const next = !!checked;
                  setShowBarOrder(next);
                  if (!next) {
                    setBarOrderTags([]);
                    setBarOrderInput("");
                  }
                }}
              />
              <Label htmlFor="bar-order-options" className="text-sm text-[#17171c]/70">
                바 순서 입력
              </Label>
            </div>
            {showBarOrder ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-[#17171c]/60">바(bar) 순서</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 shrink-0 px-4 text-xs"
                    onClick={() => setBarOrderSheetOpen(true)}
                  >
                    불러오기
                  </Button>
                </div>
                <div className="space-y-2 rounded-lg border border-[#17171c]/10 bg-card p-3 min-h-[48px] flex items-center">
                  {barOrderTags.length === 0 ? (
                    <p className="text-sm text-[#17171c]/40">
                      선택된 순서가 여기 표시돼요.
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {barOrderTags.map((tag, index) => (
                        <div
                          key={`bar-selected-${tag}-${index}`}
                          className="flex items-center gap-2"
                        >
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-9 rounded-full px-3 text-sm"
                            onClick={() =>
                              setBarOrderTags((prev) =>
                                prev.filter((_, idx) => idx !== index)
                              )
                            }
                          >
                            {tag}
                          </Button>
                          {index < barOrderTags.length - 1 ? (
                            <span className="text-sm text-[#17171c]/40">&gt;</span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {BAR_ORDER_TAGS.map((tag) => {
                    const selected = barOrderTags.includes(tag);
                    return (
                      <Button
                        key={`bar-tag-${tag}`}
                        type="button"
                        variant={selected ? "default" : "outline"}
                        size="sm"
                        className="h-9 rounded-full px-3 text-sm"
                        onClick={() =>
                          setBarOrderTags((prev) =>
                            selected
                              ? prev.filter((value) => value !== tag)
                              : [...prev, tag]
                          )
                        }
                      >
                        {tag}
                      </Button>
                    );
                  })}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-[#17171c]/60">직접 입력</Label>
                  <Input
                    type="text"
                    className="h-12 text-base placeholder:text-sm"
                    placeholder="직접 입력하고 Enter로 추가해 주세요"
                    value={barOrderInput}
                    onChange={(event) => setBarOrderInput(event.target.value)}
                    onKeyDown={(event) =>
                      handleOrderInputKeyDown(
                        event,
                        barOrderInput,
                        setBarOrderInput,
                        setBarOrderTags
                      )
                    }
                  />
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <Checkbox
                id="center-order-options"
                checked={showCenterOrder}
                onCheckedChange={(checked) => {
                  const next = !!checked;
                  setShowCenterOrder(next);
                  if (!next) {
                    setCenterOrderTags([]);
                    setCenterOrderInput("");
                  }
                }}
              />
              <Label htmlFor="center-order-options" className="text-sm text-[#17171c]/70">
                센터 순서 입력
              </Label>
            </div>
            {showCenterOrder ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-[#17171c]/60">센터(center) 순서</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 shrink-0 px-4 text-xs"
                    onClick={() => setCenterOrderSheetOpen(true)}
                  >
                    불러오기
                  </Button>
                </div>
                <div className="space-y-2 rounded-lg border border-[#17171c]/10 bg-card p-3 min-h-[48px] flex items-center">
                  {centerOrderTags.length === 0 ? (
                    <p className="text-sm text-[#17171c]/40">
                      선택된 순서가 여기 표시돼요.
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {centerOrderTags.map((tag, index) => (
                        <div
                          key={`center-selected-${tag}-${index}`}
                          className="flex items-center gap-2"
                        >
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-9 rounded-full px-3 text-sm"
                            onClick={() =>
                              setCenterOrderTags((prev) =>
                                prev.filter((_, idx) => idx !== index)
                              )
                            }
                          >
                            {tag}
                          </Button>
                          {index < centerOrderTags.length - 1 ? (
                            <span className="text-sm text-[#17171c]/40">&gt;</span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {CENTER_ORDER_TAGS.map((tag) => {
                    const selected = centerOrderTags.includes(tag);
                    return (
                      <Button
                        key={`center-tag-${tag}`}
                        type="button"
                        variant={selected ? "default" : "outline"}
                        size="sm"
                        className="h-9 rounded-full px-3 text-sm"
                        onClick={() =>
                          setCenterOrderTags((prev) =>
                            selected
                              ? prev.filter((value) => value !== tag)
                              : [...prev, tag]
                          )
                        }
                      >
                        {tag}
                      </Button>
                    );
                  })}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-[#17171c]/60">직접 입력</Label>
                  <Input
                    type="text"
                    className="h-12 text-base placeholder:text-sm"
                    placeholder="직접 입력하고 Enter로 추가해 주세요"
                    value={centerOrderInput}
                    onChange={(event) => setCenterOrderInput(event.target.value)}
                    onKeyDown={(event) =>
                      handleOrderInputKeyDown(
                        event,
                        centerOrderInput,
                        setCenterOrderInput,
                        setCenterOrderTags
                      )
                    }
                  />
                </div>
              </div>
            ) : null}
          </section>

          <Button
            type="button"
            className="h-12 w-full"
            disabled={saving || plannedCount === 0}
            onClick={handleSubmit}
          >
            반복 수업 추가하기
          </Button>
        </div>

        <BottomSheet open={startSheetOpen} onOpenChange={setStartSheetOpen}>
          <div className="mt-2 grid grid-cols-3 gap-3">
            <div className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-[#17171c]/5 p-2">
              <div
                className={`flex h-10 items-center justify-center rounded-md text-sm ${
                  Number(startDraft.hour) < 12
                    ? "bg-[#17171c]/5 text-[#17171c]"
                    : "text-[#17171c]/40"
                }`}
              >
                오전
              </div>
              <div
                className={`flex h-10 items-center justify-center rounded-md text-sm ${
                  Number(startDraft.hour) >= 12
                    ? "bg-[#17171c]/5 text-[#17171c]"
                    : "text-[#17171c]/40"
                }`}
              >
                오후
              </div>
            </div>
            <div
              ref={startHourListRef}
              className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-[#17171c]/5 p-2"
            >
              {hours.map((hour) => (
                <Button
                  key={`start-hour-${hour}`}
                  type="button"
                  variant={startDraft.hour === hour ? "default" : "ghost"}
                  className="w-full justify-start"
                  data-value={hour}
                  onClick={() => setStartDraft((prev) => ({ ...prev, hour }))}
                >
                  {formatHour12(hour)}시
                </Button>
              ))}
            </div>
            <div
              ref={startMinuteListRef}
              className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-[#17171c]/5 p-2"
            >
              {minutes.map((minute) => (
                <Button
                  key={`start-min-${minute}`}
                  type="button"
                  variant={startDraft.minute === minute ? "default" : "ghost"}
                  className="w-full justify-start"
                  data-value={minute}
                  onClick={() => setStartDraft((prev) => ({ ...prev, minute }))}
                >
                  {minute}분
                </Button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <Button
              className="h-12 w-full"
              onClick={() => {
                setStartTime(`${startDraft.hour}:${startDraft.minute}`);
                setStartSheetOpen(false);
              }}
            >
              적용하기
            </Button>
          </div>
        </BottomSheet>

        <BottomSheet open={endSheetOpen} onOpenChange={setEndSheetOpen}>
          <div className="mt-2 grid grid-cols-3 gap-3">
            <div className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-[#17171c]/5 p-2">
              <div
                className={`flex h-10 items-center justify-center rounded-md text-sm ${
                  Number(endDraft.hour) < 12
                    ? "bg-[#17171c]/5 text-[#17171c]"
                    : "text-[#17171c]/40"
                }`}
              >
                오전
              </div>
              <div
                className={`flex h-10 items-center justify-center rounded-md text-sm ${
                  Number(endDraft.hour) >= 12
                    ? "bg-[#17171c]/5 text-[#17171c]"
                    : "text-[#17171c]/40"
                }`}
              >
                오후
              </div>
            </div>
            <div
              ref={endHourListRef}
              className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-[#17171c]/5 p-2"
            >
              {hours.map((hour) => (
                <Button
                  key={`end-hour-${hour}`}
                  type="button"
                  variant={endDraft.hour === hour ? "default" : "ghost"}
                  className="w-full justify-start"
                  data-value={hour}
                  onClick={() => setEndDraft((prev) => ({ ...prev, hour }))}
                >
                  {formatHour12(hour)}시
                </Button>
              ))}
            </div>
            <div
              ref={endMinuteListRef}
              className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-[#17171c]/5 p-2"
            >
              {minutes.map((minute) => (
                <Button
                  key={`end-min-${minute}`}
                  type="button"
                  variant={endDraft.minute === minute ? "default" : "ghost"}
                  className="w-full justify-start"
                  data-value={minute}
                  onClick={() => setEndDraft((prev) => ({ ...prev, minute }))}
                >
                  {minute}분
                </Button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <Button
              className="h-12 w-full"
              onClick={() => {
                setEndTime(`${endDraft.hour}:${endDraft.minute}`);
                setEndSheetOpen(false);
              }}
            >
              적용하기
            </Button>
          </div>
        </BottomSheet>

        <BottomSheet open={startDateSheetOpen} onOpenChange={setStartDateSheetOpen}>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              locale={dayPickerKo}
              selected={startDateDraft}
              onSelect={setStartDateDraft}
              defaultMonth={startDateDraft ?? today}
              disabled={[{ before: today }]}
            />
          </div>
          <div className="mt-4">
            <Button
              className="h-12 w-full"
              disabled={!startDateDraft}
              onClick={() => {
                if (!startDateDraft) return;
                setStartDate(formatDateKeyFromLocalDate(startDateDraft));
                setStartDateSheetOpen(false);
              }}
            >
              적용하기
            </Button>
          </div>
        </BottomSheet>

        <BottomSheet open={untilSheetOpen} onOpenChange={setUntilSheetOpen}>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              locale={dayPickerKo}
              selected={untilDraft}
              onSelect={setUntilDraft}
              defaultMonth={untilDraft ?? effectiveStartDate}
              disabled={[{ before: effectiveStartDate }, { after: endDateCapDate }]}
            />
          </div>
          <div className="mt-4">
            <Button
              className="h-12 w-full"
              disabled={!untilDraft}
              onClick={() => {
                if (!untilDraft) return;
                setUntilDate(formatDateKeyFromLocalDate(untilDraft));
                setUntilSheetOpen(false);
              }}
            >
              적용하기
            </Button>
          </div>
        </BottomSheet>

        <BottomSheet open={locationSheetOpen} onOpenChange={setLocationSheetOpen}>
          <div className="space-y-3">
            {savedLocationsLoading ? (
              <div className="flex min-h-[120px] items-center justify-center">
                <Spinner size="lg" />
              </div>
            ) : savedLocations.length === 0 ? (
              <div className="rounded-lg border border-[#17171c]/5 bg-card px-4 py-6 text-center">
                <p className="text-xs text-[#17171c]/70">
                  저장된 장소가 아직 없어요.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-full text-xs"
                  onClick={() => router.push("/calendar/settings/locations")}
                >
                  추가하러 가기
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {savedLocations.map((item) => {
                  const selected = item.id === selectedLocationId;
                  return (
                    <Button
                      key={item.id}
                      type="button"
                      variant="outline"
                      className={`h-auto w-full justify-between px-4 py-3 text-left ${
                        selected ? "border-[#17171c]/40 bg-[#17171c]/5 text-[#17171c]" : ""
                      }`}
                      onClick={() => setSelectedLocationId(item.id)}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4" />
                          {item.name}
                        </div>
                        {item.address_base || item.address_detail ? (
                          <p className="text-xs text-[#17171c]/70">
                            {item.address_base}
                            {item.address_detail ? ` ${item.address_detail}` : ""}
                          </p>
                        ) : null}
                      </div>
                      {selected ? <Check className="h-4 w-4 text-[#17171c]" /> : null}
                    </Button>
                  );
                })}
              </div>
            )}
            <Button
              type="button"
              className="h-12 w-full bg-[#17171c] text-sm text-white"
              onClick={handleApplyLocation}
              disabled={!selectedLocationId}
            >
              적용하기
            </Button>
          </div>
        </BottomSheet>

        <BottomSheet open={instructorSheetOpen} onOpenChange={setInstructorSheetOpen}>
          <div className="space-y-3">
            {savedInstructorLoading ? (
              <div className="flex min-h-[120px] items-center justify-center">
                <Spinner size="lg" />
              </div>
            ) : savedInstructorLevels.length === 0 ? (
              <div className="rounded-lg border border-[#17171c]/5 bg-card px-4 py-6 text-center">
                <p className="text-xs text-[#17171c]/70">
                  저장된 선생님 & 레벨이 아직 없어요.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-full text-xs"
                  onClick={() => router.push("/calendar/settings/instructor-levels")}
                >
                  추가하러 가기
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {savedInstructorLevels.map((item) => {
                  const selected = item.id === selectedInstructorId;
                  return (
                    <Button
                      key={item.id}
                      type="button"
                      variant="outline"
                      className={`h-auto w-full justify-between px-4 py-3 text-left ${
                        selected ? "border-[#17171c]/40 bg-[#17171c]/5 text-[#17171c]" : ""
                      }`}
                      onClick={() => setSelectedInstructorId(item.id)}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <UserRound className="h-4 w-4" />
                          {item.instructor}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#17171c]/70">
                          <Layers className="h-3.5 w-3.5" />
                          {item.level}
                        </div>
                      </div>
                      {selected ? <Check className="h-4 w-4 text-[#17171c]" /> : null}
                    </Button>
                  );
                })}
              </div>
            )}
            <Button
              type="button"
              className="h-12 w-full bg-[#17171c] text-sm text-white"
              onClick={handleApplyInstructorLevel}
              disabled={!selectedInstructorId}
            >
              적용하기
            </Button>
          </div>
        </BottomSheet>

        <BottomSheet open={barOrderSheetOpen} onOpenChange={setBarOrderSheetOpen}>
          <div className="space-y-3">
            {savedBarOrdersLoading ? (
              <div className="flex min-h-[120px] items-center justify-center">
                <Spinner size="lg" />
              </div>
            ) : savedBarOrders.length === 0 ? (
              <div className="rounded-lg border border-[#17171c]/5 bg-card px-4 py-6 text-center">
                <p className="text-xs text-[#17171c]/70">
                  저장된 바 순서가 아직 없어요.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-full text-xs"
                  onClick={() => router.push("/calendar/settings/bar-orders")}
                >
                  추가하러 가기
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {savedBarOrders.map((item) => {
                  const selected = item.id === selectedBarOrderId;
                  const barTags = item.order_text
                    ? item.order_text.split(",").map((s) => s.trim()).filter(Boolean)
                    : [];
                  return (
                    <Button
                      key={item.id}
                      type="button"
                      variant="outline"
                      className={`h-auto w-full flex-col items-stretch gap-0 px-4 py-3 text-left ${
                        selected ? "border-[#17171c]/40 bg-[#17171c]/5 text-[#17171c]" : ""
                      }`}
                      onClick={() => setSelectedBarOrderId(item.id)}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <ListOrdered className="h-4 w-4 shrink-0 text-[#17171c]/50" />
                          <span className="truncate text-sm font-medium">{item.name}</span>
                        </div>
                        {selected ? (
                          <Check className="h-4 w-4 shrink-0 text-[#17171c]" />
                        ) : null}
                      </div>
                      {barTags.length > 0 ? (
                        <div className="mt-2 flex w-full flex-wrap items-center gap-2">
                          {barTags.map((tag, index, arr) => (
                            <div
                              key={`${item.id}-${tag}-${index}`}
                              className="flex items-center gap-2"
                            >
                              <span className="inline-flex h-7 items-center rounded-full bg-secondary px-2 text-sm">
                                {tag}
                              </span>
                              {index < arr.length - 1 ? (
                                <span className="text-sm text-[#17171c]/40">&gt;</span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </Button>
                  );
                })}
              </div>
            )}
            <Button
              type="button"
              className="h-12 w-full bg-[#17171c] text-sm text-white"
              onClick={handleApplyBarOrder}
              disabled={!selectedBarOrderId}
            >
              적용하기
            </Button>
          </div>
        </BottomSheet>

        <BottomSheet open={centerOrderSheetOpen} onOpenChange={setCenterOrderSheetOpen}>
          <div className="space-y-3">
            {savedCenterOrdersLoading ? (
              <div className="flex min-h-[120px] items-center justify-center">
                <Spinner size="lg" />
              </div>
            ) : savedCenterOrders.length === 0 ? (
              <div className="rounded-lg border border-[#17171c]/5 bg-card px-4 py-6 text-center">
                <p className="text-xs text-[#17171c]/70">
                  저장된 센터 순서가 아직 없어요.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-full text-xs"
                  onClick={() => router.push("/calendar/settings/center-orders")}
                >
                  추가하러 가기
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {savedCenterOrders.map((item) => {
                  const selected = item.id === selectedCenterOrderId;
                  const centerTags = item.order_text
                    ? item.order_text.split(",").map((s) => s.trim()).filter(Boolean)
                    : [];
                  return (
                    <Button
                      key={item.id}
                      type="button"
                      variant="outline"
                      className={`h-auto w-full flex-col items-stretch gap-0 px-4 py-3 text-left ${
                        selected ? "border-[#17171c]/40 bg-[#17171c]/5 text-[#17171c]" : ""
                      }`}
                      onClick={() => setSelectedCenterOrderId(item.id)}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <ListOrdered className="h-4 w-4 shrink-0 text-[#17171c]/50" />
                          <span className="truncate text-sm font-medium">{item.name}</span>
                        </div>
                        {selected ? (
                          <Check className="h-4 w-4 shrink-0 text-[#17171c]" />
                        ) : null}
                      </div>
                      {centerTags.length > 0 ? (
                        <div className="mt-2 flex w-full flex-wrap items-center gap-2">
                          {centerTags.map((tag, index, arr) => (
                            <div
                              key={`${item.id}-${tag}-${index}`}
                              className="flex items-center gap-2"
                            >
                              <span className="inline-flex h-7 items-center rounded-full bg-secondary px-2 text-sm">
                                {tag}
                              </span>
                              {index < arr.length - 1 ? (
                                <span className="text-sm text-[#17171c]/40">&gt;</span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </Button>
                  );
                })}
              </div>
            )}
            <Button
              type="button"
              className="h-12 w-full bg-[#17171c] text-sm text-white"
              onClick={handleApplyCenterOrder}
              disabled={!selectedCenterOrderId}
            >
              적용하기
            </Button>
          </div>
        </BottomSheet>

        <BottomSheet open={resultSheetOpen} onOpenChange={handleResultSheetOpenChange}>
          <div className="space-y-4 text-center">
            <p className="text-base font-semibold">반복 수업 추가를 완료했어요</p>
            <div className="space-y-2 text-left text-sm text-[#17171c]/80">
              <div className="flex items-center gap-2">
                <span className="size-1.5 shrink-0 rounded-full bg-[#17171c]/30" />
                <span>예정 {resultSummary?.createdCount ?? 0}개를 만들었어요</span>
              </div>
              {resultSummary && resultSummary.skippedCount > 0 ? (
                <div className="flex items-center gap-2">
                  <span className="size-1.5 shrink-0 rounded-full bg-[#17171c]/30" />
                  <span>겹치는 날짜 {resultSummary.skippedCount}일은 건너뛰었어요</span>
                </div>
              ) : null}
              {resultSummary?.wasCapped ? (
                <div className="flex items-center gap-2">
                  <span className="size-1.5 shrink-0 rounded-full bg-[#17171c]/30" />
                  <span>3개월까지만 추가할 수 있어요</span>
                </div>
              ) : null}
            </div>
            <Button
              type="button"
              className="h-12 w-full"
              onClick={() => handleResultSheetOpenChange(false)}
            >
              확인
            </Button>
          </div>
        </BottomSheet>
      </main>
    </MobileContainer>
  );
}
