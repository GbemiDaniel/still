/**
 * Full-screen shader field in two passes:
 * 1. haze.frag renders the slow fbm haze into a small offscreen buffer (sized in CSS pixels).
 * 2. field.frag upsamples it and adds the light, tone curve and dither.
 * Film grain is a separate full-resolution layer (grain.ts).
 */
import hazeFrag from './haze.frag?raw';
import fieldFrag from './field.frag?raw';

const VERT = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;

export interface FieldSettings {
  /** Haze buffer size as a fraction of CSS pixels. */
  hazeScale: number;
  octaves: number;
  warp: boolean;
}

export interface FieldFrame {
  time: number;
  breath: number;
  lightX: number;
  lightY: number;
}

export interface Field {
  resize(pixelRatio: number, hazeScale: number): void;
  draw(frame: FieldFrame, settings: FieldSettings): void;
}

type Uniforms = Record<string, WebGLUniformLocation | null>;

export function createField(canvas: HTMLCanvasElement): Field | null {
  const attrs: WebGLContextAttributes = {
    alpha: false, antialias: false, depth: false, stencil: false,
    premultipliedAlpha: false, powerPreference: 'high-performance',
  };
  const gl = (canvas.getContext('webgl2', attrs) ?? canvas.getContext('webgl', attrs)) as
    WebGLRenderingContext | null;
  if (!gl) return null;

  let haze: { prog: WebGLProgram; u: Uniforms };
  let comp: { prog: WebGLProgram; u: Uniforms };
  let tex: WebGLTexture;
  let fbo: WebGLFramebuffer;
  let bufW = 0;
  let bufH = 0;
  let lost = false;

  function program(src: string, names: string[]) {
    const compile = (type: number, s: string) => {
      const sh = gl!.createShader(type)!;
      gl!.shaderSource(sh, s);
      gl!.compileShader(sh);
      if (!gl!.getShaderParameter(sh, gl!.COMPILE_STATUS) && !gl!.isContextLost()) {
        throw new Error(gl!.getShaderInfoLog(sh) ?? 'shader compile failed');
      }
      return sh;
    };
    const prog = gl!.createProgram()!;
    gl!.attachShader(prog, compile(gl!.VERTEX_SHADER, VERT));
    gl!.attachShader(prog, compile(gl!.FRAGMENT_SHADER, src));
    gl!.bindAttribLocation(prog, 0, 'a');
    gl!.linkProgram(prog);
    const u: Uniforms = {};
    for (const n of names) u[n] = gl!.getUniformLocation(prog, n);
    return { prog, u };
  }

  function build() {
    haze = program(hazeFrag, ['uBuf', 'uRes', 'uTime', 'uBreath', 'uOctaves', 'uWarp']);
    comp = program(fieldFrag, ['uHaze', 'uRes', 'uBreath', 'uLight']);
    const buf = gl!.createBuffer();
    gl!.bindBuffer(gl!.ARRAY_BUFFER, buf);
    gl!.bufferData(gl!.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl!.STATIC_DRAW);
    gl!.enableVertexAttribArray(0);
    gl!.vertexAttribPointer(0, 2, gl!.FLOAT, false, 0, 0);

    tex = gl!.createTexture()!;
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    fbo = gl!.createFramebuffer()!;
    bufW = bufH = 0;
  }

  build();
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; build(); });

  return {
    resize(pixelRatio, hazeScale) {
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      const w = Math.max(1, Math.round(cw * pixelRatio));
      const h = Math.max(1, Math.round(ch * pixelRatio));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const hw = Math.max(1, Math.round(cw * hazeScale));
      const hh = Math.max(1, Math.round(ch * hazeScale));
      if (lost || (hw === bufW && hh === bufH)) return;
      bufW = hw;
      bufH = hh;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, hw, hh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
    draw(f, s) {
      if (lost || !bufW) return;

      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, bufW, bufH);
      gl.useProgram(haze.prog);
      gl.uniform2f(haze.u.uBuf, bufW, bufH);
      gl.uniform2f(haze.u.uRes, canvas.width, canvas.height);
      gl.uniform1f(haze.u.uTime, f.time);
      gl.uniform1f(haze.u.uBreath, f.breath);
      gl.uniform1i(haze.u.uOctaves, s.octaves);
      gl.uniform1f(haze.u.uWarp, s.warp ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(comp.prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(comp.u.uHaze, 0);
      gl.uniform2f(comp.u.uRes, canvas.width, canvas.height);
      gl.uniform1f(comp.u.uBreath, f.breath);
      gl.uniform2f(comp.u.uLight, f.lightX, f.lightY);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}
