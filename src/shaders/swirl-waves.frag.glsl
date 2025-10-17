#ifdef GL_ES
precision highp float;
#endif

uniform vec2 u_resolution;
uniform float u_time;

vec2 normalizedResolution(vec2 resolution) {
  return vec2(
    resolution.x,
    resolution.y > 0.0 ? resolution.y : resolution.x
  );
}

float layer(vec2 uv, float offset, float time) {
  float radius = length(uv);
  float angle = atan(uv.y, uv.x);
  float wave = sin((radius * 6.0) - time * 1.5 + angle * 4.0 + offset);
  return wave;
}

void main() {
  vec2 res = normalizedResolution(u_resolution);
  vec2 uv = (gl_FragCoord.xy / res.xy) * 2.0 - 1.0;
  uv.x *= res.x / res.y;

  float t = u_time * 0.8;
  float swirl = layer(uv, 0.0, t) * 0.5 + layer(uv, 1.2, t * 1.3) * 0.5;
  float glow = exp(-length(uv) * 2.2);

  vec3 baseColor = vec3(0.1, 0.1, 0.22);
  vec3 accentA = vec3(0.76, 0.32, 0.93);
  vec3 accentB = vec3(0.15, 0.65, 0.95);
  vec3 color = mix(accentA, accentB, 0.5 + 0.5 * swirl);
  color = mix(baseColor, color, 0.85);
  color += glow * vec3(0.18, 0.24, 0.65);

  gl_FragColor = vec4(color, 1.0);
}
