"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { callRpc } from "@/lib/rpc";

export function RoomCredentials({ tournamentId }: { tournamentId: string }) {
  const t = useTranslations("tournament");
  const te = useTranslations("errors");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [room, setRoom] = useState<{
    room_id: string | null;
    room_password: string | null;
    map: string | null;
    server_region: string | null;
    notes: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reveal() {
    setLoading(true);
    const result = await callRpc("get_room_credentials", { p_tournament_id: tournamentId });
    setLoading(false);
    if (result.success) {
      setRoom(result.data as typeof room);
      setOpen(true);
    } else {
      setError(result.error?.code ?? "UNKNOWN");
    }
  }

  if (error && !open) {
    return (
      <p className="flex items-center gap-2 text-sm text-warning">
        <Lock className="size-4" /> {te.has(error) ? te(error) : error}
      </p>
    );
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={reveal} disabled={loading}>
        <Unlock className="size-4" /> {loading ? "…" : t("roomDetails")}
      </Button>
    );
  }

  return (
    <div className="grid gap-3 rounded-card border border-accent/30 bg-accent/5 p-4 sm:grid-cols-2">
      {room?.room_id && (
        <Field label={t("roomId")} value={room.room_id} />
      )}
      {room?.room_password && (
        <Field label={t("roomPassword")} value={room.room_password} secret />
      )}
      {room?.map && <Field label={t("map")} value={room.map} />}
      {room?.server_region && <Field label="Server" value={room.server_region} />}
      {room?.notes && <p className="text-sm text-muted sm:col-span-2">{room.notes}</p>}
    </div>
  );
}

function Field({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
      <p className="select-all font-display text-lg font-bold tracking-wide">{secret ? value.replace(/./g, "•") : value}</p>
    </div>
  );
}
