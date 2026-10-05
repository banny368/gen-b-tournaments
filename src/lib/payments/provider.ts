import "server-only";
import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PaymentProvider abstraction (master prompt §22/§99). The platform never
 * couples wallet logic to a gateway; adapters translate provider events into
 * deposit records that the ledger RPCs credit idempotently.
 *
 * NOTE: No gateway is enabled by default. RAZORPAY_ENABLED etc. must be
 * turned on by an admin after keys are configured and compliance approves.
 */

export interface CreateOrderResult {
  provider: "MANUAL_UPI" | "RAZORPAY" | "CASHFREE";
  providerOrderId: string | null;
  checkoutUrl: string | null;
  instructions: string | null;
}

export interface PaymentProviderAdapter {
  readonly name: "RAZORPAY" | "CASHFREE";
  isConfigured(): boolean;
  createOrder(params: {
    depositId: string;
    amount: number;
    userId: string;
  }): Promise<CreateOrderResult>;
}

export function verifyRazorpaySignature(payload: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(signature, "utf8"));
  } catch {
    return false;
  }
}

class RazorpayAdapter implements PaymentProviderAdapter {
  readonly name = "RAZORPAY" as const;

  isConfigured(): boolean {
    return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  }

  async createOrder(params: { depositId: string; amount: number; userId: string }): Promise<CreateOrderResult> {
    if (!this.isConfigured()) {
      throw new Error("Razorpay keys not configured");
    }
    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
    const receipt = params.depositId.slice(0, 36);
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Basic ${auth}` },
      body: JSON.stringify({
        amount: Math.round(params.amount * 100), // paise
        currency: "INR",
        receipt,
        notes: { deposit_id: params.depositId, user_id: params.userId },
      }),
    });
    if (!response.ok) {
      throw new Error(`Razorpay order creation failed: ${response.status}`);
    }
    const order = (await response.json()) as { id: string };
    return { provider: "RAZORPAY", providerOrderId: order.id, checkoutUrl: null, instructions: null };
  }
}

class CashfreeAdapter implements PaymentProviderAdapter {
  readonly name = "CASHFREE" as const;

  isConfigured(): boolean {
    return false; // add credentials + implementation when the provider is approved
  }

  async createOrder(): Promise<CreateOrderResult> {
    throw new Error("Cashfree adapter not enabled");
  }
}

export const paymentAdapters: Record<string, PaymentProviderAdapter | null> = {
  RAZORPAY: new RazorpayAdapter(),
  CASHFREE: new CashfreeAdapter(),
};

/** Records a raw gateway webhook event (audit trail), returns the event row id. */
export async function recordPaymentEvent(params: {
  provider: string;
  eventType: string;
  payload: unknown;
  signatureValid: boolean;
}) {
  const admin = createAdminClient();
  await admin.from("payment_events").insert({
    provider: params.provider,
    event_type: params.eventType,
    payload: params.payload as object,
    signature_valid: params.signatureValid,
  });
}

export function newIdempotencyToken(): string {
  return randomUUID();
}
