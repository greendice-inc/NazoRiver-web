// Animated cel-shaded water for the title key visual.
// A mask texture (art/title/water_mask.webp) says where the water is:
//   R = river (flows toward the viewer in perspective), G = extra foam near banks/boat, B = waterfall.
// Everything else stays transparent, so the boat, crew and parrot in the key visual stay on top of the water.

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
uniform sampler2D uMask;
uniform float uTime;
varying vec2 vUv;

// 2D simplex noise (Ashima Arts / Stefan Gustavson, MIT)
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * snoise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return s;
}

// Palette sampled from the original key visual.
const vec3 DEEP  = vec3(0.243, 0.588, 0.859);  // #3e96db
const vec3 MID   = vec3(0.357, 0.651, 0.875);  // #5ba6df
const vec3 LIGHT = vec3(0.486, 0.722, 0.894);  // #7cb8e4
const vec3 PALE  = vec3(0.639, 0.808, 0.929);  // #a3ceed
const vec3 FOAMS = vec3(0.84, 0.93, 0.99);     // foam shadow
const vec3 FALL0 = vec3(0.208, 0.600, 0.949);  // #3599f2
const vec3 FALL1 = vec3(0.373, 0.714, 0.906);  // #5fb6e7
const vec3 FALL2 = vec3(0.620, 0.827, 0.961);  // #9ed3f5

vec3 river(vec2 p, float boost, float t) {
  // Ground-plane mapping: horizon at y=380, vanishing point x=880. Z grows toward the horizon.
  float dy = max(p.y - 380.0, 24.0);
  float Z = 300.0 / dy;
  float X = (p.x - 880.0) / dy;
  float far = smoothstep(0.9, 5.5, Z);
  vec2 q = vec2(X * 2.4, Z * 1.15 + t * 0.24);

  // Domain warp gives the swirling, churning motion.
  vec2 w = vec2(fbm(q * 0.8 + vec2(0.0, t * 0.05)), fbm(q * 0.8 + vec2(5.2, 1.3 - t * 0.04)));
  vec2 r = q + 0.42 * w;

  float body = fbm(r * vec2(1.5, 2.4));
  // Jagged crests across the flow, like the spiky rapids in the art.
  float spikes = 1.0 - abs(snoise(vec2(r.x * 7.0, r.y * 1.1 - t * 0.08)));
  float field = body + 0.2 * spikes * spikes + boost * 0.7 - far * 0.12;

  float e = 0.012 + far * 0.05;
  float bands = fbm(r * vec2(2.2, 3.4) + 3.7);
  vec3 c = DEEP;
  c = mix(c, MID, smoothstep(-0.08, -0.08 + e, bands));
  c = mix(c, LIGHT, smoothstep(0.10, 0.10 + e, field));
  c = mix(c, PALE, smoothstep(0.19, 0.19 + e, field));
  float foam = smoothstep(0.27, 0.27 + e, field);
  // Foam gets a soft blue shadow on its downstream edge so it reads as volume, not paper cut-outs.
  float under = fbm(r * vec2(1.5, 2.4) + vec2(0.0, -0.11)) + 0.2 * spikes * spikes + boost * 0.7 - far * 0.12;
  vec3 foamCol = mix(FOAMS, vec3(1.0), smoothstep(0.24, 0.34, under));
  c = mix(c, foamCol, foam);

  // Sun glints on the open water.
  float g = snoise(p * 0.085 + vec2(t * 0.25, -t * 0.8));
  float g2 = snoise(p * 0.03 + vec2(-t * 0.12, t * 0.2));
  c = mix(c, vec3(1.0), smoothstep(0.86, 0.93, g * 0.7 + g2 * 0.45) * (1.0 - foam) * (1.0 - far));

  // Distance haze toward the horizon (also hides noise shimmer there).
  c = mix(c, vec3(0.80, 0.91, 0.98), far * 0.3);
  return c;
}

vec3 waterfall(vec2 p, float t) {
  vec2 q = vec2(p.x * 0.028, p.y * 0.0042 - t * 0.8);
  float s = fbm(q);
  float streak = snoise(vec2(p.x * 0.07, p.y * 0.0018 - t * 0.7));
  float v = s + streak * 0.28;
  vec3 c = FALL0;
  c = mix(c, FALL1, smoothstep(-0.18, -0.16, v));
  c = mix(c, FALL2, smoothstep(0.02, 0.04, v));
  c = mix(c, vec3(1.0), smoothstep(0.18, 0.20, v));
  // Mist where it hits the river.
  float mist = smoothstep(330.0, 440.0, p.y);
  c = mix(c, vec3(1.0), mist * smoothstep(-0.2, 0.2, fbm(p * 0.02 + vec2(0.0, -t * 0.4))));
  return c;
}

void main() {
  vec4 m = texture2D(uMask, vUv);
  float a = max(m.r, m.b);
  if (a < 0.004) discard;
  vec2 p = vUv * vec2(1920.0, 1080.0);
  vec3 c = river(p, m.g, uTime);
  if (m.b > 0.004) c = mix(c, waterfall(p, uTime), m.b / a);
  gl_FragColor = vec4(c * a, a);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("title water shader:", gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

export class TitleWater {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null;
  private uTime: WebGLUniformLocation | null = null;
  private ready = false;
  private running = false;
  private raf = 0;
  private start = performance.now();

  constructor(parent: HTMLElement, maskUrl: string) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "abs t-water";
    parent.appendChild(this.canvas);
    // Half-res buffer is enough for flat cel shading and keeps phones cool; CSS scales it to the stage.
    const scale = Math.min(window.devicePixelRatio || 1, 2) >= 2 ? 0.75 : 0.6667;
    this.canvas.width = Math.round(1920 * scale);
    this.canvas.height = Math.round(1080 * scale);
    this.gl = this.canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!this.gl) return;
    const gl = this.gl;
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) {
      this.gl = null;
      return;
    }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("title water link:", gl.getProgramInfoLog(prog));
      this.gl = null;
      return;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.uTime = gl.getUniformLocation(prog, "uTime");
    gl.uniform1i(gl.getUniformLocation(prog, "uMask"), 0);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    const img = new Image();
    img.onload = () => {
      if (!this.gl) return;
      const tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      this.ready = true;
      this.draw();
      if (this.running) this.loop();
    };
    img.src = maskUrl;
  }

  get available(): boolean {
    return !!this.gl;
  }

  setRunning(running: boolean): void {
    if (running === this.running) return;
    this.running = running;
    if (running && this.ready) this.loop();
    if (!running) cancelAnimationFrame(this.raf);
  }

  private loop = (): void => {
    if (!this.running) return;
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  /** Debug/capture: stop the loop and draw the water at an exact time (seconds). */
  renderAt(seconds: number): boolean {
    this.setRunning(false);
    this.draw(seconds);
    return this.ready;
  }

  private draw(seconds = ((performance.now() - this.start) / 1000) % 3600): void {
    const gl = this.gl;
    if (!gl || !this.ready) return;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(this.uTime, seconds);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
