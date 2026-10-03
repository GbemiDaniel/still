// Still, pass 2: one warm light breathing in the haze, tone curve and dither.
// Film grain is not drawn here: it is a full device-resolution layer above the canvas (grain.ts).
// Runs at full resolution, so it stays cheap. GLSL ES 1.00 for WebGL2 and WebGL1.
precision highp float;

uniform sampler2D uHaze;  // pass 1 output, red channel
uniform vec2 uRes;        // drawing buffer size in pixels
uniform float uBreath;    // 0 (out) .. 1 (in)
uniform vec2 uLight;      // light centre from screen centre, in field units

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
  // Idle breathing stays in the lower part of the range; a held breath takes it to 1,
  // where the light swells, its falloff reaches across the field and the haze warms up.
  float r = mix(0.045, 0.11, b);
  float energy = mix(0.7, 1.4, b);
  float core = exp(-(d * d) / (r * r));
  float halo = (r * r * 0.6) / (d * d + r * r * 0.6);
  halo *= sqrt(halo);
  float wide = exp(-d * mix(8.0, 4.4, b));

  vec3 deep = vec3(0.0009, 0.0008, 0.0016);
  vec3 dusk = vec3(0.004, 0.0035, 0.009);
  vec3 ember = vec3(1.0, 0.36, 0.10);
  vec3 amber = vec3(1.0, 0.60, 0.28);
  vec3 hot = vec3(1.0, 0.90, 0.76);

  vec3 col = deep + dusk * h * (1.0 + 1.5 * b);
  // The haze tints the glow but only lightly, so its uneven shapes never pull the glow
  // off centre. Same average as before, about half the swing.
  col += ember * wide * (0.16 + 0.20 * h) * energy;
  col += amber * halo * (0.50 + 0.20 * h) * energy;
  col += hot * core * 1.1 * energy;

  // Vignette that opens on the in-breath, so the whole field follows, then a soft
  // filmic curve and sRGB encode.
  float v = smoothstep(1.15 + 0.45 * b, 0.15, length(p * vec2(1.0, 0.85)));
  col *= mix(0.45 + 0.25 * b, 1.0, v);
  col = 1.0 - exp(-col * 1.25);
  col = pow(col, vec3(1.0 / 2.2));

  // Triangular dither of one 8-bit step: invisible as texture, but it breaks the long
  // smooth falloff into noise instead of bands. Static, so it never shimmers.
  float n = hash12(gl_FragCoord.xy) + hash12(gl_FragCoord.xy + 19.19) - 1.0;
  col += n / 255.0;

  gl_FragColor = vec4(col, 1.0);
}
