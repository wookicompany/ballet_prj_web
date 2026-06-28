export default function MobileContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative mx-auto min-h-screen max-w-[430px] bg-background pb-[calc(5rem+env(safe-area-inset-bottom))] text-[#17171c] shadow-sm">
      {children}
    </div>
  );
}
