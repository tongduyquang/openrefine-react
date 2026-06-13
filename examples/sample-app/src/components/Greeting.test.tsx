import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Greeting } from './Greeting';

describe('Greeting', () => {
  it('renders a default greeting with the given name', () => {
    render(<Greeting name="Ada" />);

    expect(screen.getByText('Hello, Ada!')).toBeInTheDocument();
  });

  it('uses a time-of-day specific salutation when provided', () => {
    render(<Greeting name="Grace" timeOfDay="morning" />);

    expect(screen.getByText('Good morning, Grace!')).toBeInTheDocument();
  });
});
