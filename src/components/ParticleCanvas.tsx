import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 450;

// Colors: subtle black, neon blue, hot pink
const PALETTE = [
    new THREE.Color('#1e3a5f'), // deep blue
    new THREE.Color('#3b82f6'), // neon blue
    new THREE.Color('#ec4899'), // hot pink
    new THREE.Color('#f472b6'), // soft pink
    new THREE.Color('#60a5fa'), // light blue
];

interface MouseState {
    x: number;
    y: number;
}

function Particles({ mouse }: { mouse: MouseState }) {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const { viewport } = useThree();

    const { positions, velocities, phases, colorIndices } = useMemo(() => {
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const velocities = new Float32Array(PARTICLE_COUNT * 3);
        const phases = new Float32Array(PARTICLE_COUNT);
        const colorIndices = new Int32Array(PARTICLE_COUNT);

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 20;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
            velocities[i * 3] = (Math.random() - 0.5) * 0.008;
            velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.008;
            velocities[i * 3 + 2] = 0;
            phases[i] = Math.random() * Math.PI * 2;
            colorIndices[i] = Math.floor(Math.random() * PALETTE.length);
        }

        return { positions, velocities, phases, colorIndices };
    }, []);

    const tempObject = useMemo(() => new THREE.Object3D(), []);
    const tempColor = useMemo(() => new THREE.Color(), []);

    useEffect(() => {
        if (!meshRef.current) return;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            meshRef.current.setColorAt(i, PALETTE[colorIndices[i]]);
        }
        meshRef.current.instanceColor!.needsUpdate = true;
    }, [colorIndices]);

    useFrame(({ clock }) => {
        if (!meshRef.current) return;
        const t = clock.getElapsedTime();
        const mx = (mouse.x / window.innerWidth - 0.5) * viewport.width;
        const my = -(mouse.y / window.innerHeight - 0.5) * viewport.height;

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const ix = i * 3;
            const phase = phases[i];

            // Floating motion
            positions[ix] += velocities[ix] + Math.sin(t * 0.3 + phase) * 0.001;
            positions[ix + 1] += velocities[ix + 1] + Math.cos(t * 0.25 + phase) * 0.001;

            // Mouse attraction (subtle)
            const dx = mx - positions[ix];
            const dy = my - positions[ix + 1];
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 4) {
                positions[ix] += dx * 0.002;
                positions[ix + 1] += dy * 0.002;
            }

            // Wrap edges
            if (positions[ix] > 11) positions[ix] = -11;
            if (positions[ix] < -11) positions[ix] = 11;
            if (positions[ix + 1] > 7) positions[ix + 1] = -7;
            if (positions[ix + 1] < -7) positions[ix + 1] = 7;

            // Pulsing size
            const scale = 0.03 + Math.sin(t * 0.8 + phase) * 0.012;

            tempObject.position.set(positions[ix], positions[ix + 1], positions[ix + 2]);
            tempObject.scale.setScalar(scale);
            tempObject.updateMatrix();
            meshRef.current.setMatrixAt(i, tempObject.matrix);

            // Subtle color pulse
            tempColor.copy(PALETTE[colorIndices[i]]);
            const brightness = 0.6 + Math.sin(t * 0.5 + phase) * 0.3;
            tempColor.multiplyScalar(brightness);
            meshRef.current.setColorAt(i, tempColor);
        }

        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) {
            meshRef.current.instanceColor.needsUpdate = true;
        }
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]}>
            <sphereGeometry args={[1, 4, 4]} />
            <meshBasicMaterial transparent opacity={0.8} />
        </instancedMesh>
    );
}

export default function ParticleCanvas() {
    const [mouse, setMouse] = useState<MouseState>({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMouse({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
            <Canvas
                camera={{ position: [0, 0, 8], fov: 60 }}
                gl={{ antialias: false, alpha: true }}
                style={{ background: 'transparent' }}
                dpr={[1, 1.5]}
            >
                <Particles mouse={mouse} />
            </Canvas>
        </div>
    );
}
