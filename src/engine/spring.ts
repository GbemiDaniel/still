/**
 * Damped spring. omega sets speed (higher is snappier). zeta is the damping ratio:
 * 1 is critically damped (no overshoot), below 1 settles with a soft overshoot. dt in ms.
 */
export class Spring {
  value: number;
  target: number;
  velocity = 0;
  omega: number;
  zeta: number;

  constructor(value = 0, omega = 12, zeta = 1) {
    this.value = this.target = value;
    this.omega = omega;
    this.zeta = zeta;
  }

  update(dtMs: number): number {
    const dt = dtMs / 1000;
    const w = this.omega;
    if (this.zeta === 1) {
      // Exact closed form for the critically damped case.
      const x = this.value - this.target;
      const e = Math.exp(-w * dt);
      const tmp = (this.velocity + w * x) * dt;
      this.velocity = (this.velocity - w * tmp) * e;
      this.value = this.target + (x + tmp) * e;
      return this.value;
    }
    // Semi-implicit Euler in small substeps: stable for any frame time up to the loop's clamp.
    const steps = Math.max(1, Math.ceil(dt / 0.004));
    const h = dt / steps;
    const c = 2 * this.zeta * w;
    for (let i = 0; i < steps; i++) {
      this.velocity += (-w * w * (this.value - this.target) - c * this.velocity) * h;
      this.value += this.velocity * h;
    }
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
