"use client";

import { createClient } from "@/lib/supabase/client";
import type { RpcResult } from "@/lib/types";

/**
 * Client-side RPC caller. All money/tournament mutations go through
 * Postgres functions — the client never computes or asserts money state.
 */
export async function callRpc<T = unknown>(
  fn: string,
  args: Record<string, unknown>,
): Promise<RpcResult<T>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) {
    return { success: false, error: { code: "RPC_FAILED", message: error.message } };
  }
  return data as RpcResult<T>;
}
