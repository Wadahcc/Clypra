import React from "react";
import { TopBar } from "./TopBar";
import { EnhancedMediaPanel } from "./EnhancedMediaPanel";
import { PreviewPanel } from "./PreviewPanel";
import { PropertiesPanel } from "./PropertiesPanel";
import { Timeline } from "./timeline/Timeline";
import { useTimelineStore } from "@/store/timelineStore";
import { useProjectStore } from "@/store/projectStore";
import { createClipFromAsset } from "@/lib/timelineClip";
import { createTextClip, TEXT_PRESETS } from "@/lib/textClip";
import { useSubtitleImport } from "@/hooks/useSubtitleImport";

export const EditorLayout: React.FC = () => {
  const { tracks, addClip, addTrack, getTimelineEndTime } = useTimelineStore();
  const { mediaAssets, project } = useProjectStore();
  const { importSubtitleFile } = useSubtitleImport();

  const handleAddToTimeline = (item: any, type: string) => {
    // Handle different item types
    if (type === "media") {
      const mediaAsset = mediaAssets.find((asset) => asset.id === item.id);
      if (!mediaAsset) return;

      // Determine the appropriate track type based on media type
      const targetTrackType = mediaAsset.type === "audio" ? "audio" : "video";

      // Find the first track of the appropriate type
      let targetTrack = tracks.find((track) => track.type === targetTrackType && !track.locked);

      // If no track exists for this type, create one
      if (!targetTrack) {
        addTrack(targetTrackType);
        // Get the newly created track
        targetTrack = useTimelineStore.getState().tracks.find((t) => t.type === targetTrackType && !t.locked);
      }

      if (!targetTrack) return;

      // Get the end time of all existing clips
      const endTime = getTimelineEndTime();

      const newClip = createClipFromAsset({
        asset: mediaAsset,
        trackId: targetTrack.id,
        startTime: endTime,
        width: project?.canvasWidth || 1920,
        height: project?.canvasHeight || 1080,
      });

      addClip(newClip);
    } else if (type === "text") {
      // Handle text clips
      const targetTrackType = "text";

      // Find or create text track
      let targetTrack = tracks.find((track) => track.type === targetTrackType && !track.locked);

      if (!targetTrack) {
        addTrack(targetTrackType);
        targetTrack = useTimelineStore.getState().tracks.find((t) => t.type === targetTrackType && !t.locked);
      }

      if (!targetTrack) return;

      // Get the end time of all existing clips
      const endTime = getTimelineEndTime();

      // Determine preset settings
      let presetConfig = {};
      if (item.id && item.id.startsWith("text-")) {
        const presetName = item.name?.toLowerCase().replace(/\s+/g, "") as keyof typeof TEXT_PRESETS;
        if (TEXT_PRESETS[presetName]) {
          presetConfig = TEXT_PRESETS[presetName];
        }
      }

      // Create text clip
      const textClip = createTextClip({
        trackId: targetTrack.id,
        startTime: endTime,
        duration: 5.0,
        text: item.name || "Text",
        canvasWidth: project?.canvasWidth || 1920,
        canvasHeight: project?.canvasHeight || 1080,
        ...presetConfig,
      });

      addClip(textClip);
    } else if (type === "captions" && (item.type === "import-srt" || item.type === "import-txt")) {
      const fileType = item.type === "import-srt" ? "srt" : "txt";
      importSubtitleFile(fileType as "srt" | "txt").then((result) => {
        if (!result) return;

        // Find or create text track
        let targetTrack = useTimelineStore.getState().tracks.find((t) => t.type === "text" && !t.locked);
        if (!targetTrack) {
          addTrack("text");
          targetTrack = useTimelineStore.getState().tracks.find((t) => t.type === "text" && !t.locked);
        }
        if (!targetTrack) return;

        const canvasWidth = project?.canvasWidth || 1920;
        const canvasHeight = project?.canvasHeight || 1080;

        if (result.type === "srt") {
          for (const entry of result.entries) {
            const duration = entry.endTime - entry.startTime;
            if (duration <= 0) continue;
            const clip = createTextClip({
              trackId: targetTrack.id,
              startTime: entry.startTime,
              duration,
              text: entry.text,
              canvasWidth,
              canvasHeight,
              fontSize: 48,
              position: "bottom",
            });
            addClip(clip);
          }
        } else {
          let currentTime = getTimelineEndTime();
          const defaultDuration = 3.0;
          for (const entry of result.entries) {
            const clip = createTextClip({
              trackId: targetTrack.id,
              startTime: currentTime,
              duration: defaultDuration,
              text: entry.text,
              canvasWidth,
              canvasHeight,
              fontSize: 48,
              position: "bottom",
            });
            addClip(clip);
            currentTime += defaultDuration;
          }
        }
      }).catch((err) => {
        console.error("[EditorLayout] Subtitle import failed:", err);
      });
    } else {
      // Handle other types (audio, stickers, effects, transitions)
      // TODO: Implement handlers for other types
    }
  };

  return (
    <div className="w-full h-full flex flex-col app-shell overflow-hidden p-1 gap-2">
      <TopBar />

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden gap-2">
        <div className="flex-1 min-h-0 flex overflow-hidden gap-2">
          <EnhancedMediaPanel onAddToTimeline={handleAddToTimeline} />

          <div className="flex-1 min-w-0 flex flex-col overflow-hidden panel-shell">
            <PreviewPanel />
          </div>

          <PropertiesPanel />
        </div>

        <div className="h-80 panel-shell overflow-hidden">
          <Timeline />
        </div>
      </div>
    </div>
  );
};
