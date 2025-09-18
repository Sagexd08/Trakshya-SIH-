import { useEffect, useRef, useState, useCallback } from 'react';

interface TrainData {
  id: string;
  lng: number;
  lat: number;
  speedKmph: number;
  delayMin: number;
  bearing?: number;
}

interface PathPrediction {
  trainId: string;
  predictedPath: Array<{
    position: [number, number];
    timestamp: Date;
    speed: number;
    confidence: number;
  }>;
  estimatedArrival: Date;
  delayPrediction: number;
}

interface ConflictPrediction {
  id: string;
  trainA: string;
  trainB: string;
  location: [number, number];
  predictedTime: Date;
  severity: 'low' | 'medium' | 'high';
  probability: number;
}

interface UsePathPredictionOptions {
  predictionHours?: number;
  updateInterval?: number; // in milliseconds
  enableConflictDetection?: boolean;
}

export function usePathPrediction(
  trains: TrainData[],
  options: UsePathPredictionOptions = {}
) {
  const {
    predictionHours = 2,
    updateInterval = 30000, // 30 seconds
    enableConflictDetection = true
  } = options;

  const workerRef = useRef<Worker | null>(null);
  const [pathPredictions, setPathPredictions] = useState<PathPrediction[]>([]);
  const [conflicts, setConflicts] = useState<ConflictPrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Web Worker
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // Create worker from the TypeScript file
        const workerBlob = new Blob([
          `
          // Inline worker code to avoid module loading issues
          ${pathPredictionWorkerCode}
          `
        ], { type: 'application/javascript' });
        
        const workerUrl = URL.createObjectURL(workerBlob);
        workerRef.current = new Worker(workerUrl);

        workerRef.current.onmessage = (e) => {
          const { type, data } = e.data;
          
          switch (type) {
            case 'PATHS_PREDICTED':
              setPathPredictions(data);
              setIsLoading(false);
              break;
              
            case 'CONFLICTS_DETECTED':
              setConflicts(data);
              break;
              
            case 'ERROR':
              setError(data.message);
              setIsLoading(false);
              break;
          }
        };

        workerRef.current.onerror = (error) => {
          setError('Worker error: ' + error.message);
          setIsLoading(false);
        };

      } catch (err) {
        console.warn('Web Worker not supported, falling back to main thread');
        setError('Web Worker not supported');
      }
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  // Predict paths
  const predictPaths = useCallback(() => {
    if (!workerRef.current || trains.length === 0) return;

    setIsLoading(true);
    setError(null);

    workerRef.current.postMessage({
      type: 'PREDICT_PATHS',
      data: { trains, predictionHours }
    });

    if (enableConflictDetection) {
      workerRef.current.postMessage({
        type: 'DETECT_CONFLICTS',
        data: { trains, predictionHours }
      });
    }
  }, [trains, predictionHours, enableConflictDetection]);

  // Auto-update predictions
  useEffect(() => {
    if (trains.length === 0) return;

    predictPaths();

    const interval = setInterval(predictPaths, updateInterval);
    return () => clearInterval(interval);
  }, [predictPaths, updateInterval]);

  // Predict single train path
  const predictSingleTrain = useCallback((train: TrainData, hours: number = predictionHours) => {
    if (!workerRef.current) return;

    workerRef.current.postMessage({
      type: 'PREDICT_SINGLE_TRAIN',
      data: { train, hours }
    });
  }, [predictionHours]);

  // Get prediction for specific train
  const getTrainPrediction = useCallback((trainId: string): PathPrediction | undefined => {
    return pathPredictions.find(p => p.trainId === trainId);
  }, [pathPredictions]);

  // Get conflicts involving specific train
  const getTrainConflicts = useCallback((trainId: string): ConflictPrediction[] => {
    return conflicts.filter(c => c.trainA === trainId || c.trainB === trainId);
  }, [conflicts]);

  // Get high-priority conflicts
  const getHighPriorityConflicts = useCallback((): ConflictPrediction[] => {
    return conflicts.filter(c => c.severity === 'high' && c.probability > 0.7);
  }, [conflicts]);

  return {
    pathPredictions,
    conflicts,
    isLoading,
    error,
    predictPaths,
    predictSingleTrain,
    getTrainPrediction,
    getTrainConflicts,
    getHighPriorityConflicts
  };
}

// Inline worker code to avoid module loading issues
const pathPredictionWorkerCode = `
// Haversine distance calculation
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function predictPosition(currentLat, currentLng, speedKmph, bearing, timeMinutes) {
  const distanceKm = (speedKmph * timeMinutes) / 60;
  const bearingRad = bearing * Math.PI / 180;
  
  const R = 6371;
  const lat1 = currentLat * Math.PI / 180;
  const lon1 = currentLng * Math.PI / 180;
  
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distanceKm / R) +
    Math.cos(lat1) * Math.sin(distanceKm / R) * Math.cos(bearingRad)
  );
  
  const lon2 = lon1 + Math.atan2(
    Math.sin(bearingRad) * Math.sin(distanceKm / R) * Math.cos(lat1),
    Math.cos(distanceKm / R) - Math.sin(lat1) * Math.sin(lat2)
  );
  
  return [lat2 * 180 / Math.PI, lon2 * 180 / Math.PI];
}

function generatePathPrediction(train, predictionHours = 2) {
  const predictions = [];
  const intervalMinutes = 5;
  const totalIntervals = (predictionHours * 60) / intervalMinutes;
  
  let currentLat = train.lat;
  let currentLng = train.lng;
  let currentSpeed = train.speedKmph;
  let currentTime = new Date();
  
  currentTime.setMinutes(currentTime.getMinutes() + train.delayMin);
  
  for (let i = 0; i < totalIntervals; i++) {
    const timeOffset = i * intervalMinutes;
    const predictionTime = new Date(currentTime.getTime() + timeOffset * 60000);
    
    const speedVariation = 1 + (Math.random() - 0.5) * 0.2;
    const adjustedSpeed = currentSpeed * speedVariation;
    
    const [newLat, newLng] = predictPosition(
      currentLat,
      currentLng,
      adjustedSpeed,
      train.bearing || 0,
      intervalMinutes
    );
    
    const confidence = Math.max(0.1, 1 - (timeOffset / (predictionHours * 60)));
    
    predictions.push({
      position: [newLng, newLat],
      timestamp: predictionTime,
      speed: adjustedSpeed,
      confidence
    });
    
    currentLat = newLat;
    currentLng = newLng;
  }
  
  const lastPrediction = predictions[predictions.length - 1];
  const estimatedArrival = lastPrediction ? lastPrediction.timestamp : new Date();
  const delayPrediction = train.delayMin + Math.random() * 5;
  
  return {
    trainId: train.id,
    predictedPath: predictions,
    estimatedArrival,
    delayPrediction
  };
}

function detectConflicts(trains, predictionHours = 2) {
  const conflicts = [];
  const pathPredictions = trains.map(train => generatePathPrediction(train, predictionHours));
  
  for (let i = 0; i < pathPredictions.length; i++) {
    for (let j = i + 1; j < pathPredictions.length; j++) {
      const pathA = pathPredictions[i];
      const pathB = pathPredictions[j];
      
      for (let timeIndex = 0; timeIndex < Math.min(pathA.predictedPath.length, pathB.predictedPath.length); timeIndex++) {
        const pointA = pathA.predictedPath[timeIndex];
        const pointB = pathB.predictedPath[timeIndex];
        
        const distance = calculateDistance(
          pointA.position[1], pointA.position[0],
          pointB.position[1], pointB.position[0]
        );
        
        if (distance < 2) {
          const avgConfidence = (pointA.confidence + pointB.confidence) / 2;
          const severity = distance < 0.5 ? 'high' : distance < 1 ? 'medium' : 'low';
          
          conflicts.push({
            id: 'conflict-' + pathA.trainId + '-' + pathB.trainId + '-' + timeIndex,
            trainA: pathA.trainId,
            trainB: pathB.trainId,
            location: [
              (pointA.position[0] + pointB.position[0]) / 2,
              (pointA.position[1] + pointB.position[1]) / 2
            ],
            predictedTime: pointA.timestamp,
            severity,
            probability: avgConfidence
          });
          
          break;
        }
      }
    }
  }
  
  return conflicts;
}

self.onmessage = function(e) {
  const { type, data } = e.data;
  
  try {
    switch (type) {
      case 'PREDICT_PATHS':
        const { trains, predictionHours } = data;
        const pathPredictions = trains.map(train => 
          generatePathPrediction(train, predictionHours)
        );
        self.postMessage({
          type: 'PATHS_PREDICTED',
          data: pathPredictions
        });
        break;
        
      case 'DETECT_CONFLICTS':
        const { trains: conflictTrains, predictionHours: conflictHours } = data;
        const conflicts = detectConflicts(conflictTrains, conflictHours);
        self.postMessage({
          type: 'CONFLICTS_DETECTED',
          data: conflicts
        });
        break;
        
      case 'PREDICT_SINGLE_TRAIN':
        const { train, hours } = data;
        const singlePrediction = generatePathPrediction(train, hours);
        self.postMessage({
          type: 'SINGLE_TRAIN_PREDICTED',
          data: singlePrediction
        });
        break;
        
      default:
        self.postMessage({
          type: 'ERROR',
          data: { message: 'Unknown message type: ' + type }
        });
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      data: { message: error.message || 'Unknown error' }
    });
  }
};
`;
