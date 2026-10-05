"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin server actions. Permission is checked server-side on every action
 * (never trusted from the client); money operations go through the
 * permission-checking DB RPCs using the admin's own session; content
 * writes use the service-role client and always write audit logs.
 */

async function assertPermission(permission: string): Promise<void> {
  const supabase = await createClient();
  const { data: ok } = await supabase.rpc("has_permission", { permission });
  if (!ok) redirect("/admin");
}

async function audit(action: string, resourceType: string, resourceId: string | null, reason: string | null) {
  const supabase = await createClient();
  await supabase.rpc("write_audit", {
    p_action: action,
    p_resource_type: resourceType,
    p_resource_id: resourceId,
    p_before: null,
    p_after: null,
    p_reason: reason,
  });
}

export type ActionResult = { success: boolean; error?: string };

export async function createTournamentAction(formData: FormData): Promise<ActionResult> {
  await assertPermission("CREATE_TOURNAMENT");
  const gameId = String(formData.get("game_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!gameId || !title) return { success: false, error: "Missing fields" };

  const matchStart = String(formData.get("match_start") ?? "");
  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}-${Date.now().toString(36)}`;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tournaments")
    .insert({
      game_id: gameId,
      title,
      slug,
      description: String(formData.get("description") ?? "") || null,
      format: String(formData.get("format") ?? "BATTLE_ROYALE"),
      team_size: parseInt(String(formData.get("team_size") ?? "1")),
      entry_fee: parseFloat(String(formData.get("entry_fee") ?? "0")) || 0,
      prize_pool: parseFloat(String(formData.get("prize_pool") ?? "0")) || 0,
      prize_distribution: JSON.parse(String(formData.get("prize_distribution") ?? "[]")),
      max_players: parseInt(String(formData.get("max_players") ?? "100")),
      registration_end: String(formData.get("registration_end") ?? "") || null,
      match_start: matchStart || new Date().toISOString(),
      estimated_end: String(formData.get("estimated_end") ?? "") || null,
      rules: String(formData.get("rules") ?? "") || null,
      is_demo: formData.get("is_demo") === "on",
      status: "SCHEDULED",
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  await audit("CREATE_TOURNAMENT", "tournament", data.id, null);
  revalidatePath("/admin/tournaments");
  return { success: true };
}

export async function setTournamentStatusAction(tournamentId: string, status: string): Promise<ActionResult> {
  await assertPermission("EDIT_TOURNAMENT");
  const admin = createAdminClient();
  const { error } = await admin.from("tournaments").update({ status }).eq("id", tournamentId);
  if (error) return { success: false, error: error.message };
  await audit("SET_TOURNAMENT_STATUS", "tournament", tournamentId, status);
  revalidatePath("/admin/tournaments");
  return { success: true };
}

export async function upsertRoomAction(formData: FormData): Promise<ActionResult> {
  await assertPermission("EDIT_TOURNAMENT");
  const tournamentId = String(formData.get("tournament_id") ?? "");
  const admin = createAdminClient();
  const { error } = await admin.from("tournament_rooms").upsert({
    tournament_id: tournamentId,
    room_id: String(formData.get("room_id") ?? "") || null,
    room_password: String(formData.get("room_password") ?? "") || null,
    release_at: String(formData.get("release_at") ?? "") || null,
    map_name: String(formData.get("map_name") ?? "") || null,
    server_region: String(formData.get("server_region") ?? "") || null,
    notes: String(formData.get("notes") ?? "") || null,
  });
  if (error) return { success: false, error: error.message };
  await audit("UPSERT_ROOM", "tournament", tournamentId, null);
  revalidatePath("/admin/tournaments");
  return { success: true };
}

export async function publishResultsAction(
  tournamentId: string,
  results: { user_id?: string; team_id?: string; placement: number; kills?: number; points?: number }[],
): Promise<ActionResult> {
  // permission + payout enforced inside the DB function
  const supabase = await createClient();
  const { data } = await supabase.rpc("publish_results_and_pay", {
    p_tournament_id: tournamentId,
    p_results: results,
  });
  const result = data as { success: boolean; error?: { message: string } } | null;
  if (!result?.success) return { success: false, error: result?.error?.message ?? "Payout failed" };
  revalidatePath("/admin/tournaments");
  return { success: true };
}

export async function cancelTournamentAction(tournamentId: string, reason: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("cancel_tournament_refunds", {
    p_tournament_id: tournamentId,
    p_reason: reason || "Cancelled by admin",
  });
  const result = data as { success: boolean; error?: { message: string } } | null;
  if (!result?.success) return { success: false, error: result?.error?.message ?? "Cancel failed" };
  revalidatePath("/admin/tournaments");
  return { success: true };
}

export async function releaseRoomAction(tournamentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("release_room", { p_tournament_id: tournamentId });
  const result = data as { success: boolean; error?: { message: string } } | null;
  if (!result?.success) return { success: false, error: result?.error?.message ?? "Failed" };
  revalidatePath("/admin/tournaments");
  return { success: true };
}

export async function approveDepositAction(depositId: string, reason: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("approve_deposit", { p_deposit_id: depositId, p_reason: reason || null });
  const result = data as { success: boolean; error?: { message: string } } | null;
  if (!result?.success) return { success: false, error: result?.error?.message ?? "Failed" };
  revalidatePath("/admin/deposits");
  return { success: true };
}

export async function rejectDepositAction(depositId: string, reason: string): Promise<ActionResult> {
  if (!reason) return { success: false, error: "Reason required" };
  const supabase = await createClient();
  const { data } = await supabase.rpc("reject_deposit", { p_deposit_id: depositId, p_reason: reason });
  const result = data as { success: boolean; error?: { message: string } } | null;
  if (!result?.success) return { success: false, error: result?.error?.message ?? "Failed" };
  revalidatePath("/admin/deposits");
  return { success: true };
}

export async function reviewWithdrawalAction(
  withdrawalId: string,
  action: "APPROVE" | "COMPLETE" | "REJECT",
  reference: string,
  reason: string,
): Promise<ActionResult> {
  if (action === "REJECT" && !reason) return { success: false, error: "Reason required" };
  const supabase = await createClient();
  const { data } = await supabase.rpc("review_withdrawal", {
    p_withdrawal_id: withdrawalId,
    p_action: action,
    p_reference: reference || null,
    p_reason: reason || null,
  });
  const result = data as { success: boolean; error?: { message: string } } | null;
  if (!result?.success) return { success: false, error: result?.error?.message ?? "Failed" };
  revalidatePath("/admin/withdrawals");
  return { success: true };
}

export async function toggleFlagAction(key: string, enabled: boolean): Promise<ActionResult> {
  await assertPermission("CONFIGURE_FEES");
  const admin = createAdminClient();
  const { error } = await admin
    .from("feature_flags")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("key", key);
  if (error) return { success: false, error: error.message };
  await audit("TOGGLE_FLAG", "feature_flag", key, enabled ? "enabled" : "disabled");
  revalidatePath("/admin/settings");
  return { success: true };
}

export async function updateSettingAction(key: string, value: string): Promise<ActionResult> {
  await assertPermission("CONFIGURE_FEES");
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    parsed = value;
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("admin_settings")
    .update({ value: parsed, updated_at: new Date().toISOString() })
    .eq("key", key);
  if (error) return { success: false, error: error.message };
  await audit("UPDATE_SETTING", "admin_setting", key, value);
  revalidatePath("/admin/settings");
  return { success: true };
}

export async function banUserAction(userId: string, banned: boolean, reason: string): Promise<ActionResult> {
  await assertPermission("EDIT_USERS");
  if (banned && !reason) return { success: false, error: "Reason required" };
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ is_banned: banned, ban_reason: banned ? reason : null }).eq("id", userId);
  if (error) return { success: false, error: error.message };
  await audit(banned ? "BAN_USER" : "UNBAN_USER", "user", userId, reason);
  revalidatePath("/admin/users");
  return { success: true };
}

export async function grantRoleAction(userId: string, role: string, grant: boolean): Promise<ActionResult> {
  await assertPermission("MANAGE_ROLES");
  const admin = createAdminClient();
  const { error } = grant
    ? await admin.from("user_roles").insert({ user_id: userId, role })
    : await admin.from("user_roles").delete().eq("user_id", userId).eq("role", role);
  if (error) return { success: false, error: error.message };
  await audit(grant ? "GRANT_ROLE" : "REVOKE_ROLE", "user", userId, role);
  revalidatePath("/admin/users");
  return { success: true };
}

export async function updateClaimStatusAction(claimId: string, status: string, resolution: string): Promise<ActionResult> {
  await assertPermission("VIEW_USERS");
  const admin = createAdminClient();
  const { error } = await admin.from("claims").update({ status, resolution: resolution || null }).eq("id", claimId);
  if (error) return { success: false, error: error.message };
  await audit("UPDATE_CLAIM", "claim", claimId, status);
  revalidatePath("/admin/claims");
  return { success: true };
}

export async function manualAdjustmentAction(
  userId: string,
  account: string,
  amount: number,
  reason: string,
): Promise<ActionResult> {
  await assertPermission("CREATE_ADJUSTMENT");
  if (!reason) return { success: false, error: "Reason required" };
  const supabase = await createClient();
  // adjustments run through a dedicated admin RPC added in 0011
  const { data } = await supabase.rpc("admin_manual_adjustment", {
    p_user: userId,
    p_account: account,
    p_amount: amount,
    p_reason: reason,
  });
  const result = data as { success: boolean; error?: { message: string } } | null;
  if (!result?.success) return { success: false, error: result?.error?.message ?? "Failed" };
  revalidatePath("/admin/users");
  return { success: true };
}
