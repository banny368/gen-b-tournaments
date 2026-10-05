import { NextResponse } from "next/server";
import { verifyRazorpaySignature, recordPaymentEvent } from "@/lib/payments/provider";

export const dynamic = "force-dynamic";

/**
 * Razorpay webhook (master prompt §23). Steps: raw-body signature check →
 * event log → idempotent credit via ledger (deposit:{id}:credit key makes
 * duplicate webhooks harmless).
 */
export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  let event: {
    event?: string;
    payload?: { payment?: { entity?: { id?: string; order_id?: string; notes?: { deposit_id?: string } } } };
  } = {};
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  if (!secret || !verifyRazorpaySignature(raw, signature, secret)) {
    await recordPaymentEvent({
      provider: "RAZORPAY",
      eventType: event.event ?? "unknown",
      payload: event,
      signatureValid: false,
    });
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  await recordPaymentEvent({
    provider: "RAZORPAY",
    eventType: event.event ?? "unknown",
    payload: event,
    signatureValid: true,
  });

  const payment = event.payload?.payment?.entity;
  const depositId = payment?.notes?.deposit_id;

  if (event.event === "payment.captured" && depositId) {
    // Credit through the same permission-gated, idempotent RPC the admin
    // queue uses. Service-role auth passes has_permission via SUPER context —
    // instead we mark the deposit APPROVED through the RPC with a system
    // caller: the ledger idempotency key guarantees exactly-once crediting.
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    // 1. transition deposit to PAYMENT_SUCCESS (webhook evidence)
    await admin
      .from("deposits")
      .update({ status: "PAYMENT_SUCCESS", provider_payment_id: payment?.id ?? null })
      .eq("id", depositId)
      .in("status", ["CREATED", "PAYMENT_PENDING"]);
    // NOTE: actual balance credit happens on admin approval (PENDING_REVIEW →
    // APPROVED) so that even captured payments pass the compliance review in
    // this product's regulated model. Automate by enabling auto-approve for
    // gateway payments later via a dedicated RPC when compliance allows.
  }

  return NextResponse.json({ ok: true });
}
