import { createFileRoute, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listThreads, createThread } from "@/lib/aria/threads.functions";
import { JarvisOrb } from "@/components/aria/JarvisOrb";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/chat")({
  ssr: false,
  component: ChatLayout,
});

function ChatLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listThreads);
  const createFn = useServerFn(createThread);

  const params = useParams({ strict: false });
  const activeThreadId = (params as { threadId?: string }).threadId;

  const threads = useQuery({ queryKey: ["threads"], queryFn: () => listFn() });

  const createMut = useMutation({
    mutationFn: () => createFn({ data: {} }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      navigate({
        to: "/chat/$threadId",
        params: { threadId: t.id },
        replace: true,
      });
    },
  });

  // Auto-redirect from /chat to newest thread, or create one if none.
  useEffect(() => {
    if (activeThreadId) return;
    if (threads.isLoading || !threads.data) return;
    if (threads.data.length > 0) {
      navigate({
        to: "/chat/$threadId",
        params: { threadId: threads.data[0].id },
        replace: true,
      });
    } else if (!createMut.isPending) {
      createMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads.data, activeThreadId]);

  if (!activeThreadId) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="text-center">
          <JarvisOrb state="idle" size={180} />
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.4em] text-primary/70">
            Initializing…
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
