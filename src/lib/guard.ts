/**
 * @author Shakib
 * @since 25/10/26
 *
 * Turns a stream of face counts into cover / uncover decisions. Pure, so it
 * can be tested without a camera.
 */

/** ~3 samples per second. */
export const SAMPLE_MS = 333;
/** Two samples in a row with 2+ faces: someone joined. */
const CROWD_SAMPLES = 2;
/** About 3 s with nobody in view. */
const EMPTY_SAMPLES = 9;
/** About 1.3 s of just you before uncovering, so it doesn't flicker. */
const CLEAR_SAMPLES = 4;

export interface GuardDecision {
  covered: boolean;
  changed: boolean;
}

export class GuardState {
  private crowd = 0;
  private empty = 0;
  private alone = 0;
  covered = false;

  constructor(private emptySeat: boolean) {}

  setEmptySeat(on: boolean) {
    this.emptySeat = on;
  }

  reset() {
    this.crowd = this.empty = this.alone = 0;
    this.covered = false;
  }

  push(faces: number): GuardDecision {
    this.crowd = faces >= 2 ? this.crowd + 1 : 0;
    this.empty = faces === 0 ? this.empty + 1 : 0;
    const clear = faces === 1 || (faces === 0 && !this.emptySeat);
    this.alone = clear ? this.alone + 1 : 0;

    const before = this.covered;
    if (!this.covered && (this.crowd >= CROWD_SAMPLES || (this.emptySeat && this.empty >= EMPTY_SAMPLES))) {
      this.covered = true;
    } else if (this.covered && this.alone >= CLEAR_SAMPLES) {
      this.covered = false;
    }
    return { covered: this.covered, changed: before !== this.covered };
  }
}
