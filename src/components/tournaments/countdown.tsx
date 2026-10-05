"use client";

import { useEffect, useState } from "react";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/**
 * Countdown synced to server time. `serverNowIso` is captured on the server
 * at render; the device clock never decides what the countdown shows.
 */
export function Countdown({
  targetIso,
  serverNowIso,
  className,
}: {
  targetIso: string;
  serverNowIso: string;
  className?: string;
}) {
  // start from server time (pure render), then correct drift via effect
  const [now, setNow] = useState(() => new Date(serverNowIso).getTime());

  useEffect(() => {
    const offset = new Date(serverNowIso).getTime() - Date.now();
    const id = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => clearInterval(id);
  }, [serverNowIso]);

  const remaining = Math.max(0, new Date(targetIso).getTime() - now);
  const totalSec = Math.floor(remaining / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (remaining <= 0) {
    return <span className={className}>00:00:00</span>;
  }

  return (
    <span className={className} suppressHydrationWarning>
      {days > 0 && <>{days}d </>}
      {pad(hours)}:{pad(minutes)}:{pad(seconds)}
    </span>
  );
}
