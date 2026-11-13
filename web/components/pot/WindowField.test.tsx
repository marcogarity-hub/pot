import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WindowField, type Preset } from './WindowField';

const presets: Preset[] = [
  { label: '2 minutes', seconds: 120 },
  { label: '1 hour', seconds: 3600 },
];

/** Parent that owns `seconds`, like CreatePotForm does. */
function Harness({ initial }: { initial: number }) {
  const [seconds, setSeconds] = useState(initial);
  return <WindowField id="window" label="Window" hint="hint" presets={presets} seconds={seconds} onChange={setSeconds} />;
}

afterEach(() => cleanup());

describe('WindowField custom input', () => {
  it('stays mounted while typing a value that briefly matches a preset', () => {
    // 90 s is not a preset, so the custom input starts open.
    render(<Harness initial={90} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();

    // 2 minutes is exactly the "2 minutes" preset. The input must not unmount mid-typing.
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } });
    const still = screen.getByRole('spinbutton');
    expect(still).toBeInTheDocument();
    expect(still).toHaveValue(2);
  });

  it('keeps the custom input for a non-preset value', () => {
    render(<Harness initial={90} />);
    expect(screen.getByRole('spinbutton')).toHaveValue(2);
  });
});
