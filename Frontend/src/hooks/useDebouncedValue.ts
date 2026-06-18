/**
 * Debounced value hook.
 *
 * Search boxes in large enterprise directories should not call the API on every
 * keypress. A 400ms debounce keeps the interface responsive, avoids backend
 * request storms, and still feels immediate to operators.
 */

import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(handle);
  }, [delayMs, value]);

  return debouncedValue;
}
