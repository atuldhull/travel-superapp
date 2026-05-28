/**
 * @app/aether-canvas — R3F + WebGPU primitives for Aether surfaces.
 *
 * Phase 0 ships three components — enough to build the Drift prototype:
 *   • <AetherScene>   — Canvas wrapper with Warm Italian lighting rig
 *   • <AmbientField>  — deterministic particle field ("dust catching light")
 *   • <SunDisk>       — gradient-shaded hero disk
 *
 * Phase 1 adds: <AtlasGlobe>, <RouteRibbon>, <BuildingShell>, <DepthFog>.
 */
export { AetherScene, type AetherSceneProps } from './aether-scene';
export { AmbientField, type AmbientFieldProps } from './ambient-field';
export { SunDisk, type SunDiskProps } from './sun-disk';
export { detectRenderer, defaultRenderer, type RendererCapability } from './renderer-capability';
