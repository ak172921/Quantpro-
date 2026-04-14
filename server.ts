import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import YahooFinance from "yahoo-finance2";
import dotenv from "dotenv";

dotenv.config();

const yahooFinance = new (YahooFinance as any)();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Agent 1: Data Collector (Yahoo Finance)
  app.get("/api/data/:symbol", async (req, res) => {
    const { symbol } = req.params;
    try {
      console.log(`Fetching data for symbol: ${symbol}`);
      
      const quote = await yahooFinance.quote(symbol, {}, { validateResult: false } as any);
      if (!quote) {
        console.error(`No quote found for symbol: ${symbol}`);
        return res.status(404).json({ error: `Symbol ${symbol} not found` });
      }

      console.log(`Quote fetched for ${symbol}. Fetching history...`);

      // Using a more robust date handling for historical data
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let history: any[] = [];
      try {
        const chartData = await yahooFinance.chart(symbol, {
          period1: thirtyDaysAgo,
          period2: new Date(),
          interval: '1d',
        }, { validateResult: false } as any);
        if (chartData && chartData.quotes) {
          history = chartData.quotes.map((q: any) => ({
            date: q.date,
            close: q.close,
            high: q.high,
            low: q.low,
            open: q.open,
            volume: q.volume
          }));
        }
      } catch (hError: any) {
        console.warn(`Chart fetch failed for ${symbol}:`, hError.message);
      }
      
      let news: any[] = [];
      try {
        const searchRes = await yahooFinance.search(symbol, {}, { validateResult: false } as any);
        news = searchRes.news || [];
      } catch (nError: any) {
        console.warn(`News fetch failed for ${symbol}:`, nError.message);
      }

      console.log(`Data collection complete for ${symbol}. History records: ${history.length}, News items: ${news.length}`);
      res.json({ quote, history, news });
    } catch (error: any) {
      console.error(`Error fetching data for ${symbol}:`, error.message);
      
      // Log detailed validation errors if they exist (common in yahoo-finance2)
      if (error.errors) {
        console.error("Validation sub-errors:", JSON.stringify(error.errors, null, 2));
      }

      res.status(500).json({ 
        error: "Failed to fetch financial data", 
        details: error.message,
        subErrors: error.errors || [],
        symbol: symbol 
      });
    }
  });

  // Market Scan: Fetch trending symbols and their current quotes
  app.get("/api/market-scan", async (req, res) => {
    try {
      console.log("Performing market scan for top movers globally...");
      const regions = ['US', 'GB', 'DE', 'HK', 'AU', 'CA', 'FR', 'IN'];
      
      const trendingPromises = regions.map(async (region) => {
        try {
          const trending = await yahooFinance.trendingSymbols(region, {}, { validateResult: false } as any);
          return (trending?.quotes || []).map((t: any) => t.symbol);
        } catch (e) {
          return [];
        }
      });

      const results = await Promise.all(trendingPromises);
      let allSymbols: string[] = [];
      results.forEach(symbols => allSymbols.push(...symbols));
      
      // Add some global indices, cryptos, and currencies to ensure diversity
      const diverseSymbols = ['BTC-USD', 'ETH-USD', 'EURUSD=X', 'JPY=X', 'INR=X', 'CNY=X', 'GC=F', 'CL=F', '^FTSE', '^N225', '^BSESN', '000001.SS'];
      allSymbols.push(...diverseSymbols);

      const symbols = [...new Set(allSymbols)].slice(0, 15);
      
      const quotes = await Promise.all(
        symbols.map(async (s: string) => {
          try {
            return await yahooFinance.quote(s, {}, { validateResult: false } as any);
          } catch (e) {
            return null;
          }
        })
      );

      res.json({ trending: quotes.filter(q => q !== null) });
    } catch (error: any) {
      console.error("Market scan failed:", error.message);
      res.status(500).json({ error: "Failed to perform market scan", details: error.message });
    }
  });

  // Historical Data for Backtesting
  app.get("/api/historical/:symbol", async (req, res) => {
    const { symbol } = req.params;
    try {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const chartData = await yahooFinance.chart(symbol, {
        period1: oneYearAgo,
        period2: new Date(),
        interval: '1d',
      }, { validateResult: false } as any);
      
      if (chartData && chartData.quotes) {
        const history = chartData.quotes.map((q: any) => ({
          date: q.date,
          close: q.close,
          high: q.high,
          low: q.low,
          open: q.open,
          volume: q.volume
        }));
        res.json(history);
      } else {
        res.status(404).json({ error: "No historical data found" });
      }
    } catch (error: any) {
      console.error("Historical fetch failed:", error.message);
      res.status(500).json({ error: "Failed to fetch historical data", details: error.message });
    }
  });

  // Global Deep Scan: Fetch top 50 trending/active symbols globally or for a specific country
  app.get("/api/global-scan", async (req, res) => {
    try {
      const country = req.query.country as string;
      console.log(`Performing deep market scan... Country: ${country || 'Global'}`);
      
      let regions = ['US', 'GB', 'DE', 'HK', 'AU', 'CA', 'FR', 'IN'];
      if (country) {
        regions = [country.toUpperCase()];
      }

      const trendingPromises = regions.map(async (region) => {
        try {
          const trending = await yahooFinance.trendingSymbols(region, {}, { validateResult: false } as any);
          return (trending?.quotes || []).map((t: any) => t.symbol);
        } catch (e) {
          return [];
        }
      });

      let screenerPromises: Promise<any>[] = [];
      
      // Only use screeners if doing a global scan or if specifically US (most screeners are US-centric)
      if (!country || country.toUpperCase() === 'US') {
        screenerPromises = [
          yahooFinance.screener({ scrIds: 'day_gainers', count: 100 }, {}, { validateResult: false } as any),
          yahooFinance.screener({ scrIds: 'most_actives', count: 100 }, {}, { validateResult: false } as any),
          yahooFinance.screener({ scrIds: 'conservative_foreign_funds', count: 50 }, {}, { validateResult: false } as any),
          yahooFinance.screener({ scrIds: 'high_yield_bond', count: 50 }, {}, { validateResult: false } as any)
        ].map(p => p.catch(() => ({ quotes: [] })));
      }

      const results = await Promise.all([...trendingPromises, ...screenerPromises]);
      
      let allSymbols: string[] = [];
      let preFetchedQuotes: any[] = [];
      
      results.forEach(result => {
        if (Array.isArray(result)) {
          allSymbols.push(...result);
        } else if (result && result.quotes) {
          result.quotes.forEach((q: any) => {
            if (q.regularMarketPrice) {
              preFetchedQuotes.push(q);
            } else {
              allSymbols.push(q.symbol);
            }
          });
        }
      });

      // Add diverse global assets only if global scan
      if (!country) {
        const diverseSymbols = [
          'BTC-USD', 'ETH-USD', 'SOL-USD', // Crypto
          'EURUSD=X', 'GBPUSD=X', 'JPY=X', 'INR=X', 'CNY=X', // Forex
          'GC=F', 'SI=F', 'CL=F', // Commodities
          '^GSPC', '^DJI', '^IXIC', '^FTSE', '^N225', '^HSI', '^BSESN', '000001.SS' // Global Indices
        ];
        allSymbols.push(...diverseSymbols);
      } else {
        // Add specific indices/currencies based on country
        const countrySpecificAssets: Record<string, string[]> = {
          'IN': ['^BSESN', '^NSEI', 'INR=X', 'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS', 'SBIN.NS', 'BHARTIARTL.NS', 'ITC.NS', 'HINDUNILVR.NS', 'LT.NS', 'BAJFINANCE.NS', 'AXISBANK.NS', 'KOTAKBANK.NS', 'ASIANPAINT.NS', 'MARUTI.NS', 'TATAMOTORS.NS', 'SUNPHARMA.NS'],
          'CN': ['000001.SS', '399001.SZ', 'CNY=X', 'BABA', 'TCEHY', 'PDD', 'JD', 'BIDU', 'NIO', 'XPEV', 'LI', 'NTES', 'BILI', 'TCOM', 'ZTO', 'YUMC', 'HTHT', 'VIPS', 'IQ', 'HUYA'],
          'US': ['^GSPC', '^DJI', '^IXIC', 'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'BRK-B', 'LLY', 'AVGO', 'V', 'JPM', 'UNH', 'WMT', 'MA', 'PG', 'JNJ'],
          'GB': ['^FTSE', 'GBPUSD=X', 'SHEL.L', 'AZN.L', 'HSBA.L', 'ULVR.L', 'BP.L', 'GSK.L', 'DGE.L', 'RIO.L', 'BATS.L', 'GLEN.L', 'REL.L', 'COMP.L', 'LSEG.L', 'BA.L', 'NWG.L', 'BARC.L', 'STAN.L', 'PRU.L'],
          'JP': ['^N225', 'JPY=X', '7203.T', '6758.T', '9984.T', '8306.T', '6861.T', '8035.T', '9432.T', '4063.T', '8058.T', '7974.T', '6501.T', '8001.T', '6902.T', '9433.T', '8316.T', '4502.T', '7267.T', '6098.T'],
          'FR': ['^FCHI', 'EURUSD=X', 'MC.PA', 'OR.PA', 'RMS.PA', 'TTE.PA', 'SAN.PA', 'AIR.PA', 'SU.PA', 'AI.PA', 'EL.PA', 'BNP.PA', 'CS.PA', 'DG.PA', 'SAF.PA', 'KER.PA', 'LR.PA', 'ENGI.PA', 'ACA.PA', 'ORA.PA'],
          'AU': ['^AXJO', 'AUDUSD=X', 'BHP.AX', 'CBA.AX', 'CSL.AX', 'NAB.AX', 'WBC.AX', 'ANZ.AX', 'MQG.AX', 'WES.AX', 'TLS.AX', 'WOW.AX', 'RIO.AX', 'FMG.AX', 'GMG.AX', 'TCL.AX', 'STO.AX', 'COL.AX', 'QBE.AX', 'BXB.AX'],
          'DE': ['^GDAXI', 'EURUSD=X', 'SAP.DE', 'SIE.DE', 'DTE.DE', 'ALV.DE', 'MBG.DE', 'BMW.DE', 'VOW3.DE', 'BAS.DE', 'MUV2.DE', 'DPW.DE', 'IFX.DE', 'BAYN.DE', 'DHL.DE', 'HEN3.DE', 'RWE.DE', 'EOAN.DE', 'FRE.DE', 'HEI.DE'],
          'HK': ['^HSI', 'HKD=X', '0700.HK', '9988.HK', '3690.HK', '1299.HK', '0939.HK', '0005.HK', '0941.HK', '1398.HK', '0883.HK', '3988.HK', '0388.HK', '0001.HK', '0016.HK', '0002.HK', '0003.HK', '0011.HK', '0066.HK', '0823.HK'],
          'CA': ['^GSPTSE', 'CAD=X', 'RY.TO', 'TD.TO', 'SHOP.TO', 'CNR.TO', 'CP.TO', 'ENB.TO', 'CNQ.TO', 'BMO.TO', 'BNS.TO', 'CSU.TO', 'TRP.TO', 'CM.TO', 'ATD.TO', 'BCE.TO', 'MFC.TO', 'SU.TO', 'NTR.TO', 'WCN.TO']
        };
        if (countrySpecificAssets[country.toUpperCase()]) {
          allSymbols.push(...countrySpecificAssets[country.toUpperCase()]);
        }
      }

      const symbols = [...new Set(allSymbols)].slice(0, 250);
      
      const preFetchedMap = new Map(preFetchedQuotes.map(q => [q.symbol, q]));
      const symbolsToFetch = symbols.filter(s => !preFetchedMap.has(s));

      console.log(`Found ${symbols.length} unique symbols. ${preFetchedMap.size} already fetched. Fetching ${symbolsToFetch.length} quotes in parallel chunks...`);
      
      const chunkSize = 50;
      const quotePromises = [];
      for (let i = 0; i < symbolsToFetch.length; i += chunkSize) {
        const chunk = symbolsToFetch.slice(i, i + chunkSize);
        quotePromises.push(yahooFinance.quote(chunk, {}, { validateResult: false } as any).catch(() => []));
      }
      
      const rawQuotesChunks = await Promise.all(quotePromises);
      const fetchedQuotes = rawQuotesChunks.flat();
      
      const allRawQuotes = [...preFetchedQuotes, ...fetchedQuotes];
      
      // Simplify quotes to reduce payload size for Gemini API
      const quotes = allRawQuotes.map((q: any) => {
        if (!q) return null;
        return {
          symbol: q.symbol,
          shortName: q.shortName,
          price: q.regularMarketPrice,
          change: q.regularMarketChange,
          changePercent: q.regularMarketChangePercent,
          volume: q.regularMarketVolume,
          marketCap: q.marketCap,
          peRatio: q.trailingPE,
          fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: q.fiftyTwoWeekLow,
          currency: q.currency,
          marketState: q.marketState
        };
      }).filter(Boolean);

      res.json({ symbols, quotes });
    } catch (error: any) {
      console.error("Global scan failed:", error.message);
      res.status(500).json({ error: "Failed to perform global scan", details: error.message });
    }
  });

  // Batch Quotes: Fetch current prices for multiple symbols (used for alerts)
  app.get("/api/quotes", async (req, res) => {
    try {
      const symbolsStr = req.query.symbols as string;
      if (!symbolsStr) return res.json({});
      
      const symbols = symbolsStr.split(',').map(s => s.trim().toUpperCase());
      const quotes = await yahooFinance.quote(symbols, {}, { validateResult: false } as any);
      const quoteArray = Array.isArray(quotes) ? quotes : [quotes];
      
      const result: Record<string, number> = {};
      quoteArray.forEach((q: any) => {
        if (q && q.symbol && q.regularMarketPrice) {
          result[q.symbol] = q.regularMarketPrice;
        }
      });
      
      res.json(result);
    } catch (error: any) {
      console.error("Quotes fetch failed:", error.message);
      res.status(500).json({ error: "Failed to fetch quotes", details: error.message });
    }
  });

  // Simulated Brokerage State
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
  let simulatedTrades: Trade[] = [];

  // Execute Trade
  app.post("/api/broker/execute", async (req, res) => {
    try {
      const { symbol, type, amount } = req.body;
      
      const quote = await yahooFinance.quote(symbol, {}, { validateResult: false } as any);
      if (!quote || !quote.regularMarketPrice) {
        return res.status(400).json({ error: "Could not fetch current price for execution" });
      }
      
      const price = quote.regularMarketPrice;
      const quantity = amount / price;
      
      const trade: Trade = {
        id: Math.random().toString(36).substring(2, 11),
        symbol: symbol.toUpperCase(),
        type,
        quantity,
        entryPrice: price,
        timestamp: new Date().toISOString(),
        status: 'OPEN'
      };
      
      simulatedTrades.push(trade);
      res.json({ success: true, trade });
    } catch (error: any) {
      console.error("Trade execution failed:", error.message);
      res.status(500).json({ error: "Trade execution failed", details: error.message });
    }
  });

  // Get Trades
  app.get("/api/broker/trades", (req, res) => {
    res.json(simulatedTrades);
  });

  // Close Trade
  app.post("/api/broker/close/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const trade = simulatedTrades.find(t => t.id === id);
      
      if (!trade || trade.status === 'CLOSED') {
        return res.status(404).json({ error: "Trade not found or already closed" });
      }
      
      const quote = await yahooFinance.quote(trade.symbol, {}, { validateResult: false } as any);
      if (!quote || !quote.regularMarketPrice) {
        return res.status(400).json({ error: "Could not fetch current price for closing" });
      }
      
      const closePrice = quote.regularMarketPrice;
      trade.status = 'CLOSED';
      trade.closePrice = closePrice;
      
      const pnl = trade.type === 'BUY' 
        ? (closePrice - trade.entryPrice) * trade.quantity
        : (trade.entryPrice - closePrice) * trade.quantity;
        
      trade.realizedPnL = pnl;
      
      res.json({ success: true, trade });
    } catch (error: any) {
      console.error("Trade close failed:", error.message);
      res.status(500).json({ error: "Trade close failed", details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
