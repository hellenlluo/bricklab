import TopNav from "@/components/layout/TopNav";
import LeftSidebar from "@/components/layout/LeftSidebar";
import RightSidebar from "@/components/layout/RightSidebar";
import ToolBar from "@/components/layout/ToolBar";
import SceneCanvas from "@/components/scene/SceneCanvas";
import { SceneProvider } from "@/store/sceneStore";
import { PrefixEditProvider } from "@/store/usePrefixEdit";

export default function Home() {
  return (
    <SceneProvider>
      <PrefixEditProvider>
        <div className="h-screen font-sans overflow-hidden">
          <SceneCanvas />
          <TopNav />
          <LeftSidebar />
          <RightSidebar />
          <ToolBar />
        </div>
      </PrefixEditProvider>
    </SceneProvider>
  );
}
