// hooks/useRunProgress.ts
import { useEffect, useRef } from 'react';
import type { StepStatusEvent } from '../types';

const WS_BASE = window.location.origin.replace(/^http/, 'ws');

export function useRunProgress(
  runId: string | null,
  onEvent: (event: StepStatusEvent) => void
) {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!runId) return;

    const ws = new WebSocket(`${WS_BASE}/ws/runs/${runId}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const event: StepStatusEvent = JSON.parse(e.data);
        onEvent(event);
      } catch {
        console.warn('Invalid WebSocket message', e.data);
      }
    };

    ws.onerror = (e) => console.error('Run progress WebSocket error', e);

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [runId]); // eslint-disable-line react-hooks/exhaustive-deps
}
