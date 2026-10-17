import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { openDatabase } from "./expoDb";
import { Repo } from "./repo";

interface Store {
  repo: Repo;
  /** Bumps after every write so screens reload. */
  version: number;
  changed: () => void;
}

const RepoContext = createContext<Store | null>(null);

export function RepoProvider({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const [repo, setRepo] = useState<Repo | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    openDatabase().then((db) => setRepo(new Repo(db)), setError);
  }, []);

  const changed = useCallback(() => setVersion((v) => v + 1), []);

  if (error) throw error;
  if (!repo) return <>{fallback}</>;
  return <RepoContext.Provider value={{ repo, version, changed }}>{children}</RepoContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(RepoContext);
  if (!store) throw new Error("useStore must be used inside RepoProvider");
  return store;
}

/** Runs `load` now and again after every write. */
export function useQuery<T>(load: (repo: Repo) => Promise<T>, deps: unknown[] = []): T | undefined {
  const { repo, version } = useStore();
  const [data, setData] = useState<T>();
  useEffect(() => {
    let live = true;
    load(repo).then((d) => live && setData(d));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, version, ...deps]);
  return data;
}

/** Runs a write, then tells every screen to reload. Failures surface through `onError`. */
export function useAction() {
  const { changed } = useStore();
  return useCallback(
    async (fn: () => Promise<unknown>, onError?: (message: string) => void) => {
      try {
        await fn();
        changed();
        return true;
      } catch (e) {
        onError?.(e instanceof Error ? e.message : String(e));
        return false;
      }
    },
    [changed],
  );
}
