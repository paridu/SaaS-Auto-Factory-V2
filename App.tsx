import React, { useState, useRef, useEffect } from 'react';
import { 
  Radar, 
  Package, 
  Cpu, 
  Code, 
  Activity, 
  Play, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Loader2,
  ChevronRight,
  Terminal,
  Sparkles,
  Globe,
  FileText,
  GitGraph,
  Maximize2,
  CreditCard,
  RefreshCw
} from 'lucide-react';
import { 
  FactoryState, 
  INITIAL_STATE, 
  AgentStatus, 
  IdeaInput, 
  QAMetrics 
} from './types';
import * as GeminiService from './services/geminiService';
import Typewriter from './components/Typewriter';
import MermaidDiagram from './components/MermaidDiagram';

// --- Helper Components ---

const SectionHeader: React.FC<{ 
  icon: React.ElementType, 
  title: string, 
  description: string,
  isActive: boolean,
  status: AgentStatus
}> = ({ icon: Icon, title, description, isActive, status }) => {
  let statusColor = 'text-factory-muted';
  if (status === AgentStatus.COMPLETED) statusColor = 'text-factory-success';
  if (status === AgentStatus.FAILED || status === AgentStatus.SKIPPED) statusColor = 'text-factory-danger';
  if (status === AgentStatus.THINKING) statusColor = 'text-factory-accent';

  return (
    <div className={`flex items-start gap-4 p-4 rounded-lg transition-all duration-300 ${isActive ? 'bg-factory-card border-l-4 border-factory-accent' : 'opacity-60'}`}>
      <div className={`p-2 rounded-md bg-opacity-20 ${isActive ? 'bg-factory-accent' : 'bg-gray-700'}`}>
        <Icon className={`w-6 h-6 ${statusColor}`} />
      </div>
      <div className="flex-1">
        <h3 className="text-lg font-semibold text-factory-text flex items-center justify-between">
          {title}
          {status === AgentStatus.THINKING && <Loader2 className="w-4 h-4 animate-spin text-factory-accent" />}
          {status === AgentStatus.COMPLETED && <CheckCircle className="w-4 h-4 text-factory-success" />}
        </h3>
        <p className="text-sm text-factory-muted">{description}</p>
      </div>
    </div>
  );
};

const MarkdownBlock: React.FC<{ content: string; label?: string }> = ({ content, label }) => (
  <div className="mt-2">
    {label && <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 ml-1">{label}</div>}
    <div className="bg-black/30 p-4 rounded-md font-mono text-sm text-gray-300 overflow-x-auto border border-gray-700">
        <Typewriter text={content} speed={2} />
    </div>
  </div>
);

// --- Main App ---

export default function App() {
  const [state, setState] = useState<FactoryState>(INITIAL_STATE);
  const [apiKeyError, setApiKeyError] = useState<{type: 'MISSING' | 'INVALID' | 'QUOTA', message: string} | null>(null);
  const [isResearching, setIsResearching] = useState(false);

  // Loading states for individual product features
  const [loadingOptimization, setLoadingOptimization] = useState(false);
  const [loadingUserFlow, setLoadingUserFlow] = useState(false);
  const [loadingTechSpec, setLoadingTechSpec] = useState(false);

  useEffect(() => {
    if (!process.env.API_KEY) {
      setApiKeyError({
          type: 'MISSING',
          message: 'The API_KEY environment variable is not set.'
      });
    }
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state]);

  const handleApiError = (err: any) => {
    console.error("Caught API Error:", err);
    if (err.message === "INVALID_API_KEY") {
        setApiKeyError({
            type: 'INVALID',
            message: 'The provided API Key is invalid or expired.'
        });
    } else if (err.message === "QUOTA_EXCEEDED") {
        setApiKeyError({
            type: 'QUOTA',
            message: 'You have exceeded your API quota.'
        });
    } else if (err.message === "MISSING_API_KEY") {
        setApiKeyError({
            type: 'MISSING',
            message: 'The API_KEY environment variable is not set.'
        });
    } else {
        alert("An unexpected error occurred: " + (err.message || "Unknown error"));
    }
  };


  // --- Actions ---

  const handleAutoResearch = async () => {
    setIsResearching(true);
    try {
      const trendingIdea = await GeminiService.GenerateIdeaFromTrends();
      setState(prev => ({
        ...prev,
        idea: trendingIdea
      }));
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsResearching(false);
    }
  };

  const handleIdeaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.idea.name || !state.idea.targetUser) return;

    setState(prev => ({ 
      ...prev, 
      currentStage: 1, 
      radar: { ...prev.radar, status: AgentStatus.THINKING } 
    }));

    try {
      const result = await GeminiService.IdeaRadarAgent(state.idea);
      setState(prev => ({
        ...prev,
        radar: { status: AgentStatus.COMPLETED, result }
      }));
    } catch (err) {
      handleApiError(err);
      setState(prev => ({ ...prev, radar: { ...prev.radar, status: AgentStatus.FAILED } }));
    }
  };

  const handleProceedToProduct = async () => {
    setState(prev => ({ 
      ...prev, 
      currentStage: 2, 
      product: { ...prev.product, status: AgentStatus.THINKING } 
    }));

    try {
      // Create context string from previous steps
      const context = `Idea: ${state.idea.name} for ${state.idea.targetUser}. ${state.idea.description}. Pain: ${state.idea.painPoint}. Radar Analysis: ${state.radar.result?.reasoning}`;
      const prdText = await GeminiService.ProductDesignerAgent(context);
      
      setState(prev => ({
        ...prev,
        product: { 
          status: AgentStatus.COMPLETED, 
          result: { prd: prdText || '', features: [] } 
        }
      }));
    } catch (err) {
      handleApiError(err);
      setState(prev => ({ ...prev, product: { ...prev.product, status: AgentStatus.FAILED } }));
    }
  };

  // --- New Product Actions ---

  const handleOptimizeProduct = async () => {
    if (!state.product.result?.prd) return;
    setLoadingOptimization(true);
    try {
      const optimization = await GeminiService.ProductMVPReviewer(state.product.result.prd);
      setState(prev => ({
        ...prev,
        product: {
          ...prev.product,
          result: { ...prev.product.result!, optimizations: optimization }
        }
      }));
    } catch (e) {
      handleApiError(e);
    } finally {
      setLoadingOptimization(false);
    }
  };

  const handleGenerateUserFlow = async () => {
    if (!state.product.result?.prd) return;
    setLoadingUserFlow(true);
    try {
      const flow = await GeminiService.ProductUserFlowDesigner(state.product.result.prd);
      setState(prev => ({
        ...prev,
        product: {
          ...prev.product,
          result: { ...prev.product.result!, userFlow: flow }
        }
      }));
    } catch (e) {
       handleApiError(e);
    } finally {
      setLoadingUserFlow(false);
    }
  };

  const handleGenerateTechSpec = async () => {
    if (!state.product.result?.prd) return;
    setLoadingTechSpec(true);
    try {
      const spec = await GeminiService.ProductTechSpecGenerator(state.product.result.prd);
      setState(prev => ({
        ...prev,
        product: {
          ...prev.product,
          result: { ...prev.product.result!, techSpec: spec }
        }
      }));
    } catch (e) {
       handleApiError(e);
    } finally {
      setLoadingTechSpec(false);
    }
  };


  const handleProceedToTech = async () => {
    setState(prev => ({ 
      ...prev, 
      currentStage: 3, 
      tech: { ...prev.tech, status: AgentStatus.THINKING } 
    }));

    try {
      // Pass both PRD and Optimization/TechSpec if available for better context
      const context = `PRD: ${state.product.result?.prd}\n\nTech Spec: ${state.product.result?.techSpec || ''}`;
      const techSpec = await GeminiService.TechLeadAgent(context);
      
      setState(prev => ({
        ...prev,
        tech: { 
          status: AgentStatus.COMPLETED, 
          result: { stack: 'Toh Framework', schema: '', apiSpec: '', fullOutput: techSpec || '' } 
        }
      }));
    } catch (err) {
      handleApiError(err);
      setState(prev => ({ ...prev, tech: { ...prev.tech, status: AgentStatus.FAILED } }));
    }
  };

  const handleProceedToDev = async () => {
    setState(prev => ({ 
      ...prev, 
      currentStage: 4, 
      dev: { ...prev.dev, status: AgentStatus.THINKING } 
    }));

    try {
      const devOutput = await GeminiService.DevAgent(state.tech.result?.fullOutput || '');
      
      setState(prev => ({
        ...prev,
        dev: { 
          status: AgentStatus.COMPLETED, 
          result: { codeStructure: devOutput || '', instructions: '' } 
        }
      }));
    } catch (err) {
      handleApiError(err);
      setState(prev => ({ ...prev, dev: { ...prev.dev, status: AgentStatus.FAILED } }));
    }
  };

  const handleEvaluateMetrics = async () => {
    setState(prev => ({ 
      ...prev, 
      qa: { ...prev.qa, status: AgentStatus.THINKING } 
    }));

    try {
      const context = `PRD Summary: ${state.product.result?.prd.substring(0, 200)}...`;
      const result = await GeminiService.DecisionGateAgent(state.qa.metrics, context);
      
      setState(prev => ({
        ...prev,
        qa: { 
          ...prev.qa, 
          status: AgentStatus.COMPLETED, 
          result 
        }
      }));
    } catch (err) {
      handleApiError(err);
      setState(prev => ({ ...prev, qa: { ...prev.qa, status: AgentStatus.FAILED } }));
    }
  };

  const handleRestart = () => {
    if (window.confirm("Are you sure? This will clear current factory state.")) {
        setState(INITIAL_STATE);
        setApiKeyError(null);
    }
  };

  if (apiKeyError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-factory-bg text-white">
        <div className="bg-factory-card p-8 rounded-lg max-w-md text-center border border-factory-danger shadow-2xl">
          <AlertTriangle className="w-16 h-16 text-factory-danger mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-2">API Connection Failed</h1>
          <div className="bg-red-900/30 border border-red-500/30 p-3 rounded mb-4 inline-block">
             <span className="text-red-300 font-mono text-sm">{apiKeyError.type}</span>
          </div>
          <p className="text-factory-muted mb-6 text-lg">
            {apiKeyError.message}
          </p>
          
          <div className="text-left bg-black/40 p-4 rounded text-sm text-gray-400 mb-6 space-y-2">
            <p className="font-semibold text-gray-300">How to fix:</p>
            <ul className="list-disc list-inside space-y-1">
                {apiKeyError.type === 'MISSING' && <li>Ensure the <code>API_KEY</code> environment variable is set in your container configuration.</li>}
                {apiKeyError.type === 'INVALID' && <li>Check if your API Key is correct and has not been revoked.</li>}
                {apiKeyError.type === 'QUOTA' && <li>You have exceeded your Gemini API usage limits. Check your Google Cloud Console.</li>}
                <li>Restart the application after updating the key.</li>
            </ul>
          </div>

          <button 
            onClick={() => window.location.reload()}
            className="bg-factory-accent hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-lg transition flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" /> Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-factory-bg text-factory-text font-sans">
      
      {/* Sidebar / Status Rail */}
      <div className="w-80 border-r border-gray-800 bg-[#0b1120] flex flex-col hidden md:flex fixed h-full z-10">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-xl tracking-tight">SaaS Factory</h1>
          </div>
          <p className="text-xs text-factory-muted mt-2 font-mono">Vibe Coding Edition v1.0</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <SectionHeader 
                icon={Radar} 
                title="Idea Radar" 
                description="Market validation & scoring" 
                isActive={state.currentStage === 1}
                status={state.radar.status}
            />
             <SectionHeader 
                icon={Package} 
                title="Product Designer" 
                description="PRD & MVP Scope" 
                isActive={state.currentStage === 2}
                status={state.product.status}
            />
             <SectionHeader 
                icon={Cpu} 
                title="Tech Lead" 
                description="Architecture & Stack" 
                isActive={state.currentStage === 3}
                status={state.tech.status}
            />
             <SectionHeader 
                icon={Code} 
                title="Dev Agent" 
                description="Code Generation" 
                isActive={state.currentStage === 4}
                status={state.dev.status}
            />
             <SectionHeader 
                icon={Activity} 
                title="Decision Gate" 
                description="QA & Lifecycle" 
                isActive={state.currentStage >= 5}
                status={state.qa.status}
            />
        </div>

        <div className="p-4 border-t border-gray-800">
             <button onClick={handleRestart} className="w-full py-2 px-4 rounded border border-gray-700 hover:bg-gray-800 text-sm transition text-gray-400">
                New Factory Run
             </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 md:ml-80 p-6 md:p-12 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-8">
            
            {/* Stage 0: Input */}
            <div className={`transition-opacity duration-500 ${state.currentStage > 0 ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                <div className="bg-factory-card border border-gray-700 rounded-xl p-6 shadow-2xl">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <Terminal className="w-6 h-6 text-factory-accent" />
                            Initialize New SaaS
                        </h2>
                        <button 
                            onClick={handleAutoResearch}
                            disabled={isResearching}
                            className="text-sm bg-purple-900/50 hover:bg-purple-900/70 border border-purple-500/50 text-purple-200 px-4 py-2 rounded-full flex items-center gap-2 transition"
                        >
                            {isResearching ? (
                                <><Loader2 className="w-3 h-3 animate-spin" /> Researching Trends...</>
                            ) : (
                                <><Sparkles className="w-3 h-3" /> Auto-Generate from Trends</>
                            )}
                        </button>
                    </div>
                    
                    <div className="grid gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Project Name</label>
                            <input 
                                type="text" 
                                className="w-full bg-gray-900 border border-gray-700 rounded p-3 focus:border-factory-accent focus:outline-none"
                                placeholder="e.g. CatGroomer AI"
                                value={state.idea.name}
                                onChange={e => setState(p => ({...p, idea: {...p.idea, name: e.target.value}}))}
                                disabled={isResearching}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Target Audience</label>
                            <input 
                                type="text" 
                                className="w-full bg-gray-900 border border-gray-700 rounded p-3 focus:border-factory-accent focus:outline-none"
                                placeholder="e.g. Busy cat owners in cities"
                                value={state.idea.targetUser}
                                onChange={e => setState(p => ({...p, idea: {...p.idea, targetUser: e.target.value}}))}
                                disabled={isResearching}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Core Pain Point</label>
                            <input 
                                type="text" 
                                className="w-full bg-gray-900 border border-gray-700 rounded p-3 focus:border-factory-accent focus:outline-none"
                                placeholder="e.g. Cannot find available appointments last minute"
                                value={state.idea.painPoint}
                                onChange={e => setState(p => ({...p, idea: {...p.idea, painPoint: e.target.value}}))}
                                disabled={isResearching}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Description (Optional)</label>
                            <textarea 
                                className="w-full bg-gray-900 border border-gray-700 rounded p-3 focus:border-factory-accent focus:outline-none h-24"
                                placeholder="Describe the solution..."
                                value={state.idea.description}
                                onChange={e => setState(p => ({...p, idea: {...p.idea, description: e.target.value}}))}
                                disabled={isResearching}
                            />
                        </div>
                        <button 
                            onClick={handleIdeaSubmit}
                            disabled={!state.idea.name || !state.idea.targetUser || isResearching}
                            className="mt-4 bg-factory-accent hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Play className="w-4 h-4" /> Start Factory Agent
                        </button>
                    </div>
                </div>
            </div>

            {/* Stage 1: Radar Results */}
            {state.currentStage >= 1 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-factory-card border border-gray-700 rounded-xl p-6">
                        <div className="flex justify-between items-start mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-blue-400">
                                <Radar className="w-5 h-5" /> Idea Radar Analysis
                            </h2>
                            {state.radar.status === AgentStatus.THINKING && (
                                <span className="text-xs font-mono animate-pulse text-factory-accent">SCANNING MARKET...</span>
                            )}
                        </div>

                        {state.radar.result && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className={`text-4xl font-black ${state.radar.result.score >= 60 ? 'text-factory-success' : 'text-factory-danger'}`}>
                                        {state.radar.result.score}/100
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-sm font-bold ${state.radar.result.decision === 'PROCEED' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                                        {state.radar.result.decision}
                                    </div>
                                </div>
                                <p className="text-gray-300 bg-black/20 p-4 rounded border-l-2 border-gray-600">
                                    {state.radar.result.reasoning}
                                </p>

                                {state.currentStage === 1 && state.radar.result.decision === 'PROCEED' && (
                                    <button 
                                        onClick={handleProceedToProduct}
                                        className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white py-3 rounded flex items-center justify-center gap-2 transition"
                                    >
                                        Generate PRD & MVP Scope <ChevronRight className="w-4 h-4" />
                                    </button>
                                )}
                                 {state.currentStage === 1 && state.radar.result.decision === 'KILL' && (
                                    <div className="text-center p-4 bg-red-900/20 text-red-400 rounded">
                                        Agent recommends killing this idea. Try restarting with a new concept.
                                    </div>
                                )}
                            </div>
                        )}
                        {state.radar.status === AgentStatus.FAILED && (
                           <div className="text-red-400 p-4 bg-red-900/20 rounded">
                              Validation Failed. The analysis engine encountered an error. Please try again or refine your input.
                           </div>
                        )}
                    </div>
                </div>
            )}

            {/* Stage 2: Product Designer */}
            {state.currentStage >= 2 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-factory-card border border-gray-700 rounded-xl p-6">
                        <h2 className="text-xl font-bold flex items-center gap-2 text-purple-400 mb-4">
                            <Package className="w-5 h-5" /> Product Agent Output
                        </h2>
                        
                        {state.product.status === AgentStatus.THINKING && (
                             <div className="p-8 text-center text-gray-500 animate-pulse">Drafting PRD and defining MVP scope...</div>
                        )}

                        {state.product.result && (
                            <div className="space-y-4">
                                <MarkdownBlock content={state.product.result.prd} label="Core PRD" />
                                
                                {/* New Product Actions Bar */}
                                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-800">
                                  <button
                                    onClick={handleOptimizeProduct}
                                    disabled={loadingOptimization || !!state.product.result.optimizations}
                                    className="px-3 py-1.5 bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-500/30 rounded text-xs text-indigo-200 flex items-center gap-2 disabled:opacity-50"
                                  >
                                    {loadingOptimization ? <Loader2 className="w-3 h-3 animate-spin"/> : <Maximize2 className="w-3 h-3"/>}
                                    {state.product.result.optimizations ? 'Optimized' : 'Review & Optimize'}
                                  </button>
                                  
                                  <button
                                    onClick={handleGenerateUserFlow}
                                    disabled={loadingUserFlow || !!state.product.result.userFlow}
                                    className="px-3 py-1.5 bg-pink-900/30 hover:bg-pink-900/50 border border-pink-500/30 rounded text-xs text-pink-200 flex items-center gap-2 disabled:opacity-50"
                                  >
                                    {loadingUserFlow ? <Loader2 className="w-3 h-3 animate-spin"/> : <GitGraph className="w-3 h-3"/>}
                                    {state.product.result.userFlow ? 'Flow Generated' : 'Visual User Flow'}
                                  </button>

                                  <button
                                    onClick={handleGenerateTechSpec}
                                    disabled={loadingTechSpec || !!state.product.result.techSpec}
                                    className="px-3 py-1.5 bg-teal-900/30 hover:bg-teal-900/50 border border-teal-500/30 rounded text-xs text-teal-200 flex items-center gap-2 disabled:opacity-50"
                                  >
                                    {loadingTechSpec ? <Loader2 className="w-3 h-3 animate-spin"/> : <FileText className="w-3 h-3"/>}
                                    {state.product.result.techSpec ? 'Spec Ready' : 'Generate Tech Spec'}
                                  </button>
                                </div>

                                {/* Results of new actions */}
                                {state.product.result.optimizations && (
                                  <div className="animate-in fade-in slide-in-from-top-2">
                                     <MarkdownBlock content={state.product.result.optimizations} label="MVP Optimization Suggestions" />
                                  </div>
                                )}
                                {state.product.result.userFlow && (
                                  <div className="animate-in fade-in slide-in-from-top-2">
                                     <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 ml-1">User Flow (Visual)</div>
                                     <MermaidDiagram chart={state.product.result.userFlow} />
                                  </div>
                                )}
                                {state.product.result.techSpec && (
                                  <div className="animate-in fade-in slide-in-from-top-2">
                                     <MarkdownBlock content={state.product.result.techSpec} label="Detailed Technical Spec" />
                                  </div>
                                )}

                                {state.currentStage === 2 && (
                                    <button 
                                        onClick={handleProceedToTech}
                                        className="w-full bg-purple-900/50 hover:bg-purple-900/70 border border-purple-700 text-purple-100 py-3 rounded flex items-center justify-center gap-2 transition mt-4"
                                    >
                                        Approve & Design Architecture <ChevronRight className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Stage 3: Tech Lead */}
            {state.currentStage >= 3 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-factory-card border border-gray-700 rounded-xl p-6">
                        <h2 className="text-xl font-bold flex items-center gap-2 text-orange-400 mb-4">
                            <Cpu className="w-5 h-5" /> Tech Lead Architecture
                        </h2>

                        {state.tech.status === AgentStatus.THINKING && (
                             <div className="p-8 text-center text-gray-500 animate-pulse">Designing Schema and API spec (Toh Framework)...</div>
                        )}

                        {state.tech.result && (
                            <div className="space-y-4">
                                {state.tech.result.fullOutput.toLowerCase().includes('stripe') && (
                                    <div className="flex items-center gap-2 bg-indigo-900/30 text-indigo-200 px-4 py-2 rounded-lg border border-indigo-500/30">
                                        <CreditCard className="w-5 h-5" />
                                        <span className="font-semibold text-sm">Stripe Payment Integration Detected</span>
                                    </div>
                                )}
                                <MarkdownBlock content={state.tech.result.fullOutput} />
                                {state.currentStage === 3 && (
                                    <button 
                                        onClick={handleProceedToDev}
                                        className="w-full bg-orange-900/50 hover:bg-orange-900/70 border border-orange-700 text-orange-100 py-3 rounded flex items-center justify-center gap-2 transition mt-4"
                                    >
                                        Generate Boilerplate Code <ChevronRight className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

             {/* Stage 4: Dev Agent */}
             {state.currentStage >= 4 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-factory-card border border-gray-700 rounded-xl p-6">
                        <h2 className="text-xl font-bold flex items-center gap-2 text-green-400 mb-4">
                            <Code className="w-5 h-5" /> Dev Agent Output
                        </h2>

                        {state.dev.status === AgentStatus.THINKING && (
                             <div className="p-8 text-center text-gray-500 animate-pulse">Generating file structure and README...</div>
                        )}

                        {state.dev.result && (
                            <div className="space-y-4">
                                <MarkdownBlock content={state.dev.result.codeStructure} />
                                <div className="bg-green-900/20 p-4 rounded text-center text-green-300 text-sm border border-green-900">
                                    <CheckCircle className="w-4 h-4 inline mr-2" />
                                    Repo scaffolded. Ready for deployment.
                                </div>
                                {state.currentStage === 4 && (
                                    <div className="grid grid-cols-2 gap-4 mt-4">
                                         <button 
                                            onClick={() => setState(p => ({...p, currentStage: 5}))}
                                            className="col-span-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 py-2 rounded text-sm"
                                        >
                                            Simulate Launch & Collect Metrics
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Stage 5: Decision Gate */}
             {state.currentStage >= 5 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
                    <div className="bg-factory-card border border-gray-700 rounded-xl p-6 border-t-4 border-t-yellow-500">
                        <h2 className="text-xl font-bold flex items-center gap-2 text-yellow-500 mb-4">
                            <Activity className="w-5 h-5" /> Decision Gate
                        </h2>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="text-xs text-gray-500">Active Users</label>
                                <input type="number" 
                                    value={state.qa.metrics.users}
                                    onChange={e => setState(p => ({...p, qa: {...p.qa, metrics: {...p.qa.metrics, users: parseInt(e.target.value)}}}))}
                                    className="w-full bg-gray-900 border border-gray-700 p-2 rounded text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">Revenue (MRR)</label>
                                <input type="text" 
                                    value={state.qa.metrics.revenue}
                                    onChange={e => setState(p => ({...p, qa: {...p.qa, metrics: {...p.qa.metrics, revenue: e.target.value}}}))}
                                    className="w-full bg-gray-900 border border-gray-700 p-2 rounded text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">Retention Rate</label>
                                <input type="text" 
                                    value={state.qa.metrics.retention}
                                    onChange={e => setState(p => ({...p, qa: {...p.qa, metrics: {...p.qa.metrics, retention: e.target.value}}}))}
                                    className="w-full bg-gray-900 border border-gray-700 p-2 rounded text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">User Feedback Summary</label>
                                <input type="text" 
                                    value={state.qa.metrics.feedback}
                                    onChange={e => setState(p => ({...p, qa: {...p.qa, metrics: {...p.qa.metrics, feedback: e.target.value}}}))}
                                    className="w-full bg-gray-900 border border-gray-700 p-2 rounded text-sm"
                                />
                            </div>
                        </div>

                        {state.qa.status === AgentStatus.IDLE || state.qa.status === AgentStatus.COMPLETED ? (
                            <button 
                                onClick={handleEvaluateMetrics}
                                className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-2 rounded"
                            >
                                Analyze & Decide
                            </button>
                        ) : (
                             <div className="text-center text-yellow-500 animate-pulse">Analyzing metrics...</div>
                        )}

                        {state.qa.result && (
                            <div className="mt-6 p-6 bg-black/40 rounded border border-yellow-500/30 text-center">
                                <div className="text-sm text-gray-400 mb-2">FINAL DECISION</div>
                                <div className="text-4xl font-black text-white mb-4">{state.qa.result.decision}</div>
                                <p className="text-gray-300 max-w-lg mx-auto">{state.qa.result.analysis}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
}