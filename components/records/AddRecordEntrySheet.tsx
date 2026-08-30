"use client";

import { PenLine, Repeat } from "lucide-react";

import BottomSheet from "@/components/sheets/BottomSheet";
import { Button } from "@/components/ui/button";

type AddRecordEntrySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectToday: () => void;
  onSelectRecurring: () => void;
};

// Phase 4a entry point: 캘린더/day의 "+"를 탭했을 때 단건 기록과 반복 예정 등록 중
// 하나를 고르게 하는 선택지 시트. 스타일은 record/[id]/page.tsx의 메뉴 시트(수정하기/삭제하기)와
// 동일한 outline 버튼 패턴을 재사용한다(docs/design.md "반복 예정 등록 컴포넌트" 1번).
export default function AddRecordEntrySheet({
  open,
  onOpenChange,
  onSelectToday,
  onSelectRecurring,
}: AddRecordEntrySheetProps) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full justify-start text-sm"
          onClick={() => {
            onOpenChange(false);
            onSelectToday();
          }}
        >
          <PenLine className="mr-2 h-4 w-4" />
          한 번 기록 남기기
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full justify-start text-sm"
          onClick={() => {
            onOpenChange(false);
            onSelectRecurring();
          }}
        >
          <Repeat className="mr-2 h-4 w-4" />
          반복 수업 추가하기
        </Button>
      </div>
    </BottomSheet>
  );
}
