"use client";

interface StatusIndicatorProps {
  status: "disconnected" | "syncing" | "synced" | "error" | "broadcasting";
  isHost: boolean;
  error?: string | null;
}

export function StatusIndicator({ status, isHost, error }: StatusIndicatorProps) {
  const getStatusConfig = () => {
    if (isHost) {
      return {
        color: "bg-green-500",
        pulseColor: "bg-green-400",
        text: "Broadcasting",
        description: "Your playback is being shared with listeners",
      };
    }

    switch (status) {
      case "disconnected":
        return {
          color: "bg-zinc-500",
          pulseColor: "bg-zinc-400",
          text: "Disconnected",
          description: "Not connected to the host",
        };
      case "syncing":
        return {
          color: "bg-yellow-500",
          pulseColor: "bg-yellow-400",
          text: "Connecting...",
          description: "Connecting to host",
        };
      case "synced":
        return {
          color: "bg-green-500",
          pulseColor: "bg-green-400",
          text: "Live",
          description: "Viewing host's playback",
        };
      case "error":
        return {
          color: "bg-red-500",
          pulseColor: "bg-red-400",
          text: "Sync Error",
          description: error || "Failed to sync with host",
        };
      default:
        return {
          color: "bg-zinc-500",
          pulseColor: "bg-zinc-400",
          text: "Unknown",
          description: "Unknown status",
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900/60 backdrop-blur rounded-xl border border-zinc-800">
      {/* Status Dot */}
      <div className="relative flex h-3 w-3">
        {(status === "synced" || status === "syncing" || isHost) && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.pulseColor} opacity-75`}
          />
        )}
        <span
          className={`relative inline-flex rounded-full h-3 w-3 ${config.color}`}
        />
      </div>

      {/* Status Text */}
      <div className="flex flex-col">
        <span className="text-sm font-medium text-white">{config.text}</span>
        <span className="text-xs text-zinc-500">{config.description}</span>
      </div>
    </div>
  );
}
