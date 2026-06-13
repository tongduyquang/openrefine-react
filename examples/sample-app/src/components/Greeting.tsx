export interface GreetingProps {
  /** Name of the person to greet. */
  name: string;
  /** Optional time of day, used to vary the salutation. */
  timeOfDay?: 'morning' | 'afternoon' | 'evening';
}

function salutationFor(timeOfDay?: GreetingProps['timeOfDay']): string {
  switch (timeOfDay) {
    case 'morning':
      return 'Good morning';
    case 'afternoon':
      return 'Good afternoon';
    case 'evening':
      return 'Good evening';
    default:
      return 'Hello';
  }
}

/** Renders a friendly greeting for the given name. */
export function Greeting({ name, timeOfDay }: GreetingProps) {
  return (
    <p>
      {salutationFor(timeOfDay)}, {name}!
    </p>
  );
}
