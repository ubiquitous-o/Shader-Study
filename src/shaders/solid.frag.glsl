# ifdef GL_ES
precision highp float;
# endif

uniform float uTime;
uniform vec2  uResolution;
varying vec2  vUv;

void main(){
  vec2 uv = vUv;
  float t = uTime * 0.2;
  vec3 col = 0.5 + 0.5 * cos(4.0 * vec3(uv.x + t, uv.y, uv.x - t));
  gl_FragColor = vec4(col, 1.0);
}
