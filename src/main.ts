import "./style.css";
import * as THREE from "three";

import { findShaderById, shaderCatalog } from "./shaders";
import type {
  ShaderDefinition,
  ShaderResizeContext,
  ShaderUpdateContext,
  UniformMap,
} from "./shaders";

const query = new URLSearchParams(window.location.search);
const mode = query.get("mode");
const isThumbnailMode = mode === "thumbnail";
const requestedShaderId = query.get("shader") ?? undefined;
const sizeParam = query.get("size");
const parsedSize = sizeParam ? Number.parseInt(sizeParam, 10) : Number.NaN;
const THUMBNAIL_SIZE =
  Number.isFinite(parsedSize) && parsedSize > 0 ? parsedSize : 512;
let thumbnailReadySent = false;

if (isThumbnailMode && document.body) {
  document.body.dataset.thumbnailMode = "true";
  document.body.dataset.thumbnailReady = "pending";
}

function notifyThumbnailReady() {
  if (thumbnailReadySent || !document.body) {
    return;
  }
  thumbnailReadySent = true;
  document.body.dataset.thumbnailReady = "ready";
  if (currentShader) {
    document.body.dataset.thumbnailShaderId = currentShader.id;
  }
}

const canvas = document.getElementById("app") as HTMLCanvasElement | null;

if (!canvas) {
  throw new Error('Canvas element with id "app" was not found.');
}

const initialWidth = isThumbnailMode ? THUMBNAIL_SIZE : window.innerWidth;
const initialHeight = isThumbnailMode ? THUMBNAIL_SIZE : window.innerHeight;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
});
renderer.setPixelRatio(
  isThumbnailMode ? 1 : Math.min(window.devicePixelRatio || 1, 2),
);
renderer.setSize(initialWidth, initialHeight, true);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101014);

const camera = new THREE.Camera();
camera.position.z = 1;

const quadGeometry = new THREE.BufferGeometry();
const positions = new Float32Array([
  -1, -1, 0,
  3, -1, 0,
  -1, 3, 0,
]);
const uvs = new Float32Array([0, 0, 2, 0, 0, 2]);
quadGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
quadGeometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

const quad = new THREE.Mesh(quadGeometry, new THREE.ShaderMaterial());
scene.add(quad);

const viewport = new THREE.Vector2(initialWidth, initialHeight);

type ResizeHandler = (context: ShaderResizeContext) => void;
type UpdateHandler = (context: ShaderUpdateContext) => void;

let currentShader: ShaderDefinition | null = null;
let currentUniforms: UniformMap = {};
let resizeHandler: ResizeHandler | null = null;
let updateHandler: UpdateHandler | null = null;
let lastElapsed = 0;
let fullscreenButton: HTMLButtonElement | null = null;
let stripToggleButton: HTMLButtonElement | null = null;
let stripElement: HTMLDivElement | null = null;
let stripVisible = true;

const clock = new THREE.Clock();
const buttonMap = new Map<string, HTMLButtonElement>();

function highlightActive(id: string) {
  buttonMap.forEach((button, shaderId) => {
    button.dataset.active = shaderId === id ? "true" : "false";
  });
}

function applyShader(definition: ShaderDefinition) {
  const uniforms = definition.createUniforms();
  const material = new THREE.ShaderMaterial({
    vertexShader: definition.vertexShader,
    fragmentShader: definition.fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

  const previousMaterial = quad.material as THREE.Material | undefined;
  if (previousMaterial) {
    previousMaterial.dispose();
  }
  quad.material = material;

  currentShader = definition;
  currentUniforms = uniforms;
  resizeHandler = definition.onResize ?? null;
  updateHandler = definition.update ?? null;
  lastElapsed = clock.getElapsedTime();

  if (resizeHandler) {
    resizeHandler({
      uniforms,
      size: viewport,
    });
  }

  if (updateHandler) {
    updateHandler({
      uniforms,
      elapsedTime: lastElapsed,
      deltaTime: 0,
      renderer,
    });
  }
}

function selectShader(id: string) {
  const definition = findShaderById(id);
  if (!definition || currentShader?.id === definition.id) {
    return;
  }
  applyShader(definition);
  highlightActive(definition.id);
}

function buildGallery(definitions: ShaderDefinition[]) {
  const uiContainer = document.createElement("div");
  uiContainer.className = "shader-ui";

  const controlsRow = document.createElement("div");
  controlsRow.className = "shader-ui__row";

  const controlsGroup = document.createElement("div");
  controlsGroup.className = "shader-ui__controls";

  const strip = document.createElement("div");
  strip.className = "shader-strip";
  stripElement = strip;

  strip.addEventListener(
    "wheel",
    (event) => {
      if (!event.deltaY && !event.deltaX) {
        return;
      }
      event.preventDefault();
      const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      strip.scrollBy({
        left: delta,
        behavior: "auto",
      });
    },
    { passive: false },
  );

  const fullscreenAction = document.createElement("button");
  fullscreenAction.type = "button";
  fullscreenAction.className = "shader-fullscreen-toggle";
  fullscreenAction.setAttribute("aria-label", "Enter fullscreen");
  fullscreenAction.title = "Enter fullscreen";
  const fullscreenIcon = document.createElement("img");
  fullscreenIcon.src = "/icons/fullscreen.svg";
  fullscreenIcon.alt = "";
  fullscreenIcon.className = "shader-fullscreen-toggle__icon";
  fullscreenAction.appendChild(fullscreenIcon);
  fullscreenAction.addEventListener("click", toggleFullscreen);
  fullscreenButton = fullscreenAction;

  const stripToggle = document.createElement("button");
  stripToggle.type = "button";
  stripToggle.className = "shader-strip-toggle";
  stripToggle.textContent = "Hide Gallery";
  stripToggle.dataset.active = "true";
  stripToggle.addEventListener("click", toggleStripVisibility);
  stripToggleButton = stripToggle;

  controlsGroup.appendChild(stripToggle);
  controlsGroup.appendChild(fullscreenAction);

  definitions.forEach((definition) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "shader-strip__item";
    button.dataset.shaderId = definition.id;

    if (definition.thumbnail) {
      const image = document.createElement("img");
      image.src = definition.thumbnail;
      image.alt = `${definition.name} preview`;
      image.className = "shader-strip__thumbnail";
      button.appendChild(image);
    }

    const label = document.createElement("span");
    label.textContent = definition.name;
    label.className = "shader-strip__label";
    button.appendChild(label);

    button.addEventListener("click", () => selectShader(definition.id));

    buttonMap.set(definition.id, button);
    strip.appendChild(button);
  });

  controlsRow.appendChild(controlsGroup);
  uiContainer.appendChild(controlsRow);
  uiContainer.appendChild(strip);

  document.body.appendChild(uiContainer);
}

function onResize() {
  if (isThumbnailMode) {
    return;
  }
  viewport.set(window.innerWidth, window.innerHeight);
  renderer.setSize(viewport.x, viewport.y, true);

  if (resizeHandler) {
    resizeHandler({
      uniforms: currentUniforms,
      size: viewport,
    });
  }
}

function updateFullscreenButtonState() {
  if (!fullscreenButton) {
    return;
  }
  const isFullscreen = document.fullscreenElement === renderer.domElement;
  fullscreenButton.dataset.active = isFullscreen ? "true" : "false";
  const label = isFullscreen ? "Exit fullscreen" : "Enter fullscreen";
  fullscreenButton.setAttribute("aria-label", label);
  fullscreenButton.title = label;
}

function toggleFullscreen() {
  const element = renderer.domElement;
  if (!document.fullscreenElement) {
    if (element.requestFullscreen) {
      element.requestFullscreen().catch(() => {
        /* noop */
      });
    }
  } else if (document.exitFullscreen) {
    document.exitFullscreen().catch(() => {
      /* noop */
    });
  }
}

function updateStripVisibility() {
  if (!stripElement || !stripToggleButton) {
    return;
  }
  stripElement.dataset.hidden = stripVisible ? "false" : "true";
  stripToggleButton.dataset.active = stripVisible ? "true" : "false";
  stripToggleButton.textContent = stripVisible ? "Hide Gallery" : "Show Gallery";
}

function toggleStripVisibility() {
  stripVisible = !stripVisible;
  updateStripVisibility();
}

function tick() {
  const elapsed = clock.getElapsedTime();
  const delta = elapsed - lastElapsed;
  lastElapsed = elapsed;

  if (updateHandler) {
    updateHandler({
      uniforms: currentUniforms,
      elapsedTime: elapsed,
      deltaTime: delta,
      renderer,
    });
  }

  renderer.render(scene, camera);
  if (isThumbnailMode) {
    notifyThumbnailReady();
  }
  requestAnimationFrame(tick);
}

let initialShader: ShaderDefinition | undefined;

if (requestedShaderId) {
  initialShader = findShaderById(requestedShaderId);
  if (!initialShader) {
    console.warn(
      `Shader with id "${requestedShaderId}" was not found. Falling back to the first available shader.`,
    );
  }
}

if (!initialShader) {
  initialShader = shaderCatalog[0];
}

if (!initialShader) {
  throw new Error("No shader definitions are registered.");
}

if (isThumbnailMode) {
  viewport.set(THUMBNAIL_SIZE, THUMBNAIL_SIZE);
  renderer.setSize(viewport.x, viewport.y, true);
  applyShader(initialShader);
  renderer.render(scene, camera);
  notifyThumbnailReady();
  requestAnimationFrame(tick);
} else {
  buildGallery(shaderCatalog);
  applyShader(initialShader);
  highlightActive(initialShader.id);

  window.addEventListener("resize", onResize);
  window.addEventListener("fullscreenchange", updateFullscreenButtonState);
  onResize();
  updateFullscreenButtonState();
  updateStripVisibility();
  requestAnimationFrame(tick);
}
