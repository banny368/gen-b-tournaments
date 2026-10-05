"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Dialog } from "@radix-ui/react-dialog";
import { DialogContent as SharedDialogContent, DialogTitle as SharedDialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  createTournamentAction,
  upsertRoomAction,
  publishResultsAction,
  cancelTournamentAction,
  releaseRoomAction,
  setTournamentStatusAction,
} from "@/lib/admin-actions";
import { formatINR } from "@/lib/utils";

const formats = ["BATTLE_ROYALE", "SOLO", "DUO", "SQUAD", "CUSTOM_ROOM", "ONE_V_ONE", "TWO_V_TWO", "KNOCKOUT", "LEAGUE", "POINTS_TABLE", "ELIMINATION", "MULTI_ROUND", "CLAN_VS_CLAN"];

export function CreateTournamentForm({ games }: { games: { id: string; name: string }[] }) {
  const t = useTranslations("admin");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dist, setDist] = useState('{"rank":1,"percent":50}\n{"rank":2,"percent":30}\n{"rank":3,"percent":20}');

  async function submit(formData: FormData) {
    setLoading(true);
    let parsed = [];
    try {
      parsed = dist
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => JSON.parse(l));
    } catch {
      setLoading(false);
      toast.error("Prize distribution JSON invalid");
      return;
    }
    formData.set("prize_distribution", JSON.stringify(parsed));
    const res = await createTournamentAction(formData);
    setLoading(false);
    if (res.success) {
      toast.success(t("createTournament"));
      setOpen(false);
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>{t("createTournament")}</Button>
      <SharedDialogContent className="glass max-h-[85vh] max-w-2xl overflow-y-auto rounded-card p-6" aria-describedby={undefined}>
        <SharedDialogTitle className="font-display text-lg font-bold">{t("createTournament")}</SharedDialogTitle>
        <form action={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="game_id">Game</Label>
            <Select id="game_id" name="game_id" required>
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="format">Format</Label>
            <Select id="format" name="format">
              {formats.map((f) => (
                <option key={f} value={f}>
                  {f.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="team_size">Team size</Label>
            <Input id="team_size" name="team_size" type="number" min={1} max={4} defaultValue={1} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="max_players">Max players</Label>
            <Input id="max_players" name="max_players" type="number" min={2} defaultValue={100} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entry_fee">Entry fee (INR)</Label>
            <Input id="entry_fee" name="entry_fee" type="number" min={0} step="0.01" defaultValue={0} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prize_pool">Prize pool (INR)</Label>
            <Input id="prize_pool" name="prize_pool" type="number" min={0} step="0.01" defaultValue={0} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="match_start">Match start</Label>
            <Input id="match_start" name="match_start" type="datetime-local" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="registration_end">Registration end</Label>
            <Input id="registration_end" name="registration_end" type="datetime-local" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="prize_distribution">Prize distribution (JSON lines)</Label>
            <Textarea id="prize_distribution" value={dist} onChange={(e) => setDist(e.target.value)} rows={4} className="font-mono text-xs" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="rules">Rules</Label>
            <Textarea id="rules" name="rules" rows={3} />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="is_demo" className="size-4 accent-[#3d7bff]" /> Demo tournament (sandbox)
          </label>
          <Button type="submit" className="sm:col-span-2" disabled={loading}>
            {t("createTournament")}
          </Button>
        </form>
      </SharedDialogContent>
    </Dialog>
  );
}

export function AdminTournamentActions({
  tournament,
}: {
  tournament: {
    id: string;
    title: string;
    status: string;
    entry_fee: number;
    prize_pool: number;
  };
}) {
  const t = useTranslations("admin");
  const [roomOpen, setRoomOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function act(fn: () => Promise<{ success: boolean; error?: string }>) {
    setLoading(true);
    const res = await fn();
    setLoading(false);
    if (res.success) toast.success("Done");
    else toast.error(res.error);
  }

  async function submitResults(formData: FormData) {
    const results: { user_id: string; placement: number; kills: number; points: number }[] = [];
    let rank = 1;
    while (formData.get(`user_${rank}`)) {
      results.push({
        user_id: String(formData.get(`user_${rank}`)),
        placement: rank,
        kills: parseInt(String(formData.get(`kills_${rank}`) ?? "0")),
        points: parseFloat(String(formData.get(`points_${rank}`) ?? "0")),
      });
      rank++;
    }
    if (results.length === 0) {
      toast.error("Add at least rank 1");
      return;
    }
    await act(() => publishResultsAction(tournament.id, results));
    setResultsOpen(false);
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Dialog open={roomOpen} onOpenChange={setRoomOpen}>
        <Button variant="outline" size="sm" onClick={() => setRoomOpen(true)}>
          Room
        </Button>
        <SharedDialogContent className="glass max-w-md rounded-card p-6" aria-describedby={undefined}>
          <SharedDialogTitle className="font-display text-base font-bold">Room credentials</SharedDialogTitle>
          <form action={async (fd) => { await upsertRoomAction(fd); setRoomOpen(false); }} className="mt-4 space-y-3">
            <input type="hidden" name="tournament_id" value={tournament.id} />
            <Input name="room_id" placeholder="Room ID" />
            <Input name="room_password" placeholder="Password" />
            <Input name="release_at" type="datetime-local" />
            <Input name="map_name" placeholder="Map (e.g. Erangel)" />
            <Input name="server_region" placeholder="Server region" />
            <Button type="submit" className="w-full">
              Save room
            </Button>
          </form>
        </SharedDialogContent>
      </Dialog>

      <Button variant="outline" size="sm" disabled={loading} onClick={() => act(() => releaseRoomAction(tournament.id))}>
        {t("releaseRoom")}
      </Button>

      <Dialog open={resultsOpen} onOpenChange={setResultsOpen}>
        <Button variant="outline" size="sm" onClick={() => setResultsOpen(true)}>
          {t("publishResults")}
        </Button>
        <SharedDialogContent className="glass max-w-md rounded-card p-6" aria-describedby={undefined}>
          <SharedDialogTitle className="font-display text-base font-bold">{t("publishResults")}</SharedDialogTitle>
          <p className="mt-1 text-xs text-muted">
            Commission is applied automatically. Pool: {formatINR(tournament.prize_pool)}
          </p>
          <form action={submitResults} className="mt-4 space-y-3">
            {[1, 2, 3].map((rank) => (
              <div key={rank} className="grid grid-cols-[1fr_5rem_5rem] gap-2">
                <Input name={`user_${rank}`} placeholder={`Rank ${rank} — user UUID`} />
                <Input name={`kills_${rank}`} type="number" placeholder="Kills" min={0} />
                <Input name={`points_${rank}`} type="number" placeholder="Pts" min={0} />
              </div>
            ))}
            <Button type="submit" className="w-full" disabled={loading}>
              Pay winners
            </Button>
          </form>
        </SharedDialogContent>
      </Dialog>

      <Button
        variant="danger"
        size="sm"
        disabled={loading}
        onClick={() => {
          const reason = prompt("Cancellation reason:") ?? "";
          if (reason) act(() => cancelTournamentAction(tournament.id, reason));
        }}
      >
        {t("cancelTournament")}
      </Button>

      {tournament.status === "DRAFT" && (
        <Button variant="secondary" size="sm" disabled={loading} onClick={() => act(() => setTournamentStatusAction(tournament.id, "SCHEDULED"))}>
          Publish
        </Button>
      )}
    </div>
  );
}
