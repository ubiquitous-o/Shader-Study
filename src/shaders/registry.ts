import * as THREE from "three";

export type UniformMap = Record<string, THREE.IUniform<unknown>>;

export interface ShaderUpdateContext {
  uniforms: UniformMap;
  elapsedTime: number;
  deltaTime: number;
  renderer: THREE.WebGLRenderer;
}

export interface ShaderResizeContext {
  uniforms: UniformMap;
  size: THREE.Vector2;
}

export interface ShaderRegistryEntry {
  id: string;
  name: string;
  description?: string;
  vertexPath: string;
  fragmentPath: string;
  thumbnail?: string;
  createUniforms: () => UniformMap;
  update?: (context: ShaderUpdateContext) => void;
  onResize?: (context: ShaderResizeContext) => void;
}

export const shaderRegistry: ShaderRegistryEntry[] = [
  {
    id: "gradation",
    name: "Gradation",
    description: "Simple animated color gradation shader",
    thumbnail: "/thumbnails/gradation.png",
    vertexPath: "./passthrough.vert.glsl",
    fragmentPath: "./gradation.frag.glsl",
    createUniforms: () => ({
      u_time: { value: 0 },
      u_resolution: { value: new THREE.Vector2(1, 1) },
    }),
    update: ({ uniforms, elapsedTime }) => {
      const uTime = uniforms.u_time as THREE.IUniform<number> | undefined;
      if (uTime) {
        uTime.value = elapsedTime;
      }
    },
    onResize: ({ uniforms, size }) => {
      const uResolution =
        uniforms.u_resolution as THREE.IUniform<THREE.Vector2> | undefined;
      if (!uResolution) {
        return;
      }
      if (uResolution.value instanceof THREE.Vector2) {
        uResolution.value.copy(size);
      } else {
        uResolution.value = size.clone();
      }
    },
  },
];
