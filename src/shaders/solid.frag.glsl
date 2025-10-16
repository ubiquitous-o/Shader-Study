# ifdef GL_ES
precision highp float;
# endif

uniform float u_time;
uniform vec2  u_resolution;
varying vec2  v_texcoord;

void main(){
  vec2 uv = v_texcoord;
  float t = u_time * 0.2;
  vec3 col = 0.5 + 0.5 * cos(4.0 * vec3(uv.x + t, uv.y, uv.x - t));
  gl_FragColor = vec4(col, 1.0);
}
