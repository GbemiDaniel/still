// Still, pass 1: the drifting haze. Soft and low-frequency, so it renders into a small
// offscreen buffer and is upsampled by the composite pass.
precision highp float;

uniform vec2 uBuf;     // haze buffer size in pixels
uniform vec2 uRes;     // screen buffer size, for aspect
uniform float uTime;   // seconds
uniform float uBreath; // 0 (out) .. 1 (in)
uniform int uOctaves;  // haze detail, set by the governor
uniform float uWarp;   // 0 or 1, domain warp on or off

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}

const mat2 ROT = mat2(0.8, 0.6, -0.6, 0.8);

float fbm(vec2 p, int octaves) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    sum += amp * noise(p);
    norm += amp;
    p = ROT * p * 2.03 + 17.1;
    amp *= 0.5;
  }
  return sum / norm;
}

void main() {
  // Same field units as the composite pass: height, capped by width on tall screens.
  vec2 uv = gl_FragCoord.xy / uBuf;
  vec2 p = (uv - 0.5) * uRes / min(uRes.y, uRes.x * 1.6);
  float t = uTime;
  float b = uBreath;

  // Slow fbm, gently warped, that opens a little as the light breathes in.
  vec2 q = p * (1.7 - 0.12 * b) + vec2(0.0, -t * 0.012);
  vec2 warp = vec2(fbm(q + vec2(0.0, t * 0.021), 2),
                   fbm(q + vec2(5.2, 1.3) - t * 0.017, 2)) - 0.5;
  float h = fbm(q + uWarp * 0.9 * warp + vec2(t * 0.008, 0.0), uOctaves);
  // Half-step dither before the 8-bit buffer, so upsampled haze keeps its soft gradient
  // instead of stepping into streaks.
  float dither = (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(smoothstep(0.3, 0.8, h) + dither, 0.0, 0.0, 1.0);
}
