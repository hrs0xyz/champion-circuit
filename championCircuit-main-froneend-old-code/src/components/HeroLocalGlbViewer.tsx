import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinnedScene } from 'three/examples/jsm/utils/SkeletonUtils.js';

const BRAIN_URL = '/models/brain.glb';
const PORSCHE_URL = '/models/porsche_992_gt3_rs_2024__www.vecarz.com.glb';
const KOHLI_URL = '/models/virat_kohli_cricket_batting_animation_-_low_poly.glb';
const DUALSHOCK_URL = '/models/dualshock_ps1.glb';
const GAME_CONTROLLER_URL = '/models/game_controller.glb';
const TABLE_TENNIS_URL = '/models/table_tennis_with_ping_pong_ball.glb';

const BRAIN_MATERIAL: THREE.MeshPhysicalMaterialParameters = {
  color: 0x7dd3fc,
  emissive: 0x7dd3fc,
  emissiveIntensity: 0.8,
  roughness: 0.1,
  metalness: 0.0,
  transparent: true,
  opacity: 0.4,
  clearcoat: 1.0,
  clearcoatRoughness: 0.1,
  transmission: 0.95,
  thickness: 1.5,
  ior: 1.5,
  side: THREE.DoubleSide,
};

function BrainParticles() {
  const particlesRef = useRef<THREE.Points>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const [ready, setReady] = useState(false);
  const particleCount = 120;

  useEffect(() => {
    if (!geometryRef.current) {
      geometryRef.current = new THREE.BufferGeometry();
    }
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      const radius = 15 + Math.random() * 15;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      positions[i] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i + 2] = radius * Math.cos(phi);
    }
    geometryRef.current.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometryRef.current.setDrawRange(0, particleCount);
    setReady(true);
  }, []);

  useFrame((state, delta) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y += delta * 0.5;
      particlesRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.1;
    }
  });

  if (!ready || !geometryRef.current) return null;

  return (
    <points ref={particlesRef} geometry={geometryRef.current}>
      <pointsMaterial color={0x7dd3fc} size={0.15} transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

type GlbFitMode = 'default' | 'card';

/** Step cards: slightly smaller subject + farther camera so models read in full. */
const CARD_FIT_SCALE = 1.38;
const CARD_CAMERA_FACTOR = 1.22;
const CARD_FIT_BY_URL: Partial<Record<string, number>> = {
  [KOHLI_URL]: 1.22,
};
const CARD_CAMERA_BY_URL: Partial<Record<string, number>> = {
  [KOHLI_URL]: 1.34,
};

function BrainModelScene({ fit = 'default' }: { fit?: GlbFitMode }) {
  const brainRef = useRef<THREE.Group>(null);
  const initializedRef = useRef(false);
  const { camera } = useThree();
  const isCard = fit === 'card';

  useEffect(() => {
    if (initializedRef.current || !brainRef.current) return;
    initializedRef.current = true;

    const brainGroup = new THREE.Group();
    const mainMaterial = new THREE.MeshPhysicalMaterial(BRAIN_MATERIAL);
    brainGroup.add(new THREE.Mesh(new THREE.SphereGeometry(25, 64, 64), mainMaterial));

    for (let i = 0; i < 12; i++) {
      const detail = new THREE.Mesh(
        new THREE.SphereGeometry(3.5, 16, 16),
        Object.assign(mainMaterial.clone(), { emissiveIntensity: 0.3, opacity: 0.25 }),
      );
      const angle = (i / 12) * Math.PI * 2;
      detail.position.set(Math.cos(angle) * 18.5, Math.sin(angle * 2) * 0.5, Math.sin(angle) * 18.5);
      brainGroup.add(detail);
    }
    brainRef.current.add(brainGroup);

    const loader = new GLTFLoader();
    loader.load(
      BRAIN_URL,
      (gltf) => {
        if (!brainRef.current) return;
        brainRef.current.clear();
        const scene = gltf.scene.clone();
        scene.traverse((child: unknown) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh) mesh.material = new THREE.MeshPhysicalMaterial(BRAIN_MATERIAL);
        });
        const box = new THREE.Box3().setFromObject(scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const scale = 25 / Math.max(size.x, size.y, size.z);
        scene.scale.multiplyScalar(scale);
        scene.position.sub(center.multiplyScalar(scale));
        brainRef.current.add(scene);
      },
      undefined,
      () => {},
    );
  }, []);

  useLayoutEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    if (isCard) {
      camera.position.set(0, 0, 30);
      camera.fov = 58;
    } else {
      camera.position.set(0, 0, 32);
      camera.fov = 65;
    }
    camera.updateProjectionMatrix();
  }, [camera, isCard]);

  useFrame((state, delta) => {
    if (brainRef.current) {
      brainRef.current.rotation.y += delta * 0.3;
      brainRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.06;
      brainRef.current.position.set(0, 0, 0);
      brainRef.current.scale.setScalar(isCard ? 1.32 : 1.25);
    }
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={isCard ? [0, 0, 30] : [0, 0, 32]} fov={isCard ? 58 : 65} />

      <ambientLight intensity={0.3} />
      <pointLight position={[25, 25, 25]} intensity={4.0} color={0x7dd3fc} />
      <pointLight position={[-25, -25, -25]} intensity={3.5} color={0x4ade80} />
      <pointLight position={[0, 25, 0]} intensity={3.5} color={0x7dd3fc} />
      <pointLight position={[0, -25, 0]} intensity={2.8} color={0x4ade80} />
      <directionalLight position={[20, 20, 20]} intensity={2.5} color={0x7dd3fc} />
      <directionalLight position={[-20, -20, -20]} intensity={2.0} color={0x4ade80} />

      <group ref={brainRef} />
      <BrainParticles />

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        enableRotate
        rotateSpeed={0.6}
        dampingFactor={0.08}
        enableDamping
      />
    </>
  );
}

const FIT_SIZES: Record<string, number> = {
  [PORSCHE_URL]: 7.5,
  [DUALSHOCK_URL]: 4.0,
  [GAME_CONTROLLER_URL]: 5.2,
  [KOHLI_URL]: 3.5,
  [TABLE_TENNIS_URL]: 3.2,
};
const DEFAULT_FIT = 3.0;

const INITIAL_ROTATIONS: Record<string, [number, number, number]> = {
  [DUALSHOCK_URL]: [Math.PI / 2, 0, 0],
  [GAME_CONTROLLER_URL]: [0.18, Math.PI * 1.4, 0],
  [PORSCHE_URL]: [0, Math.PI * 0.25, 0],
};

const SKIP_ANIMATIONS = new Set([DUALSHOCK_URL, GAME_CONTROLLER_URL]);

function GenericGltfSubject({ url, fit = 'default' }: { url: string; fit?: GlbFitMode }) {
  const gltf = useLoader(GLTFLoader, url);
  const cloned = useMemo(() => {
    const c = cloneSkinnedScene(gltf.scene);
    c.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of materials) {
          const m = mat as THREE.MeshStandardMaterial;
          if (m.map) { m.map.colorSpace = THREE.SRGBColorSpace; m.map.needsUpdate = true; }
          if (m.emissiveMap) { m.emissiveMap.colorSpace = THREE.SRGBColorSpace; m.emissiveMap.needsUpdate = true; }
          m.needsUpdate = true;
        }
      }
    });
    return c;
  }, [gltf.scene, url]);
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const hasAnimations = gltf.animations.length > 0;

  const { camera } = useThree();

  useLayoutEffect(() => {
    cloned.scale.setScalar(1);
    cloned.position.set(0, 0, 0);
    cloned.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);

    const isCard = fit === 'card';
    const baseFit = FIT_SIZES[url] ?? DEFAULT_FIT;
    const cardFitScale = isCard ? (CARD_FIT_BY_URL[url] ?? CARD_FIT_SCALE) : 1;
    const fitSize = baseFit * cardFitScale;
    const s = fitSize / maxDim;
    cloned.scale.setScalar(s);
    cloned.position.set(-center.x * s, -center.y * s, -center.z * s);

    const rot = INITIAL_ROTATIONS[url];
    if (rot) {
      cloned.rotation.set(rot[0], rot[1], rot[2]);
    }

    if (url === GAME_CONTROLLER_URL) {
      cloned.position.y -= fitSize * (isCard ? 0.04 : 0.08);
    }

    if (camera instanceof THREE.PerspectiveCamera) {
      const fov = camera.fov * (Math.PI / 180);
      const cameraFactor = isCard ? (CARD_CAMERA_BY_URL[url] ?? CARD_CAMERA_FACTOR) : 1.35;
      const dist = (fitSize / 2) / Math.tan(fov / 2) * cameraFactor;
      const yLift = fitSize * (isCard ? 0.06 : 0.12);
      camera.position.set(0, yLift, Math.max(dist, isCard ? 3.4 : 3.5));
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    }
  }, [cloned, url, camera, fit]);

  useEffect(() => {
    if (!hasAnimations || SKIP_ANIMATIONS.has(url)) return undefined;
    const mixer = new THREE.AnimationMixer(cloned);
    mixerRef.current = mixer;
    for (const clip of gltf.animations) {
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = false;
      action.play();
    }
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(cloned);
      mixerRef.current = null;
    };
  }, [cloned, gltf.animations, hasAnimations]);

  const isDualshock = url === DUALSHOCK_URL;
  const isGameController = url === GAME_CONTROLLER_URL;

  useFrame((state, delta) => {
    mixerRef.current?.update(delta);
    if (isDualshock && groupRef.current) {
      const t = state.clock.elapsedTime;
      groupRef.current.position.y = Math.sin(t * 0.8) * 0.08;
      groupRef.current.rotation.z = Math.sin(t * 0.6) * 0.05;
    }
    if (isGameController && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.22;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={cloned} />
    </group>
  );
}

function GenericScene({ url, fit = 'default' }: { url: string; fit?: GlbFitMode }) {
  const isPorsche = url === PORSCHE_URL;
  const isGameController = url === GAME_CONTROLLER_URL;
  const isCard = fit === 'card';
  const shouldAutoRotate = false;

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={isGameController ? [0, 0.08, isCard ? 4.8 : 4.3] : [0, 0.3, isCard ? 5.4 : 5]}
        fov={isGameController ? (isCard ? 42 : 34) : isCard ? 48 : 40}
        near={0.01}
        far={500}
      />

      <ambientLight intensity={isPorsche ? 0.5 : isGameController ? 0.78 : 0.6} />
      <directionalLight
        position={isGameController ? [6, 7, 8] : [8, 12, 10]}
        intensity={isPorsche ? 3.0 : isGameController ? 2.1 : 2.5}
        color={0xffffff}
      />
      <directionalLight
        position={isGameController ? [-5, 4, -6] : [-6, 8, -8]}
        intensity={isPorsche ? 1.4 : isGameController ? 1.25 : 1.0}
        color={isGameController ? 0xf4f4f4 : 0x8899ff}
      />
      <directionalLight
        position={isGameController ? [0, -2, 6] : [0, -4, 6]}
        intensity={isPorsche ? 0.8 : isGameController ? 0.68 : 0.5}
        color={isGameController ? 0xe6e6e6 : 0xffe4c4}
      />
      <hemisphereLight args={isGameController ? [0xf1f1f1, 0x0b0b0b, 0.5] : [0x4466aa, 0x111422, isPorsche ? 0.6 : 0.5]} />

      <GenericGltfSubject url={url} fit={fit} />

      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom={false}
        enableRotate
        autoRotate={shouldAutoRotate}
        autoRotateSpeed={isGameController ? 0.85 : 1.5}
        dampingFactor={isGameController ? 0.12 : 0.08}
        enableDamping
      />
    </>
  );
}

export function HeroLocalGlbViewer({ url, fit = 'default' }: { url: string; fit?: GlbFitMode }) {
  const isBrain = url === BRAIN_URL;
  const isCard = fit === 'card';

  return (
    <div className={`hero-local-glb${isCard ? ' hero-local-glb--card' : ''}`}>
      <Canvas
        gl={{
          antialias: false,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: isBrain ? 1.0 : 1.2,
          powerPreference: 'high-performance',
        }}
        dpr={isCard ? [1, 1.5] : [1, 1.25]}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          {isBrain ? <BrainModelScene fit={fit} /> : <GenericScene url={url} fit={fit} />}
        </Suspense>
      </Canvas>
    </div>
  );
}
