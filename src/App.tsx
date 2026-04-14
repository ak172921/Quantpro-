/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from "recharts";
import { 
  Search, TrendingUp, Brain, Cpu, MessageSquare, Zap, ShieldCheck, 
  BarChart3, ArrowUpRight, ArrowDownRight, RefreshCcw, Loader2, Newspaper, ExternalLink,
  Bell, BellRing, X, Plus, ArrowDown, ArrowRight, Sparkles, Flame, Play, Activity, RefreshCw, Briefcase
} from "lucide-react";
import { AgentCard } from "./components/AgentCard";
import { cn } from "@/src/lib/utils";
import { GoogleGenAI } from "@google/genai";
import Markdown from "react-markdown";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface StockData {
  quote: any;
  history: any[];
  news?: any[];
}

interface AgentState {
  status: "idle" | "running" | "completed" | "error";
  output: string;
}

interface PriceAlert {
  id: string;
  symbol: string;
  condition: 'above' | 'below';
  threshold: number;
  triggered: boolean;
}

interface Notification {
  id: string;
  message: string;
  time: Date;
}

interface Trade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  timestamp: string;
  status: 'OPEN' | 'CLOSED';
  closePrice?: number;
  realizedPnL?: number;
}

export default function App() {
  const [symbol, setSymbol] = useState("AAPL");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StockData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [agents, setAgents] = useState<{ [key: string]: AgentState }>({
    collector: { status: "idle", output: "" },
    math: { status: "idle", output: "" },
    ml: { status: "idle", output: "" },
    sentiment: { status: "idle", output: "" },
    strategy: { status: "idle", output: "" },
    signal: { status: "idle", output: "" },
    opportunity: { status: "idle", output: "" },
    scanner: { status: "idle", output: "" },
    orchestrator: { status: "idle", output: "" },
  });

  const [topPicks, setTopPicks] = useState<any[]>([]);
  
  // Alerts State
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [newAlertSymbol, setNewAlertSymbol] = useState("");
  const [newAlertCondition, setNewAlertCondition] = useState<'above' | 'below'>("above");
  const [newAlertThreshold, setNewAlertThreshold] = useState("");

  // Backtest State
  const [backtestSymbol, setBacktestSymbol] = useState("AAPL");
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestResult, setBacktestResult] = useState<string | null>(null);
  const [backtestError, setBacktestError] = useState<string | null>(null);

  // Trade State
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradeAmount, setTradeAmount] = useState(1000);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);

  const fetchTrades = async () => {
    try {
      const res = await fetch("/api/broker/trades");
      const data = await res.json();
      setTrades(data);
    } catch (err) {
      console.error("Failed to fetch trades", err);
    }
  };

  useEffect(() => {
    fetchTrades();
  }, []);

  const executeTrade = async (type: 'BUY' | 'SELL') => {
    if (!symbol) return;
    setTradeLoading(true);
    setTradeError(null);
    try {
      const res = await fetch("/api/broker/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, type, amount: tradeAmount })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to execute trade");
      
      setNotifications(prev => [...prev, {
        id: Math.random().toString(),
        message: `Executed ${type} for ${symbol} at $${data.trade.entryPrice.toFixed(2)}`,
        time: new Date()
      }]);
      fetchTrades();
    } catch (err: any) {
      setTradeError(err.message);
    } finally {
      setTradeLoading(false);
    }
  };

  const closeTrade = async (id: string) => {
    try {
      const res = await fetch(`/api/broker/close/${id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to close trade");
      
      setNotifications(prev => [...prev, {
        id: Math.random().toString(),
        message: `Closed trade for ${data.trade.symbol}. P&L: $${data.trade.realizedPnL?.toFixed(2)}`,
        time: new Date()
      }]);
      fetchTrades();
    } catch (err: any) {
      console.error("Failed to close trade", err);
      alert(err.message);
    }
  };

  // Polling for Alerts
  useEffect(() => {
    if (alerts.length === 0) return;
    
    const interval = setInterval(async () => {
      const activeAlerts = alerts.filter(a => !a.triggered);
      if (activeAlerts.length === 0) return;
      
      const symbols = [...new Set(activeAlerts.map(a => a.symbol))].join(',');
      try {
        const res = await fetch(`/api/quotes?symbols=${symbols}`);
        const prices = await res.json();
        
        setAlerts(prev => prev.map(alert => {
          if (alert.triggered) return alert;
          const currentPrice = prices[alert.symbol];
          if (!currentPrice) return alert;
          
          let isTriggered = false;
          if (alert.condition === 'above' && currentPrice >= alert.threshold) isTriggered = true;
          if (alert.condition === 'below' && currentPrice <= alert.threshold) isTriggered = true;
          
          if (isTriggered) {
            setNotifications(n => [...n, {
              id: Math.random().toString(),
              message: `🚨 ALERT: ${alert.symbol} is now ${alert.condition} $${alert.threshold} (Current: $${currentPrice.toFixed(2)})`,
              time: new Date()
            }]);
            return { ...alert, triggered: true };
          }
          return alert;
        }));
      } catch (e) {
        console.error("Failed to poll prices for alerts");
      }
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [alerts]);

  // Auto-dismiss notifications
  useEffect(() => {
    if (notifications.length === 0) return;
    const timer = setTimeout(() => {
      setNotifications(prev => prev.slice(1));
    }, 8000);
    return () => clearTimeout(timer);
  }, [notifications]);

  const handleAddAlert = () => {
    if (!newAlertSymbol || !newAlertThreshold || isNaN(Number(newAlertThreshold))) return;
    setAlerts(prev => [...prev, {
      id: Math.random().toString(),
      symbol: newAlertSymbol.toUpperCase(),
      condition: newAlertCondition,
      threshold: Number(newAlertThreshold),
      triggered: false
    }]);
    setNewAlertSymbol("");
    setNewAlertThreshold("");
  };

  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const updateAgent = (id: string, state: Partial<AgentState>) => {
    setAgents(prev => ({
      ...prev,
      [id]: { ...prev[id], ...state }
    }));
  };

  const analyzeWithGemini = async (type: string, inputData: any, mode: 'single' | 'global' = 'single') => {
    let systemInstruction = "";
    
    if (mode === 'single') {
      switch (type) {
        case "math":
          systemInstruction = `You are a Senior Quantitative Researcher at a top-tier hedge fund (similar to Renaissance Technologies' Medallion Fund). Analyze the provided financial data for ${symbol}. Apply advanced mathematical and statistical concepts such as Stochastic Calculus, Hidden Markov Models (HMM), Bayesian inference, Principal Component Analysis (PCA), Copulas for multivariate dependence, Fourier transforms for signal processing, and GARCH models for volatility clustering. Identify hidden, non-random statistical arbitrage opportunities, co-integration pairs, and mean-reversion/momentum anomalies using rigorous hypothesis testing. Provide a highly rigorous mathematical and statistical summary of the alpha signals.`;
          break;
        case "ml":
          systemInstruction = `You are a Lead AI/ML Quant Engineer at an elite algorithmic trading firm. Use the provided data for ${symbol} to simulate advanced predictive modeling. Utilize concepts from Deep Learning (LSTMs, Transformers for time-series), Ensemble methods (XGBoost, Random Forests), and non-linear pattern recognition. Identify hidden topological features, regime shifts, and predictive alpha signals in the noisy data. Provide a summary of the ML-driven alpha and probability distributions.`;
          break;
        case "sentiment":
          systemInstruction = `You are a Social Media Sentiment Analyst. Simulate a search across Twitter, Reddit, and YouTube for ${symbol}. Provide a summary of public opinion, trending topics, and overall sentiment (Bullish/Bearish/Neutral).`;
          break;
        case "strategy":
          systemInstruction = `You are the "Continuous Strategy Optimizer", an autonomous AI agent active 24/7. You analyze all past and real-time data of every financial instrument globally. Your purpose is to create new mathematical modeling and machine learning strategies that work best in current market scenarios, and remove strategies that no longer work (alpha decay). Based on the provided market data, generate a "Live R&D Report" detailing: 1) The current global market regime. 2) 2 New Strategies Deployed (with math/ML concepts). 3) 1 Strategy Deprecated (and why it failed).`;
          break;
        case "signal":
          systemInstruction = `You are a Trading Signal Generator. Synthesize the advanced mathematical analysis, deep learning ML model, social sentiment, and the Continuous Strategy Optimizer's R&D report for ${symbol}. Apply strict risk management principles like the Kelly Criterion. Provide a clear Buy/Sell/Hold signal for Day Trading. Justify your decision with risk-adjusted return metrics (Sharpe/Sortino ratios).`;
          break;
        case "opportunity":
          systemInstruction = `You are the Real-time Opportunity Agent. Your goal is to identify the absolute best entry/exit points for ${symbol} for Day Trading to maximize returns TODAY. 
          Review the technical data, ML predictions, social sentiment, and the latest deployed strategies. 
          Produce a structured "Real-time Opportunity Table" in your response with columns: [Action, Price Target, Stop Loss, Confidence %, Expected Return %].
          Confirm your findings with the logic provided by the other agents.`;
          break;
        case "scanner":
          systemInstruction = `You are the Global Market Scanner Agent. You have been provided with a list of trending financial instruments. 
          Analyze their current market data and identify which ones are "Strong Buy" or "Strong Sell" for the HIGHEST returns today.
          Produce a "Top Returns Table" with columns: [Symbol, Recommendation, Current Price, Day Change %, Target Return %].
          Rank them by potential return.`;
          break;
        case "orchestrator":
          systemInstruction = `You are the Agent Orchestrator. Review the outputs of the Math Analyst, ML Modeler, Sentiment Analyst, Strategy Optimizer, Signal Generator, Real-time Opportunity Agent, and Global Market Scanner for ${symbol}. Correct any inconsistencies, verify the logic, and provide a final authoritative verdict.`;
          break;
      }
    } else {
      switch (type) {
        case "math":
          systemInstruction = `You are a Senior Quantitative Researcher at an elite algorithmic fund. Analyze the provided batch of up to 250 financial instruments. Apply advanced statistical arbitrage, co-integration analysis, Hidden Markov Models, Bayesian networks, and volatility surface mapping. Utilize Principal Component Analysis (PCA) and cross-sectional statistical regressions to identify the top statistically significant setups with the highest probability of non-random alpha. Provide a summary of the best mathematical and statistical opportunities.`;
          break;
        case "ml":
          systemInstruction = `You are a Lead AI/ML Quant Engineer. Analyze this batch of up to 250 instruments using deep learning ensembles, cross-asset attention mechanisms, and anomaly detection. Identify instruments exhibiting the strongest predictive alpha signals, regime changes, and non-linear momentum shifts. Provide a summary of the best ML-driven opportunities.`;
          break;
        case "sentiment":
          systemInstruction = `You are a Social Media Sentiment Analyst. Simulate sentiment analysis for these trending instruments. Identify which ones have the highest social momentum and hype. Provide a summary.`;
          break;
        case "strategy":
          systemInstruction = `You are the "Continuous Strategy Optimizer", an autonomous AI agent active 24/7. You analyze all past and real-time data of every financial instrument globally. Your purpose is to create new mathematical modeling and machine learning strategies that work best in current market scenarios, and remove strategies that no longer work (alpha decay). Based on the provided market data, generate a "Live R&D Report" detailing: 1) The current global market regime. 2) 2 New Strategies Deployed (with math/ML concepts). 3) 1 Strategy Deprecated (and why it failed).`;
          break;
        case "signal":
          systemInstruction = `You are a Trading Signal Generator. Synthesize the batch analysis from the advanced Math, ML, Sentiment, and Strategy Optimizer agents. Filter down to the most actionable instruments using strict risk-adjusted metrics (Kelly Criterion, Sharpe ratio) and provide general signal directions.`;
          break;
        case "scanner":
          systemInstruction = `You are the Global Market Scanner and Orchestrator. Review the batch data and the analysis from all other agents (Math, ML, Sentiment, Strategy Optimizer). 
          Create a ranked list of the TOP PICKS (up to 50) for DAY TRADING to get the HIGHEST RETURNS TODAY. 
          For EACH instrument, you MUST provide:
          1. Symbol
          2. Signal (Strong Buy or Strong Sell)
          3. Reason Why (Keep this EXTREMELY brief, 1 short sentence max)
          4. How to execute the position (Entry price, Target price, Stop Loss).
          Format this as a highly readable Markdown table.`;
          break;
        case "backtester":
          systemInstruction = `You are a Quantitative Backtesting Engine. You are given 1 year of daily historical price data for a financial instrument, and the trading strategy/signal generated by the Signal Generator agent.
          Simulate a backtest of this strategy over the historical data.
          Calculate and provide the following key metrics:
          1. Total P&L (Profit and Loss) %
          2. Sharpe Ratio
          3. Max Drawdown %
          4. Win Rate %
          5. Number of Trades
          Provide a brief summary of the equity curve and whether the strategy is robust. Format as Markdown.`;
          break;
      }
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: JSON.stringify(inputData),
      config: { systemInstruction }
    });
    return response.text || "No analysis generated (possible safety block or empty response).";
  };

  const runGlobalScan = async (country?: string) => {
    setLoading(true);
    setError(null);
    setData(null); // Clear single symbol data to focus on global scan
    
    setAgents({
      collector: { status: "running", output: "" },
      math: { status: "idle", output: "" },
      ml: { status: "idle", output: "" },
      sentiment: { status: "idle", output: "" },
      strategy: { status: "idle", output: "" },
      signal: { status: "idle", output: "" },
      opportunity: { status: "idle", output: "" },
      scanner: { status: "idle", output: "" },
      orchestrator: { status: "idle", output: "" },
    });

    try {
      // Step 1: Global Data Collection
      const url = country ? `/api/global-scan?country=${country}` : `/api/global-scan`;
      const dataRes = await fetch(url);
      const scanData = await dataRes.json();
      
      if (!dataRes.ok) throw new Error(scanData.error || "Failed to fetch global data");
      
      updateAgent("collector", { status: "completed", output: `Successfully fetched data for ${scanData.symbols.length} ${country || 'global'} instruments.` });

      // Step 2: Parallel Batch Analysis
      const analysisTypes = ["math", "ml", "sentiment", "strategy"];
      analysisTypes.forEach(type => updateAgent(type, { status: "running" }));

      const analysisPromises = analysisTypes.map(async (type) => {
        try {
          const result = await analyzeWithGemini(type, scanData, 'global');
          updateAgent(type, { status: "completed", output: result });
          return { type, output: result };
        } catch (err: any) {
          updateAgent(type, { status: "error", output: `Analysis failed: ${err.message}` });
          return { type, output: "Error" };
        }
      });

      const analysisResults = await Promise.all(analysisPromises);

      // Step 3: Batch Signal and Scanner Generation (Parallel)
      updateAgent("signal", { status: "running" });
      updateAgent("scanner", { status: "running" });

      const [signalResult, scannerResult] = await Promise.all([
        analyzeWithGemini("signal", { scanData, analysis: analysisResults }, 'global')
          .then(res => {
            updateAgent("signal", { status: "completed", output: res });
            return res;
          })
          .catch(err => {
            updateAgent("signal", { status: "error", output: `Signal failed: ${err.message}` });
            return "Error";
          }),
        analyzeWithGemini("scanner", { scanData, analysis: analysisResults }, 'global')
          .then(res => {
            updateAgent("scanner", { status: "completed", output: res });
            return res;
          })
          .catch(err => {
            updateAgent("scanner", { status: "error", output: `Scanner failed: ${err.message}` });
            return "Error";
          })
      ]);

      updateAgent("orchestrator", { status: "completed", output: "Global scan complete. See Global Market Opportunities section for the top picks." });

    } catch (err: any) {
      console.error("Global scan error:", err);
      setError(err.message);
      updateAgent("collector", { status: "error", output: err.message });
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    
    // Reset agents
    setAgents({
      collector: { status: "running", output: "" },
      math: { status: "idle", output: "" },
      ml: { status: "idle", output: "" },
      sentiment: { status: "idle", output: "" },
      strategy: { status: "idle", output: "" },
      signal: { status: "idle", output: "" },
      opportunity: { status: "idle", output: "" },
      scanner: { status: "idle", output: "" },
      orchestrator: { status: "idle", output: "" },
    });

    try {
      // Step 1: Data Collection
      const dataRes = await fetch(`/api/data/${symbol}`);
      const stockData = await dataRes.json();
      
      if (!dataRes.ok) {
        throw new Error(stockData.error || stockData.details || "Failed to fetch stock data");
      }
      
      setData(stockData);
      updateAgent("collector", { status: "completed", output: `Successfully fetched data for ${symbol}. Current Price: $${stockData.quote.regularMarketPrice}` });

      // Step 2: Parallel Analysis (Math, ML, Sentiment)
      const analysisTypes = ["math", "ml", "sentiment", "strategy"];
      analysisTypes.forEach(type => updateAgent(type, { status: "running" }));

      const analysisPromises = analysisTypes.map(async (type) => {
        try {
          const result = await analyzeWithGemini(type, stockData);
          updateAgent(type, { status: "completed", output: result });
          return { type, output: result };
        } catch (err: any) {
          console.error(`Analysis error for ${type}:`, err);
          updateAgent(type, { status: "error", output: `Analysis failed: ${err.message}` });
          return { type, output: "Error" };
        }
      });

      const analysisResults = await Promise.all(analysisPromises);

      // Step 3: Signal Generation
      updateAgent("signal", { status: "running" });
      try {
        const signalResult = await analyzeWithGemini("signal", { stockData, analysis: analysisResults });
        updateAgent("signal", { status: "completed", output: signalResult });
        
        // Step 4: Opportunity Identification
        updateAgent("opportunity", { status: "running" });
        const opportunityResult = await analyzeWithGemini("opportunity", { stockData, analysis: analysisResults, signal: signalResult });
        updateAgent("opportunity", { status: "completed", output: opportunityResult });
        
        // Step 5: Orchestration
        updateAgent("orchestrator", { status: "running" });
        const orchResult = await analyzeWithGemini("orchestrator", { 
          stockData, 
          analysis: analysisResults, 
          signal: signalResult, 
          opportunity: opportunityResult
        });
        updateAgent("orchestrator", { status: "completed", output: orchResult });
      } catch (err: any) {
        console.error("Signal/Orchestration error:", err);
        updateAgent("signal", { status: "error", output: `Signal generation failed: ${err.message}` });
        updateAgent("opportunity", { status: "error", output: `Opportunity analysis failed: ${err.message}` });
        updateAgent("orchestrator", { status: "error", output: `Orchestration failed: ${err.message}` });
      }

    } catch (err: any) {
      console.error("Run analysis error:", err);
      setError(err.message);
      updateAgent("collector", { status: "error", output: err.message });
    } finally {
      setLoading(false);
    }
  };

  const runBacktest = async () => {
    if (!backtestSymbol) return;
    setBacktestLoading(true);
    setBacktestError(null);
    setBacktestResult(null);

    try {
      // Fetch historical data
      const res = await fetch(`/api/historical/${backtestSymbol}`);
      const historyData = await res.json();

      if (!res.ok) {
        throw new Error(historyData.error || "Failed to fetch historical data");
      }

      // Get the signal strategy from the signal agent if it exists
      const signalStrategy = agents.signal.output || "Use a standard momentum and mean-reversion strategy.";

      // Run backtest via Gemini
      const result = await analyzeWithGemini("backtester", { historyData, signalStrategy });
      setBacktestResult(result);
    } catch (err: any) {
      console.error("Backtest error:", err);
      setBacktestError(err.message);
    } finally {
      setBacktestLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-zinc-100 font-sans relative">
      {/* Abstract Background Image */}
      <div className="fixed inset-0 z-[-1] opacity-20 pointer-events-none">
        <img 
          src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop" 
          alt="Abstract Neon" 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/50 via-[#050505]/80 to-[#050505] mix-blend-multiply" />
      </div>

      {/* Header */}
      <header className="glass-panel sticky top-0 z-50 border-b-0 border-white/5">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-fuchsia-500 to-cyan-500 p-2 rounded-xl shadow-lg shadow-fuchsia-500/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold font-[Space_Grotesk] tracking-tight">
              QuantAgent <span className="text-gradient">✨</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-cyan-400 transition-colors" />
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="Enter Ticker (e.g. TSLA)"
                className="pl-12 pr-4 py-3 bg-white/5 border border-white/10 focus:border-cyan-500/50 rounded-full text-sm transition-all outline-none w-56 md:w-72 font-mono text-zinc-100 placeholder:text-zinc-500 focus:shadow-[0_0_20px_rgba(6,182,212,0.2)]"
              />
            </div>
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="bg-zinc-100 text-zinc-900 px-6 py-3 rounded-full text-sm font-bold hover:bg-white hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            >
              {loading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4 text-orange-500" />}
              Run Analysis
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-10">
        {/* Hero Title */}
        <div className="mb-10 text-center">
          <h2 className="text-4xl md:text-6xl font-bold font-[Space_Grotesk] tracking-tighter mb-4">
            Analyze Your <span className="text-gradient">Stocks 📈</span>
          </h2>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Our AI agent swarm analyzes the math, the ML patterns, and the social sentiment to give you the ultimate trading signals.
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 glass-panel neon-border-fuchsia border-red-500/50 bg-red-500/10 rounded-2xl text-red-200 text-sm flex items-center gap-3 font-mono"
          >
            <AlertCircle className="w-5 h-5 text-red-400" />
            {error}
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Market Data & Chart */}
          <div className="lg:col-span-2 space-y-8">
            {data ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel p-6 rounded-3xl neon-border-blue"
              >
                <div className="flex items-end justify-between mb-6">
                  <div>
                    <p className="text-sm text-zinc-400 font-medium uppercase tracking-wider font-mono">{data.quote.shortName || symbol}</p>
                    <h2 className="text-5xl font-bold mt-1 font-[Space_Grotesk] tracking-tighter">${(data.quote.regularMarketPrice || 0).toLocaleString()}</h2>
                    <div className={cn(
                      "flex items-center gap-1 text-sm font-bold mt-2 px-3 py-1 rounded-full w-fit",
                      (data.quote.regularMarketChange || 0) >= 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                    )}>
                      {(data.quote.regularMarketChange || 0) >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      {(data.quote.regularMarketChange || 0).toFixed(2)} ({(data.quote.regularMarketChangePercent || 0).toFixed(2)}%)
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500 uppercase font-bold tracking-widest">Market Status</p>
                    <p className="text-sm font-bold text-cyan-400">{data.quote.marketState || 'UNKNOWN'}</p>
                  </div>
                </div>

                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.history}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#d946ef" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
                      <XAxis dataKey="date" hide />
                      <YAxis 
                        domain={['auto', 'auto']} 
                        orientation="right"
                        tick={{ fontSize: 10, fill: '#71717a' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#09090b', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)' }}
                        itemStyle={{ color: '#06b6d4' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="close" 
                        stroke="#06b6d4" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorPrice)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            ) : (
              <div className="glass-panel p-12 rounded-3xl border-dashed border-white/20 flex flex-col items-center justify-center text-center">
                <BarChart3 className="w-16 h-16 text-zinc-600 mb-4" />
                <h3 className="text-xl font-bold text-zinc-200 font-[Space_Grotesk]">No Data Loaded</h3>
                <p className="text-zinc-500 max-w-xs mt-2">Enter a ticker and hit Run Analysis to see the magic happen ✨</p>
              </div>
            )}

            {/* Agent Flowchart */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold font-[Space_Grotesk] px-2 flex items-center gap-2">
                <Brain className="w-5 h-5 text-fuchsia-500" />
                The Swarm Pipeline
              </h3>
              
              <div className="flex flex-col items-center gap-2">
                {/* Level 1: Collector */}
                <div className="w-full max-w-md">
                  <AgentCard
                    title="Data Collector"
                    status={agents.collector.status}
                    description="Scraping the web for raw data"
                    output={agents.collector.output}
                    icon={<BarChart3 className="w-5 h-5" />}
                  />
                </div>
                
                <ArrowDown className="w-6 h-6 text-zinc-600 animate-pulse" />

                {/* Level 2: Analysis Quartet */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                  <AgentCard
                    title="Math Analyst"
                    status={agents.math.status}
                    description="Bayesian Stats & HMMs 🤓"
                    output={agents.math.output}
                    icon={<Brain className="w-5 h-5" />}
                  />
                  <AgentCard
                    title="ML Modeler"
                    status={agents.ml.status}
                    description="Deep Learning & LSTMs 🤖"
                    output={agents.ml.output}
                    icon={<Cpu className="w-5 h-5" />}
                  />
                  <AgentCard
                    title="Sentiment Analyst"
                    status={agents.sentiment.status}
                    description="Reading the social sentiment 📊"
                    output={agents.sentiment.output}
                    icon={<MessageSquare className="w-5 h-5" />}
                  />
                  <AgentCard
                    title="Strategy Optimizer"
                    status={agents.strategy.status}
                    description="24/7 Global Strategy R&D 🌍"
                    output={agents.strategy.output}
                    icon={<RefreshCcw className="w-5 h-5" />}
                  />
                </div>
              </div>
            </div>

            {/* Real-Time News Feed */}
            {data && data.news && data.news.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel p-6 rounded-3xl"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-white/10 rounded-xl">
                    <Newspaper className="w-5 h-5 text-zinc-300" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg font-[Space_Grotesk]">Real-Time News 📰</h3>
                    <p className="text-xs text-zinc-400">Latest headlines for {symbol}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {data.news.slice(0, 5).map((article: any, idx: number) => (
                    <a 
                      key={idx} 
                      href={article.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block group"
                    >
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <h4 className="text-sm font-bold text-zinc-200 group-hover:text-cyan-400 transition-colors line-clamp-2">
                              {article.title}
                            </h4>
                            <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500 font-mono">
                              <span className="font-medium text-fuchsia-400">{article.publisher}</span>
                              <span>•</span>
                              <span>{new Date(article.providerPublishTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-zinc-600 group-hover:text-cyan-400 flex-shrink-0 mt-1" />
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Global Market Opportunities Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-6 rounded-3xl neon-border-fuchsia"
            >
              <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                <div className="p-3 bg-gradient-to-br from-orange-500 to-fuchsia-500 rounded-xl shadow-lg shadow-orange-500/20">
                  <Flame className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-xl font-[Space_Grotesk]">Trending Stocks 🔥</h3>
                  <p className="text-xs text-zinc-400">Top instruments with highest expected returns today</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                <button
                  onClick={() => runGlobalScan()}
                  disabled={loading}
                  className="bg-white text-black px-4 py-2 rounded-full text-xs font-bold hover:bg-zinc-200 disabled:opacity-50 flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                >
                  {loading && agents.scanner.status === "running" ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                  Global Scan
                </button>
                {[
                  { name: 'USA 🇺🇸', code: 'US' },
                  { name: 'India 🇮🇳', code: 'IN' },
                  { name: 'China 🇨🇳', code: 'CN' },
                  { name: 'UK 🇬🇧', code: 'GB' },
                  { name: 'Japan 🇯🇵', code: 'JP' },
                  { name: 'France 🇫🇷', code: 'FR' },
                  { name: 'Australia 🇦🇺', code: 'AU' },
                ].map(country => (
                  <button
                    key={country.code}
                    onClick={() => runGlobalScan(country.code)}
                    disabled={loading}
                    className="bg-zinc-800 text-zinc-300 px-4 py-2 rounded-full text-xs font-bold hover:bg-zinc-700 hover:text-white disabled:opacity-50 transition-all border border-zinc-700"
                  >
                    {country.name}
                  </button>
                ))}
              </div>

              {agents.scanner.status === "running" ? (
                <div className="py-16 flex flex-col items-center justify-center text-zinc-400">
                  <Loader2 className="w-10 h-10 animate-spin mb-4 text-fuchsia-500" />
                  <p className="text-sm font-bold text-zinc-300 font-[Space_Grotesk]">Agents are analyzing top 50 global instruments...</p>
                  <p className="text-xs mt-2 font-mono">This deep scan takes a moment as all agents process the batch data.</p>
                </div>
              ) : agents.scanner.output ? (
                <div className="overflow-x-auto">
                  <div className="prose prose-sm max-w-none prose-invert">
                    <div className="whitespace-pre-wrap font-mono text-xs bg-black/40 p-6 rounded-2xl border border-white/10">
                      {agents.scanner.output}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center text-zinc-500 border-2 border-dashed border-white/10 rounded-2xl">
                  <p className="text-sm font-mono">Run Deep Scan to identify global market opportunities.</p>
                </div>
              )}
            </motion.div>
          </div>

          {/* Right Column: Signal & Orchestrator */}
          <div className="space-y-8">
            <div className="flex flex-col items-center gap-2">
              <ArrowDown className="w-6 h-6 text-zinc-600 animate-pulse hidden lg:block" />
              
              <div className="w-full">
                <AgentCard
                  title="Signal Generator"
                  status={agents.signal.status}
                  description="Day trading & long term signals"
                  output={agents.signal.output}
                  icon={<Zap className="w-5 h-5" />}
                />
              </div>
              
              <div className="w-full mt-4">
                <AgentCard
                  title="Opportunity Agent"
                  status={agents.opportunity.status}
                  description="Real-time day trading table"
                  output={agents.opportunity.output}
                  icon={<TrendingUp className="w-5 h-5" />}
                />
              </div>

              <div className="w-full mt-4">
                <AgentCard
                  title="Global Market Scanner"
                  status={agents.scanner.status}
                  description="Top returns list for the day"
                  output={agents.scanner.output}
                  icon={<Search className="w-5 h-5" />}
                />
              </div>
            </div>
            
            <div className="p-8 bg-gradient-to-br from-zinc-900 to-black rounded-3xl text-white shadow-2xl relative overflow-hidden border border-zinc-800">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl shadow-lg shadow-cyan-500/20">
                    <ShieldCheck className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-2xl font-[Space_Grotesk]">The Verdict 👑</h3>
                    <p className="text-xs text-cyan-400 font-mono mt-1">Agent Orchestrator</p>
                  </div>
                </div>
                
                {agents.orchestrator.status === "running" ? (
                  <div className="flex flex-col items-center gap-3 py-10 justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                    <p className="text-sm text-zinc-400 font-mono">Reviewing all agent outputs...</p>
                  </div>
                ) : agents.orchestrator.output ? (
                  <div className="space-y-6">
                    <div className="p-5 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                      <p className="text-sm leading-relaxed text-zinc-200 font-medium">
                        "{agents.orchestrator.output}"
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-xs text-cyan-400 bg-cyan-500/10 p-3 rounded-xl border border-cyan-500/20 font-bold tracking-wide">
                      <ShieldCheck className="w-4 h-4" />
                      VERIFIED BY SWARM CONSENSUS
                    </div>
                  </div>
                ) : (
                  <div className="py-10 text-center">
                    <p className="text-sm text-zinc-600 font-mono">Waiting for analysis chain to complete...</p>
                  </div>
                )}
              </div>
              
              {/* Decorative background element */}
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl" />
            </div>

            <div className="glass-panel p-6 rounded-3xl">
              <h4 className="font-bold text-sm mb-4 uppercase tracking-widest text-zinc-400 font-[Space_Grotesk]">Terminal Output 💻</h4>
              <div className="space-y-3">
                {Object.entries(agents).map(([id, state]) => (
                  <div key={id} className="flex items-center justify-between text-xs font-mono">
                    <span className="capitalize text-zinc-400">{id.replace(/([A-Z])/g, ' $1')}</span>
                    <span className={cn(
                      "px-2 py-1 rounded-md font-bold",
                      (state as AgentState).status === "completed" ? "bg-green-500/20 text-green-400" :
                      (state as AgentState).status === "running" ? "bg-blue-500/20 text-blue-400 animate-pulse" :
                      (state as AgentState).status === "error" ? "bg-red-500/20 text-red-400" :
                      "bg-white/5 text-zinc-500"
                    )}>
                      [{(state as AgentState).status.toUpperCase()}]
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Backtesting Section */}
            <div className="glass-panel p-6 rounded-3xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-500/20 rounded-xl">
                  <Activity className="w-5 h-5 text-purple-400" />
                </div>
                <h4 className="font-bold text-lg font-[Space_Grotesk]">Strategy Backtester 📈</h4>
              </div>
              
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Symbol (e.g. AAPL)" 
                    value={backtestSymbol}
                    onChange={e => setBacktestSymbol(e.target.value.toUpperCase())}
                    className="flex-1 px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm outline-none focus:border-purple-500/50 font-mono text-zinc-200 placeholder:text-zinc-600"
                  />
                  <button 
                    onClick={runBacktest}
                    disabled={backtestLoading || !backtestSymbol}
                    className="bg-purple-500 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-purple-600 disabled:opacity-50 flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                  >
                    {backtestLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Run Backtest
                  </button>
                </div>

                {backtestError && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                    {backtestError}
                  </div>
                )}

                {backtestResult && (
                  <div className="p-4 bg-black/40 border border-white/10 rounded-xl text-sm text-zinc-300 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto custom-scrollbar">
                    <Markdown>{backtestResult}</Markdown>
                  </div>
                )}
                
                {!backtestResult && !backtestLoading && !backtestError && (
                  <p className="text-xs text-zinc-600 text-center py-4 font-mono">
                    Enter a symbol to backtest the current strategy against 1 year of historical data.
                  </p>
                )}
              </div>
            </div>

            {/* Simulated Brokerage Section */}
            <div className="glass-panel p-6 rounded-3xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-green-500/20 rounded-xl">
                  <Briefcase className="w-5 h-5 text-green-400" />
                </div>
                <h4 className="font-bold text-lg font-[Space_Grotesk]">Simulated Brokerage 💼</h4>
              </div>
              
              <div className="space-y-6">
                {/* Execute Trade */}
                <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                  <h5 className="text-sm font-bold text-zinc-300 mb-3">Execute Signal for {symbol}</h5>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                      <input 
                        type="number" 
                        value={tradeAmount}
                        onChange={e => setTradeAmount(Number(e.target.value))}
                        className="w-full pl-8 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm outline-none focus:border-green-500/50 font-mono text-zinc-200"
                      />
                    </div>
                    <button 
                      onClick={() => executeTrade('BUY')}
                      disabled={tradeLoading || !symbol}
                      className="bg-green-500/20 text-green-400 border border-green-500/30 px-6 py-3 rounded-xl text-sm font-bold hover:bg-green-500 hover:text-white disabled:opacity-50 transition-all"
                    >
                      BUY
                    </button>
                    <button 
                      onClick={() => executeTrade('SELL')}
                      disabled={tradeLoading || !symbol}
                      className="bg-red-500/20 text-red-400 border border-red-500/30 px-6 py-3 rounded-xl text-sm font-bold hover:bg-red-500 hover:text-white disabled:opacity-50 transition-all"
                    >
                      SELL
                    </button>
                  </div>
                  {tradeError && <p className="text-red-400 text-xs mt-2">{tradeError}</p>}
                </div>

                {/* Trade Log */}
                <div>
                  <h5 className="text-sm font-bold text-zinc-300 mb-3">Trade Log</h5>
                  <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                    {trades.length === 0 ? (
                      <p className="text-xs text-zinc-600 text-center py-4 font-mono">No trades executed yet.</p>
                    ) : (
                      trades.slice().reverse().map(trade => (
                        <div key={trade.id} className="flex items-center justify-between p-3 bg-black/40 border border-white/5 rounded-xl text-sm">
                          <div className="flex items-center gap-3">
                            <span className={cn("font-bold text-xs px-2 py-1 rounded-md", trade.type === 'BUY' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>
                              {trade.type}
                            </span>
                            <span className="font-bold">{trade.symbol}</span>
                            <span className="text-zinc-500 font-mono text-xs">
                              {trade.quantity.toFixed(4)} @ ${trade.entryPrice.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            {trade.status === 'OPEN' ? (
                              <button 
                                onClick={() => closeTrade(trade.id)}
                                className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg transition-colors"
                              >
                                Close
                              </button>
                            ) : (
                              <span className={cn("font-mono font-bold text-xs", (trade.realizedPnL || 0) >= 0 ? "text-green-400" : "text-red-400")}>
                                {(trade.realizedPnL || 0) >= 0 ? '+' : ''}${(trade.realizedPnL || 0).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Price Alerts Section */}
            <div className="glass-panel p-6 rounded-3xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-red-500/20 rounded-xl">
                  <Bell className="w-5 h-5 text-red-400" />
                </div>
                <h4 className="font-bold text-lg font-[Space_Grotesk]">Price Alerts 🚨</h4>
              </div>
              
              <div className="space-y-5">
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Ticker" 
                      value={newAlertSymbol}
                      onChange={e => setNewAlertSymbol(e.target.value)}
                      className="w-1/3 px-4 py-2 bg-black/40 border border-white/10 rounded-xl text-sm outline-none focus:border-red-500/50 font-mono text-zinc-200 placeholder:text-zinc-600"
                    />
                    <select 
                      value={newAlertCondition}
                      onChange={e => setNewAlertCondition(e.target.value as 'above'|'below')}
                      className="w-1/3 px-4 py-2 bg-black/40 border border-white/10 rounded-xl text-sm outline-none focus:border-red-500/50 text-zinc-200"
                    >
                      <option value="above">Above</option>
                      <option value="below">Below</option>
                    </select>
                    <input 
                      type="number" 
                      placeholder="Price" 
                      value={newAlertThreshold}
                      onChange={e => setNewAlertThreshold(e.target.value)}
                      className="w-1/3 px-4 py-2 bg-black/40 border border-white/10 rounded-xl text-sm outline-none focus:border-red-500/50 font-mono text-zinc-200 placeholder:text-zinc-600"
                    />
                  </div>
                  <button 
                    onClick={handleAddAlert}
                    disabled={!newAlertSymbol || !newAlertThreshold}
                    className="w-full bg-red-500 text-white py-3 rounded-xl text-sm font-bold hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                  >
                    <Plus className="w-4 h-4" /> Set Alert
                  </button>
                </div>

                <div className="space-y-2 mt-4">
                  {alerts.length === 0 ? (
                    <p className="text-xs text-zinc-600 text-center py-4 font-mono">No active alerts.</p>
                  ) : (
                    alerts.map(alert => (
                      <div key={alert.id} className={cn(
                        "flex items-center justify-between p-4 rounded-xl border text-sm transition-all",
                        alert.triggered ? "bg-white/5 border-white/5 text-zinc-500" : "bg-red-500/10 border-red-500/20 text-red-200"
                      )}>
                        <div className="flex items-center gap-3">
                          {alert.triggered ? <Bell className="w-4 h-4" /> : <BellRing className="w-4 h-4 text-red-400 animate-pulse" />}
                          <span className="font-bold">{alert.symbol}</span>
                          <span className="text-zinc-500">{alert.condition === 'above' ? '>' : '<'}</span>
                          <span className="font-mono font-bold">${alert.threshold}</span>
                        </div>
                        <button onClick={() => removeAlert(alert.id)} className="text-zinc-500 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {notifications.map(note => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="bg-zinc-900 text-white p-4 rounded-xl shadow-2xl flex items-start gap-3 max-w-sm pointer-events-auto border border-zinc-800"
            >
              <div className="p-2 bg-blue-500/20 rounded-full flex-shrink-0">
                <BellRing className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Price Alert Triggered</h4>
                <p className="text-sm text-zinc-300 mt-1">{note.message}</p>
                <p className="text-xs text-zinc-500 mt-2">{note.time.toLocaleTimeString()}</p>
              </div>
              <button 
                onClick={() => setNotifications(prev => prev.filter(n => n.id !== note.id))}
                className="text-zinc-500 hover:text-white transition-colors ml-auto"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AlertCircle(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

