import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { parseSrt } from "@/lib/srtParser";
import { parseTxt } from "@/lib/txtParser";
import type { SrtEntry } from "@/lib/srtParser";
import type { TxtEntry } from "@/lib/txtParser";

export type SubtitleImportResult =
  | { type: "srt"; entries: SrtEntry[]; filename: string }
  | { type: "txt"; entries: TxtEntry[]; filename: string };

export const useSubtitleImport = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "warning";
    message: string;
  } | null>(null);

  const importSubtitleFile = async (
    fileType: "srt" | "txt",
  ): Promise<SubtitleImportResult | null> => {
    try {
      setIsLoading(true);

      const extensions = fileType === "srt" ? ["srt"] : ["txt"];
      const filterName = fileType === "srt" ? "SRT Subtitle" : "Text File";

      const selected = await open({
        multiple: false,
        filters: [{ name: filterName, extensions }],
      });

      if (!selected) return null;

      const path = Array.isArray(selected) ? selected[0] : selected;
      const content: string = await invoke("read_text_file", { path });
      const filename = path.split(/[/\\]/).pop() || "Unknown";

      if (fileType === "srt") {
        const entries = parseSrt(content);
        if (entries.length === 0) {
          setToastMessage({
            type: "warning",
            message: "No valid subtitle entries found in SRT file.",
          });
          return null;
        }
        setToastMessage({
          type: "success",
          message: `Imported ${entries.length} subtitle(s) from ${filename}`,
        });
        return { type: "srt", entries, filename };
      } else {
        const entries = parseTxt(content);
        if (entries.length === 0) {
          setToastMessage({
            type: "warning",
            message: "No text content found in file.",
          });
          return null;
        }
        setToastMessage({
          type: "success",
          message: `Imported ${entries.length} line(s) from ${filename}`,
        });
        return { type: "txt", entries, filename };
      }
    } catch (error) {
      console.error("[SubtitleImport] Import failed:", error);
      setToastMessage({
        type: "warning",
        message: "Failed to import subtitle file.",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    importSubtitleFile,
    isLoading,
    toastMessage,
    clearToast: () => setToastMessage(null),
  };
};
