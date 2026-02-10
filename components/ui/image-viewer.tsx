import { X } from "lucide-react";

type ImageViewerProps = {
  isOpen: boolean;
  imageUrl: string | null;
  alt?: string;
  onClose: () => void;
};

export default function ImageViewer({
  isOpen,
  imageUrl,
  alt,
  onClose,
}: ImageViewerProps) {
  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        aria-label="닫기"
      >
        <X className="h-5 w-5" />
      </button>
      <img
        src={imageUrl}
        alt={alt ?? "이미지 상세 보기"}
        className="max-h-full max-w-full object-contain"
      />
    </div>
  );
}
