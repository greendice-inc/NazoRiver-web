import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { CameraPose, Gate, Prop, Sprite, TotemFaces } from "./types";
import { BeeEnemy } from "./bee";
import { UnityWater } from "./water";
import { asset } from "./paths";

const LINE = 10;
const LINES_AHEAD = 14;
const FADE_NEAR = 112;
const FADE_FAR = 140;
const DEG = Math.PI / 180;
const WATER_TEXTURE = 64;
// Seconds for course objects to fade in when they first appear (e.g. after an enemy clears the view).
const REVEAL_TIME = 0.6;
const ENEMY_HEIGHT = 1.1;

type SpriteDef = {
  file: string;
  x: number;
  y: number;
  z: number;
  scale: number;
  rotY: number;
  tint: number;
};

// Line.prefab: stone walls and trees on both banks, positions in Unity units relative to the line.
const lineSprites: SpriteDef[] = [
  { file: "stone_3", x: -9, y: 1, z: -8, scale: 0.8, rotY: -45, tint: 0.33 },
  { file: "stone_4", x: -9, y: 1, z: -5, scale: 0.8, rotY: -45, tint: 0.33 },
  { file: "stone_5", x: -9, y: 1, z: -2, scale: 0.8, rotY: -45, tint: 0.33 },
  { file: "tree_1", x: -9, y: 1, z: -7.5, scale: 1, rotY: -45, tint: 1 },
  { file: "tree_7", x: -9, y: 1, z: -2.5, scale: 1, rotY: -45, tint: 1 },
  { file: "stone_3", x: 9, y: 1, z: -8, scale: 0.8, rotY: 45, tint: 0.33 },
  { file: "stone_4", x: 9, y: 1, z: -5, scale: 0.8, rotY: 45, tint: 0.33 },
  { file: "stone_5", x: 9, y: 1, z: -2, scale: 0.8, rotY: 45, tint: 0.33 },
  { file: "tree_10", x: 9, y: 2, z: -2.5, scale: 1, rotY: 45, tint: 1 },
  { file: "tree_8", x: 9, y: 1, z: -7.5, scale: 1, rotY: 45, tint: 1 },
];

const textureFiles = ["stone_1", "stone_3", "stone_4", "stone_5", "tree_1", "tree_7", "tree_8", "tree_10"];

function srgbGray(value: number): THREE.Color {
  return new THREE.Color().setRGB(value, value, value, THREE.SRGBColorSpace);
}

function glowTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.18, "rgba(255,255,250,0.75)");
  g.addColorStop(0.45, "rgba(220,240,255,0.22)");
  g.addColorStop(1, "rgba(200,230,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function sparkleTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(c, 6);
  ctx.lineTo(c, size - 6);
  ctx.moveTo(6, c);
  ctx.lineTo(size - 6, c);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

class FadingSprite {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

  constructor(texture: THREE.Texture, scale: number, tint: number) {
    const image = texture.image as HTMLImageElement;
    const geometry = new THREE.PlaneGeometry((image.width / 100) * scale, (image.height / 100) * scale);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      color: srgbGray(tint),
      transparent: true,
      alphaTest: 0.02,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geometry, material);
  }

  setOpacity(value: number): void {
    this.mesh.material.opacity = value;
    this.mesh.visible = value > 0.003;
  }
}

const spinEuler = new THREE.Euler();
const spinStep = new THREE.Quaternion();

class NazoCube {
  group = new THREE.Group();
  private cube: THREE.Mesh;
  private glow: THREE.Sprite;
  private halo: THREE.Sprite;
  private seed = Math.random() * 10;

  constructor(cubeMaterial: THREE.Material, glow: THREE.Texture) {
    const size = 0.5625;
    this.cube = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), cubeMaterial);
    this.cube.rotation.set(-45 * DEG, 0, 45 * DEG, "YXZ");
    this.glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glow,
        color: new THREE.Color(1.1, 1.1, 1.05),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    );
    this.glow.scale.setScalar(1.7);
    this.halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glow,
        color: new THREE.Color(0.55, 0.75, 1.0),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.5,
      }),
    );
    this.halo.scale.setScalar(3.2);
    this.group.add(this.halo, this.glow, this.cube);
  }

  update(time: number, dt: number, opacity: number): void {
    const turn = 36 * DEG * dt;
    spinStep.setFromEuler(spinEuler.set(turn, turn, turn, "YXZ"));
    this.cube.quaternion.multiply(spinStep);
    const pulse = 0.85 + 0.15 * Math.sin(time * 4 + this.seed);
    this.glow.scale.setScalar(1.7 * pulse);
    (this.glow.material as THREE.SpriteMaterial).opacity = 0.4 * opacity;
    (this.halo.material as THREE.SpriteMaterial).opacity = 0.25 * opacity * (0.8 + 0.2 * Math.sin(time * 2.2 + this.seed));
    this.group.visible = opacity > 0.003;
  }
}

type Burst = {
  points: THREE.Points;
  velocities: Float32Array;
  age: number;
};

type PropEntry = {
  kind: Prop["kind"];
  key: string;
  object: THREE.Object3D;
  sprite?: FadingSprite;
  cube?: THREE.Mesh;
};

export type WorldExtras = {
  props: Prop[];
  boat: { roll: number } | null;
  totem: TotemFaces | null;
  decor: "forest" | "pillars";
};

function charTexture(text: string): THREE.Texture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.font = `bold 200px "NotoJP", "IPAexG", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 18;
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.strokeText(text, size / 2, size / 2 + 8);
  ctx.fillStyle = "#0000ff";
  ctx.fillText(text, size / 2, size / 2 + 8);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// RiverCanvas/LastObjects: pillar walls every 5 units on both banks from z = 5.
const pillarFiles = ["pillar_1", "pillar_2", "pillar_3", "pillar_1", "pillar_2", "pillar_4"];

export class World {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.3, 1000);
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private water!: UnityWater;
  private textures = new Map<string, THREE.Texture>();
  private lines: { group: THREE.Group; sprites: FadingSprite[] }[] = [];
  private obstacles = new Map<number, { object: THREE.Object3D; kind: Sprite["kind"]; born: number; nazo?: NazoCube; bee?: BeeEnemy; rock?: FadingSprite }>();
  private gateGroup = new THREE.Group();
  private gateSprites: FadingSprite[] = [];
  private gateKey = "";
  private gateBaseZ = 0;
  private cubeMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(1, 1, 1),
    emissiveIntensity: 0.2,
    roughness: 0.35,
    metalness: 0,
  });
  private glow = glowTexture();
  private sparkle = sparkleTexture();
  private bursts: Burst[] = [];
  private time = 0;
  private daySky: THREE.CubeTexture | null = null;
  private nightSky: THREE.Texture | THREE.Color = new THREE.Color(0x0a0618);
  private sun!: THREE.DirectionalLight;
  private hemi!: THREE.HemisphereLight;
  private secret = false;
  private loader = new THREE.TextureLoader();
  private loaded = new Map<string, THREE.Texture | null>();
  private props = new Map<string, PropEntry>();
  private propCube = new THREE.MeshStandardMaterial({ color: 0xdfe8ff, roughness: 0.4, metalness: 0.1 });
  private boat: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null;
  private totemGroup = new THREE.Group();
  private totemKey = "";
  private totemFaces: THREE.Mesh[] = [];
  private pillars = new THREE.Group();
  private pillarsBuilt = false;
  private gateTime = 0;
  ready: Promise<void>;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;

    const target = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.4, 0.45, 1.0);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.camera.rotation.order = "YXZ";

    this.sun = new THREE.DirectionalLight(new THREE.Color(1, 0.957, 0.839), Math.PI * 0.9);
    this.sun.position.set(3.21, 7.66, 5.57);
    this.scene.add(this.sun);
    this.hemi = new THREE.HemisphereLight(0xbcd6f2, 0x1a2436, 1.4);
    this.scene.add(this.hemi);

    this.scene.add(this.gateGroup, this.totemGroup, this.pillars);
    this.pillars.visible = false;
    this.ready = this.load();
  }

  private async load(): Promise<void> {
    const loader = new THREE.TextureLoader();
    const cubeLoader = new THREE.CubeTextureLoader();
    const sky = cubeLoader.loadAsync(["px", "nx", "py", "ny", "pz", "nz"].map((face) => asset(`sky/${face}.jpg`)));
    const bump = loader.loadAsync(asset("water/bump.webp"));
    const fresnel = fetch(asset("water/fresnel.json")).then((res) => res.json() as Promise<number[]>);
    const sprites = textureFiles.map(async (file) => {
      const texture = await loader.loadAsync(asset(`world/${file}.webp`));
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      this.textures.set(file, texture);
    });
    const [skyTexture, bumpTexture, fresnelCurve] = await Promise.all([sky, bump, fresnel, ...sprites]);
    skyTexture.colorSpace = THREE.SRGBColorSpace;
    this.daySky = skyTexture;
    this.scene.background = skyTexture;
    this.scene.environment = skyTexture;
    const ura = await loader.loadAsync(asset("u/Sprites/ura_sky.webp")).catch(() => null);
    if (ura) {
      ura.colorSpace = THREE.SRGBColorSpace;
      this.nightSky = ura;
    }

    this.water = new UnityWater(bumpTexture, fresnelCurve, WATER_TEXTURE, WATER_TEXTURE);
    this.scene.add(this.water);

    for (let i = 0; i < LINES_AHEAD + 2; i++) {
      const group = new THREE.Group();
      const sprites = lineSprites.map((def) => {
        const sprite = new FadingSprite(this.textures.get(def.file)!, def.scale, def.tint);
        sprite.mesh.position.set(def.x, def.y, -def.z);
        sprite.mesh.rotation.y = -def.rotY * DEG;
        group.add(sprite.mesh);
        return sprite;
      });
      this.lines.push({ group, sprites });
      this.scene.add(group);
    }
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.bloom.resolution.set(width * pixelRatio * 0.5, height * pixelRatio * 0.5);
  }

  setSecret(on: boolean): void {
    if (this.secret === on) return;
    this.secret = on;
    if (on) {
      this.scene.background = this.nightSky;
      this.hemi.color.set(0x4a3a6a);
      this.hemi.groundColor.set(0x08060e);
      this.hemi.intensity = 0.75;
      this.sun.color.set(0x8866aa);
      this.sun.intensity = Math.PI * 0.28;
      this.bloom.strength = 0.72;
    } else if (this.daySky) {
      this.scene.background = this.daySky;
      this.scene.environment = this.daySky;
      this.hemi.color.set(0xbcd6f2);
      this.hemi.groundColor.set(0x1a2436);
      this.hemi.intensity = 1.4;
      this.sun.color.setRGB(1, 0.957, 0.839);
      this.sun.intensity = Math.PI * 0.9;
      this.bloom.strength = 0.4;
    }
  }

  burst(x: number, z: number): void {
    const count = 48;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions.set([x, 0.5, -z], i * 3);
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI - Math.PI / 2;
      const s = 1.5 + Math.random() * 3;
      velocities.set([Math.cos(a) * Math.cos(b) * s, Math.abs(Math.sin(b)) * s + 1, Math.sin(a) * Math.cos(b) * s], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      map: this.sparkle,
      size: 0.55,
      color: new THREE.Color(1.8, 1.8, 1.6),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geometry, material);
    this.scene.add(points);
    this.bursts.push({ points, velocities, age: 0 });
  }

  render(dt: number, pose: CameraPose, sprites: Sprite[], gate: Gate | null, extras: WorldExtras): void {
    if (!this.water) return;
    this.time += dt;

    this.camera.position.set(pose.x, 0.5, -pose.z);
    this.camera.rotation.set(-(pose.pitch ?? -5) * DEG, -pose.yaw * DEG, pose.roll * DEG);
    this.camera.updateMatrixWorld();

    this.water.update(dt, pose.x, -pose.z);
    const pillars = extras.decor === "pillars";
    this.placeLines(pose.z, !pillars);
    this.placePillars(pillars);
    this.placeGate(gate, pose.z, dt);
    this.placeObstacles(sprites, pose.z, dt);
    this.placeProps(extras.props, pose.z, dt);
    this.placeBoat(extras.boat);
    this.placeTotem(extras.totem);
    this.updateBursts(dt);

    this.composer.render(dt);
  }

  private texture(src: string): THREE.Texture | null {
    if (this.loaded.has(src)) return this.loaded.get(src) ?? null;
    this.loaded.set(src, null);
    this.loader.load(src, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      this.loaded.set(src, texture);
    });
    return null;
  }

  private placeProps(props: Prop[], cameraZ: number, dt: number): void {
    const seen = new Set<string>();
    for (const prop of props) {
      seen.add(prop.id);
      const key = `${prop.kind}|${prop.text ?? ""}|${prop.src ?? ""}|${prop.scale ?? 1}`;
      let entry = this.props.get(prop.id);
      if (entry && entry.key !== key) {
        this.dropProp(prop.id, entry);
        entry = undefined;
      }
      if (!entry) {
        entry = this.makeProp(prop, key) ?? undefined;
        if (!entry) continue;
        this.scene.add(entry.object);
        this.props.set(prop.id, entry);
      }
      const opacity = this.fade(prop.z - cameraZ) * (prop.opacity ?? 1);
      entry.object.position.set(prop.x, prop.y, -prop.z);
      entry.sprite?.setOpacity(opacity);
      entry.object.visible = opacity > 0.003;
      if (entry.cube) {
        const turn = 60 * DEG * dt;
        entry.cube.rotation.x += turn;
        entry.cube.rotation.y += turn * 0.7;
      }
    }
    for (const [id, entry] of this.props) {
      if (!seen.has(id)) this.dropProp(id, entry);
    }
  }

  private makeProp(prop: Prop, key: string): PropEntry | null {
    if (prop.kind === "rock") {
      const sprite = new FadingSprite(this.textures.get("stone_1")!, 0.64, 0.6226415);
      return { kind: prop.kind, key, object: sprite.mesh, sprite };
    }
    if (prop.kind === "char") {
      const group = new THREE.Group();
      const material = new THREE.MeshBasicMaterial({ map: charTexture(prop.text ?? ""), transparent: true, alphaTest: 0.02, side: THREE.DoubleSide });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
      const sprite = Object.assign(Object.create(FadingSprite.prototype) as FadingSprite, { mesh: plane });
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), this.propCube);
      cube.position.set(0, -0.5, -1);
      group.add(plane, cube);
      return { kind: prop.kind, key, object: group, sprite, cube };
    }
    const texture = prop.src ? this.texture(prop.src) : null;
    if (!texture) return null;
    const sprite = new FadingSprite(texture, prop.scale ?? 1, 1);
    return { kind: prop.kind, key, object: sprite.mesh, sprite };
  }

  private dropProp(id: string, entry: PropEntry): void {
    this.scene.remove(entry.object);
    if (entry.sprite) {
      entry.sprite.mesh.geometry.dispose();
      if (entry.kind === "char") entry.sprite.mesh.material.map?.dispose();
      entry.sprite.mesh.material.dispose();
    }
    entry.cube?.geometry.dispose();
    this.props.delete(id);
  }

  // Cruise2Canvas/Boat: boat.webp lying flat under the camera, seen when the camera looks straight down.
  private placeBoat(boat: { roll: number } | null): void {
    if (!this.boat) {
      const texture = this.texture(asset("u/Sprites/ui/boat.webp"));
      if (!texture) return;
      const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide });
      this.boat = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36), material);
      this.boat.rotation.order = "YXZ";
      this.boat.position.set(0, 0.1, 0.05);
      this.scene.add(this.boat);
    }
    this.boat.visible = !!boat;
    if (boat) this.boat.rotation.set(-90 * DEG, -boat.roll * DEG, 0);
  }

  // Boss4Canvas / Boss4ExCanvas: band-textured cylinders that spin to show 喜怒哀楽.
  private placeTotem(totem: TotemFaces | null): void {
    const key = totem ? (totem.ex ? "ex" : "normal") : "";
    if (key !== this.totemKey) {
      this.totemKey = key;
      for (const face of this.totemFaces) {
        face.geometry.dispose();
        (face.material as THREE.Material).dispose();
      }
      this.totemGroup.clear();
      this.totemFaces = [];
    }
    if (!totem) return;
    if (!this.totemFaces.length) {
      const src = asset(totem.ex ? "u/Sprites/totem/トーテム改_帯素材.webp" : "u/Sprites/totem/トーテム_帯素材.webp");
      const texture = this.texture(src);
      if (!texture) return;
      const ys = totem.ex ? [1.25, 0.75, 0.25] : [1.35, 0.95, 0.55, 0.15];
      const height = totem.ex ? 0.5 : 0.4;
      for (const y of ys) {
        const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85, metalness: 0 });
        const face = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, height, 64, 1, false), material);
        face.position.set(0, y, -3.2);
        this.totemGroup.add(face);
        this.totemFaces.push(face);
      }
    }
    this.totemFaces.forEach((face, i) => {
      face.rotation.y = -(totem.angles[i] ?? 0) * DEG;
    });
  }

  private placePillars(on: boolean): void {
    this.pillars.visible = on;
    if (!on || this.pillarsBuilt) return;
    const textures = pillarFiles.map((file) => this.texture(asset(`u/Sprites/lastBoss/${file}.webp`)));
    if (textures.some((texture) => !texture)) return;
    this.pillarsBuilt = true;
    for (let k = 0; k < 8; k++) {
      for (const side of [-1, 1]) {
        for (let j = 0; j < 3; j++) {
          const sprite = new FadingSprite(textures[(k % 2) * 3 + j]!, 0.6, 1);
          sprite.mesh.position.set(side * 9, 1, -(10 + k * 15 + (j - 1) * 5));
          sprite.mesh.rotation.y = -side * 45 * DEG;
          this.pillars.add(sprite.mesh);
        }
      }
    }
  }

  private fade(depth: number): number {
    if (depth <= FADE_NEAR) return 1;
    if (depth >= FADE_FAR) return 0;
    return 1 - (depth - FADE_NEAR) / (FADE_FAR - FADE_NEAR);
  }

  private placeLines(cameraZ: number, on: boolean): void {
    const first = Math.floor(cameraZ / LINE) - 1;
    this.lines.forEach((line, i) => {
      const num = first + i;
      line.group.position.z = -num * LINE;
      line.group.visible = on && num >= 0;
      line.sprites.forEach((sprite, j) => {
        const depth = num * LINE + lineSprites[j].z - cameraZ;
        sprite.setOpacity(this.fade(depth));
      });
    });
  }

  private placeGate(gate: Gate | null, cameraZ: number, dt: number): void {
    const key = gate ? `${gate.left}|${gate.right}|${gate.x}` : "";
    if (key !== this.gateKey) {
      this.gateKey = key;
      this.gateTime = 0;
      for (const sprite of this.gateSprites) {
        sprite.mesh.geometry.dispose();
        sprite.mesh.material.dispose();
      }
      this.gateGroup.clear();
      this.gateSprites = [];
      if (gate) {
        this.buildGate(gate);
        this.gateBaseZ = gate.z;
      }
    }
    if (!gate) return;
    // The cruise quiz slides the gate along with the boat; move the group instead of rebuilding it.
    this.gateGroup.position.z = -(gate.z - this.gateBaseZ);
    this.gateTime += dt;
    // Cruise2 ShowChoiceGate: gate sprites fade from clear black to black (1s), then to white (1s); walls appear after.
    const alpha = gate.fadeIn ? Math.min(1, this.gateTime) : Math.min(1, this.gateTime / REVEAL_TIME);
    const light = gate.fadeIn ? Math.min(1, Math.max(0, this.gateTime - 1)) : 1;
    for (const sprite of this.gateSprites) {
      const depth = -(sprite.mesh.position.z + this.gateGroup.position.z) - cameraZ;
      const wall = sprite.mesh.userData.wall === true;
      if (wall) {
        sprite.setOpacity(gate.fadeIn && this.gateTime < 2 ? 0 : this.fade(depth) * (gate.fadeIn ? 1 : alpha));
      } else {
        sprite.setOpacity(this.fade(depth) * alpha);
        sprite.mesh.material.color.copy(srgbGray(light));
      }
    }
  }

  private buildGate(gate: Gate): void {
    const loader = new THREE.TextureLoader();
    const sides: [string, number][] = [
      [gate.left, -4.5],
      [gate.right, 4.5],
    ];
    for (const [src, offset] of sides) {
      loader.load(src, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        const sprite = new FadingSprite(texture, 1, 1);
        sprite.mesh.position.set(gate.x + offset, 1, -gate.z);
        this.gateGroup.add(sprite.mesh);
        this.gateSprites.push(sprite);
      });
    }
    const stones = ["stone_3", "stone_4", "stone_5"];
    for (let k = 0; k < 5; k++) {
      const wallZ = gate.z + 5 + k * 10;
      [-3, 0, 3].forEach((dz, j) => {
        const sprite = new FadingSprite(this.textures.get(stones[j])!, 0.8, 0.329);
        sprite.mesh.userData.wall = true;
        sprite.mesh.position.set(gate.x, 0, -(wallZ + dz));
        this.gateGroup.add(sprite.mesh);
        this.gateSprites.push(sprite);
      });
    }
  }

  private placeObstacles(sprites: Sprite[], cameraZ: number, dt: number): void {
    const seen = new Set<number>();
    for (const sprite of sprites) {
      seen.add(sprite.id);
      let entry = this.obstacles.get(sprite.id);
      if (!entry) {
        const born = this.time;
        if (sprite.kind === "enemy") {
          const bee = new BeeEnemy();
          entry = { object: bee.group, kind: sprite.kind, born, bee };
        } else if (sprite.kind === "nazo") {
          const nazo = new NazoCube(this.cubeMaterial, this.glow);
          entry = { object: nazo.group, kind: sprite.kind, born, nazo };
        } else {
          const rock = new FadingSprite(this.textures.get("stone_1")!, 0.64, 0.6226415);
          entry = { object: rock.mesh, kind: sprite.kind, born, rock };
        }
        this.scene.add(entry.object);
        this.obstacles.set(sprite.id, entry);
      }
      const depth = sprite.z - cameraZ;
      const opacity = this.fade(depth) * Math.min(1, (this.time - entry.born) / REVEAL_TIME);
      if (entry.bee) {
        entry.object.position.set(sprite.x, 0, -sprite.z);
        entry.bee.update(this.time, opacity, sprite.y ?? ENEMY_HEIGHT);
      } else if (entry.nazo) {
        entry.object.position.set(sprite.x, 0.5, -sprite.z);
        entry.nazo.update(this.time, dt, opacity);
      } else if (entry.rock) {
        entry.object.position.set(sprite.x, 1, -sprite.z);
        entry.rock.setOpacity(opacity);
      }
    }
    for (const [id, entry] of this.obstacles) {
      if (seen.has(id)) continue;
      this.scene.remove(entry.object);
      entry.bee?.dispose();
      if (entry.rock) {
        entry.rock.mesh.geometry.dispose();
        entry.rock.mesh.material.dispose();
      }
      this.obstacles.delete(id);
    }
  }

  private updateBursts(dt: number): void {
    this.bursts = this.bursts.filter((burst) => {
      burst.age += dt;
      const position = burst.points.geometry.getAttribute("position") as THREE.BufferAttribute;
      const array = position.array as Float32Array;
      for (let i = 0; i < array.length; i += 3) {
        burst.velocities[i + 1] -= 4 * dt;
        array[i] += burst.velocities[i] * dt;
        array[i + 1] += burst.velocities[i + 1] * dt;
        array[i + 2] += burst.velocities[i + 2] * dt;
      }
      position.needsUpdate = true;
      const material = burst.points.material as THREE.PointsMaterial;
      material.opacity = Math.max(0, 1 - burst.age / 0.9);
      if (burst.age < 0.9) return true;
      this.scene.remove(burst.points);
      burst.points.geometry.dispose();
      material.dispose();
      return false;
    });
  }
}
