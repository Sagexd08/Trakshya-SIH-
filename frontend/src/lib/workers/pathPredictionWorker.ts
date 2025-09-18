// Web Worker for train path prediction and conflict detection
// This runs in a separate thread to avoid blocking the main UI

interface TrainData {
  id: string;
  lng: number;
  lat: number;
  speedKmph: number;
  delayMin: number;
  bearing?: number;
  route?: Array<[number, number]>;
  schedule?: Array<{
    station: string;
    arrivalTime: Date;
    departureTime: Date;
  }>;
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

// Haversine distance calculation
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Predict future position based on current speed and bearing
function predictPosition(
  currentLat: number, 
  currentLng: number, 
  speedKmph: number, 
  bearing: number, 
  timeMinutes: number
): [number, number] {
  const distanceKm = (speedKmph * timeMinutes) / 60;
  const bearingRad = bearing * Math.PI / 180;
  
  const R = 6371; // Earth's radius in km
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

// Generate path predictions for a train
function generatePathPrediction(train: TrainData, predictionHours: number = 2): PathPrediction {
  const predictions: PathPrediction['predictedPath'] = [];
  const intervalMinutes = 5; // Predict every 5 minutes
  const totalIntervals = (predictionHours * 60) / intervalMinutes;
  
  let currentLat = train.lat;
  let currentLng = train.lng;
  let currentSpeed = train.speedKmph;
  let currentTime = new Date();
  
  // Account for current delay
  currentTime.setMinutes(currentTime.getMinutes() + train.delayMin);
  
  for (let i = 0; i < totalIntervals; i++) {
    const timeOffset = i * intervalMinutes;
    const predictionTime = new Date(currentTime.getTime() + timeOffset * 60000);
    
    // Apply speed variations (realistic fluctuations)
    const speedVariation = 1 + (Math.random() - 0.5) * 0.2; // ±10% variation
    const adjustedSpeed = currentSpeed * speedVariation;
    
    // Predict position
    const [newLat, newLng] = predictPosition(
      currentLat,
      currentLng,
      adjustedSpeed,
      train.bearing || 0,
      intervalMinutes
    );
    
    // Calculate confidence (decreases over time)
    const confidence = Math.max(0.1, 1 - (timeOffset / (predictionHours * 60)));
    
    predictions.push({
      position: [newLng, newLat],
      timestamp: predictionTime,
      speed: adjustedSpeed,
      confidence
    });
    
    // Update for next iteration
    currentLat = newLat;
    currentLng = newLng;
  }
  
  // Estimate arrival time (simplified)
  const lastPrediction = predictions[predictions.length - 1];
  const estimatedArrival = lastPrediction ? lastPrediction.timestamp : new Date();
  
  // Predict delay accumulation
  const delayPrediction = train.delayMin + Math.random() * 5; // Simple delay growth model
  
  return {
    trainId: train.id,
    predictedPath: predictions,
    estimatedArrival,
    delayPrediction
  };
}

// Detect potential conflicts between trains
function detectConflicts(trains: TrainData[], predictionHours: number = 2): ConflictPrediction[] {
  const conflicts: ConflictPrediction[] = [];
  const pathPredictions = trains.map(train => generatePathPrediction(train, predictionHours));
  
  // Check each pair of trains
  for (let i = 0; i < pathPredictions.length; i++) {
    for (let j = i + 1; j < pathPredictions.length; j++) {
      const pathA = pathPredictions[i];
      const pathB = pathPredictions[j];
      
      // Check for proximity at similar times
      for (let timeIndex = 0; timeIndex < Math.min(pathA.predictedPath.length, pathB.predictedPath.length); timeIndex++) {
        const pointA = pathA.predictedPath[timeIndex];
        const pointB = pathB.predictedPath[timeIndex];
        
        const distance = calculateDistance(
          pointA.position[1], pointA.position[0],
          pointB.position[1], pointB.position[0]
        );
        
        // Conflict threshold: trains within 2km
        if (distance < 2) {
          const avgConfidence = (pointA.confidence + pointB.confidence) / 2;
          const severity = distance < 0.5 ? 'high' : distance < 1 ? 'medium' : 'low';
          
          conflicts.push({
            id: `conflict-${pathA.trainId}-${pathB.trainId}-${timeIndex}`,
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
          
          break; // Only report first conflict per train pair
        }
      }
    }
  }
  
  return conflicts;
}

// Main worker message handler
self.onmessage = function(e) {
  const { type, data } = e.data;
  
  try {
    switch (type) {
      case 'PREDICT_PATHS':
        const { trains, predictionHours } = data;
        const pathPredictions = trains.map((train: TrainData) => 
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
          data: { message: `Unknown message type: ${type}` }
        });
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      data: { message: error instanceof Error ? error.message : 'Unknown error' }
    });
  }
};

// Export types for TypeScript
export type { TrainData, ConflictPrediction, PathPrediction };
