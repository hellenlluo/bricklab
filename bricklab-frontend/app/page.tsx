import TopNav from "@/components/layout/TopNav";
import LeftSidebar from "@/components/layout/LeftSidebar";
import RightSidebar from "@/components/layout/RightSidebar";

export default function Home() {
  return (
    <div className="flex flex-col h-screen bg-zinc-50 font-sans dark:bg-black">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar />
        <main className="flex-1 overflow-hidden" />
        <RightSidebar />
      </div>
    </div>
  );
}
