// Still, pass 2: one warm light breathing in the haze, tone curve and film grain.
// Runs at full resolution, so it stays cheap. GLSL ES 1.00 for WebGL2 and WebGL1.
precision highp float;

uniform sampler2D uHaze;  // pass 1 output, red channel
uniform vec2 uRes;        // drawing buffer size in pixels
uniform float uBreath;    // 0 (out) .. 1 (in)
uniform vec2 uLight;      // light centre from screen centre, in field units
uniform float uGrainSeed; // changes at film rate, fixed in calm mode
uniform float uGrain;     // grain strength

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  // Unit is the height, capped by width on tall portrait screens so the light keeps its size.
  float unit = min(uRes.y, uRes.x * 1.6);
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / unit;
  float b = uBreath;
  float h = texture2D(uHaze, gl_FragCoord.xy / uRes).r;

  // Light: a small hot core, a tight halo and a long faint falloff that the haze catches.
  float d = length(p - uLight);
  float r = mix(0.05, 0.085, b);
  float energy = mix(0.75, 1.15, b);
  float core = exp(-(d * d) / (r * r));
  float halo = (r * r * 0.6) / (d * d + r * r * 0.6);
  halo *= sqrt(halo);
  float wide = exp(-d * mix(7.5, 5.8, b));

  vec3 deep = vec3(0.0009, 0.0008, 0.0016);
  vec3 dusk = vec3(0.004, 0.0035, 0.009);
  vec3 ember = vec3(1.0, 0.36, 0.10);
  vec3 amber = vec3(1.0, 0.60, 0.28);
  vec3 hot = vec3(1.0, 0.90, 0.76);

  vec3 col = deep + dusk * h;
  col += ember * wide * (0.12 + 0.30 * h) * energy;
  col += amber * halo * (0.45 + 0.35 * h) * energy;
  col += hot * core * 1.1 * energy;

  // Vignette, then a soft filmic curve and sRGB encode.
  float v = smoothstep(1.15, 0.15, length(p * vec2(1.0, 0.85)));
  col *= mix(0.45, 1.0, v);
  col = 1.0 - exp(-col * 1.25);
  col = pow(col, vec3(1.0 / 2.2));

  // Film grain (triangular, so it also dithers away banding). Lighter in the highlights.
  vec2 g = gl_FragCoord.xy + uGrainSeed * vec2(113.0, 71.0);
  float n = hash12(g) + hash12(g + 19.19) - 1.0;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col += n * uGrain * (1.0 - 0.6 * lum);

  gl_FragColor = vec4(col, 1.0);
}
