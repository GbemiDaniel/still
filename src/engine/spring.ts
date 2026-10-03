/** Critically damped spring. omega sets speed (higher is snappier). dt in ms. */
export class Spring {
  value: number;
  target: number;
  velocity = 0;
  omega: number;

  constructor(value = 0, omega = 12) {
    this.value = this.target = value;
    this.omega = omega;
  }

  update(dtMs: number): number {
    const dt = dtMs / 1000;
    const w = this.omega;
    const x = this.value - this.target;
    const e = Math.exp(-w * dt);
    const tmp = (this.velocity + w * x) * dt;
    this.velocity = (this.velocity - w * tmp) * e;
    this.value = this.target + (x + tmp) * e;
    return this.value;
  }
}

export class Spring2 {
  x: Spring;
  y: Spring;

  constructor(x = 0, y = 0, omega = 12) {
    this.x = new Spring(x, omega);
    this.y = new Spring(y, omega);
  }

  setTarget(x: number, y: number) {
    this.x.target = x;
    this.y.target = y;
  }

  update(dtMs: number) {
    this.x.update(dtMs);
    this.y.update(dtMs);
  }
}
