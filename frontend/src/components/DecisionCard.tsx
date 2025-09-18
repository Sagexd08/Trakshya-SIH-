"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, TrendingUp, TrendingDown, Activity, Edit3, Sparkles, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { AIRecommendation, SystemContext } from "@/lib/gemini";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { postJSON } from "@/lib/api";

interface DecisionCardProps {
  context?: SystemContext;
  onRecommendationApply?: (recommendation: AIRecommendation) => void;
  autoRefresh?: boolean;
  showMultiple?: boolean;
  enableInlineEdit?: boolean;
  showTrainVisualization?: boolean;
}

interface KPIImpact {
  metric: string;
  current: number;
  projected: number;
  unit: string;
  trend: 'up' | 'down' | 'neutral';
  confidence: number;
}

interface TrainMovement {
  trainId: string;
  from: { lat: number; lng: number; name: string };
  to: { lat: number; lng: number; name: string };
  currentPosition: { lat: number; lng: number };
  speed: number;
  delay: number;
  status: 'on-time' | 'delayed' | 'optimized';
}

export default function DecisionCard({
  context,
  onRecommendationApply,
  autoRefresh = true,
  showMultiple = false,
  enableInlineEdit = true,
  showTrainVisualization = true
}: DecisionCardProps) {
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<AIRecommendation>>({});
  const [kpiImpacts, setKpiImpacts] = useState<KPIImpact[]>([]);
  const [trainMovements, setTrainMovements] = useState<TrainMovement[]>([]);
  const [showDetails, setShowDetails] = useState<string | null>(null);

  // Calculate KPI impacts for a recommendation
  const calculateKPIImpacts = (recommendation: AIRecommendation): KPIImpact[] => {
    const impacts: KPIImpact[] = [];

    if (recommendation.impact.delayReduction) {
      impacts.push({
        metric: 'Average Delay',
        current: context?.avgDelay || 4.2,
        projected: (context?.avgDelay || 4.2) - (recommendation.impact.delayReduction / 10),
        unit: 'minutes',
        trend: 'down',
        confidence: recommendation.confidence
      });
    }

    if (recommendation.impact.energySavings) {
      impacts.push({
        metric: 'Energy Efficiency',
        current: context?.energyEfficiency || 92.4,
        projected: (context?.energyEfficiency || 92.4) + recommendation.impact.energySavings,
        unit: '%',
        trend: 'up',
        confidence: recommendation.confidence
      });
    }

    if (recommendation.impact.throughputImprovement) {
      impacts.push({
        metric: 'Network Throughput',
        current: context?.throughput || 87.6,
        projected: (context?.throughput || 87.6) + recommendation.impact.throughputImprovement,
        unit: '%',
        trend: 'up',
        confidence: recommendation.confidence
      });
    }

    return impacts;
  };

  // Generate mock train movements for visualization
  const generateTrainMovements = (recommendation: AIRecommendation): TrainMovement[] => {
    if (!recommendation.actions?.trainId) return [];

    return [{
      trainId: recommendation.actions.trainId,
      from: { lat: 28.6139, lng: 77.2090, name: 'New Delhi' },
      to: { lat: 26.4499, lng: 80.3319, name: 'Kanpur Central' },
      currentPosition: { lat: 27.5314, lng: 78.7706 },
      speed: 85,
      delay: recommendation.actions.delayMinutes || 0,
      status: recommendation.type === 'delay' ? 'optimized' : 'on-time'
    }];
  };

  // Fetch recommendations from AI
  const fetchRecommendations = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/ai/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activeTrains: context?.activeTrains || 142,
          conflicts: context?.conflicts || [],
          energyEfficiency: context?.energyEfficiency || 92.4,
          avgDelay: context?.avgDelay || 4.2,
          throughput: context?.throughput || 87.6,
          currentView: 'dashboard'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const recs = data.recommendations || [];
        setRecommendations(recs);

        // Calculate KPI impacts for the first recommendation
        if (recs.length > 0) {
          setKpiImpacts(calculateKPIImpacts(recs[0]));
          setTrainMovements(generateTrainMovements(recs[0]));
          if (showTrainVisualization) setShowDetails(recs[0].id);
        }
      } else {
        throw new Error('Failed to fetch recommendations');
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      // Fallback to mock data
      const mockRecs = getMockRecommendations();
      setRecommendations(mockRecs);
      if (mockRecs.length > 0) {
        setKpiImpacts(calculateKPIImpacts(mockRecs[0]));
        setTrainMovements(generateTrainMovements(mockRecs[0]));
        if (showTrainVisualization) setShowDetails(mockRecs[0].id);
      }
      toast.error("Using demo recommendations. Connect AI service for real-time analysis.");
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh recommendations
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchRecommendations();

    if (autoRefresh) {
      const interval = setInterval(fetchRecommendations, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [context, autoRefresh]);

  const handleAccept = async (recommendation: AIRecommendation) => {
    setProcessing(recommendation.id);

    try {
      // Try to use the existing API first
      await postJSON("/decisions", {
        action: "accept",
        proposalId: recommendation.id,
        recommendation
      });

      if (onRecommendationApply) {
        onRecommendationApply(recommendation);
      }

      // Remove the applied recommendation
      setRecommendations(prev => prev.filter(r => r.id !== recommendation.id));

      toast.success(`Recommendation applied: ${recommendation.title}`);

    } catch (error) {
      console.error('Error applying recommendation:', error);
      toast.error("Failed to apply recommendation. Please try again.");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (recommendation: AIRecommendation) => {
    try {
      await postJSON("/decisions", {
        action: "reject",
        proposalId: recommendation.id
      });

      setRecommendations(prev => prev.filter(r => r.id !== recommendation.id));
      toast.info("Recommendation dismissed");
    } catch (error) {
      console.error('Error rejecting recommendation:', error);
      setRecommendations(prev => prev.filter(r => r.id !== recommendation.id));
      toast.info("Recommendation dismissed");
    }
  };

  // Handle inline editing
  const startEditing = (recommendation: AIRecommendation) => {
    setEditingId(recommendation.id);
    setEditValues({
      title: recommendation.title,
      description: recommendation.description,
      actions: { ...recommendation.actions }
    });
  };

  const saveEdit = async (recommendation: AIRecommendation) => {
    try {
      const updatedRecommendation = {
        ...recommendation,
        ...editValues,
        actions: { ...recommendation.actions, ...editValues.actions }
      };

      // Update local state optimistically
      setRecommendations(prev =>
        prev.map(r => r.id === recommendation.id ? updatedRecommendation : r)
      );

      // Recalculate impacts
      setKpiImpacts(calculateKPIImpacts(updatedRecommendation));
      setTrainMovements(generateTrainMovements(updatedRecommendation));

      setEditingId(null);
      setEditValues({});

      toast.success("Recommendation updated successfully");
    } catch (error) {
      console.error('Error updating recommendation:', error);
      toast.error("Failed to update recommendation");
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  // Handle modify action (creates a new recommendation based on current one)
  const handleModify = async (recommendation: AIRecommendation) => {
    const modifiedRecommendation: AIRecommendation = {
      ...recommendation,
      id: crypto.randomUUID(),
      title: `Modified: ${recommendation.title}`,
      confidence: Math.max(0.5, recommendation.confidence - 0.1), // Slightly lower confidence for modified
      timestamp: new Date()
    };

    setRecommendations(prev => [modifiedRecommendation, ...prev.filter(r => r.id !== recommendation.id)]);
    startEditing(modifiedRecommendation);

    toast.info("Recommendation ready for modification");
  };

  const getMockRecommendations = (): AIRecommendation[] => [
    {
      id: crypto.randomUUID(),
      type: "delay",
      title: "Hold Train 123 for 2 mins → Saves 14 mins overall",
      description: "Reduces conflict near Kanpur Jn by sequencing faster train first",
      confidence: 0.87,
      impact: {
        delayReduction: 14,
        throughputImprovement: 12,
        conflictsResolved: 1
      },
      actions: {
        trainId: "123",
        delayMinutes: 2,
        priority: "high"
      },
      reasoning: "Analysis shows this minimal delay prevents a cascade of conflicts affecting 3 other trains",
      timestamp: new Date()
    },
    {
      id: crypto.randomUUID(),
      type: "energy",
      title: "Optimize speed profile for Train 18005",
      description: "Reduce energy consumption while maintaining schedule adherence",
      confidence: 0.73,
      impact: {
        energySavings: 15,
        throughputImprovement: 3
      },
      actions: {
        trainId: "18005",
        priority: "medium"
      },
      reasoning: "Current speed profile is 18% above optimal. Gradual reduction will save energy without affecting passenger experience",
      timestamp: new Date()
    }
  ];

  if (isLoading && recommendations.length === 0) {
    return (
      <Card className="bg-neutral-900 border-neutral-700">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3" data-testid="loading-skeleton">
            <div className="h-4 bg-neutral-700 rounded mb-2"></div>
            <div className="h-3 bg-neutral-700 rounded mb-3 w-3/4"></div>
            <div className="grid grid-cols-3 gap-2">
              <div className="h-12 bg-neutral-700 rounded"></div>
              <div className="h-12 bg-neutral-700 rounded"></div>
              <div className="h-12 bg-neutral-700 rounded"></div>
            </div>
            <div className="flex gap-2">
              <div className="h-8 bg-neutral-700 rounded flex-1"></div>
              <div className="h-8 bg-neutral-700 rounded flex-1"></div>
              <div className="h-8 bg-neutral-700 rounded w-16"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0 && !isLoading) {
    return (
      <Card className="bg-neutral-900 border-neutral-700">
        <CardContent className="p-6 text-center">
          <Sparkles size={32} className="text-neutral-500 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-white mb-2">No Active Recommendations</h3>
          <p className="text-sm text-neutral-400 mb-1">AI is monitoring for optimization opportunities</p>
          <p className="text-xs text-neutral-500">Check back in a few minutes for new suggestions</p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRecommendations}
            className="mt-3"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </CardContent>
      </Card>
    );
  }

  const recommendationsToShow = showMultiple ? recommendations : recommendations.slice(0, 1);

  return (
    <div className="space-y-4">
      <AnimatePresence mode="popLayout">
        {recommendationsToShow.map((recommendation, index) => {
          const isProcessing = processing === recommendation.id;
          const isEditing = editingId === recommendation.id;
          const isExpanded = showDetails === recommendation.id;

          return (
            <motion.div
              key={recommendation.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card className="bg-neutral-900 border-neutral-700 hover:border-neutral-600 transition-all duration-200">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {isEditing && enableInlineEdit ? (
                        <input
                          type="text"
                          value={editValues.title || recommendation.title}
                          onChange={(e) => setEditValues(prev => ({ ...prev, title: e.target.value }))}
                          className="w-full bg-neutral-800 border border-neutral-600 rounded px-2 py-1 text-white text-sm"
                          placeholder="Recommendation title"
                        />
                      ) : (
                        <h3 className="font-semibold text-white text-sm leading-tight">
                          {recommendation.title}
                        </h3>
                      )}

                      <div className="flex items-center gap-2 mt-2">
                        <Badge
                          variant={recommendation.confidence > 0.8 ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {`${Math.round(recommendation.confidence * 100)}% confidence`}
                        </Badge>
                        <Badge variant="outline" className="text-xs md:inline hidden">
                          {`${Math.round(recommendation.confidence * 100)}%`}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {recommendation.type}
                        </Badge>
                        <span className="text-xs text-neutral-500">
                          {recommendation.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 ml-2">
                      {enableInlineEdit && !isEditing && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditing(recommendation)}
                          className="h-6 w-6 p-0"
                          data-testid="edit-button"
                        >
                          <Edit3 className="w-3 h-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDetails(isExpanded ? null : recommendation.id)}
                        className="h-6 w-6 p-0"
                        data-testid="expand-button"
                      >
                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <TrendingUp className="w-3 h-3" />
                        </motion.div>
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Description */}
                  {isEditing && enableInlineEdit ? (
                    <textarea
                      value={editValues.description || recommendation.description}
                      onChange={(e) => setEditValues(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full bg-neutral-800 border border-neutral-600 rounded px-2 py-1 text-white text-sm resize-none"
                      rows={2}
                      placeholder="Recommendation description"
                    />
                  ) : (
                    <>
                      <p className="text-sm text-neutral-400 leading-relaxed">
                        {recommendation.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {typeof recommendation.impact?.delayReduction === 'number' && (
                          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs bg-neutral-800 text-neutral-200 border border-neutral-700">
                            {-recommendation.impact.delayReduction}m
                          </span>
                        )}
                        {typeof recommendation.impact?.throughputImprovement === 'number' && (
                          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs bg-neutral-800 text-neutral-200 border border-neutral-700">
                            +{recommendation.impact.throughputImprovement}%
                          </span>
                        )}
                      </div>
                    </>

                  )}

                  {/* KPI Impact Cards */}
                  {kpiImpacts.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {kpiImpacts.map((impact, idx) => (
                        <motion.div
                          key={impact.metric}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.1 }}
                          className="bg-neutral-800 rounded-lg p-3"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-neutral-300">
                              {impact.metric}
                            </span>
                            {impact.trend === 'up' ? (
                              <TrendingUp className="w-3 h-3 text-green-400" />
                            ) : impact.trend === 'down' ? (
                              <TrendingDown className="w-3 h-3 text-red-400" />
                            ) : (
                              <Activity className="w-3 h-3 text-yellow-400" />
                            )}
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-neutral-500">Current:</span>
                              <span className="text-white font-mono">
                                {impact.current.toFixed(1)}
                              </span>
                              <span className="text-neutral-400 ml-1">{impact.unit}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-neutral-500">Projected:</span>
                              <span className={cn(
                                "font-mono font-medium",
                                impact.trend === 'up' ? "text-green-400" :
                                impact.trend === 'down' ? "text-red-400" : "text-yellow-400"
                              )}>
                                {impact.projected.toFixed(1)}
                              </span>
                              <span className="text-neutral-400 ml-1">{impact.unit}</span>
                            </div>
                          </div>

                          <div className="mt-2 w-full bg-neutral-700 rounded-full h-1">
                            <motion.div
                              className={cn(
                                "h-1 rounded-full",
                                impact.trend === 'up' ? "bg-green-400" :
                                impact.trend === 'down' ? "bg-red-400" : "bg-yellow-400"
                              )}
                              initial={{ width: 0 }}
                              animate={{ width: `${impact.confidence * 100}%` }}
                              transition={{ duration: 1, delay: idx * 0.2 }}
                            />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-3 border-t border-neutral-700 pt-3"
                      >
                        {/* Reasoning */}
                        <div>
                          <h4 className="text-xs font-medium text-neutral-300 mb-1">AI Reasoning</h4>
                          <p className="text-xs text-neutral-400 leading-relaxed">
                            {recommendation.reasoning}
                          </p>
                        </div>

                        {/* Train Visualization */}
                        {showTrainVisualization && trainMovements.length > 0 && (
                          <div>
                            <h4 className="text-xs font-medium text-neutral-300 mb-2">Affected Trains</h4>
                            <div className="space-y-2">
                              {trainMovements.map((train) => (
                                <div key={train.trainId} className="bg-neutral-800 rounded p-2">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium text-white">
                                      Train {train.trainId}
                                    </span>
                                    <Badge
                                      variant={
                                        train.status === 'on-time' ? 'default' :
                                        train.status === 'delayed' ? 'destructive' : 'secondary'
                                      }
                                      className="text-xs"
                                    >
                                      {train.status}
                                    </Badge>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <span className="text-neutral-500">Route:</span>
                                      <div className="text-white">{train.from.name} → {train.to.name}</div>
                                    </div>
                                    <div>
                                      <span className="text-neutral-500">Speed:</span>
                                      <div className="text-white">{train.speed} km/h</div>
                                    </div>
                                  </div>
                                  {train.delay > 0 && (
                                    <div className="mt-1 text-xs">
                                      <span className="text-neutral-500">Delay:</span>
                                      <span className="text-red-400 ml-1">+{train.delay} min</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Action Parameters */}
                        {recommendation.actions && (
                          <div>
                            <h4 className="text-xs font-medium text-neutral-300 mb-1">Action Parameters</h4>
                            <div className="bg-neutral-800 rounded p-2">
                              <pre className="text-xs text-neutral-400 whitespace-pre-wrap">
                                {JSON.stringify(recommendation.actions, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>

                <CardFooter className="gap-2 pt-2">
                  {isEditing ? (
                    <>
                      <Button
                        onClick={() => saveEdit(recommendation)}
                        className="flex-1 bg-green-600 hover:bg-green-500"
                        size="sm"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Save Changes
                      </Button>
                      <Button
                        variant="outline"
                        onClick={cancelEdit}
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={() => handleAccept(recommendation)}
                        disabled={isProcessing}
                        className="flex-1 bg-green-600 hover:bg-green-500"
                        size="sm"
                      >
                        {isProcessing ? (
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                            <span>Applying...</span>
                          </div>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Accept
                          </>
                        )}
                      </Button>

                      <Button
                        variant="secondary"
                        onClick={() => handleReject(recommendation)}
                        disabled={isProcessing}
                        size="sm"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>

                      {enableInlineEdit && (
                        <Button
                          variant="outline"
                          onClick={() => handleModify(recommendation)}
                          disabled={isProcessing}
                          size="sm"
                        >
                          <Edit3 className="w-4 h-4 mr-1" />
                          Modify
                        </Button>
                      )}
                    </>
                  )}
                </CardFooter>
              </Card>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Show more button for multiple recommendations */}
      {!showMultiple && recommendations.length > 1 && (
        <Button
          variant="outline"
          onClick={() => setShowDetails(null)}
          className="w-full"
          size="sm"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          View {recommendations.length - 1} More Recommendations
        </Button>
      )}
    </div>
  );
}

