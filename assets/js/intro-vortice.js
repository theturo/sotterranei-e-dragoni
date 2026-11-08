// Vortice dell'intro disegnato da uno shader (WebGL 1): il vortice dipinto (texture quadrata)
// gira più veloce al centro e si stringe; nel finale vira ai toni caldi e un fronte a spirale
// lo copre con il bianco dipinto. Finché le texture non sono pronte disegna un vortice generato
// (rumore deterministico: niente sfarfallio). Funziona anche dentro un worker (OffscreenCanvas).

const VS = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FS = `
precision highp float;
uniform vec2 uRes;
uniform float uU;
uniform vec2 uEll;
uniform float uRot, uTwist, uGlow, uGlowR, uWarm, uFlash, uBianco;
uniform vec3 uCam; // zoom, centro x, centro y (unità = lato corto)
uniform sampler2D uTexQ, uTexB; // vortice dipinto e bianco finale dipinto
uniform float uModo;            // 0 generato, 1 dipinto

float h(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
float n(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.55;
  for (int i = 0; i < 5; i++) { v += a * n(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= 0.5; }
  return v;
}
vec3 pick(float i, vec3 a, vec3 b, vec3 c, vec3 d, vec3 e){
  return i < 0.5 ? a : i < 1.5 ? b : i < 2.5 ? c : i < 3.5 ? d : e;
}
vec3 rampa(float v){
  // tavolozza dei master (blu, crema, ocra) e, nel finale, quella calda del montaggio
  vec3 c0 = mix(vec3(.15,.21,.38), vec3(.40,.28,.50), uWarm);
  vec3 c1 = mix(vec3(.28,.41,.63), vec3(.62,.47,.68), uWarm);
  vec3 c2 = mix(vec3(.64,.70,.78), vec3(.90,.68,.62), uWarm);
  vec3 c3 = mix(vec3(.93,.87,.73), vec3(.99,.87,.70), uWarm);
  vec3 c4 = mix(vec3(.80,.61,.39), vec3(.95,.64,.42), uWarm);
  float x = clamp(v, 0.0, 0.999) * 4.0;
  float i = floor(x), fr = fract(x);
  vec3 col = mix(pick(i, c0, c1, c2, c3, c4), pick(i + 1.0, c0, c1, c2, c3, c4), smoothstep(0.3, 0.7, fr));
  float bordo = smoothstep(0.28, 0.5, fr) * (1.0 - smoothstep(0.5, 0.72, fr));
  return col * (1.0 - 0.17 * bordo);
}
void main(){
  vec2 q = (gl_FragCoord.xy - 0.5 * uRes) / uU; q.y = -q.y;
  float rS = length(q / uEll);                    // raggio sullo schermo (per il bianco)
  vec2 qs = q;                                    // coordinate sullo schermo
  q = q / uCam.x + uCam.yz;                       // camera
  vec2 e = q / uEll;
  float r = length(e);
  float a = atan(e.y, e.x);
  float lr = log(r + 0.04);
  float th = a + uTwist * lr - uRot;           // braccio della spirale
  vec2 circ = vec2(cos(th), sin(th));
  float largo = fbm(circ * 2.1 + vec2(lr * 0.9, -lr * 0.6) + 4.0);      // masse di colore lungo i bracci
  float tratti = fbm(circ * 7.0 + vec2(lr * 2.0, lr * 1.2) + 17.0);     // pennellate sottili e allungate
  float c = cos(uTwist * lr - uRot), s = sin(uTwist * lr - uRot);
  vec2 w = mat2(c, s, -s, c) * e;
  float v = 0.72 * largo + 0.28 * tratti + 0.16 * (fbm(w * 16.0 + 11.0) - 0.5);
  v += 0.42 * smoothstep(0.15, 1.35, r) - 0.2;   // occhio blu, bordi crema
  vec3 col = rampa(v);
  if (uModo > 0.5) {
    // il quadrato dipinto gira (più veloce al centro) e si stringe quando cresce la torsione
    float aq = a - (uTwist - 1.5) * lr * 0.9 - uRot;
    vec3 dip = texture2D(uTexQ, vec2(0.5) + min(r * 0.27, 0.495) * vec2(cos(aq), sin(aq))).rgb;
    dip *= 0.92 + 0.16 * tratti;                                  // grana fine per lo zoom
    // nel finale vira ai toni caldi del montaggio (viola e pesca)
    vec3 caldo = vec3(dip.r * 0.9 + 0.12 + 0.25 * dip.b, dip.g * 0.85 + 0.08, dip.b * 0.75 + 0.18);
    col = mix(dip, caldo, uWarm);
  }
  // fiammate ruggine (come nei master), più rade verso il centro
  float ru = smoothstep(0.69, 0.76, fbm(circ * 4.0 + vec2(lr * 1.7, -lr) + 31.0)) * smoothstep(0.3, 1.0, r);
  col = mix(col, mix(vec3(.66,.27,.16), vec3(.86,.45,.30), uWarm), ru * 0.55);
  float g = uGlow * exp(-pow(r / uGlowR, 2.0));
  col = mix(col, vec3(1.0, 0.94, 0.80), clamp(g, 0.0, 1.0));
  col += uFlash * vec3(1.0, 0.82, 0.55) * exp(-pow(r / 0.55, 2.0));
  // esplosione a spirale: il bianco avanza dal centro lungo tre bracci fino a coprire tutto
  float bracci = 0.5 + 0.5 * sin(3.0 * (a + uTwist * lr * 0.8 - uRot * 1.5));
  float d = rS - uBianco * 2.0 * (0.7 + 0.45 * bracci) - pow(uBianco, 4.0) + 0.25 * (largo - 0.5);
  vec3 bianco = vec3(1.0, 0.985, 0.95);
  if (uModo > 0.5) {
    float cb = cos(uRot * 0.3), sb = sin(uRot * 0.3);
    bianco = texture2D(uTexB, vec2(0.5) + 0.45 * (mat2(cb, sb, -sb, cb) * qs)).rgb;
  }
  col = mix(col, bianco, smoothstep(0.12, -0.12, d) * smoothstep(0.0, 0.05, uBianco));
  col *= mix(0.93 + 0.07 * n(gl_FragCoord.xy * 0.35), 1.0, 0.7 * uBianco);  // carta
  col *= 1.0 - 0.2 * (1.0 - uBianco) * smoothstep(0.95, 1.9, r);
  gl_FragColor = vec4(col, 1.0);
}`;

export function creaVortice(canvas) {
  const gl = canvas.getContext("webgl", { antialias: false });
  if (!gl) return null;
  const sh = (tipo, src) => {
    const s = gl.createShader(tipo);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  for (const n of ["uRes", "uU", "uEll", "uRot", "uTwist", "uGlow", "uGlowR", "uWarm", "uFlash", "uBianco", "uCam", "uTexQ", "uTexB", "uModo"]) U[n] = gl.getUniformLocation(prog, n);

  // texture del vortice dipinto (non potenza di due: niente mipmap, bordi bloccati)
  const tex = { pronte: false };
  const carica = (unita, img) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unita);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };

  return {
    texture(quadrato, bianco) {
      carica(0, quadrato); carica(1, bianco);
      gl.uniform1i(U.uTexQ, 0); gl.uniform1i(U.uTexB, 1);
      tex.pronte = true;
    },
    disegna(p) {
      const W = canvas.width, H = canvas.height;
      gl.viewport(0, 0, W, H);
      gl.uniform2f(U.uRes, W, H);
      gl.uniform1f(U.uU, Math.min(W, H));
      gl.uniform2f(U.uEll, p.ellX, p.ellY);
      gl.uniform1f(U.uRot, p.rot);
      gl.uniform1f(U.uTwist, p.twist);
      gl.uniform1f(U.uGlow, p.glow);
      gl.uniform1f(U.uGlowR, p.glowR);
      gl.uniform1f(U.uWarm, p.warm);
      gl.uniform1f(U.uFlash, p.flash);
      gl.uniform1f(U.uBianco, p.bianco);
      gl.uniform3f(U.uCam, p.camS, p.camX, p.camY);
      gl.uniform1f(U.uModo, tex.pronte ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}
