import { RefObject, useEffect, useRef, useState } from "react";
import { Program } from "@/types/iptv";

interface UseIdleStateOptions {
  theaterMode: boolean;
  settingsOpen: boolean;
  fullGuideOpen: boolean;
  // Truthy when the full-guide program popup is open.
  focusedProgram: unknown;
  selectedPoster: Program | null;
  // Scrollable containers whose scroll activity should reset the idle timer.
  scrollRefs: Array<RefObject<HTMLElement | null>>;
  // Called to auto-close the poster (on idle, and after 9s while the full guide is open).
  closePoster: () => void;
}

// Idle / scroll / sidebar-visibility state extracted from Index.tsx.
// Hides the sidebar + cursor after a context-dependent idle timeout and tracks scrolling.
export const useIdleState = ({
  theaterMode,
  settingsOpen,
  fullGuideOpen,
  focusedProgram,
  selectedPoster,
  scrollRefs,
  closePoster,
}: UseIdleStateOptions) => {
  const [isIdle, setIsIdle] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);

  // Keep the latest callback without re-subscribing listeners each render.
  const closePosterRef = useRef(closePoster);
  closePosterRef.current = closePoster;

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let scrollTimeout: NodeJS.Timeout;
    let posterTimeout: NodeJS.Timeout;

    const resetIdle = () => {
      setIsIdle(false);
      if (!theaterMode) {
        setSidebarVisible(true);
      }
      clearTimeout(timeout);
      clearTimeout(posterTimeout);

      // Context-dependent idle delay:
      // - Settings open: 20s (user is configuring)
      // - Full guide with popup open: 25s (reading program details)
      // - Full guide / focused program / scrolling: 10s
      // - Default: 3s (normal viewing)
      let idleTime: number;
      if (settingsOpen) {
        idleTime = 20000;
      } else if (focusedProgram && fullGuideOpen) {
        idleTime = 25000;
      } else if (fullGuideOpen || focusedProgram) {
        idleTime = 10000;
      } else if (isScrolling) {
        idleTime = 10000;
      } else {
        idleTime = 3000;
      }

      // Close poster at 9s when in full guide mode (before the 10s idle timeout).
      if (fullGuideOpen && selectedPoster) {
        posterTimeout = setTimeout(() => {
          closePosterRef.current();
        }, 9000);
      }

      timeout = setTimeout(() => {
        setIsIdle(true);
        setSidebarVisible(false);
        closePosterRef.current(); // Close poster when idle (focusedProgram popup stays open)
      }, idleTime);
    };

    const handleScrollStart = () => {
      setIsScrolling(true);
      clearTimeout(scrollTimeout);
      resetIdle();
    };

    const handleScrollEnd = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setIsScrolling(false);
      }, 1000);
    };

    // Explicit scroll containers plus any dynamically-created scroll viewports.
    const scrollableElements = [
      ...scrollRefs.map((ref) => ref.current),
      ...Array.from(document.querySelectorAll("[data-radix-scroll-area-viewport]")),
      ...Array.from(document.querySelectorAll(".overflow-auto, .overflow-y-auto")),
    ].filter(Boolean) as Element[];

    scrollableElements.forEach((element) => {
      element.addEventListener("scroll", handleScrollStart, { passive: true });
      element.addEventListener("scroll", handleScrollEnd, { passive: true });
    });

    const handleWheel = (e: WheelEvent) => {
      const target = e.target as Element;
      const isInScrollableArea = scrollableElements.some((el) => el.contains(target));
      if (isInScrollableArea && Math.abs(e.deltaY) > 0) {
        handleScrollStart();
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          setIsScrolling(false);
        }, 1000);
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("mousemove", resetIdle);
    window.addEventListener("keydown", resetIdle);
    window.addEventListener("touchstart", resetIdle);
    window.addEventListener("click", resetIdle);
    resetIdle(); // initial

    return () => {
      clearTimeout(timeout);
      clearTimeout(scrollTimeout);
      clearTimeout(posterTimeout);
      window.removeEventListener("mousemove", resetIdle);
      window.removeEventListener("keydown", resetIdle);
      window.removeEventListener("touchstart", resetIdle);
      window.removeEventListener("click", resetIdle);
      window.removeEventListener("wheel", handleWheel);

      scrollableElements.forEach((element) => {
        element.removeEventListener("scroll", handleScrollStart);
        element.removeEventListener("scroll", handleScrollEnd);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullGuideOpen, settingsOpen, selectedPoster, isScrolling, focusedProgram, theaterMode]);

  // Hide the cursor while idle.
  useEffect(() => {
    document.body.style.cursor = isIdle ? "none" : "default";
  }, [isIdle]);

  return { isIdle, setIsIdle, isScrolling, setIsScrolling, sidebarVisible, setSidebarVisible };
};
