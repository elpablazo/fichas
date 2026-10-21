// Lazy views with prefetch. If a chunk fails to load (a deploy replaced it), reload once.
import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';

const RELOAD_KEY = 'chunk-reload-at';
let leaving = false;
window.addEventListener('beforeunload', () => {
  leaving = true;
});
window.addEventListener('pagehide', () => {
  leaving = true;
});
window.addEventListener('pageshow', () => {
  leaving = false;
});

export function lazyView<P extends object>(load: () => Promise<{ default: ComponentType<P> }>) {
  let Comp: ComponentType<P> | null = null;
  let promise: Promise<void> | null = null;
  const prefetch = (): Promise<void> => {
    promise ??= load()
      .then((m) => {
        Comp = m.default;
      })
      .catch((err: unknown) => {
        promise = null;
        const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
        if (!leaving && navigator.onLine && Date.now() - last > 60_000) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          location.reload();
        }
        throw err;
      });
    return promise;
  };
  function Lazy(props: P) {
    const [, setLoaded] = useState(Comp !== null);
    useEffect(() => {
      let mounted = true;
      // The shared prefetch may finish between render and this effect. Always notify the view.
      void prefetch().then(
        () => {
          if (mounted) setLoaded(true);
        },
        () => {},
      );
      return () => {
        mounted = false;
      };
    }, []);
    return Comp ? <Comp {...props} /> : null;
  }
  Lazy.prefetch = prefetch;
  return Lazy;
}
