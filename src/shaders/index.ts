import {
  shaderRegistry,
  type ShaderRegistryEntry,
} from "./registry";

export type {
  UniformMap,
  ShaderResizeContext,
  ShaderUpdateContext,
} from "./registry";

export interface ShaderDefinition extends ShaderRegistryEntry {
  vertexShader: string;
  fragmentShader: string;
}

const rawSources = import.meta.glob("./*.glsl", {
  as: "raw",
  eager: true,
}) as Record<string, unknown>;

function resolveSource(pathRef: string): string {
  const normalized = pathRef.startsWith("./") ? pathRef : `./${pathRef}`;
  const source = rawSources[normalized];
  if (!source) {
    throw new Error(
      `Unable to resolve shader source for "${normalized}". Ensure the file exists and is included in shaderRegistry.`,
    );
  }
  if (typeof source === "string") {
    return source;
  }
  if (typeof source === "object" && "default" in source) {
    const maybeString = (source as { default: unknown }).default;
    if (typeof maybeString === "string") {
      return maybeString;
    }
  }
  throw new Error(
    `Shader source for "${normalized}" must be a string. Received ${typeof source}.`,
  );
}

export const shaderCatalog: ShaderDefinition[] = shaderRegistry.map((entry) => ({
  ...entry,
  vertexShader: resolveSource(entry.vertexPath),
  fragmentShader: resolveSource(entry.fragmentPath),
}));

export function findShaderById(id: string): ShaderDefinition | undefined {
  return shaderCatalog.find((entry) => entry.id === id);
}
