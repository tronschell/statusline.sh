import { useEffect, useState } from "react";

export type DetectedOs = "mac" | "windows" | "linux" | "unknown";

interface UserAgentDataLike {
  platform?: string;
  getHighEntropyValues?: (h: string[]) => Promise<{ platform?: string }>;
}

function fromString(s: string | undefined): DetectedOs {
  if (!s) return "unknown";
  const lower = s.toLowerCase();
  if (lower.includes("mac") || lower.includes("darwin")) return "mac";
  if (lower.includes("win")) return "windows";
  if (lower.includes("linux") || lower.includes("x11")) return "linux";
  return "unknown";
}

export function detectOsSync(): DetectedOs {
  if (typeof navigator === "undefined") return "unknown";
  const navAny = navigator as unknown as { userAgentData?: UserAgentDataLike };
  const fromUaData = fromString(navAny.userAgentData?.platform);
  if (fromUaData !== "unknown") return fromUaData;
  return fromString(navigator.userAgent ?? navigator.platform);
}

export function useOsDetect(): DetectedOs {
  const [os, setOs] = useState<DetectedOs>(() => detectOsSync());
  useEffect(() => {
    const navAny = navigator as unknown as { userAgentData?: UserAgentDataLike };
    const uad = navAny.userAgentData;
    if (uad?.getHighEntropyValues) {
      uad
        .getHighEntropyValues(["platform"])
        .then((r) => {
          const detected = fromString(r.platform);
          if (detected !== "unknown") setOs(detected);
        })
        .catch(() => {});
    }
  }, []);
  return os;
}
