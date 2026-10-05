"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { updateClaimStatusAction } from "@/lib/admin-actions";

const statuses = ["OPEN", "IN_REVIEW", "WAITING_USER", "WAITING_ADMIN", "RESOLVED", "REJECTED", "CLOSED"];

export function AdminClaimActions({ claimId }: { claimId: string }) {
  const [status, setStatus] = useState("IN_REVIEW");
  const [resolution, setResolution] = useState("");
  const [loading, setLoading] = useState(false);

  async function update() {
    setLoading(true);
    const res = await updateClaimStatusAction(claimId, status, resolution);
    setLoading(false);
    if (res.success) toast.success("Done");
    else toast.error(res.error);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-40 text-xs">
        {statuses.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>
      <Input
        value={resolution}
        onChange={(e) => setResolution(e.target.value)}
        placeholder="Resolution note"
        className="h-9 w-56 text-xs"
      />
      <Button size="sm" disabled={loading} onClick={update}>
        {loading ? "…" : "Update"}
      </Button>
    </div>
  );
}
