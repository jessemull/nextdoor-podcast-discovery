"use client";

import { useCallback, useEffect, useState } from "react";

import { isInvalidRefreshTokenError } from "@/lib/auth-errors";
import { getSupabase } from "@/lib/supabase.client";

import type { User } from "@supabase/supabase-js";

export function useAuthUser(): {
  isLoading: boolean;
  user: User | null;
} {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const refreshUser = useCallback(async () => {
    const supabase = getSupabase();
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    } catch (err) {
      if (isInvalidRefreshTokenError(err)) {
        await supabase.auth.signOut();
        setUser(null);
      } else {
        throw err;
      }
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabase();

    const handleAuthChange = () => {
      refreshUser().then(() => setIsLoading(false));
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(handleAuthChange);

    // Initial load: sync auth state from Supabase (async, then stop loading)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial auth load from external system
    void refreshUser().then(() => setIsLoading(false));

    return () => subscription.unsubscribe();
  }, [refreshUser]);

  return { isLoading, user };
}
