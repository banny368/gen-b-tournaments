import { getTranslations } from "next-intl/server";
import { MessagesSquare } from "lucide-react";
import { GlobalChat } from "@/components/chat/global-chat";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const t = await getTranslations("chat");
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: channel } = await supabase
    .from("chat_channels")
    .select("id")
    .eq("type", "GLOBAL")
    .maybeSingle();

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, content, created_at, user_id, profiles (username, display_name)")
    .eq("channel_id", channel?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-2">
        <MessagesSquare className="size-6 text-primary" />
        <h1 className="font-display text-2xl font-bold">{t("title")}</h1>
      </div>

      <GlobalChat
        channelId={channel?.id ?? null}
        currentUserId={user?.id ?? null}
        initialMessages={
          ((messages ?? []) as unknown as {
            id: string;
            content: string;
            created_at: string;
            user_id: string;
            profiles: { username: string | null; display_name: string | null } | null;
          }[]).reverse()
        }
      />
    </div>
  );
}
