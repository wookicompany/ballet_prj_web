"use client";
/* eslint-disable react-hooks/set-state-in-effect */

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
import AnimatedImage from "@/components/ui/animated-image";
import { useParams, useRouter } from "next/navigation";

import { format } from "date-fns";
import { ko } from "date-fns/locale";
import MoodSelector from "@/components/records/MoodSelector";
import MobileContainer from "@/components/layout/MobileContainer";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginSheet } from "@/components/auth/LoginSheetProvider";
import { ensureSessionOrLogin, getAccessToken } from "@/lib/authSession";
import {
  getSeoulDateParts,
  getSeoulTodayDate,
  getSeoulTimeParts,
  parseDateKey,
} from "@/lib/kstDateTime";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  RN_HEALTH_SYNC_RESULT_EVENT,
  RN_PLATFORM_INFO_EVENT,
  isInReactNativeWebView,
  requestHealthSyncFromApp,
  resolveHealthSyncFromBridgeMessage,
  resolvePlatformInfoFromBridgeMessage,
  sendHapticToApp,
} from "@/lib/reactNativeWebView";
import type { AppPlatform, HealthSyncErrorCode } from "@/lib/reactNativeWebView";
import { BAR_ORDER_TAGS, CENTER_ORDER_TAGS } from "@/lib/orderTags";
import { invalidateProfileCache } from "@/lib/profileCache";
import { supabase } from "@/lib/supabaseClient";
import {
  Activity,
  CalendarDays,
  Check,
  ChevronLeft,
  Flame,
  Heart,
  HeartPulse,
  Layers,
  ListOrdered,
  MapPin,
  Plus,
  UserRound,
  X,
} from "lucide-react";
import BottomSheet from "@/components/sheets/BottomSheet";
import { toast } from "sonner";

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const BUCKET = "record-media";

const LOCATION_DELIMITER = " | ";
const ADDRESS_DELIMITER = " || ";

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

const parseLocationValue = (value: string) => {
  if (!value) {
    return { name: "", base: "", detail: "" };
  }
  if (value.includes(LOCATION_DELIMITER)) {
    const [name, ...rest] = value.split(LOCATION_DELIMITER);
    const address = rest.join(LOCATION_DELIMITER).trim();
    if (address.includes(ADDRESS_DELIMITER)) {
      const [base, ...detailParts] = address.split(ADDRESS_DELIMITER);
      return {
        name: name.trim(),
        base: base.trim(),
        detail: detailParts.join(ADDRESS_DELIMITER).trim(),
      };
    }
    return { name: name.trim(), base: address, detail: "" };
  }
  if (value.includes(ADDRESS_DELIMITER)) {
    const [base, ...detailParts] = value.split(ADDRESS_DELIMITER);
    return {
      name: "",
      base: base.trim(),
      detail: detailParts.join(ADDRESS_DELIMITER).trim(),
    };
  }
  return { name: "", base: value.trim(), detail: "" };
};

const getSafeFileName = (file: File) => {
  const fallbackExt = file.type?.split("/")[1] || "jpg";
  const match = file.name.match(/\.([a-zA-Z0-9]+)$/);
  const ext = match ? match[1].toLowerCase() : fallbackExt;
  const seed = Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${seed}.${ext}`;
};

type FormState = {
  record_date: string;
  start_time: string;
  end_time: string;
  content: string;
  mood: number | null;
  location: string;
  level: string;
  instructor: string;
  bar_order: string;
  center_order: string;
  did_well: string;
  improve_next: string;
  memo: string;
  workout_activity_label: string | null;
  workout_source_name: string | null;
  workout_device_name: string | null;
  workout_active_energy_kcal: number | null;
  workout_total_energy_kcal: number | null;
  workout_avg_bpm: number | null;
  workout_max_bpm: number | null;
};

type SyncedWorkout = {
  activityLabel: string | null;
  sourceName: string | null;
  deviceName: string | null;
  activeEnergyKcal: number | null;
  totalEnergyKcal: number | null;
  avgBpm: number | null;
  maxBpm: number | null;
};

const getHealthSyncErrorMessage = (code: HealthSyncErrorCode) => {
  if (code === "NO_PERMISSION") return "Apple Health 권한을 확인해 주세요.";
  if (code === "NO_DATA") {
    return "선택한 날짜에는 불러올 운동 기록이 아직 없어요.";
  }
  if (code === "TIMEOUT") return "요청 시간이 초과됐어요. 다시 시도해 주세요.";
  return "운동 데이터를 불러오지 못했어요.";
};

const createRequestId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

export default function RecordEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const { openLoginSheet } = useLoginSheet();
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [recordLoading, setRecordLoading] = useState(true);
  const [showBarOrder, setShowBarOrder] = useState(false);
  const [showCenterOrder, setShowCenterOrder] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [showLevelInstructor, setShowLevelInstructor] = useState(false);
  const [showHealthSync, setShowHealthSync] = useState(false);
  const [barOrderTags, setBarOrderTags] = useState<string[]>([]);
  const [centerOrderTags, setCenterOrderTags] = useState<string[]>([]);
  const [barOrderInput, setBarOrderInput] = useState("");
  const [centerOrderInput, setCenterOrderInput] = useState("");
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const [instructorSheetOpen, setInstructorSheetOpen] = useState(false);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [savedInstructorLevels, setSavedInstructorLevels] = useState<
    SavedInstructorLevel[]
  >([]);
  const [savedLocationsLoading, setSavedLocationsLoading] = useState(false);
  const [savedInstructorLoading, setSavedInstructorLoading] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null
  );
  const [selectedInstructorId, setSelectedInstructorId] = useState<
    string | null
  >(null);
  const [barOrderSheetOpen, setBarOrderSheetOpen] = useState(false);
  const [centerOrderSheetOpen, setCenterOrderSheetOpen] = useState(false);
  const [savedBarOrders, setSavedBarOrders] = useState<SavedBarOrder[]>([]);
  const [savedCenterOrders, setSavedCenterOrders] = useState<
    SavedCenterOrder[]
  >([]);
  const [savedBarOrdersLoading, setSavedBarOrdersLoading] = useState(false);
  const [savedCenterOrdersLoading, setSavedCenterOrdersLoading] =
    useState(false);
  const [selectedBarOrderId, setSelectedBarOrderId] = useState<string | null>(
    null
  );
  const [selectedCenterOrderId, setSelectedCenterOrderId] = useState<
    string | null
  >(null);
  const [existingMedia, setExistingMedia] = useState<
    Array<{ id: string; url: string }>
  >([]);
  const [removedMediaIds, setRemovedMediaIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [startSheetOpen, setStartSheetOpen] = useState(false);
  const [endSheetOpen, setEndSheetOpen] = useState(false);
  const yearListRef = useRef<HTMLDivElement>(null);
  const monthListRef = useRef<HTMLDivElement>(null);
  const dayListRef = useRef<HTMLDivElement>(null);
  const startHourListRef = useRef<HTMLDivElement>(null);
  const startMinuteListRef = useRef<HTMLDivElement>(null);
  const endHourListRef = useRef<HTMLDivElement>(null);
  const endMinuteListRef = useRef<HTMLDivElement>(null);
  const [startDraft, setStartDraft] = useState({ hour: "00", minute: "00" });
  const [endDraft, setEndDraft] = useState({ hour: "00", minute: "00" });
  const [dateDraft, setDateDraft] = useState(() => getSeoulDateParts());
  const [locationName, setLocationName] = useState("");
  const [locationBase, setLocationBase] = useState("");
  const [locationDetail, setLocationDetail] = useState("");
  const [detectedPlatform, setDetectedPlatform] = useState<AppPlatform | null>(
    null
  );
  const [isIosHealthkit, setIsIosHealthkit] = useState(false);
  const [healthSyncing, setHealthSyncing] = useState(false);
  const [healthSyncRequestId, setHealthSyncRequestId] = useState<string | null>(
    null
  );
  const [syncedWorkoutDraft, setSyncedWorkoutDraft] = useState<SyncedWorkout | null>(
    null
  );
  const lastSavedPlatformRef = useRef<AppPlatform | null>(null);
  const hours = useMemo(
    () => Array.from({ length: 24 }, (_, idx) => String(idx).padStart(2, "0")),
    []
  );
  const minutes = useMemo(
    () => Array.from({ length: 60 }, (_, idx) => String(idx).padStart(2, "0")),
    []
  );
  const years = useMemo(() => {
    const currentYear = getSeoulDateParts().year;
    return Array.from({ length: 6 }, (_, idx) => currentYear - 2 + idx);
  }, []);
  const months = useMemo(() => Array.from({ length: 12 }, (_, idx) => idx + 1), []);

  useEffect(() => {
    if (!dateSheetOpen) return;

    const scrollToCenter = (container: HTMLDivElement | null, value: string) => {
      if (!container) return;
      const target = container.querySelector<HTMLButtonElement>(
        `button[data-value="${value}"]`
      );
      if (!target) return;
      target.scrollIntoView({ block: "center", inline: "center" });
    };

    const frame = requestAnimationFrame(() => {
      scrollToCenter(yearListRef.current, String(dateDraft.year));
      scrollToCenter(monthListRef.current, String(dateDraft.month).padStart(2, "0"));
      scrollToCenter(dayListRef.current, String(dateDraft.day).padStart(2, "0"));
    });

    return () => cancelAnimationFrame(frame);
  }, [dateSheetOpen, dateDraft.year, dateDraft.month, dateDraft.day]);

  useEffect(() => {
    if (!startSheetOpen) return;
    requestAnimationFrame(() => {
      const hourTarget = startHourListRef.current?.querySelector(
        `[data-value="${startDraft.hour}"]`
      );
      const minuteTarget = startMinuteListRef.current?.querySelector(
        `[data-value="${startDraft.minute}"]`
      );
      hourTarget?.scrollIntoView({ block: "center" });
      minuteTarget?.scrollIntoView({ block: "center" });
    });
  }, [startSheetOpen, startDraft]);

  useEffect(() => {
    if (!endSheetOpen) return;
    requestAnimationFrame(() => {
      const hourTarget = endHourListRef.current?.querySelector(
        `[data-value="${endDraft.hour}"]`
      );
      const minuteTarget = endMinuteListRef.current?.querySelector(
        `[data-value="${endDraft.minute}"]`
      );
      hourTarget?.scrollIntoView({ block: "center" });
      minuteTarget?.scrollIntoView({ block: "center" });
    });
  }, [endSheetOpen, endDraft]);

  const [form, setForm] = useState<FormState>({
    record_date: "",
    start_time: "",
    end_time: "",
    content: "",
    mood: null,
    location: "",
    level: "",
    instructor: "",
    bar_order: "",
    center_order: "",
    did_well: "",
    improve_next: "",
    memo: "",
    workout_activity_label: null,
    workout_source_name: null,
    workout_device_name: null,
    workout_active_energy_kcal: null,
    workout_total_energy_kcal: null,
    workout_avg_bpm: null,
    workout_max_bpm: null,
  });

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
    setSavedLocationsLoading(true);
    const accessToken = await getAccessToken(openLoginSheet);
    if (!accessToken) {
      setSavedLocationsLoading(false);
      return;
    }
    const response = await fetch("/api/saved-locations", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      setSavedLocationsLoading(false);
      toast("저장된 장소를 불러오지 못했어요.");
      return;
    }
    const payload = (await response.json()) as { items: SavedLocation[] };
    setSavedLocations(payload.items ?? []);
    setSavedLocationsLoading(false);
  }, [openLoginSheet, user]);

  const fetchSavedInstructorLevels = useCallback(async () => {
    if (!user) return;
    setSavedInstructorLoading(true);
    const accessToken = await getAccessToken(openLoginSheet);
    if (!accessToken) {
      setSavedInstructorLoading(false);
      return;
    }
    const response = await fetch("/api/saved-instructor-levels", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      setSavedInstructorLoading(false);
      toast("저장된 강사님 & 레벨을 불러오지 못했어요.");
      return;
    }
    const payload = (await response.json()) as {
      items: SavedInstructorLevel[];
    };
    setSavedInstructorLevels(payload.items ?? []);
    setSavedInstructorLoading(false);
  }, [openLoginSheet, user]);

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
      toast("선택된 강사님 & 레벨이 없어요.");
      return;
    }
    setShowLevelInstructor(true);
    setForm((prev) => ({
      ...prev,
      instructor: selected.instructor,
      level: selected.level,
    }));
    setInstructorSheetOpen(false);
  };

  const fetchSavedBarOrders = useCallback(async () => {
    if (!user) return;
    setSavedBarOrdersLoading(true);
    const accessToken = await getAccessToken(openLoginSheet);
    if (!accessToken) {
      setSavedBarOrdersLoading(false);
      return;
    }
    const response = await fetch("/api/saved-bar-orders", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      setSavedBarOrdersLoading(false);
      toast("저장된 바 순서를 불러오지 못했어요.");
      return;
    }
    const payload = (await response.json()) as { items: SavedBarOrder[] };
    setSavedBarOrders(payload.items ?? []);
    setSavedBarOrdersLoading(false);
  }, [openLoginSheet, user]);

  const fetchSavedCenterOrders = useCallback(async () => {
    if (!user) return;
    setSavedCenterOrdersLoading(true);
    const accessToken = await getAccessToken(openLoginSheet);
    if (!accessToken) {
      setSavedCenterOrdersLoading(false);
      return;
    }
    const response = await fetch("/api/saved-center-orders", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      setSavedCenterOrdersLoading(false);
      toast("저장된 센터 순서를 불러오지 못했어요.");
      return;
    }
    const payload = (await response.json()) as {
      items: SavedCenterOrder[];
    };
    setSavedCenterOrders(payload.items ?? []);
    setSavedCenterOrdersLoading(false);
  }, [openLoginSheet, user]);

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

  useEffect(() => {
    const fetchRecord = async () => {
      if (authLoading) return;
      if (!user) {
        openLoginSheet();
        return;
      }

      const { data } = await supabase
        .from("records")
        .select(
          "record_date,start_time,end_time,content,mood,location,level,instructor,bar_order,center_order,did_well,improve_next,memo,workout_activity_label,workout_source_name,workout_device_name,workout_active_energy_kcal,workout_total_energy_kcal,workout_avg_bpm,workout_max_bpm,record_media(id,url,created_at,deleted_at)"
        )
        .eq("id", params.id)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .single();

    if (data) {
        const barTags = data.bar_order
          ? data.bar_order.split(",").map((value) => value.trim()).filter(Boolean)
          : [];
        const centerTags = data.center_order
          ? data.center_order
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean)
          : [];
        setForm({
          record_date: data.record_date,
          start_time: data.start_time,
          end_time: data.end_time,
          content: data.content,
          mood: data.mood,
          location: data.location ?? "",
          level: data.level ?? "",
          instructor: data.instructor ?? "",
          bar_order: data.bar_order ?? "",
          center_order: data.center_order ?? "",
          did_well: data.did_well ?? "",
          improve_next: data.improve_next ?? "",
          memo: data.memo ?? "",
          workout_activity_label: data.workout_activity_label ?? null,
          workout_source_name: data.workout_source_name ?? null,
          workout_device_name: data.workout_device_name ?? null,
          workout_active_energy_kcal: data.workout_active_energy_kcal ?? null,
          workout_total_energy_kcal: data.workout_total_energy_kcal ?? null,
          workout_avg_bpm: data.workout_avg_bpm ?? null,
          workout_max_bpm: data.workout_max_bpm ?? null,
        });
        setBarOrderTags(barTags);
        setCenterOrderTags(centerTags);
        const hasHealthSyncValue = Boolean(
          data.workout_activity_label ||
            data.workout_source_name ||
            data.workout_device_name ||
            data.workout_active_energy_kcal !== null ||
            data.workout_total_energy_kcal !== null ||
            data.workout_avg_bpm !== null ||
            data.workout_max_bpm !== null
        );
        setShowBarOrder(barTags.length > 0);
        setShowCenterOrder(centerTags.length > 0);
        setShowLocation(Boolean(data.location));
        setShowLevelInstructor(Boolean(data.level || data.instructor));
        setShowHealthSync(hasHealthSyncValue);
        const parsedLocation = parseLocationValue(data.location ?? "");
        setLocationName(parsedLocation.name);
        setLocationBase(parsedLocation.base);
        setLocationDetail(parsedLocation.detail);
      }

      // APP_AGENTS.md: deleted_at 소프트 삭제 규칙 — 클라이언트 후처리
      setExistingMedia(
        (data?.record_media ?? [])
          .filter((m) => !m.deleted_at)
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map(({ id, url }) => ({ id, url }))
      );
      setRemovedMediaIds([]);
      setRecordLoading(false);
    };

    fetchRecord();
  }, [params.id, user, router, authLoading, openLoginSheet]);

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

  const saveDetectedPlatform = useCallback(
    async (platform: AppPlatform) => {
      if (!user) return;
      if (lastSavedPlatformRef.current === platform) return;
      const accessToken = await getAccessToken(openLoginSheet);
      if (!accessToken) return;

      const response = await fetch("/api/profile/platform", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ app_platform: platform }),
      });
      if (response.ok) {
        lastSavedPlatformRef.current = platform;
      }
    },
    [openLoginSheet, user]
  );

  useEffect(() => {
    if (!detectedPlatform || !user) return;
    void saveDetectedPlatform(detectedPlatform);
  }, [detectedPlatform, saveDetectedPlatform, user]);

  useEffect(() => {
    if (typeof window === "undefined" || !isInReactNativeWebView()) return;

    const handlePlatform = (raw: unknown) => {
      const platformInfo = resolvePlatformInfoFromBridgeMessage(raw);
      if (!platformInfo) return;
      setDetectedPlatform(platformInfo.platform);
      setIsIosHealthkit(
        platformInfo.platform === "ios" && platformInfo.healthProvider === "healthkit"
      );
    };

    const handleHealthResult = (raw: unknown) => {
      const result = resolveHealthSyncFromBridgeMessage(raw);
      if (!result) return;
      if (!healthSyncRequestId || result.requestId !== healthSyncRequestId) return;

      setHealthSyncing(false);
      setHealthSyncRequestId(null);

      if (result.status === "error") {
        toast(getHealthSyncErrorMessage(result.code));
        return;
      }

      setSyncedWorkoutDraft({
        activityLabel: result.workout.activityLabel,
        sourceName: result.workout.sourceName,
        deviceName: result.workout.deviceName,
        activeEnergyKcal: result.workout.activeEnergyKcal,
        totalEnergyKcal: result.workout.totalEnergyKcal,
        avgBpm: result.workout.avgBpm,
        maxBpm: result.workout.maxBpm,
      });
      toast("운동 데이터를 불러왔어요.");
    };

    const handleWindowMessage = (event: MessageEvent) => {
      handlePlatform(event.data);
      handleHealthResult(event.data);
    };

    const handlePlatformEvent = (event: Event) => {
      handlePlatform((event as CustomEvent).detail);
    };

    const handleHealthEvent = (event: Event) => {
      handleHealthResult((event as CustomEvent).detail);
    };

    window.addEventListener("message", handleWindowMessage);
    window.addEventListener(RN_PLATFORM_INFO_EVENT, handlePlatformEvent as EventListener);
    window.addEventListener(
      RN_HEALTH_SYNC_RESULT_EVENT,
      handleHealthEvent as EventListener
    );

    return () => {
      window.removeEventListener("message", handleWindowMessage);
      window.removeEventListener(
        RN_PLATFORM_INFO_EVENT,
        handlePlatformEvent as EventListener
      );
      window.removeEventListener(
        RN_HEALTH_SYNC_RESULT_EVENT,
        handleHealthEvent as EventListener
      );
    };
  }, [healthSyncRequestId]);

  const handleRequestHealthSync = () => {
    if (!form.record_date) {
      toast("먼저 날짜를 선택해 주세요.");
      return;
    }

    const requestId = createRequestId();
    setHealthSyncRequestId(requestId);
    setHealthSyncing(true);
    const sent = requestHealthSyncFromApp({
      requestId,
      date: form.record_date,
      activity: "barre",
    });
    if (!sent) {
      setHealthSyncing(false);
      setHealthSyncRequestId(null);
      toast("앱 환경에서만 연동할 수 있어요.");
    }
  };

  const appliedWorkout = useMemo<SyncedWorkout | null>(() => {
    const hasValue =
      !!form.workout_activity_label ||
      !!form.workout_source_name ||
      !!form.workout_device_name ||
      form.workout_active_energy_kcal !== null ||
      form.workout_total_energy_kcal !== null ||
      form.workout_avg_bpm !== null ||
      form.workout_max_bpm !== null;
    if (!hasValue) return null;
    return {
      activityLabel: form.workout_activity_label,
      sourceName: form.workout_source_name,
      deviceName: form.workout_device_name,
      activeEnergyKcal: form.workout_active_energy_kcal,
      totalEnergyKcal: form.workout_total_energy_kcal,
      avgBpm: form.workout_avg_bpm,
      maxBpm: form.workout_max_bpm,
    };
  }, [
    form.workout_activity_label,
    form.workout_active_energy_kcal,
    form.workout_avg_bpm,
    form.workout_device_name,
    form.workout_max_bpm,
    form.workout_source_name,
    form.workout_total_energy_kcal,
  ]);

  const workoutCard = showHealthSync ? syncedWorkoutDraft ?? appliedWorkout : null;

  const handleSubmit = async () => {
    if (!user || authLoading) return;

    if (!form.record_date || !form.start_time || !form.end_time || !form.mood) {
      toast("날짜, 시작 시간, 종료 시간, 오늘 발레는 어땠나요?는 필수예요.");
      return;
    }
    if (form.end_time < form.start_time) {
      toast("종료 시간이 시작 시간보다 빠를 수 없습니다.");
      return;
    }

    const resolvedLocation = showLocation
      ? buildLocationValue(locationName, locationBase, locationDetail)
      : "";
    const resolvedHealthWorkout = !showHealthSync
      ? {
          workout_activity_label: null,
          workout_source_name: null,
          workout_device_name: null,
          workout_active_energy_kcal: null,
          workout_total_energy_kcal: null,
          workout_avg_bpm: null,
          workout_max_bpm: null,
        }
      : syncedWorkoutDraft
        ? {
            workout_activity_label: syncedWorkoutDraft.activityLabel,
            workout_source_name: syncedWorkoutDraft.sourceName,
            workout_device_name: syncedWorkoutDraft.deviceName,
            workout_active_energy_kcal: syncedWorkoutDraft.activeEnergyKcal,
            workout_total_energy_kcal: syncedWorkoutDraft.totalEnergyKcal,
            workout_avg_bpm: syncedWorkoutDraft.avgBpm,
            workout_max_bpm: syncedWorkoutDraft.maxBpm,
          }
        : {
            workout_activity_label: form.workout_activity_label,
            workout_source_name: form.workout_source_name,
            workout_device_name: form.workout_device_name,
            workout_active_energy_kcal: form.workout_active_energy_kcal,
            workout_total_energy_kcal: form.workout_total_energy_kcal,
            workout_avg_bpm: form.workout_avg_bpm,
            workout_max_bpm: form.workout_max_bpm,
          };

    setSaving(true);
    const session = await ensureSessionOrLogin(openLoginSheet);
    if (!session) {
      setSaving(false);
      return;
    }
    const response = await fetch(`/api/records/${params.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...form,
        ...resolvedHealthWorkout,
        location: resolvedLocation,
        level: showLevelInstructor ? form.level : "",
        instructor: showLevelInstructor ? form.instructor : "",
        bar_order: showBarOrder ? barOrderTags.join(", ") : "",
        center_order: showCenterOrder ? centerOrderTags.join(", ") : "",
      }),
    });

    if (!response.ok) {
      setSaving(false);
      toast("기록 수정에 실패했습니다.");
      return;
    }

    const uploads: Array<{
      path: string;
      media_type: "image" | "video";
      file: File;
    }> = [];

    images.slice(0, 3).forEach((file) => {
      uploads.push({
        file,
        media_type: "image",
        path: `${user.id}/${params.id}/${getSafeFileName(file)}`,
      });
    });
    for (const upload of uploads) {
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(upload.path, upload.file);

      if (uploadError) {
        continue;
      }

      const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(upload.path);
      await fetch(`/api/records/${params.id}/media`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [
            {
              media_type: upload.media_type,
              url: urlData.publicUrl,
            },
          ],
        }),
      });
    }

    if (removedMediaIds.length > 0) {
      const deleteResponse = await fetch(`/api/records/${params.id}/media`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mediaIds: removedMediaIds }),
      });
      if (!deleteResponse.ok) {
        toast("미디어 삭제에 실패했습니다.");
        setSaving(false);
        return;
      }
    }

    if (user) invalidateProfileCache(user.id);
    router.back();
  };

  const mediaItems = useMemo(() => {
    const items: Array<
      | { type: "existing"; id: string; url: string }
      | { type: "new"; url: string; file: File }
    > = [];

    existingMedia.forEach((item) => {
      if (removedMediaIds.includes(item.id)) return;
      items.push({ type: "existing", id: item.id, url: item.url });
    });
    images.forEach((file) => {
      items.push({
        type: "new",
        url: URL.createObjectURL(file),
        file,
      });
    });

    return items.slice(0, 3);
  }, [existingMedia, images, removedMediaIds]);

  useEffect(() => {
    return () => {
      mediaItems.forEach((item) => {
        if (item.type === "new") {
          URL.revokeObjectURL(item.url);
        }
      });
    };
  }, [mediaItems]);

  const handleMediaSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith("image/")) {
      const visibleExisting = existingMedia.filter(
        (item) => !removedMediaIds.includes(item.id)
      );
      if (
        file.size > MAX_IMAGE_SIZE ||
        visibleExisting.length + images.length >= 3
      ) {
        return;
      }
      setImages((prev) => [...prev, file].slice(0, 3));
    }

    event.target.value = "";
  };

  const handleRemoveImage = (
    index: number,
    item: { type: "existing"; id: string } | { type: "new" }
  ) => {
    sendHapticToApp();
    if (item.type === "existing") {
      setRemovedMediaIds((prev) =>
        prev.includes(item.id) ? prev : [...prev, item.id]
      );
      return;
    }
    const newIndex = index - existingMedia.filter(
      (media) => !removedMediaIds.includes(media.id)
    ).length;
    setImages((prev) => prev.filter((_, idx) => idx !== newIndex));
  };

  const startHour = form.start_time ? form.start_time.split(":")[0] : "00";
  const startMinute = form.start_time ? form.start_time.split(":")[1] : "00";
  const endHour = form.end_time ? form.end_time.split(":")[0] : "00";
  const endMinute = form.end_time ? form.end_time.split(":")[1] : "00";
  const formatMeridiem = (hour: string) =>
    Number(hour) < 12 ? "오전" : "오후";
  const formatHour12 = (hour: string) => {
    const value = Number(hour);
    const normalized = value % 12 === 0 ? 12 : value % 12;
    return String(normalized).padStart(2, "0");
  };
  const formatTimeDisplay = (hour: string, minute: string) =>
    `${formatMeridiem(hour)} ${formatHour12(hour)}시 ${minute}분`;
  const getClampedNowTime = () => {
    const { hour, minute } = getSeoulTimeParts();
    const hourValue = Math.max(hour, 6);
    const minuteValue = minute;
    return {
      hour: String(hourValue).padStart(2, "0"),
      minute: String(minuteValue).padStart(2, "0"),
    };
  };

  if (authLoading) {
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
            로그인하면 기록을 수정할 수 있어요.
          </p>
        </main>
      </MobileContainer>
    );
  }

  if (recordLoading) {
    return (
      <MobileContainer>
        <main className="flex min-h-screen items-center justify-center">
          <Spinner size="lg" />
        </main>
      </MobileContainer>
    );
  }

  return (
    <MobileContainer>
      {saving ? <LoadingOverlay /> : null}
      <main className="px-4 pb-12">
        <header className="sticky top-0 z-20 bg-white h-12 mb-6 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="text-[#17171c]/70"
            onClick={() => router.back()}
            aria-label="뒤로"
          >
            <ChevronLeft className="size-6" />
          </Button>
          <h1 className="text-base font-semibold">기록 수정</h1>
          <div className="w-9" />
        </header>

        <div className="space-y-8">
          <section className="space-y-3">
            <Label className="text-sm text-[#17171c]/60">미디어 업로드</Label>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 pr-2">
              <button
                type="button"
                className="relative aspect-square w-20 shrink-0 rounded-lg border border-dashed border-[#17171c]/10 bg-transparent"
                onClick={() => fileInputRef.current?.click()}
                aria-label="사진 추가"
              >
                <Plus className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-[#17171c]/40" />
              </button>
              {mediaItems.map((item, index) => (
                <div
                  key={`image-${item.type === "existing" ? item.id : index}`}
                  className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-lg bg-white"
                >
                  <AnimatedImage
                    src={item.url}
                    alt="업로드 사진"
                    width={1600}
                    height={1600}
                    unoptimized
                    draggable={false}
                    className="h-full w-full object-contain"
                  />
                  <button
                    type="button"
                    className="absolute right-1 top-1 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-[#17171c] shadow-sm"
                    onClick={() =>
                      handleRemoveImage(
                        index,
                        item.type === "existing"
                          ? { type: "existing", id: item.id }
                          : { type: "new" }
                      )
                    }
                    aria-label="업로드 사진 삭제"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleMediaSelect}
            />
            <p className="text-xs text-[#17171c]/50">
              사진은 최대 3장까지 업로드할 수 있어요.
            </p>
          </section>

          <Separator />

          <section className="space-y-4">
            <div className="pt-0">
              <Label className="text-sm text-[#17171c]/60">날짜</Label>
              <Button
                type="button"
                variant="outline"
                className="mt-2 h-12 w-full justify-start gap-2 text-left text-sm font-normal"
                onClick={() => {
                  const baseDate = form.record_date
                    ? parseDateKey(form.record_date) ?? getSeoulTodayDate()
                    : getSeoulTodayDate();
                  setDateDraft({
                    year: baseDate.getFullYear(),
                    month: baseDate.getMonth() + 1,
                    day: baseDate.getDate(),
                  });
                  setDateSheetOpen(true);
                }}
              >
                <CalendarDays className="h-4 w-4" />
                {form.record_date
                  ? format(
                      parseDateKey(form.record_date) ?? getSeoulTodayDate(),
                      "yyyy년 MM월 dd일(EEE)",
                      {
                        locale: ko,
                      }
                    )
                  : "날짜 선택"}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <Label className="text-sm text-[#17171c]/60">시작 시간</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 h-12 w-full justify-start text-left text-sm font-normal"
                  onClick={() => {
                    const nextDraft = form.start_time
                      ? { hour: startHour, minute: startMinute }
                      : getClampedNowTime();
                    setStartDraft(nextDraft);
                    setStartSheetOpen(true);
                  }}
                >
                  {form.start_time
                    ? formatTimeDisplay(startHour, startMinute)
                    : "시간 선택"}
                </Button>
              </div>
              <div>
                <Label className="text-sm text-[#17171c]/60">종료 시간</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 h-12 w-full justify-start text-left text-sm font-normal"
                  onClick={() => {
                    const nextDraft = form.end_time
                      ? { hour: endHour, minute: endMinute }
                      : getClampedNowTime();
                    setEndDraft(nextDraft);
                    setEndSheetOpen(true);
                  }}
                >
                  {form.end_time
                    ? formatTimeDisplay(endHour, endMinute)
                    : "시간 선택"}
                </Button>
              </div>
            </div>
            <div className="pt-2">
              <Label className="text-sm text-[#17171c]/60">
                오늘 발레는 어땠나요?
              </Label>
              <div className="mt-2">
                <MoodSelector
                  value={form.mood}
                  onChange={(next) =>
                    setForm((prev) => ({ ...prev, mood: next }))
                  }
                />
              </div>
            </div>
            <div className="pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-[#17171c]/60">
                  한 줄로 가볍게 남겨주세요.
                </Label>
                <span className="text-xs text-[#17171c]/50">
                  {form.content.length}/16
                </span>
              </div>
              <Input
                className="mt-2 h-12 text-base"
                maxLength={16}
                value={form.content}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, content: event.target.value }))
                }
              />
            </div>
          </section>

          <Separator />

          <section className="space-y-6">
            <div>
              <Label className="text-sm text-[#17171c]/60">
                오늘 잘했던 점을 남겨보세요.
              </Label>
              <Textarea
                className="mt-2 min-h-[120px] text-base"
                rows={3}
                value={form.did_well}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, did_well: event.target.value }))
                }
              />
            </div>
            <div>
              <Label className="text-sm text-[#17171c]/60">
                다음에는 무엇을 더 신경 쓰면 좋을까요?
              </Label>
              <Textarea
                className="mt-2 min-h-[120px] text-base"
                rows={3}
                value={form.improve_next}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    improve_next: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label className="text-sm text-[#17171c]/60">
                더 남기고 싶은 이야기가 있다면 적어보세요.
              </Label>
              <Textarea
                className="mt-2 min-h-[120px] text-base"
                rows={3}
                value={form.memo}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, memo: event.target.value }))
                }
              />
            </div>
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
                    setForm((prev) => ({ ...prev, location: "" }));
                  }
                }}
              />
              <Label
                htmlFor="location-options"
                className="text-sm text-[#17171c]/70"
              >
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
                    setForm((prev) => ({
                      ...prev,
                      level: "",
                      instructor: "",
                    }));
                  }
                }}
              />
              <Label
                htmlFor="level-instructor-options"
                className="text-sm text-[#17171c]/70"
              >
                강사님 &amp; 레벨 입력
              </Label>
            </div>
            {showLevelInstructor ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[#17171c]/60">
                    강사님 &amp; 레벨
                  </span>
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
                    placeholder="강사님을 입력해 주세요"
                    value={form.instructor}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        instructor: event.target.value,
                      }))
                    }
                  />
                  <Input
                    type="text"
                    className="h-12 text-base placeholder:text-sm"
                    placeholder="레벨을 입력해 주세요"
                    value={form.level}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        level: event.target.value,
                      }))
                    }
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
              <Label
                htmlFor="bar-order-options"
                className="text-sm text-[#17171c]/70"
              >
                바 순서 입력
              </Label>
            </div>
            {showBarOrder ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-[#17171c]/60">
                    바(bar) 순서
                  </Label>
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
                <div className="space-y-2 rounded-lg border border-[#17171c]/10 bg-white p-3 min-h-[48px] flex items-center">
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
              <Label
                htmlFor="center-order-options"
                className="text-sm text-[#17171c]/70"
              >
                센터 순서 입력
              </Label>
            </div>
            {showCenterOrder ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-[#17171c]/60">
                    센터(center) 순서
                  </Label>
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
                <div className="space-y-2 rounded-lg border border-[#17171c]/10 bg-white p-3 min-h-[48px] flex items-center">
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
            {isIosHealthkit ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="health-sync-options"
                  checked={showHealthSync}
                  onCheckedChange={(checked) => {
                    const next = !!checked;
                    setShowHealthSync(next);
                    if (!next) {
                      setSyncedWorkoutDraft(null);
                      setForm((prev) => ({
                        ...prev,
                        workout_activity_label: null,
                        workout_source_name: null,
                        workout_device_name: null,
                        workout_active_energy_kcal: null,
                        workout_total_energy_kcal: null,
                        workout_avg_bpm: null,
                        workout_max_bpm: null,
                      }));
                    }
                  }}
                />
                <Label
                  htmlFor="health-sync-options"
                  className="text-sm text-[#17171c]/70"
                >
                  Apple Watch 발레 바 운동 불러오기
                </Label>
              </div>
            ) : null}
            {showHealthSync && isIosHealthkit ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-[#17171c]/60">
                    Apple Watch 발레 바 운동
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 shrink-0 px-4 text-xs"
                    onClick={handleRequestHealthSync}
                    disabled={healthSyncing}
                  >
                    {healthSyncing ? <Spinner size="sm" /> : "불러오기"}
                  </Button>
                </div>
                <div className="space-y-2 rounded-lg border border-[#17171c]/10 bg-white p-3 min-h-[48px]">
                  <div className="flex items-start justify-end">
                    <p className="text-xs text-[#17171c]/60">
                      {workoutCard?.deviceName ?? "-"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#17171c]/80">
                    <Activity className="h-4 w-4" />
                    <span>활동 칼로리 소모량:</span>
                    {workoutCard?.activeEnergyKcal == null
                      ? "-"
                      : `${workoutCard.activeEnergyKcal} kcal`}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#17171c]/80">
                    <Flame className="h-4 w-4" />
                    <span>총 칼로리 소모량:</span>
                    {workoutCard?.totalEnergyKcal == null
                      ? "-"
                      : `${workoutCard.totalEnergyKcal} kcal`}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#17171c]/80">
                    <Heart className="h-4 w-4" />
                    <span>평균 심박수:</span>
                    {workoutCard?.avgBpm == null ? "-" : `${workoutCard.avgBpm} BPM`}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#17171c]/80">
                    <HeartPulse className="h-4 w-4" />
                    <span>최대 심박수:</span>
                    {workoutCard?.maxBpm == null ? "-" : `${workoutCard.maxBpm} BPM`}
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <Button
            type="button"
            className="h-12 w-full bg-[#17171c] text-white hover:bg-[#17171c]/90"
            disabled={saving}
            onClick={handleSubmit}
          >
            저장하기
          </Button>
        </div>
        <BottomSheet
          open={dateSheetOpen}
          onOpenChange={setDateSheetOpen}
        >
          <div className="grid grid-cols-3 gap-3">
            <div
              ref={yearListRef}
              className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-[#17171c]/5 p-2"
            >
              {years.map((year) => (
                <Button
                  key={`year-${year}`}
                  data-value={String(year)}
                  type="button"
                  variant={dateDraft.year === year ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setDateDraft((prev) => ({ ...prev, year }))}
                >
                  {year}년
                </Button>
              ))}
            </div>
            <div
              ref={monthListRef}
              className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-[#17171c]/5 p-2"
            >
              {months.map((month) => {
                const value = String(month).padStart(2, "0");
                return (
                  <Button
                    key={`month-${month}`}
                    data-value={value}
                    type="button"
                    variant={dateDraft.month === month ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setDateDraft((prev) => ({ ...prev, month }))}
                  >
                    {value}월
                  </Button>
                );
              })}
            </div>
            <div
              ref={dayListRef}
              className="no-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border border-[#17171c]/5 p-2"
            >
              {Array.from(
                { length: new Date(dateDraft.year, dateDraft.month, 0).getDate() },
                (_, idx) => idx + 1
              ).map((day) => {
                const value = String(day).padStart(2, "0");
                return (
                  <Button
                    key={`day-${day}`}
                    data-value={value}
                    type="button"
                    variant={dateDraft.day === day ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setDateDraft((prev) => ({ ...prev, day }))}
                  >
                    {value}일
                  </Button>
                );
              })}
            </div>
          </div>
          <div className="mt-4">
            <Button
              className="w-full bg-[#17171c] text-white hover:bg-[#17171c]/90"
              onClick={() => {
                const paddedMonth = String(dateDraft.month).padStart(2, "0");
                const paddedDay = String(dateDraft.day).padStart(2, "0");
                setForm((prev) => ({
                  ...prev,
                  record_date: `${dateDraft.year}-${paddedMonth}-${paddedDay}`,
                }));
                setDateSheetOpen(false);
              }}
            >
              적용할게요
            </Button>
          </div>
        </BottomSheet>

        <BottomSheet
          open={startSheetOpen}
          onOpenChange={setStartSheetOpen}
        >
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
                  key={`start-drawer-hour-${hour}`}
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
                  key={`start-drawer-min-${minute}`}
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
              className="h-12 w-full bg-[#17171c] text-white hover:bg-[#17171c]/90"
              onClick={() => {
                setForm((prev) => ({
                  ...prev,
                  start_time: `${startDraft.hour}:${startDraft.minute}`,
                }));
                setStartSheetOpen(false);
              }}
            >
              적용하기
            </Button>
          </div>
        </BottomSheet>

        <BottomSheet
          open={endSheetOpen}
          onOpenChange={setEndSheetOpen}
        >
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
                  key={`end-drawer-hour-${hour}`}
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
                  key={`end-drawer-min-${minute}`}
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
              className="h-12 w-full bg-[#17171c] text-white hover:bg-[#17171c]/90"
              onClick={() => {
                setForm((prev) => ({
                  ...prev,
                  end_time: `${endDraft.hour}:${endDraft.minute}`,
                }));
                setEndSheetOpen(false);
              }}
            >
              적용하기
            </Button>
          </div>
        </BottomSheet>

        <BottomSheet
          open={locationSheetOpen}
          onOpenChange={setLocationSheetOpen}
        >
          <div className="space-y-3">
            {savedLocationsLoading ? (
              <div className="flex min-h-[120px] items-center justify-center">
                <Spinner size="lg" />
              </div>
            ) : savedLocations.length === 0 ? (
              <div className="rounded-lg border border-[#17171c]/5 bg-white px-4 py-6 text-center">
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
                        selected
                          ? "border-[#17171c]/40 bg-[#17171c]/5 text-[#17171c]"
                          : ""
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
                            {item.address_detail
                              ? ` ${item.address_detail}`
                              : ""}
                          </p>
                        ) : null}
                      </div>
                      {selected ? (
                        <Check className="h-4 w-4 text-[#17171c]" />
                      ) : null}
                    </Button>
                  );
                })}
              </div>
            )}
            <Button
              type="button"
              className="h-12 w-full bg-[#17171c] text-sm text-white hover:bg-[#17171c]/90"
              onClick={handleApplyLocation}
              disabled={!selectedLocationId}
            >
              적용하기
            </Button>
          </div>
        </BottomSheet>

        <BottomSheet
          open={instructorSheetOpen}
          onOpenChange={setInstructorSheetOpen}
        >
          <div className="space-y-3">
            {savedInstructorLoading ? (
              <div className="flex min-h-[120px] items-center justify-center">
                <Spinner size="lg" />
              </div>
            ) : savedInstructorLevels.length === 0 ? (
              <div className="rounded-lg border border-[#17171c]/5 bg-white px-4 py-6 text-center">
                <p className="text-xs text-[#17171c]/70">
                  저장된 강사님 & 레벨이 아직 없어요.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-full text-xs"
                  onClick={() =>
                    router.push("/calendar/settings/instructor-levels")
                  }
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
                        selected
                          ? "border-[#17171c]/40 bg-[#17171c]/5 text-[#17171c]"
                          : ""
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
                      {selected ? (
                        <Check className="h-4 w-4 text-[#17171c]" />
                      ) : null}
                    </Button>
                  );
                })}
              </div>
            )}
            <Button
              type="button"
              className="h-12 w-full bg-[#17171c] text-sm text-white hover:bg-[#17171c]/90"
              onClick={handleApplyInstructorLevel}
              disabled={!selectedInstructorId}
            >
              적용하기
            </Button>
          </div>
        </BottomSheet>

        <BottomSheet
          open={barOrderSheetOpen}
          onOpenChange={setBarOrderSheetOpen}
        >
          <div className="space-y-3">
            {savedBarOrdersLoading ? (
              <div className="flex min-h-[120px] items-center justify-center">
                <Spinner size="lg" />
              </div>
            ) : savedBarOrders.length === 0 ? (
              <div className="rounded-lg border border-[#17171c]/5 bg-white px-4 py-6 text-center">
                <p className="text-xs text-[#17171c]/70">
                  저장된 바 순서가 아직 없어요.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-full text-xs"
                  onClick={() =>
                    router.push("/calendar/settings/bar-orders")
                  }
                >
                  추가하러 가기
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {savedBarOrders.map((item) => {
                  const selected = item.id === selectedBarOrderId;
                  const barTags = item.order_text
                    ? item.order_text
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                    : [];
                  return (
                    <Button
                      key={item.id}
                      type="button"
                      variant="outline"
                      className={`h-auto w-full flex-col items-stretch gap-0 px-4 py-3 text-left ${
                        selected
                          ? "border-[#17171c]/40 bg-[#17171c]/5 text-[#17171c]"
                          : ""
                      }`}
                      onClick={() => setSelectedBarOrderId(item.id)}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <ListOrdered className="h-4 w-4 shrink-0 text-[#17171c]/50" />
                          <span className="truncate text-sm font-medium">
                            {item.name}
                          </span>
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
                                <span className="text-sm text-[#17171c]/40">
                                  &gt;
                                </span>
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
              className="h-12 w-full bg-[#17171c] text-sm text-white hover:bg-[#17171c]/90"
              onClick={handleApplyBarOrder}
              disabled={!selectedBarOrderId}
            >
              적용하기
            </Button>
          </div>
        </BottomSheet>

        <BottomSheet
          open={centerOrderSheetOpen}
          onOpenChange={setCenterOrderSheetOpen}
        >
          <div className="space-y-3">
            {savedCenterOrdersLoading ? (
              <div className="flex min-h-[120px] items-center justify-center">
                <Spinner size="lg" />
              </div>
            ) : savedCenterOrders.length === 0 ? (
              <div className="rounded-lg border border-[#17171c]/5 bg-white px-4 py-6 text-center">
                <p className="text-xs text-[#17171c]/70">
                  저장된 센터 순서가 아직 없어요.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-full text-xs"
                  onClick={() =>
                    router.push("/calendar/settings/center-orders")
                  }
                >
                  추가하러 가기
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {savedCenterOrders.map((item) => {
                  const selected = item.id === selectedCenterOrderId;
                  const centerTags = item.order_text
                    ? item.order_text
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                    : [];
                  return (
                    <Button
                      key={item.id}
                      type="button"
                      variant="outline"
                      className={`h-auto w-full flex-col items-stretch gap-0 px-4 py-3 text-left ${
                        selected
                          ? "border-[#17171c]/40 bg-[#17171c]/5 text-[#17171c]"
                          : ""
                      }`}
                      onClick={() => setSelectedCenterOrderId(item.id)}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <ListOrdered className="h-4 w-4 shrink-0 text-[#17171c]/50" />
                          <span className="truncate text-sm font-medium">
                            {item.name}
                          </span>
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
                                <span className="text-sm text-[#17171c]/40">
                                  &gt;
                                </span>
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
              className="h-12 w-full bg-[#17171c] text-sm text-white hover:bg-[#17171c]/90"
              onClick={handleApplyCenterOrder}
              disabled={!selectedCenterOrderId}
            >
              적용하기
            </Button>
          </div>
        </BottomSheet>
      </main>
    </MobileContainer>
  );
}
