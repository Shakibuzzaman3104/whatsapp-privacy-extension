/**
 * @author Shakib
 * @since 25/10/26
 */
import { describe, expect, it } from 'vitest';
import { GuardState } from '../src/lib/guard';

const run = (guard: GuardState, samples: number[]) => samples.map((n) => guard.push(n).covered);

describe('GuardState', () => {
  it('ignores a single noisy frame with two faces', () => {
    expect(run(new GuardState(false), [1, 2, 1, 1]).some(Boolean)).toBe(false);
  });

  it('covers after two crowded samples and uncovers after four alone', () => {
    const guard = new GuardState(false);
    expect(run(guard, [1, 2, 2])).toEqual([false, false, true]);
    expect(run(guard, [1, 1, 1])).toEqual([true, true, true]);
    expect(guard.push(1)).toEqual({ covered: false, changed: true });
  });

  it('does not uncover while a crowd keeps flickering in', () => {
    const guard = new GuardState(false);
    run(guard, [2, 2]);
    expect(run(guard, [1, 1, 1, 2, 1, 1, 1]).every(Boolean)).toBe(true);
  });

  it('treats an empty seat as safe unless empty-seat mode is on', () => {
    expect(run(new GuardState(false), Array(20).fill(0)).some(Boolean)).toBe(false);
    const strict = new GuardState(true);
    const states = run(strict, Array(9).fill(0));
    expect(states.at(-1)).toBe(true);
    expect(states.slice(0, 8).some(Boolean)).toBe(false);
  });

  it('uncovers an empty-seat cover only when you are back', () => {
    const guard = new GuardState(true);
    run(guard, Array(9).fill(0));
    expect(run(guard, [0, 0, 0, 0, 0]).every(Boolean)).toBe(true);
    expect(run(guard, [1, 1, 1, 1]).at(-1)).toBe(false);
  });
});
