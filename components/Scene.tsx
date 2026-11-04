
"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";

function ParticleModel() {
    const pointsRef = useRef<THREE.Points>(null);

    const positions = useLoader(
        THREE.FileLoader,
        "/data/points.json"
    ) as string;

    const geometry = useMemo(() => {
        const data: number[][] = JSON.parse(positions);

        const array = new Float32Array(data.length * 3);

        data.forEach((point, i) => {
            array[i * 3] = point[0];
            array[i * 3 + 1] = point[1];
            array[i * 3 + 2] = point[2];
        });

        const geo = new THREE.BufferGeometry();

        geo.setAttribute(
            "position",
            new THREE.BufferAttribute(array, 3)
        );

        return geo;
    }, [positions]);

    useFrame((state) => {
        if (!pointsRef.current) return;

        const targetY = state.pointer.x * 0.3;
        const targetX = -state.pointer.y * 0.15;

        pointsRef.current.rotation.y +=
            (targetY - pointsRef.current.rotation.y) * 0.04;

        pointsRef.current.rotation.x +=
            (targetX - pointsRef.current.rotation.x) * 0.04;
    });

    return (
        <points ref={pointsRef} geometry={geometry}>
            <pointsMaterial
                color="#A30D25"
                size={0.014}
                sizeAttenuation
                transparent
                opacity={0.95}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
            />
        </points>
    );
}

export default function Scene() {
    return (
        <div className="w-full h-screen bg-[#050505]">
            <Canvas camera={{ position: [0, 0, 7], fov: 45 }}>
                <ParticleModel />
            </Canvas>
        </div>
    );
}
