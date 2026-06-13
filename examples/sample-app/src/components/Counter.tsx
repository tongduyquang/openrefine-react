import { useState } from 'react';

export interface CounterProps {
  /** Starting value for the counter. Defaults to 0. */
  initialCount?: number;
  /** Called with the new count whenever it changes. */
  onChange?: (count: number) => void;
}

/** A simple increment/decrement counter. */
export function Counter({ initialCount = 0, onChange }: CounterProps) {
  const [count, setCount] = useState(initialCount);

  const update = (next: number) => {
    setCount(next);
    onChange?.(next);
  };

  return (
    <div>
      <p>Count: {count}</p>
      <button type="button" onClick={() => update(count - 1)}>
        Decrement
      </button>
      <button type="button" onClick={() => update(count + 1)}>
        Increment
      </button>
    </div>
  );
}
