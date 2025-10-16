// src/main.ts
import * as THREE from "three";
// import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// 分離した GLSL（前手順 4-1/4-2 で用意したもの）
import frag from "./shaders/solid.frag.glsl?raw";
import vert from "./shaders/passthrough.vert.glsl?raw";

const canvas = document.getElementById("app") as HTMLCanvasElement;

// ===== Renderer =====
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// “モダン”な既定（好みで調整）
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// ===== Scene / Camera =====
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101014);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.01,
  100
);
// フルスクリーンクアッドを見るだけなので、少し手前に引く
camera.position.set(0, 0, 1);

// const controls = new OrbitControls(camera, renderer.domElement);
// controls.enableDamping = true;
// controls.enablePan = false;
// controls.enableZoom = false; // 画面一杯のクアッドならズーム不要（好みで true）

// ===== Fullscreen Quad (Plane) + ShaderMaterial =====
// クリップ空間いっぱいに貼る 2x2 の平面（カメラで映す設計）
const quadGeo = new THREE.PlaneGeometry(2, 2, 1, 1);

// ShaderMaterial に頂点/フラグメントをそのまま渡す
const quadMat = new THREE.ShaderMaterial({
  vertexShader: vert,
  fragmentShader: frag,
  uniforms: {
    u_time: { value: 0 },
    u_resolution: {
      value: new THREE.Vector2(window.innerWidth, window.innerHeight),
    },
  },
  // 透明や深度が不要なら明示（ポストプロセス的に使う場合の最適化）
  depthTest: false,
  depthWrite: false,
});

const quad = new THREE.Mesh(quadGeo, quadMat);
scene.add(quad);

// ===== Resize Handling =====
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  quadMat.uniforms.uResolution.value.set(w, h);
}
window.addEventListener("resize", onResize);

// ===== Tick / Animate =====
const clock = new THREE.Clock();

function tick() {
  const t = clock.getElapsedTime();
  quadMat.uniforms.u_time.value = t;

  // controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

tick();
