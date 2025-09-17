"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Play,
  Pause,
  RotateCcw,
  Save,
  Upload,
  Download,
  AlertTriangle,
  Cloud,
  Zap,
  Construction,
  MapPin,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SystemContext } from "@/lib/gemini";

interface DisruptionScenario {
  id: string;
  name: string;
  type: 'weather' | 'technical' | 'infrastructure' | 'operational';
  icon: React.ComponentType<{ className?: string }>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  parameters: {
    duration: [number, number]; // min, max hours
    affectedArea: number; // radius in km
    speedReduction: number; // percentage
    capacityReduction: number; // percentage
  };
  impacts: {
    delayIncrease: string;
    energyImpact: string;
    costImpact: string;
    passengerImpact: string;
  };
}

interface SimulationState {
  isRunning: boolean;
  progress: number;
  currentStep: string;
  results: {
    totalDelay: number;
    energyIncrease: number;
    costImpact: number;
    affectedTrains: number;
    alternativeRoutes: number;
  } | null;
}

interface SavedScenario {
  id: string;
  name: string;
  scenario: DisruptionScenario;
  parameters: any;
  timestamp: Date;
  results?: SimulationState['results'];
}

const PREDEFINED_SCENARIOS: DisruptionScenario[] = [
  {
    id: 'dense-fog',
    name: 'Dense Fog',
    type: 'weather',
    icon: Cloud,
    severity: 'high',
    description: 'Dense fog reducing visibility to less than 50 meters, requiring speed restrictions and increased headway.',
    parameters: {
      duration: [2, 8],
      affectedArea: 50,
      speedReduction: 40,
      capacityReduction: 30
    },
    impacts: {
      delayIncrease: '+15-25 minutes',
      energyImpact: '+8-12%',
      costImpact: '₹2-4 lakhs/hour',
      passengerImpact: '5000+ affected'
    }
  },
  {
    id: 'signal-failure',
    name: 'Signal System Failure',
    type: 'technical',
    icon: Zap,
    severity: 'critical',
    description: 'Complete signal system failure requiring manual authorization and reduced speeds.',
    parameters: {
      duration: [1, 4],
      affectedArea: 25,
      speedReduction: 60,
      capacityReduction: 70
    },
    impacts: {
      delayIncrease: '+30-60 minutes',
      energyImpact: '+15-25%',
      costImpact: '₹8-15 lakhs/hour',
      passengerImpact: '10000+ affected'
    }
  },
  {
    id: 'track-closure',
    name: 'Emergency Track Closure',
    type: 'infrastructure',
    icon: Construction,
    severity: 'critical',
    description: 'Complete track closure due to infrastructure damage, requiring full rerouting.',
    parameters: {
      duration: [4, 24],
      affectedArea: 100,
      speedReduction: 0,
      capacityReduction: 100
    },
    impacts: {
      delayIncrease: '+60-180 minutes',
      energyImpact: '+20-40%',
      costImpact: '₹25-50 lakhs/hour',
      passengerImpact: '25000+ affected'
    }
  },
  {
    id: 'power-outage',
    name: 'Traction Power Failure',
    type: 'technical',
    icon: Zap,
    severity: 'high',
    description: 'Overhead power line failure affecting electric trains in the section.',
    parameters: {
      duration: [1, 6],
      affectedArea: 30,
      speedReduction: 80,
      capacityReduction: 90
    },
    impacts: {
      delayIncrease: '+45-90 minutes',
      energyImpact: '+30-50%',
      costImpact: '₹12-25 lakhs/hour',
      passengerImpact: '15000+ affected'
    }
  },
  {
    id: 'station-congestion',
    name: 'Major Station Congestion',
    type: 'operational',
    icon: MapPin,
    severity: 'medium',
    description: 'Platform congestion at major junction causing cascading delays.',
    parameters: {
      duration: [1, 3],
      affectedArea: 15,
      speedReduction: 20,
      capacityReduction: 40
    },
    impacts: {
      delayIncrease: '+10-20 minutes',
      energyImpact: '+5-10%',
      costImpact: '₹1-3 lakhs/hour',
      passengerImpact: '3000+ affected'
    }
  }
];

export default function ScenarioModal() {
  const [open, setOpen] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<DisruptionScenario>(PREDEFINED_SCENARIOS[0]);
  const [customParameters, setCustomParameters] = useState({
    duration: 4,
    location: [77.2090, 28.6139] as [number, number],
    severity: 1.0
  });
  const [simulationState, setSimulationState] = useState<SimulationState>({
    isRunning: false,
    progress: 0,
    currentStep: '',
    results: null
  });
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [activeTab, setActiveTab] = useState('scenarios');
  const [aiExplanation, setAiExplanation] = useState<string>('');
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);

  // Load saved scenarios from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('trakshya-saved-scenarios');
    if (saved) {
      try {
        setSavedScenarios(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load saved scenarios:', error);
      }
    }
  }, []);

  // Save scenarios to localStorage
  const saveScenarios = useCallback((scenarios: SavedScenario[]) => {
    localStorage.setItem('trakshya-saved-scenarios', JSON.stringify(scenarios));
    setSavedScenarios(scenarios);
  }, []);

  // Get AI explanation for scenario impact
  const getAIExplanation = useCallback(async (scenario: DisruptionScenario) => {
    setIsLoadingExplanation(true);
    try {
      const context: SystemContext = {
        activeTrains: 142,
        conflicts: [],
        energyEfficiency: 92.4,
        avgDelay: 4.2,
        throughput: 87.6,
        userRole: 'controller',
        currentView: 'scenario-simulation'
      };

      const response = await fetch('/api/ai/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: {
            name: scenario.name,
            type: scenario.type,
            severity: scenario.severity,
            description: scenario.description,
            parameters: scenario.parameters,
            duration: customParameters.duration,
            location: customParameters.location
          },
          context
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAiExplanation(data.explanation || 'AI analysis not available');
      } else {
        setAiExplanation('Failed to get AI analysis');
      }
    } catch (error) {
      console.error('AI explanation error:', error);
      setAiExplanation('Error getting AI analysis');
    } finally {
      setIsLoadingExplanation(false);
    }
  }, [customParameters]);

  // Run simulation
  const runSimulation = useCallback(async () => {
    setSimulationState(prev => ({ ...prev, isRunning: true, progress: 0 }));

    const steps = [
      'Initializing simulation environment...',
      'Analyzing current train positions...',
      'Applying disruption parameters...',
      'Calculating route alternatives...',
      'Simulating train movements...',
      'Computing delay propagation...',
      'Analyzing energy impact...',
      'Generating final report...'
    ];

    for (let i = 0; i < steps.length; i++) {
      setSimulationState(prev => ({
        ...prev,
        progress: ((i + 1) / steps.length) * 100,
        currentStep: steps[i]
      }));

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
    }

    // Generate realistic results based on scenario parameters
    const baseDelay = 15;
    const delayMultiplier = selectedScenario.parameters.speedReduction / 100;
    const capacityImpact = selectedScenario.parameters.capacityReduction / 100;

    const results = {
      totalDelay: Math.round(baseDelay * (1 + delayMultiplier) * customParameters.severity),
      energyIncrease: Math.round(12 * (1 + capacityImpact) * customParameters.severity),
      costImpact: Math.round(50000 * customParameters.duration * customParameters.severity),
      affectedTrains: Math.round(25 * (1 + capacityImpact) * customParameters.severity),
      alternativeRoutes: Math.round(8 * customParameters.severity)
    };

    setSimulationState(prev => ({
      ...prev,
      isRunning: false,
      results
    }));

    // Get AI explanation for the results
    await getAIExplanation(selectedScenario);

    toast.success('Simulation completed successfully');
  }, [selectedScenario, customParameters, getAIExplanation]);

  // Save current scenario
  const saveCurrentScenario = useCallback(() => {
    const newScenario: SavedScenario = {
      id: `scenario-${Date.now()}`,
      name: `${selectedScenario.name} - ${new Date().toLocaleDateString()}`,
      scenario: selectedScenario,
      parameters: customParameters,
      timestamp: new Date(),
      results: simulationState.results || undefined
    };

    const updated = [...savedScenarios, newScenario];
    saveScenarios(updated);
    toast.success('Scenario saved successfully');
  }, [selectedScenario, customParameters, simulationState.results, savedScenarios, saveScenarios]);

  // Load saved scenario
  const loadScenario = useCallback((saved: SavedScenario) => {
    setSelectedScenario(saved.scenario);
    setCustomParameters(saved.parameters);
    if (saved.results) {
      setSimulationState(prev => ({ ...prev, results: saved.results! }));
    }
    setActiveTab('scenarios');
    toast.success('Scenario loaded successfully');
  }, []);

  // Export scenarios
  const exportScenarios = useCallback(() => {
    const dataStr = JSON.stringify(savedScenarios, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trakshya-scenarios-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Scenarios exported successfully');
  }, [savedScenarios]);

  // Import scenarios
  const importScenarios = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported)) {
          const updated = [...savedScenarios, ...imported];
          saveScenarios(updated);
          toast.success(`Imported ${imported.length} scenarios`);
        }
      } catch (error) {
        toast.error('Failed to import scenarios');
      }
    };
    reader.readAsText(file);
  }, [savedScenarios, saveScenarios]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Activity className="w-4 h-4" />
          What-If Scenarios
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-neutral-950 border-neutral-800">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            Scenario Simulation Center
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-neutral-900">
            <TabsTrigger value="scenarios" className="text-white">Scenarios</TabsTrigger>
            <TabsTrigger value="simulation" className="text-white">Simulation</TabsTrigger>
            <TabsTrigger value="saved" className="text-white">Saved</TabsTrigger>
          </TabsList>

          {/* Scenarios Tab */}
          <TabsContent value="scenarios" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PREDEFINED_SCENARIOS.map((scenario) => (
                <Card
                  key={scenario.id}
                  className={cn(
                    "cursor-pointer transition-all duration-200 hover:scale-105",
                    selectedScenario.id === scenario.id
                      ? "bg-neutral-800 border-cyan-400"
                      : "bg-neutral-900 border-neutral-700 hover:border-neutral-600"
                  )}
                  onClick={() => setSelectedScenario(scenario)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <scenario.icon className="w-5 h-5 text-cyan-400" />
                        <CardTitle className="text-sm font-medium text-white">
                          {scenario.name}
                        </CardTitle>
                      </div>
                      <Badge
                        variant={
                          scenario.severity === 'critical' ? 'destructive' :
                          scenario.severity === 'high' ? 'default' :
                          scenario.severity === 'medium' ? 'secondary' : 'outline'
                        }
                        className="text-xs"
                      >
                        {scenario.severity}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      {scenario.description}
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Speed:</span>
                          <span className="text-red-400">-{scenario.parameters.speedReduction}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Capacity:</span>
                          <span className="text-red-400">-{scenario.parameters.capacityReduction}%</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Duration:</span>
                          <span className="text-yellow-400">
                            {scenario.parameters.duration[0]}-{scenario.parameters.duration[1]}h
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Area:</span>
                          <span className="text-blue-400">{scenario.parameters.affectedArea}km</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-neutral-700">
                      <div className="text-xs text-neutral-500 mb-1">Expected Impact:</div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-neutral-400">Delay:</span>
                          <span className="text-red-400">{scenario.impacts.delayIncrease}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-400">Cost:</span>
                          <span className="text-yellow-400">{scenario.impacts.costImpact}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Selected Scenario Details */}
            {selectedScenario && (
              <Card className="bg-neutral-900 border-neutral-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <selectedScenario.icon className="w-5 h-5 text-cyan-400" />
                    {selectedScenario.name} - Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Duration Slider */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-300">
                        Duration: {customParameters.duration} hours
                      </label>
                      <Slider
                        value={[customParameters.duration]}
                        onValueChange={(value) =>
                          setCustomParameters(prev => ({ ...prev, duration: value[0] }))
                        }
                        max={selectedScenario.parameters.duration[1]}
                        min={selectedScenario.parameters.duration[0]}
                        step={0.5}
                        className="w-full"
                      />
                    </div>

                    {/* Severity Multiplier */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-300">
                        Severity: {(customParameters.severity * 100).toFixed(0)}%
                      </label>
                      <Slider
                        value={[customParameters.severity]}
                        onValueChange={(value) =>
                          setCustomParameters(prev => ({ ...prev, severity: value[0] }))
                        }
                        max={2.0}
                        min={0.1}
                        step={0.1}
                        className="w-full"
                      />
                    </div>

                    {/* Location */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-300">Location</label>
                      <div className="text-xs text-neutral-400">
                        Lat: {customParameters.location[1].toFixed(4)}<br/>
                        Lng: {customParameters.location[0].toFixed(4)}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => {
                          // In a real app, this would open a map picker
                          toast.info('Map picker coming soon');
                        }}
                      >
                        <MapPin className="w-3 h-3 mr-1" />
                        Select on Map
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={runSimulation}
                      disabled={simulationState.isRunning}
                      className="flex-1"
                    >
                      {simulationState.isRunning ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Run Simulation
                        </>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => getAIExplanation(selectedScenario)}
                      disabled={isLoadingExplanation}
                    >
                      {isLoadingExplanation ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        'AI Analysis'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Simulation Tab */}
          <TabsContent value="simulation" className="space-y-4">
            {simulationState.isRunning && (
              <Card className="bg-neutral-900 border-neutral-700">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-white">Running Simulation</h3>
                      <Badge variant="default" className="animate-pulse">
                        {simulationState.progress.toFixed(0)}%
                      </Badge>
                    </div>

                    <div className="w-full bg-neutral-800 rounded-full h-2">
                      <motion.div
                        className="bg-cyan-400 h-2 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${simulationState.progress}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>

                    <p className="text-sm text-neutral-400">{simulationState.currentStep}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {simulationState.results && (
              <div className="space-y-4">
                <Card className="bg-neutral-900 border-neutral-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-400" />
                      Simulation Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-400">
                          +{simulationState.results.totalDelay}
                        </div>
                        <div className="text-xs text-neutral-400">Minutes Delay</div>
                      </div>

                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-400">
                          +{simulationState.results.energyIncrease}%
                        </div>
                        <div className="text-xs text-neutral-400">Energy Increase</div>
                      </div>

                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-400">
                          ₹{(simulationState.results.costImpact / 1000).toFixed(0)}K
                        </div>
                        <div className="text-xs text-neutral-400">Cost Impact</div>
                      </div>

                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-400">
                          {simulationState.results.affectedTrains}
                        </div>
                        <div className="text-xs text-neutral-400">Affected Trains</div>
                      </div>

                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-400">
                          {simulationState.results.alternativeRoutes}
                        </div>
                        <div className="text-xs text-neutral-400">Alt. Routes</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* AI Explanation */}
                {aiExplanation && (
                  <Card className="bg-neutral-900 border-neutral-700">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Activity className="w-5 h-5 text-purple-400" />
                        AI Impact Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-invert prose-sm max-w-none">
                        <p className="text-neutral-300 leading-relaxed">
                          {aiExplanation}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex gap-2">
                  <Button onClick={saveCurrentScenario} variant="outline" className="flex-1">
                    <Save className="w-4 h-4 mr-2" />
                    Save Scenario
                  </Button>

                  <Button
                    onClick={() => setSimulationState(prev => ({ ...prev, results: null }))}
                    variant="outline"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset
                  </Button>
                </div>
              </div>
            )}

            {!simulationState.isRunning && !simulationState.results && (
              <Card className="bg-neutral-900 border-neutral-700">
                <CardContent className="p-8 text-center">
                  <Activity className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No Simulation Running</h3>
                  <p className="text-neutral-400 mb-4">
                    Configure a scenario in the Scenarios tab and run a simulation to see results here.
                  </p>
                  <Button onClick={() => setActiveTab('scenarios')} variant="outline">
                    Go to Scenarios
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Saved Scenarios Tab */}
          <TabsContent value="saved" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-white">Saved Scenarios</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportScenarios}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild>
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      Import
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept=".json"
                    onChange={importScenarios}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {savedScenarios.length === 0 ? (
              <Card className="bg-neutral-900 border-neutral-700">
                <CardContent className="p-8 text-center">
                  <Save className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No Saved Scenarios</h3>
                  <p className="text-neutral-400">
                    Run simulations and save them to build your scenario library.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savedScenarios.map((saved) => (
                  <Card key={saved.id} className="bg-neutral-900 border-neutral-700">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium text-white">
                          {saved.name}
                        </CardTitle>
                        <Badge variant="outline" className="text-xs">
                          {saved.scenario.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-neutral-400">
                        {saved.timestamp.toLocaleDateString()} {saved.timestamp.toLocaleTimeString()}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2">
                        <saved.scenario.icon className="w-4 h-4 text-cyan-400" />
                        <span className="text-sm text-neutral-300">{saved.scenario.name}</span>
                      </div>

                      {saved.results && (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-neutral-500">Delay:</span>
                            <span className="text-red-400">+{saved.results.totalDelay}min</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-500">Cost:</span>
                            <span className="text-yellow-400">₹{(saved.results.costImpact / 1000).toFixed(0)}K</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-500">Trains:</span>
                            <span className="text-blue-400">{saved.results.affectedTrains}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-neutral-500">Routes:</span>
                            <span className="text-green-400">{saved.results.alternativeRoutes}</span>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadScenario(saved)}
                          className="flex-1"
                        >
                          Load
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const updated = savedScenarios.filter(s => s.id !== saved.id);
                            saveScenarios(updated);
                            toast.success('Scenario deleted');
                          }}
                          className="text-red-400 hover:text-red-300"
                        >
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

