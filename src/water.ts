import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { Refractor } from "three/examples/jsm/objects/Refractor.js";

// Port of Unity Standard Assets "FX/Water" in Refractive mode with the WaterProDaytime material.
const WAVE_SCALE = 0.118;
const WAVE_SPEED = new THREE.Vector4(9, 4.5, -8, -3.5);
const WAVE_SCALE4 = new THREE.Vector4(WAVE_SCALE, WAVE_SCALE, WAVE_SCALE * 0.4, WAVE_SCALE * 0.45);

const vertexShader = /* glsl */ `
  uniform mat4 textureMatrix;
  uniform vec4 waveScale4;
  uniform vec4 waveOffset;
  varying vec4 vRef;
  varying vec2 vBump0;
  varying vec2 vBump1;
  varying vec3 vView;

  void main() {
    vec4 wpos = modelMatrix * vec4(position, 1.0);
    vec4 unityXZ = vec4(wpos.x, -wpos.z, wpos.x, -wpos.z);
    vec4 temp = unityXZ * waveScale4 + waveOffset;
    vBump0 = temp.xy;
    vBump1 = temp.wz;
    vec3 v = cameraPosition - wpos.xyz;
    vView = vec3(v.x, -v.z, v.y);
    vRef = textureMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * wpos;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D tReflection;
  uniform sampler2D tRefraction;
  uniform sampler2D tBump;
  uniform sampler2D tFresnel;
  uniform float reflDistort;
  uniform float refrDistort;
  uniform vec3 refrColor;
  varying vec4 vRef;
  varying vec2 vBump0;
  varying vec2 vBump1;
  varying vec3 vView;

  void main() {
    vec3 viewDir = normalize(vView);
    vec3 bump1 = texture2D(tBump, vBump0).rgb * 2.0 - 1.0;
    vec3 bump2 = texture2D(tBump, vBump1).rgb * 2.0 - 1.0;
    vec3 bump = (bump1 + bump2) * 0.5;

    float fresnelFac = dot(viewDir, bump);

    vec4 uv1 = vRef;
    uv1.xy += bump.xy * reflDistort;
    vec2 reflUv = uv1.xy / uv1.w;
    vec3 refl = texture2D(tReflection, vec2(1.0 - reflUv.x, reflUv.y)).rgb;

    vec4 uv2 = vRef;
    uv2.xy -= bump.xy * refrDistort;
    vec3 refr = texture2D(tRefraction, uv2.xy / uv2.w).rgb * refrColor;

    float fresnel = texture2D(tFresnel, vec2(fract(fresnelFac), 0.5)).r;
    vec3 color = mix(refr, refl, fresnel);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export class UnityWater extends THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  private reflector: Reflector;
  private refractor: Refractor;
  private textureMatrix = new THREE.Matrix4();
  private time = 0;

  constructor(bump: THREE.Texture, fresnel: number[], width: number, height: number) {
    const geometry = new THREE.PlaneGeometry(600, 1400);
    bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
    bump.colorSpace = THREE.NoColorSpace;
    bump.anisotropy = 8;

    const lut = new Uint8Array(fresnel.length * 4);
    fresnel.forEach((value, i) => lut.set([value, value, value, 255], i * 4));
    const fresnelTexture = new THREE.DataTexture(lut, fresnel.length, 1);
    fresnelTexture.wrapS = THREE.RepeatWrapping;
    fresnelTexture.magFilter = THREE.LinearFilter;
    fresnelTexture.minFilter = THREE.LinearFilter;
    fresnelTexture.needsUpdate = true;

    const material = new THREE.ShaderMaterial({
      uniforms: {
        tReflection: { value: null },
        tRefraction: { value: null },
        tBump: { value: bump },
        tFresnel: { value: fresnelTexture },
        textureMatrix: { value: null },
        waveScale4: { value: WAVE_SCALE4 },
        waveOffset: { value: new THREE.Vector4() },
        reflDistort: { value: 0.44 },
        refrDistort: { value: 0.4 },
        refrColor: { value: new THREE.Color().setRGB(0.937, 0.937, 0.937, THREE.SRGBColorSpace) },
      },
      vertexShader,
      fragmentShader,
    });

    super(geometry, material);
    this.rotation.x = -Math.PI / 2;
    this.updateMatrixWorld();

    this.reflector = new Reflector(geometry, { textureWidth: width, textureHeight: height, clipBias: 0.003 });
    this.refractor = new Refractor(geometry, { textureWidth: width, textureHeight: height, clipBias: 0.003 });
    this.reflector.matrixAutoUpdate = false;
    this.refractor.matrixAutoUpdate = false;
    material.uniforms.tReflection.value = this.reflector.getRenderTarget().texture;
    material.uniforms.tRefraction.value = this.refractor.getRenderTarget().texture;
    material.uniforms.textureMatrix.value = this.textureMatrix;

    this.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
      this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
      this.textureMatrix.multiply(camera.projectionMatrix);
      this.textureMatrix.multiply(camera.matrixWorldInverse);
      this.textureMatrix.multiply(this.matrixWorld);

      this.visible = false;
      this.reflector.matrixWorld.copy(this.matrixWorld);
      this.refractor.matrixWorld.copy(this.matrixWorld);
      this.reflector.onBeforeRender(renderer, scene, camera, geometry, material, group);
      this.refractor.onBeforeRender(renderer, scene, camera, geometry, material, group);
      this.visible = true;
    };
  }

  update(dt: number, cameraX: number, cameraZ: number): void {
    this.time += dt;
    const t = this.time / 20;
    const offset = this.material.uniforms.waveOffset.value as THREE.Vector4;
    offset.set(
      (WAVE_SPEED.x * WAVE_SCALE4.x * t) % 1,
      (WAVE_SPEED.y * WAVE_SCALE4.y * t) % 1,
      (WAVE_SPEED.z * WAVE_SCALE4.z * t) % 1,
      (WAVE_SPEED.w * WAVE_SCALE4.w * t) % 1,
    );
    this.position.set(Math.round(cameraX / 20) * 20, 0, Math.round(cameraZ / 20) * 20);
    this.updateMatrixWorld();
  }
}
