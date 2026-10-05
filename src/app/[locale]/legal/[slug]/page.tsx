import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Prose } from "@/components/legal/prose";

export const dynamic = "force-dynamic";

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("legal_documents")
    .select("title, content_md, version, published_at")
    .eq("slug", slug)
    .eq("is_published", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) notFound();
  const doc = data as { title: string; content_md: string; version: number; published_at: string | null };

  return (
    <div className="mx-auto max-w-3xl py-4">
      <h1 className="font-display text-3xl font-bold">{doc.title}</h1>
      <p className="mt-1 text-xs text-muted">v{doc.version}</p>
      <Prose content={doc.content_md} />
    </div>
  );
}
