import FloatingButton from "@/components/navigation/FloatingButton";
import TabBar from "@/components/navigation/TabBar";
import MobileContainer from "@/components/layout/MobileContainer";

export default function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MobileContainer>
      {children}
      <FloatingButton />
      <TabBar />
    </MobileContainer>
  );
}
