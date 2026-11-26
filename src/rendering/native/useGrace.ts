import { useEffect, useRef, useState } from 'react';
import { BudgetCache } from '../../core/cache';
import { previewFormat, rasterPreview } from './preview';
import type { Scene } from '../../core/scene/types';
import { requestGraceOutput, safeNativeSvg } from './client';
interface Preview {
  svg: string;
  warnings: string[];
  url?: string;
}
export function useGrace(scene: Scene) {
  const cache = useRef<BudgetCache<Scene, Preview> | null>(null);
  const uncachedUrl = useRef<string | undefined>(undefined);
  if (!cache.current)
    cache.current = new BudgetCache(24 * 1024 * 1024, 5, (value) => {
      if (value.url) URL.revokeObjectURL(value.url);
    });
  useEffect(
    () => () => {
      cache.current?.clear();
      if (uncachedUrl.current) URL.revokeObjectURL(uncachedUrl.current);
    },
    [],
  );
  const [engine, setEngine] = useState({ available: false, version: '', checked: false }),
    [retry, setRetry] = useState(0);
  const [rendering, setRendering] = useState({
    svg: '',
    warnings: [] as string[],
    error: '',
    pending: true,
    revision: scene,
  });
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/grace/status', { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw Error('Servidor nativo indisponível.');
        return r.json();
      })
      .then((status) => setEngine({ ...status, checked: true }))
      .catch(() => {
        if (!controller.signal.aborted) setEngine({ available: false, version: '', checked: true });
      });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    const controller = new AbortController();
    setRendering((old) => ({ ...old, error: '', warnings: [], pending: true }));
    if (!engine.available) {
      setRendering({
        svg: '',
        warnings: [],
        error: engine.checked
          ? 'O motor Grace original está indisponível. Execute npm run dev com gracebat instalado.'
          : '',
        pending: !engine.checked,
        revision: scene,
      });
      return;
    }
    const cached = cache.current!.get(scene);
    if (cached) {
      setRendering({ ...cached, error: '', pending: false, revision: scene });
      return () => controller.abort();
    }
    const format = previewFormat(scene);
    const timer = setTimeout(() => {
      requestGraceOutput(
        scene,
        format,
        controller.signal,
        format === 'png' ? { nativePreview: true } : {},
      )
        .then(async ({ blob, warnings }) => {
          if (controller.signal.aborted) return;
          let result: Preview;
          if (format === 'png') {
            const url = URL.createObjectURL(blob);
            result = { svg: rasterPreview(scene, url), url, warnings };
          } else {
            const source = await blob.text();
            if (controller.signal.aborted) return;
            result = { svg: safeNativeSvg(source), warnings };
          }
          // Keep the current raster URL alive until eviction/unmount as well.
          const retained = cache.current!.set(
            scene,
            result,
            format === 'png' ? blob.size : result.svg.length * 2,
          );
          if (uncachedUrl.current) URL.revokeObjectURL(uncachedUrl.current);
          uncachedUrl.current = retained ? undefined : result.url;
          setRendering({ ...result, error: '', pending: false, revision: scene });
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setRendering({
              svg: '',
              warnings: [],
              error: error.message,
              pending: false,
              revision: scene,
            });
        });
    }, 60);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [scene, engine.available, engine.checked, retry]);
  return {
    ...rendering,
    engine,
    stale: rendering.revision !== scene,
    reconnect: () => setRetry((n) => n + 1),
  };
}
