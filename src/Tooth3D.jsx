import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// Built with three.js + @react-three/fiber (procedural geometry, no external
// asset). Each tissue is its own revolved (lathe) shell so the cross-section
// reads anatomically and every part is individually clickable + highlightable.

const PART_COLORS = {
  enamel: '#eef4fb',
  dentin: '#e9c87f',
  pulp: '#ff5d76',
  pdl: '#2fb6ab',
  apex: '#ffd166'
};

// Map every anatomy id onto the mesh that should light up for it.
const HIGHLIGHT_MESH = {
  crown: 'enamel',
  enamel: 'enamel',
  dentin: 'dentin',
  root: 'dentin',
  cementum: 'dentin',
  pulp: 'pulp',
  periodontal: 'pdl',
  apex: 'apex'
};

const BASE_OPACITY = { enamel: 0.32, dentin: 0.6, pulp: 1, pdl: 0.85, apex: 1 };

function lathe(points, segments = 80) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments);
}

function Layer({ id, geometry, selectId, selectedMesh, onSelect }) {
  const color = PART_COLORS[id];
  const active = selectedMesh === id;
  const dim = selectedMesh && selectedMesh !== id;
  const opacity = active ? Math.max(0.9, BASE_OPACITY[id]) : dim ? BASE_OPACITY[id] * 0.45 : BASE_OPACITY[id];
  return (
    <mesh
      geometry={geometry}
      onClick={(event) => { event.stopPropagation(); onSelect(selectId); }}
      onPointerOver={(event) => { event.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = ''; }}
    >
      <meshStandardMaterial
        color={color}
        emissive={active ? color : '#000000'}
        emissiveIntensity={active ? 0.5 : 0}
        roughness={0.45}
        metalness={0.05}
        transparent
        opacity={opacity}
        depthWrite={opacity > 0.9}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function ToothModel({ selected, onSelect }) {
  const geos = useMemo(() => ({
    enamel: lathe([[0.31, -0.12], [0.35, 0.2], [0.40, 0.5], [0.36, 0.86], [0.23, 1.09], [0.06, 1.21], [0.0, 1.23]]),
    dentin: lathe([[0.02, -1.45], [0.12, -1.25], [0.20, -0.95], [0.26, -0.55], [0.30, -0.12], [0.34, 0.2], [0.38, 0.5], [0.34, 0.85], [0.22, 1.08], [0.06, 1.2], [0.0, 1.22]]),
    pulp: lathe([[0.015, -1.0], [0.05, -0.5], [0.08, -0.05], [0.12, 0.35], [0.10, 0.7], [0.04, 0.9], [0.0, 0.95]])
  }), []);
  const selectedMesh = HIGHLIGHT_MESH[selected] || null;

  return (
    <group position={[0, -0.05, 0]}>
      <Layer id="dentin" geometry={geos.dentin} selectId="dentin" selectedMesh={selectedMesh} onSelect={onSelect} />
      <Layer id="enamel" geometry={geos.enamel} selectId="enamel" selectedMesh={selectedMesh} onSelect={onSelect} />
      <Layer id="pulp" geometry={geos.pulp} selectId="pulp" selectedMesh={selectedMesh} onSelect={onSelect} />
      <mesh
        position={[0, -0.12, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        onClick={(event) => { event.stopPropagation(); onSelect('periodontal'); }}
      >
        <torusGeometry args={[0.33, 0.026, 16, 56]} />
        <meshStandardMaterial
          color={PART_COLORS.pdl}
          emissive={selectedMesh === 'pdl' ? PART_COLORS.pdl : '#000000'}
          emissiveIntensity={selectedMesh === 'pdl' ? 0.55 : 0}
          roughness={0.5}
          transparent
          opacity={selectedMesh && selectedMesh !== 'pdl' ? 0.4 : 0.85}
        />
      </mesh>
      <mesh position={[0, -1.47, 0]} onClick={(event) => { event.stopPropagation(); onSelect('apex'); }}>
        <sphereGeometry args={[0.06, 24, 24]} />
        <meshStandardMaterial
          color={PART_COLORS.apex}
          emissive={selectedMesh === 'apex' ? PART_COLORS.apex : '#000000'}
          emissiveIntensity={selectedMesh === 'apex' ? 0.65 : 0}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}

export default function Tooth3D({ selected, onSelect, label, color }) {
  return (
    <div className="tooth3d-stage">
      <span className="tooth-callout tooth3d-callout">
        <em style={{ background: color }} />
        {label}
      </span>
      <Canvas camera={{ position: [0, 0.15, 3.1], fov: 42 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.75} />
        <directionalLight position={[3, 4, 5]} intensity={1.15} />
        <directionalLight position={[-4, -2, -3]} intensity={0.4} color="#9fb4ff" />
        <ToothModel selected={selected} onSelect={onSelect} />
        <OrbitControls
          enablePan={false}
          enableZoom
          minDistance={2}
          maxDistance={5}
          autoRotate
          autoRotateSpeed={0.9}
          enableDamping
        />
      </Canvas>
      <span className="tooth3d-hint">Drag to rotate · scroll to zoom</span>
    </div>
  );
}
