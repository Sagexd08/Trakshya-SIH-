// Path prediction worker for heavy train route calculations
export interface TrainData {
  id: string;
  position: { lat: number; lng: number };
  speed: number;
  heading: number;
  route: Array<{ lat: number; lng: number; station?: string }>;
  currentSegment: number;
  delay: number;
  timestamp: number;
}

export interface PredictionRequest {
  type: 'PREDICT_PATH' | 'CALCULATE_CONFLICTS' | 'OPTIMIZE_ROUTES';
  trains: TrainData[];
  timeHorizon: number; // minutes
  options?: {
    includeDelays?: boolean;
    weatherConditions?: 'clear' | 'fog' | 'rain' | 'snow';
    trackConditions?: 'normal' | 'maintenance' | 'congested';
  };
}

export interface PredictionResult {
  type: 'PATH_PREDICTION' | 'CONFLICT_ANALYSIS' | 'ROUTE_OPTIMIZATION';
  trainId: string;
  predictions: Array<{
    timestamp: number;
    position: { lat: number; lng: number };
    speed: number;
    confidence: number;
    station?: string;
    eta?: number;
  }>;
  conflicts?: Array<{
    trainIds: string[];
    location: { lat: number; lng: number };
    timestamp: number;
    severity: 'low' | 'medium' | 'high';
    type: 'crossing' | 'station' | 'junction';
  }>;
  optimizations?: Array<{
    trainId: string;
    action: 'speed_up' | 'slow_down' | 'hold' | 'reroute';
    value: number;
    reason: string;
    impact: number;
  }>;
}

// Haversine distance calculation
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate bearing between two points
function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Predict train position at future time
function predictPosition(
  train: TrainData,
  futureTime: number,
  options: PredictionRequest['options'] = {}
): {
  position: { lat: number; lng: number };
  speed: number;
  confidence: number;
  station?: string;
  eta?: number;
} {
  const timeDelta = (futureTime - train.timestamp) / 1000 / 60; // minutes
  const route = train.route;
  const currentSegment = train.currentSegment;
  
  if (currentSegment >= route.length - 1) {
    // Train has reached destination
    return {
      position: route[route.length - 1],
      speed: 0,
      confidence: 0.9,
      station: route[route.length - 1].station,
      eta: 0,
    };
  }

  // Calculate base speed with environmental factors
  let adjustedSpeed = train.speed;
  
  if (options.weatherConditions) {
    const weatherMultipliers: Record<'clear' | 'fog' | 'rain' | 'snow', number> = {
      clear: 1.0,
      fog: 0.7,
      rain: 0.8,
      snow: 0.6,
    };
    const key = options.weatherConditions ?? 'clear';
    adjustedSpeed *= weatherMultipliers[key];
  }

  if (options.trackConditions) {
    const trackMultipliers: Record<'normal' | 'maintenance' | 'congested', number> = {
      normal: 1.0,
      maintenance: 0.5,
      congested: 0.3,
    };
    const key2 = options.trackConditions ?? 'normal';
    adjustedSpeed *= trackMultipliers[key2];
  }

  // Account for delays
  if (options.includeDelays && train.delay > 0) {
    // Trains typically try to make up time by going slightly faster
    adjustedSpeed *= 1.1;
  }

  // Calculate distance traveled
  const distanceTraveled = (adjustedSpeed * timeDelta) / 60; // km

  // Find position along route
  let remainingDistance = distanceTraveled;
  let segmentIndex = currentSegment;
  let currentPos = train.position;
  
  while (remainingDistance > 0 && segmentIndex < route.length - 1) {
    const nextPoint = route[segmentIndex + 1];
    const segmentDistance = calculateDistance(
      currentPos.lat, currentPos.lng,
      nextPoint.lat, nextPoint.lng
    );
    
    if (remainingDistance >= segmentDistance) {
      // Move to next segment
      remainingDistance -= segmentDistance;
      currentPos = nextPoint;
      segmentIndex++;
    } else {
      // Interpolate position within segment
      const ratio = remainingDistance / segmentDistance;
      currentPos = {
        lat: currentPos.lat + (nextPoint.lat - currentPos.lat) * ratio,
        lng: currentPos.lng + (nextPoint.lng - currentPos.lng) * ratio,
      };
      remainingDistance = 0;
    }
  }

  // Calculate confidence based on time horizon and factors
  let confidence = Math.max(0.1, 1.0 - (timeDelta / 60)); // Decreases over time
  
  if (options.weatherConditions && options.weatherConditions !== 'clear') confidence *= 0.8;
  if (options.trackConditions && options.trackConditions !== 'normal') confidence *= 0.7;
  if (train.delay > 10) confidence *= 0.9;

  // Calculate ETA to next station
  let eta: number | undefined;
  for (let i = segmentIndex; i < route.length; i++) {
    if (route[i].station) {
      const distanceToStation = calculateDistance(
        currentPos.lat, currentPos.lng,
        route[i].lat, route[i].lng
      );
      eta = (distanceToStation / adjustedSpeed) * 60; // minutes
      break;
    }
  }

  return {
    position: currentPos,
    speed: adjustedSpeed,
    confidence: Math.min(0.95, confidence),
    station: route[segmentIndex]?.station,
    eta,
  };
}

// Detect potential conflicts between trains
function detectConflicts(trains: TrainData[], timeHorizon: number, options: any = {}): Array<{
  trainIds: string[];
  location: { lat: number; lng: number };
  timestamp: number;
  severity: 'low' | 'medium' | 'high';
  type: 'crossing' | 'station' | 'junction';
}> {
  const conflicts: any[] = [];
  const timeSteps = Math.ceil(timeHorizon / 5); // Check every 5 minutes
  
  for (let step = 1; step <= timeSteps; step++) {
    const futureTime = Date.now() + (step * 5 * 60 * 1000);
    const predictions: Array<{ trainId: string; prediction: any }> = [];
    
    // Get predictions for all trains at this time
    trains.forEach(train => {
      const prediction = predictPosition(train, futureTime, options);
      predictions.push({ trainId: train.id, prediction });
    });
    
    // Check for conflicts between each pair of trains
    for (let i = 0; i < predictions.length; i++) {
      for (let j = i + 1; j < predictions.length; j++) {
        const pred1 = predictions[i];
        const pred2 = predictions[j];
        
        const distance = calculateDistance(
          pred1.prediction.position.lat, pred1.prediction.position.lng,
          pred2.prediction.position.lat, pred2.prediction.position.lng
        );
        
        // Conflict threshold: trains within 2km
        if (distance < 2.0) {
          let severity: 'low' | 'medium' | 'high' = 'low';
          let type: 'crossing' | 'station' | 'junction' = 'crossing';
          
          // Determine severity based on distance and speeds
          if (distance < 0.5) severity = 'high';
          else if (distance < 1.0) severity = 'medium';
          
          // Determine type based on location (simplified)
          if (pred1.prediction.station || pred2.prediction.station) {
            type = 'station';
          }
          
          conflicts.push({
            trainIds: [pred1.trainId, pred2.trainId],
            location: {
              lat: (pred1.prediction.position.lat + pred2.prediction.position.lat) / 2,
              lng: (pred1.prediction.position.lng + pred2.prediction.position.lng) / 2,
            },
            timestamp: futureTime,
            severity,
            type,
          });
        }
      }
    }
  }
  
  return conflicts;
}

// Generate route optimizations
function generateOptimizations(trains: TrainData[], conflicts: any[]): Array<{
  trainId: string;
  action: 'speed_up' | 'slow_down' | 'hold' | 'reroute';
  value: number;
  reason: string;
  impact: number;
}> {
  const optimizations: any[] = [];
  
  conflicts.forEach(conflict => {
    if (conflict.severity === 'high' || conflict.severity === 'medium') {
      const [trainId1, trainId2] = conflict.trainIds;
      const train1 = trains.find(t => t.id === trainId1);
      const train2 = trains.find(t => t.id === trainId2);
      
      if (!train1 || !train2) return;
      
      // Simple optimization: slow down the faster train
      if (train1.speed > train2.speed) {
        optimizations.push({
          trainId: trainId1,
          action: 'slow_down' as const,
          value: Math.max(10, train1.speed * 0.2),
          reason: `Avoid ${conflict.severity} conflict with train ${trainId2}`,
          impact: conflict.severity === 'high' ? 0.8 : 0.6,
        });
      } else {
        optimizations.push({
          trainId: trainId2,
          action: 'slow_down' as const,
          value: Math.max(10, train2.speed * 0.2),
          reason: `Avoid ${conflict.severity} conflict with train ${trainId1}`,
          impact: conflict.severity === 'high' ? 0.8 : 0.6,
        });
      }
    }
  });
  
  return optimizations;
}

// Main worker message handler
self.onmessage = function(e: MessageEvent<PredictionRequest>) {
  const { type, trains, timeHorizon, options = {} } = e.data;
  
  try {
    switch (type) {
      case 'PREDICT_PATH': {
        const results: PredictionResult[] = trains.map(train => {
          const predictions: any[] = [];
          const timeSteps = Math.ceil(timeHorizon / 5); // Every 5 minutes
          
          for (let step = 1; step <= timeSteps; step++) {
            const futureTime = Date.now() + (step * 5 * 60 * 1000);
            const prediction = predictPosition(train, futureTime, options);
            predictions.push({
              timestamp: futureTime,
              ...prediction,
            });
          }
          
          return {
            type: 'PATH_PREDICTION' as const,
            trainId: train.id,
            predictions,
          };
        });
        
        self.postMessage(results);
        break;
      }
      
      case 'CALCULATE_CONFLICTS': {
        const conflicts = detectConflicts(trains, timeHorizon, options);
        
        const result: PredictionResult = {
          type: 'CONFLICT_ANALYSIS',
          trainId: 'all',
          predictions: [],
          conflicts,
        };
        
        self.postMessage([result]);
        break;
      }
      
      case 'OPTIMIZE_ROUTES': {
        const conflicts = detectConflicts(trains, timeHorizon, options);
        const optimizations = generateOptimizations(trains, conflicts);
        
        const result: PredictionResult = {
          type: 'ROUTE_OPTIMIZATION',
          trainId: 'all',
          predictions: [],
          conflicts,
          optimizations,
        };
        
        self.postMessage([result]);
        break;
      }
      
      default:
        throw new Error(`Unknown request type: ${type}`);
    }
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

