import { laneX, STEP } from "./mode";

// Cruise-style lane steering: ±0.20 per stroke, 0.005/frame decay, lane change at ±1.
export class Steer {
  lane = 3;
  gauge = 0;
  moving = false;
  private from = 3;
  private to = 3;
  private time = 0;
  private duration = 0.25;
  private left = 0;
  private right = 0;

  reset(lane = 3): void {
    this.lane = lane;
    this.from = lane;
    this.to = lane;
    this.gauge = 0;
    this.moving = false;
    this.left = 0;
    this.right = 0;
  }

  pressLeft(): void {
    this.left += 1;
  }

  pressRight(): void {
    this.right += 1;
  }

  clearInput(): void {
    this.left = 0;
    this.right = 0;
  }

  // Returns true on the frame a lane change starts.
  step(enabled: boolean, duration: number): boolean {
    if (this.moving) {
      this.time += STEP;
      if (this.time >= this.duration) this.moving = false;
      this.clearInput();
      return false;
    }
    if (this.gauge > 0) this.gauge = Math.max(this.gauge - 0.005, 0);
    else if (this.gauge < 0) this.gauge = Math.min(this.gauge + 0.005, 0);
    const right = this.right;
    const left = this.left;
    this.clearInput();
    if (!enabled) return false;
    for (let i = 0; i < right; i++) this.push(1);
    for (let i = 0; i < left; i++) this.push(-1);
    if (this.gauge >= 1) return this.begin(this.lane + 1, duration);
    if (this.gauge <= -1) return this.begin(this.lane - 1, duration);
    return false;
  }

  x(): number {
    if (!this.moving) return laneX(this.lane);
    const t = Math.min(this.time / this.duration, 1);
    return laneX(this.from + (this.to - this.from) * t);
  }

  displayLane(): number {
    if (!this.moving) return this.lane;
    const t = Math.min(this.time / this.duration, 1);
    return this.from + (this.to - this.from) * t;
  }

  arrowGauge(): { gauge: number; full: boolean } {
    if (this.moving) return { gauge: Math.sign(this.to - this.from), full: true };
    return { gauge: this.gauge, full: false };
  }

  private push(dir: 1 | -1): void {
    if (dir > 0 && this.lane === 5) {
      this.gauge = this.gauge <= -0.2 ? this.gauge + 0.2 : 0;
      return;
    }
    if (dir < 0 && this.lane === 1) {
      this.gauge = this.gauge >= 0.2 ? this.gauge - 0.2 : 0;
      return;
    }
    this.gauge += 0.2 * dir;
  }

  private begin(next: number, duration: number): boolean {
    this.gauge = 0;
    if (next < 1 || next > 5) return false;
    this.from = this.lane;
    this.to = next;
    this.lane = next;
    this.time = 0;
    this.duration = duration;
    this.moving = true;
    return true;
  }
}
