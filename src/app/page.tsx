import Chat from "@/components/Chat";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ chat?: string; q?: string }> }) {
  const { chat, q } = await searchParams;
  return <Chat key={chat ?? q ?? "new"} initialChatId={chat} initialQuery={q} />;
}
