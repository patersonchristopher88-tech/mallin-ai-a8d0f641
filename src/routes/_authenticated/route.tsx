import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const [, force] = useState(0);
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => force((n) => n + 1));
    return () => sub.subscription.unsubscribe();
  }, []);
  return <Outlet />;
}
