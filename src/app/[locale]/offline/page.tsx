import { Gamepad2 } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <Gamepad2 className="size-12 text-muted" />
      <h1 className="font-display text-2xl font-bold">You are offline</h1>
      <p className="max-w-sm text-sm text-muted">
        Check your internet connection and try again. Your wallet and tournament data are safe on
        the server.
      </p>
    </div>
  );
}
