import { useCallback, useRef, type ReactNode } from "react";
import { toast } from "sonner";
import { logger } from "@/utils/logger";

type ToastKind = "success" | "error" | "info" | "warning";
type ToastMessage = string | ReactNode;

export type QueuedToast = Record<ToastKind, (message: ToastMessage) => void>;

// Notification queue: enforces a 2s gap between toasts and drops a repeat of the
// same string message within 5s. Wraps sonner + the server logger.
// Extracted from Index.tsx where it was defined inline.
export const useQueuedToast = () => {
  const queueRef = useRef<Array<() => void>>([]);
  const processingRef = useRef(false);
  const lastShownRef = useRef<Map<string, number>>(new Map());

  const processQueue = useCallback(() => {
    // Local recursion so the memoized callback doesn't reference itself.
    const step = () => {
      if (queueRef.current.length > 0) {
        const fn = queueRef.current.shift()!;
        fn();
        setTimeout(step, 2000); // 2-second gap between notifications
      } else {
        processingRef.current = false;
      }
    };
    step();
  }, []);

  const queueNotification = useCallback(
    (fn: () => void, messageKey: string) => {
      const now = Date.now();
      const lastShown = lastShownRef.current.get(messageKey);
      // Skip a duplicate of the same message within 5 seconds.
      if (lastShown && now - lastShown < 5000) return;
      lastShownRef.current.set(messageKey, now);

      queueRef.current.push(fn);
      if (!processingRef.current) {
        processingRef.current = true;
        processQueue();
      }
    },
    [processQueue]
  );

  const logByKind: Record<ToastKind, (message: string) => void> = {
    success: logger.log,
    error: logger.error,
    info: logger.info,
    warning: logger.warn,
  };

  const make = (kind: ToastKind) => (message: ToastMessage) => {
    const messageKey = typeof message === "string" ? message : `jsx-${kind}`;
    if (typeof message === "string") logByKind[kind](message);
    return queueNotification(() => toast[kind](message), messageKey);
  };

  const queuedToast: QueuedToast = {
    success: make("success"),
    error: make("error"),
    info: make("info"),
    warning: make("warning"),
  };

  return { queuedToast, queueNotification };
};
