import { useEffect, useState } from "react";

// Boolean that toggles every `intervalMs`, driving the blinking colon shared by the clock variants.
export const useBlinkingColon = (intervalMs = 500): boolean => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setVisible((v) => !v), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return visible;
};
