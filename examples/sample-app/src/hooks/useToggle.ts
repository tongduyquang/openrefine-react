import { useCallback, useState } from 'react';

/** A boolean toggle hook. Returns the current value and a function to flip it. */
export function useToggle(initialValue = false): [boolean, () => void] {
  const [value, setValue] = useState(initialValue);

  const toggle = useCallback(() => {
    setValue((prev) => !prev);
  }, []);

  return [value, toggle];
}
