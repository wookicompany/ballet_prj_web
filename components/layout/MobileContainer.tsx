export default function MobileContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative mx-auto min-h-screen max-w-[430px] bg-white pb-20 text-[#17171c] shadow-sm">
      {children}
    </div>
  );
}
