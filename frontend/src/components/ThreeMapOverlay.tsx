"use client";
import { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Text, Billboard, Sphere, Box, Line } from '@react-three/drei';
import * as THREE from 'three';
import mapboxgl from 'mapbox-gl';

interface TrainData {
  id: string;
  lng: number;
  lat: number;
  speedKmph: number;
  delayMin: number;
  bearing?: number;
  conflicts?: number;
  energyEfficiency?: number;
  nextStation?: string;
  eta?: number;
}

interface ConflictZone {
  id: string;
  center: [number, number];
  radius: number;
  severity: 'low' | 'medium' | 'high';
  affectedTrains: string[];
}

interface ThreeMapOverlayProps {
  map: mapboxgl.Map;
  trains: TrainData[];
  conflicts: ConflictZone[];
  selectedTrain?: string | null;
  followingTrain?: string | null;
  showConflicts?: boolean;
  showTrainPaths?: boolean;
}

// Convert lat/lng to Three.js world coordinates
function lngLatToWorld(lng: number, lat: number, map: mapboxgl.Map): THREE.Vector3 {
  const point = map.project([lng, lat]);
  const scale = map.transform.scale;
  
  // Convert to normalized coordinates (-1 to 1)
  const x = (point.x / map.getCanvas().width) * 2 - 1;
  const y = -((point.y / map.getCanvas().height) * 2 - 1);
  
  return new THREE.Vector3(x * 100, 0, y * 100);
}

// Animated train component with instanced rendering
function AnimatedTrain({ 
  train, 
  map, 
  isSelected, 
  isFollowing,
  onClick 
}: { 
  train: TrainData; 
  map: mapboxgl.Map; 
  isSelected: boolean;
  isFollowing: boolean;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Points>(null);
  const { camera } = useThree();
  
  const position = useMemo(() => 
    lngLatToWorld(train.lng, train.lat, map), 
    [train.lng, train.lat, map]
  );

  // Create trail effect
  const trailGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(30 * 3); // 30 points for trail
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;

    // Smooth movement animation
    const targetPosition = lngLatToWorld(train.lng, train.lat, map);
    meshRef.current.position.lerp(targetPosition, 0.1);

    // Rotation based on bearing
    if (train.bearing !== undefined) {
      const targetRotation = (train.bearing * Math.PI) / 180;
      meshRef.current.rotation.y = THREE.MathUtils.lerp(
        meshRef.current.rotation.y,
        targetRotation,
        0.1
      );
    }

    // Pulsing effect for selected train
    if (isSelected) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.2;
      meshRef.current.scale.setScalar(scale);
    } else {
      meshRef.current.scale.setScalar(1);
    }

    // Update trail
    if (trailRef.current) {
      const positions = trailRef.current.geometry.attributes.position.array as Float32Array;
      
      // Shift existing positions
      for (let i = positions.length - 3; i >= 3; i -= 3) {
        positions[i] = positions[i - 3];
        positions[i + 1] = positions[i - 2];
        positions[i + 2] = positions[i - 1];
      }
      
      // Add new position
      positions[0] = meshRef.current.position.x;
      positions[1] = meshRef.current.position.y;
      positions[2] = meshRef.current.position.z;
      
      trailRef.current.geometry.attributes.position.needsUpdate = true;
    }

    // Camera following
    if (isFollowing) {
      const offset = new THREE.Vector3(0, 20, 30);
      const targetCameraPosition = meshRef.current.position.clone().add(offset);
      camera.position.lerp(targetCameraPosition, 0.05);
      camera.lookAt(meshRef.current.position);
    }
  });

  // Color based on train status
  const trainColor = useMemo(() => {
    if (train.conflicts && train.conflicts > 0) return '#ef4444'; // Red for conflicts
    if (train.delayMin > 5) return '#f59e0b'; // Orange for delays
    if (train.speedKmph > 80) return '#10b981'; // Green for high speed
    return '#3b82f6'; // Blue for normal
  }, [train.conflicts, train.delayMin, train.speedKmph]);

  const energyColor = useMemo(() => {
    const efficiency = train.energyEfficiency || 90;
    if (efficiency > 95) return '#10b981';
    if (efficiency > 85) return '#f59e0b';
    return '#ef4444';
  }, [train.energyEfficiency]);

  return (
    <group position={position}>
      {/* Train body */}
      <mesh ref={meshRef} onClick={onClick}>
        <boxGeometry args={[2, 1, 6]} />
        <meshStandardMaterial 
          color={trainColor} 
          emissive={trainColor}
          emissiveIntensity={isSelected ? 0.3 : 0.1}
        />
      </mesh>

      {/* Speed indicator */}
      <Billboard>
        <Text
          position={[0, 3, 0]}
          fontSize={1}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {train.id}
        </Text>
        <Text
          position={[0, 2, 0]}
          fontSize={0.7}
          color={trainColor}
          anchorX="center"
          anchorY="middle"
        >
          {train.speedKmph} km/h
        </Text>
        {train.delayMin > 0 && (
          <Text
            position={[0, 1, 0]}
            fontSize={0.6}
            color="#f59e0b"
            anchorX="center"
            anchorY="middle"
          >
            +{train.delayMin}m
          </Text>
        )}
      </Billboard>

      {/* Energy efficiency indicator */}
      <Sphere position={[0, 4, 0]} args={[0.3]}>
        <meshStandardMaterial 
          color={energyColor}
          emissive={energyColor}
          emissiveIntensity={0.5}
        />
      </Sphere>

      {/* Trail effect */}
      <points ref={trailRef} geometry={trailGeometry}>
        <pointsMaterial 
          color={trainColor} 
          size={0.5} 
          transparent 
          opacity={0.6}
          sizeAttenuation={false}
        />
      </points>

      {/* Direction indicator */}
      {train.bearing !== undefined && (
        <Line
          points={[[0, 0, 0], [0, 0, 4]]}
          color={trainColor}
          lineWidth={2}
        />
      )}
    </group>
  );
}

// Conflict zone visualization
function ConflictZone({ 
  conflict, 
  map 
}: { 
  conflict: ConflictZone; 
  map: mapboxgl.Map;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const position = useMemo(() => 
    lngLatToWorld(conflict.center[0], conflict.center[1], map), 
    [conflict.center, map]
  );

  const color = useMemo(() => {
    switch (conflict.severity) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#eab308';
      default: return '#6b7280';
    }
  }, [conflict.severity]);

  useFrame((state) => {
    if (!meshRef.current) return;
    
    // Pulsing animation
    const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.3;
    meshRef.current.scale.setScalar(scale);
    
    // Rotation
    meshRef.current.rotation.y += 0.01;
  });

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <cylinderGeometry args={[conflict.radius * 2, conflict.radius * 2, 0.5, 16]} />
        <meshStandardMaterial 
          color={color}
          transparent
          opacity={0.3}
          emissive={color}
          emissiveIntensity={0.2}
        />
      </mesh>
      
      <Billboard>
        <Text
          position={[0, 2, 0]}
          fontSize={0.8}
          color={color}
          anchorX="center"
          anchorY="middle"
        >
          CONFLICT
        </Text>
        <Text
          position={[0, 1, 0]}
          fontSize={0.6}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {conflict.severity.toUpperCase()}
        </Text>
      </Billboard>
    </group>
  );
}

// Main Three.js overlay component
export default function ThreeMapOverlay({
  map,
  trains,
  conflicts,
  selectedTrain,
  followingTrain,
  showConflicts = true,
  showTrainPaths = true
}: ThreeMapOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Sync canvas size with map
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && map) {
        const canvas = map.getCanvas();
        canvasRef.current.style.width = canvas.style.width;
        canvasRef.current.style.height = canvas.style.height;
      }
    };

    map.on('resize', handleResize);
    handleResize();

    return () => {
      map.off('resize', handleResize);
    };
  }, [map]);

  const handleTrainClick = (trainId: string) => {
    // Emit custom event for train selection
    window.dispatchEvent(new CustomEvent('trainSelected', { detail: { trainId } }));
  };

  return (
    <div 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1
      }}
    >
      <Canvas
        ref={canvasRef}
        camera={{ 
          position: [0, 50, 50], 
          fov: 60,
          near: 0.1,
          far: 1000
        }}
        style={{ pointerEvents: 'auto' }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <pointLight position={[0, 20, 0]} intensity={0.5} />

        {/* Render trains */}
        {trains.map((train) => (
          <AnimatedTrain
            key={train.id}
            train={train}
            map={map}
            isSelected={selectedTrain === train.id}
            isFollowing={followingTrain === train.id}
            onClick={() => handleTrainClick(train.id)}
          />
        ))}

        {/* Render conflict zones */}
        {showConflicts && conflicts.map((conflict) => (
          <ConflictZone
            key={conflict.id}
            conflict={conflict}
            map={map}
          />
        ))}
      </Canvas>
    </div>
  );
}
