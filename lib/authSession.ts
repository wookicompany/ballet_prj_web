import { supabase } from "@/lib/supabaseClient";

export const ensureSessionOrLogin = async (
  openLoginSheet: () => void
) => {
  const { data: sessionData } = await supabase.auth.getSession();
  let session = sessionData.session ?? null;

  if (!session) {
    const { data: refreshData, error: refreshError } =
      await supabase.auth.refreshSession();
    if (refreshError) {
      openLoginSheet();
      return null;
    }
    session = refreshData.session ?? null;
  }

  if (!session) {
    openLoginSheet();
    return null;
  }

  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  return session;
};
