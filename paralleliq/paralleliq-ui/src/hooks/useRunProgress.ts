/**
 * hooks/useRunProgress.ts
 * Subscribes to live run progress events via WebSocket.
 * Called from the run detail page when a run is RUNNING.
 */
import { useEffect, useRef } from 'react';
import type { StepStatusEvent } from '../types';

const WS_BASE = window.location.origin.replace(/^http/, 'ws');

export function useRunProgress(
  runId: string | null,
  onEvent: (event: StepStatusEvent) => void
): void {
  // Stable ref so the effect doesn't re-subscribe on every render
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!runId) return;

    const ws = new WebSocket(`${WS_BASE}/ws/runs/${runId}`);

    ws.onmessage = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data as string) as StepStatusEvent;
        onEventRef.current(event);
      } catch {
        console.warn('Received non-JSON WebSocket message', e.data);
      }
    };

    ws.onerror = () => {
      console.error('Run progress WebSocket error — run:', runId);
    };

    ws.onclose = (e) => {
      if (!e.wasClean) {
        console.warn('WebSocket closed unexpectedly for run', runId);
      }
    };

    return () => {
      ws.close();
    };
  }, [runId]);
}
