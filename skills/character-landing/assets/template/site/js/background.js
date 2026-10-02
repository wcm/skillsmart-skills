// Background gradients from four drifting colour points, rendered at half resolution. Two looks, blended by `poster`:
//   0 = liquid mesh: points blend smoothly into each other (soft, airy)
//   1 = poster: the nearest point wins with a crisp edge, giving flat organic colour shapes (graphic, illustrated)
export function createBackground(canvas) {
  const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false });
  const resize = () => {
    const s = Math.min(devicePixelRatio || 1, 1.5) * 0.5; // gradient is soft; half-res is plenty
    canvas.width = Math.round(innerWidth * s); canvas.height = Math.round(innerHeight * s);
    gl?.viewport(0, 0, canvas.width, canvas.height);
  };
  addEventListener("resize", resize); resize();
  if (!gl) return { draw() {} };

  const vs = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
  const fs = `precision highp float;
  uniform vec2 res; uniform float time; uniform float poster; uniform vec3 c[4];
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
  void main(){
    vec2 uv = gl_FragCoord.xy / res; float asp = res.x / res.y;
    vec2 q = vec2(uv.x * asp, uv.y);
    float t = time;
    q += .22 * vec2(n(q*1.6 + t*.9) - .5, n(q*1.6 - t*.7 + 7.3) - .5);
    vec2 pts[4];
    pts[0] = vec2(asp*(.18 + .10*sin(t*1.10)), .78 + .10*cos(t*.90));
    pts[1] = vec2(asp*(.84 + .08*cos(t*.80)), .70 + .14*sin(t*1.30));
    pts[2] = vec2(asp*(.30 + .14*cos(t*.70)), .16 + .10*sin(t*1.00));
    pts[3] = vec2(asp*(.78 + .12*sin(t*.60)), .20 + .12*cos(t*1.20));
    vec3 col = vec3(0.); float wsum = 0.;
    for (int i = 0; i < 4; i++) { float d = distance(q, pts[i]); float w = 1. / pow(d*d + .02, 1.6); col += c[i]*w; wsum += w; }
    col /= wsum;
    if (poster > .001) {
      // wobblier warp, then a sharp softmax over distances: flat shapes with crisp, slightly soft edges
      vec2 r = q + .32 * vec2(n(q*2.4 + t*1.3) - .5, n(q*2.4 - t*1.1 + 3.1) - .5);
      float d[4]; float dmin = 9.;
      for (int i = 0; i < 4; i++) { d[i] = distance(r, pts[i]) * (1. + .18*float(i)); dmin = min(dmin, d[i]); }
      vec3 pc = vec3(0.); float ps = 0.;
      for (int i = 0; i < 4; i++) { float w = exp(-130. * (d[i] - dmin)); pc += c[i]*w; ps += w; }
      col = mix(col, pc / ps, poster);
    }
    col += (h(gl_FragCoord.xy + fract(t)) - .5) / 255. * 2.;  // dither, no banding
    gl_FragColor = vec4(col, 1.);
  }`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog); gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uCols = gl.getUniformLocation(prog, "c"), uTime = gl.getUniformLocation(prog, "time"), uRes = gl.getUniformLocation(prog, "res");
  const uPoster = gl.getUniformLocation(prog, "poster");

  return {
    draw(cols, time, poster = 0) {
      gl.uniform1f(uPoster, poster);
      gl.uniform3fv(uCols, new Float32Array(cols.flat()));
      gl.uniform1f(uTime, time * .08);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}
