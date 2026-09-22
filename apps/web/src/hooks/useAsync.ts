import { useCallback, useEffect, useState } from 'react';

export type AsyncStatus = 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  status: AsyncStatus;
  data: T | null;
  error: Error | null;
  reload: () => void;
}

export function useAsync<T>(loader: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const [status, setStatus] = useState<AsyncStatus>('loading');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    setError(null);

    loader()
      .then((result) => {
        if (!active) return;
        setData(result);
        setStatus('success');
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(caught instanceof Error ? caught : new Error('Đã xảy ra lỗi không xác định'));
        setStatus('error');
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadToken]);

  return { status, data, error, reload };
}
