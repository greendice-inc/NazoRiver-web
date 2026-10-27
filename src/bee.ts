import * as THREE from "three";

const INK = "#2a1708";
const BODY_SIZE = 1.8;

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// Front view of an angry cartoon bee on a 512px canvas; the body centre sits at (256, 300).
function drawBody(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = 12;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(256 + side * 42, 178);
    ctx.quadraticCurveTo(256 + side * 76, 120, 256 + side * 84, 72);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(256 + side * 86, 66, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.beginPath();
  ctx.moveTo(224, 418);
  ctx.lineTo(288, 418);
  ctx.lineTo(256, 492);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(256, 300, 158, 140, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#ffcc1a";
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = INK;
  ctx.fillRect(0, 350, 512, 34);
  ctx.fillRect(0, 404, 512, 40);
  const shine = ctx.createRadialGradient(196, 214, 10, 196, 214, 170);
  shine.addColorStop(0, "rgba(255,255,255,0.45)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, 512, 512);
  ctx.restore();
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.ellipse(256, 300, 158, 140, 0, 0, Math.PI * 2);
  ctx.stroke();

  for (const side of [-1, 1]) {
    const ex = 256 + side * 52;
    ctx.beginPath();
    ctx.ellipse(ex, 262, 38, 44, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ex - side * 10, 274, 19, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex - side * 16, 266, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(256 + side * 100, 204);
    ctx.lineTo(256 + side * 20, 236);
    ctx.stroke();
  }

  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(218, 330);
  ctx.quadraticCurveTo(256, 304, 294, 330);
  ctx.stroke();
  ctx.fillStyle = "#fff";
  for (const x of [236, 276]) {
    ctx.beginPath();
    ctx.moveTo(x - 8, 318);
    ctx.lineTo(x + 8, 318);
    ctx.lineTo(x, 334);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = "rgba(255,90,60,0.35)";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(256 + side * 108, 312, 22, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWing(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.ellipse(128, 80, 116, 66, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(214,240,255,0.72)";
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = "rgba(42,23,8,0.85)";
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(90,120,150,0.6)";
  ctx.beginPath();
  ctx.moveTo(24, 82);
  ctx.quadraticCurveTo(128, 60, 226, 84);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(96, 56, 40, 14, -0.2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fill();
}

function drawShadow(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
}

let shared: { body: THREE.Texture; wing: THREE.Texture; shadow: THREE.Texture } | null = null;

function textures(): { body: THREE.Texture; wing: THREE.Texture; shadow: THREE.Texture } {
  shared ??= {
    body: canvasTexture(512, 512, drawBody),
    wing: canvasTexture(256, 160, drawWing),
    shadow: canvasTexture(128, 128, drawShadow),
  };
  return shared;
}

type Wing = { pivot: THREE.Group; side: -1 | 1 };

// The cruise enemy: a hovering bee that flaps, bobs, and casts a soft shadow on the water.
export class BeeEnemy {
  group = new THREE.Group();
  private rig = new THREE.Group();
  private wings: Wing[] = [];
  private shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private materials: THREE.MeshBasicMaterial[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private seed = Math.random() * 10;

  constructor() {
    const tex = textures();
    const bodyMaterial = new THREE.MeshBasicMaterial({ map: tex.body, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide });
    const bodyGeometry = new THREE.PlaneGeometry(BODY_SIZE, BODY_SIZE);
    // Canvas (256, 300) is the body centre; shift the plane so the rig origin is that point.
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = (44 / 512) * BODY_SIZE;
    this.rig.add(body);

    const wingGeometry = new THREE.PlaneGeometry(1.05, 0.66);
    for (const side of [-1, 1] as const) {
      const material = new THREE.MeshBasicMaterial({ map: tex.wing, transparent: true, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(wingGeometry, material);
      mesh.position.set(side * 0.46, 0.12, 0);
      mesh.rotation.z = side * 0.35;
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.3, 0.42, -0.02);
      pivot.add(mesh);
      this.rig.add(pivot);
      this.wings.push({ pivot, side });
      this.materials.push(material);
    }
    this.materials.push(bodyMaterial);

    const shadowMaterial = new THREE.MeshBasicMaterial({ map: tex.shadow, transparent: true, depthWrite: false });
    const shadowGeometry = new THREE.PlaneGeometry(1.6, 0.9);
    this.shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.02;
    this.geometries.push(bodyGeometry, wingGeometry, shadowGeometry);

    this.group.add(this.shadow, this.rig);
  }

  update(time: number, opacity: number, height: number): void {
    const bob = 0.12 * Math.sin(time * 3 + this.seed);
    this.rig.position.y = height + bob;
    this.rig.rotation.z = 0.08 * Math.sin(time * 1.7 + this.seed);
    const flap = Math.sin(time * 44 + this.seed);
    for (const wing of this.wings) wing.pivot.rotation.z = wing.side * (0.15 + 0.4 * flap);
    for (const material of this.materials) material.opacity = opacity;
    this.shadow.material.opacity = 0.5 * opacity * Math.max(0.3, 1 - (height - 0.6) / 2);
    this.group.visible = opacity > 0.003;
  }

  dispose(): void {
    for (const material of this.materials) material.dispose();
    this.shadow.material.dispose();
    for (const geometry of this.geometries) geometry.dispose();
  }
}
