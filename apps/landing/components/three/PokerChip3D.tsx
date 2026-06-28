'use client';

/* eslint-disable react/no-unknown-property -- R3F three.js elements use non-DOM props (position, intensity, args, ...) */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';

type PokerChip3DProps = {
  /** Fired after the first frame is painted so the poster can fade out cleanly. */
  onReady?: () => void;
};

// Brand palette (mirrors the landing theme tokens).
const GOLD = '#C9A84C';
const GOLD_LIGHT = '#E8C97A';
const GOLD_DARK = '#A8872E';
const GOLD_SHEEN = '#F2DD95';
const NAVY = '#0F1923';

/**
 * Top/bottom face texture, drawn procedurally (no asset fetch): a gold disc with
 * a metallic sheen gradient, a ring of alternating edge wedges, an inner dark
 * medallion, and a serif "T". The cylinder cap UVs sample the inscribed circle,
 * so the square corners (left transparent) are never seen.
 */
function makeFaceTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;
  const r = size / 2;

  // Gold body with an off-centre sheen highlight.
  const grad = ctx.createRadialGradient(c, c * 0.72, r * 0.08, c, c, r);
  grad.addColorStop(0, GOLD_SHEEN);
  grad.addColorStop(0.5, GOLD);
  grad.addColorStop(1, GOLD_DARK);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fill();

  // Ring of alternating wedges near the rim (the classic chip "spots").
  const wedges = 18;
  const outerR = r * 0.97;
  const innerR = r * 0.74;
  for (let i = 0; i < wedges; i++) {
    const a0 = (i / wedges) * Math.PI * 2;
    const a1 = ((i + 1) / wedges) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(c, c, outerR, a0, a1);
    ctx.arc(c, c, innerR, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? GOLD_DARK : GOLD_LIGHT;
    ctx.fill();
  }

  // Hairline rings framing the wedge band.
  ctx.lineWidth = size * 0.012;
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.arc(c, c, innerR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.arc(c, c, outerR, 0, Math.PI * 2);
  ctx.stroke();

  // Inner dark medallion with a gold rim.
  ctx.fillStyle = NAVY;
  ctx.beginPath();
  ctx.arc(c, c, r * 0.52, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = size * 0.018;
  ctx.strokeStyle = GOLD_LIGHT;
  ctx.beginPath();
  ctx.arc(c, c, r * 0.52, 0, Math.PI * 2);
  ctx.stroke();

  // Serif monogram.
  ctx.fillStyle = GOLD_LIGHT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.round(size * 0.42)}px "Times New Roman", Georgia, serif`;
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = size * 0.02;
  ctx.fillText('T', c, c + size * 0.02);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Edge (side) texture: a lit gold strip with evenly spaced dark inserts, mapped
 * once around the circumference. The pattern lands in a gap at the seam, so the
 * wrap is invisible.
 */
function makeEdgeTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, GOLD_DARK);
  grad.addColorStop(0.5, GOLD_LIGHT);
  grad.addColorStop(1, GOLD_DARK);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const blocks = 24;
  const cell = w / blocks;
  ctx.fillStyle = NAVY;
  for (let i = 0; i < blocks; i++) {
    if (i % 2 === 0) {
      ctx.fillRect(i * cell + cell * 0.28, h * 0.16, cell * 0.44, h * 0.68);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const BASE_TILT_X = -0.5;

/** The chip mesh + its slow, tasteful idle motion. */
function Chip() {
  const resources = useMemo(() => {
    const geometry = new THREE.CylinderGeometry(1, 1, 0.2, 64, 1);
    const faceTex = makeFaceTexture();
    const edgeTex = makeEdgeTexture();
    const faceMat = new THREE.MeshStandardMaterial({
      map: faceTex,
      metalness: 0.3,
      roughness: 0.32,
      emissive: new THREE.Color('#2a2106'),
      emissiveIntensity: 0.3,
    });
    const edgeMat = new THREE.MeshStandardMaterial({
      map: edgeTex,
      metalness: 0.3,
      roughness: 0.45,
      emissive: new THREE.Color('#2a2106'),
      emissiveIntensity: 0.25,
    });
    // CylinderGeometry material groups: [side, top, bottom].
    const mesh = new THREE.Mesh(geometry, [edgeMat, faceMat, faceMat]);
    mesh.rotation.x = BASE_TILT_X;
    return { mesh, geometry, faceTex, edgeTex, faceMat, edgeMat };
  }, []);

  useEffect(
    () => () => {
      resources.geometry.dispose();
      resources.faceTex.dispose();
      resources.edgeTex.dispose();
      resources.faceMat.dispose();
      resources.edgeMat.dispose();
    },
    [resources],
  );

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const m = resources.mesh;
    m.rotation.y += delta * 0.45; // slow turntable spin
    m.rotation.x = BASE_TILT_X + Math.sin(t * 0.6) * 0.06; // subtle tilt
    m.position.y = Math.sin(t * 0.9) * 0.05; // gentle bob
  });

  return <primitive object={resources.mesh} />;
}

/**
 * The lazy three.js scene (default export — dynamically imported with ssr:false).
 * Transparent canvas so the felt behind shows through; plain lights only (no HDR
 * / Environment), capped DPR, and a single low-poly chip mesh.
 */
export default function PokerChip3D({ onReady }: PokerChip3DProps) {
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 0.5, 3.8], fov: 32 }}
      style={{ width: '100%', height: '100%' }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0); // fully transparent backdrop
        // Wait for a painted frame before signalling ready (avoids fading the
        // poster out over an empty canvas).
        requestAnimationFrame(() => requestAnimationFrame(() => onReady?.()));
      }}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} color="#fff3d6" />
      <directionalLight position={[-4, -1, 2]} intensity={0.7} color={GOLD_LIGHT} />
      <Chip />
    </Canvas>
  );
}
