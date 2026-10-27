import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { useTilt } from '../context/TiltContext';
import { useCurrency } from '../context/CurrencyContext';
import { TrendingUp, TrendingDown, Activity, AlertTriangle } from 'lucide-react';

interface ChartPoint {
  index: number;
  time: string;
  timestamp: string;
  tradePnl: number;
  cumulativePnl: number;
  instrument: string;
  tiltEvent?: string;
  pointsAdded?: number;
}

export const PnLChart: React.FC = () => {
  const { trades, events } = useTilt();
  const { formatCurrency, currencySymbol } = useCurrency();

  // Compute cumulative series chronologically
  const chartData = useMemo(() => {
    if (!trades || trades.length === 0) return [];

    // Chronological order (oldest to newest)
    const sorted = [...trades].sort((a, b) => {
      const ta = new Date(a.timestamp || 0).getTime();
      const tb = new Date(b.timestamp || 0).getTime();
      return ta - tb;
    });

    let runningTotal = 0;
    const points: ChartPoint[] = [];

    // Initial baseline anchor
    if (sorted.length > 0) {
      const firstTime = new Date(sorted[0].timestamp || Date.now());
      firstTime.setMinutes(firstTime.getMinutes() - 1);
      points.push({
        index: 0,
        time: firstTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: firstTime.toISOString(),
        tradePnl: 0,
        cumulativePnl: 0,
        instrument: 'START',
      });
    }

    sorted.forEach((t, i) => {
      runningTotal += Number(t.pnl) || 0;
      const tTime = t.timestamp ? new Date(t.timestamp) : new Date();
      const timeStr = tTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      // Check if any tilt event happened on this trade
      const matchedEvent = (events || []).find((ev) => ev.trade_id === t.id);

      points.push({
        index: i + 1,
        time: timeStr,
        timestamp: t.timestamp || tTime.toISOString(),
        tradePnl: Number(t.pnl) || 0,
        cumulativePnl: runningTotal,
        instrument: t.instrument,
        tiltEvent: matchedEvent?.event_type,
        pointsAdded: matchedEvent?.points_added,
      });
    });

    return points;
  }, [trades, events]);

  // Find min and max to calculate split gradient offset at 0
  const { minPnl, maxPnl, currentPnl, gradientOffset, tiltEventPoints } = useMemo(() => {
    if (chartData.length === 0) {
      return { minPnl: 0, maxPnl: 0, currentPnl: 0, gradientOffset: 0.5, tiltEventPoints: [] };
    }

    let min = 0;
    let max = 0;
    const eventPts: ChartPoint[] = [];

    chartData.forEach((d) => {
      if (d.cumulativePnl < min) min = d.cumulativePnl;
      if (d.cumulativePnl > max) max = d.cumulativePnl;
      if (d.tiltEvent) eventPts.push(d);
    });

    const curr = chartData[chartData.length - 1].cumulativePnl;

    // Gradient offset calculation for 0 baseline
    let offset = 0.5;
    if (max <= 0) {
      offset = 0;
    } else if (min >= 0) {
      offset = 1;
    } else {
      offset = max / (max - min);
    }

    return {
      minPnl: min,
      maxPnl: max,
      currentPnl: curr,
      gradientOffset: Math.max(0, Math.min(1, offset)),
      tiltEventPoints: eventPts,
    };
  }, [chartData]);

  // Custom Bloomberg-styled Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data: ChartPoint = payload[0].payload;
    const isProfitable = data.cumulativePnl >= 0;
    const isTradeWin = data.tradePnl >= 0;

    return (
      <div className="bg-[#0f1218] border border-[#2a3545] p-3 rounded shadow-2xl font-mono text-xs z-50 min-w-[200px]">
        <div className="flex items-center justify-between border-b border-[#1e2530] pb-1.5 mb-2">
          <span className="text-[#ff6600] font-bold tracking-wide">
            {data.instrument}
          </span>
          <span className="text-slate-400 text-[11px]">{data.time}</span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">Cumulative P&L:</span>
            <span
              className={`font-bold ${
                isProfitable ? 'text-[#00d084]' : 'text-[#ff3b3b]'
              }`}
            >
              {formatCurrency(data.cumulativePnl, { showSign: true })}
            </span>
          </div>

          {data.instrument !== 'START' && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">Trade P&L:</span>
              <span
                className={`font-semibold ${
                  isTradeWin ? 'text-[#00d084]' : 'text-[#ff3b3b]'
                }`}
              >
                {formatCurrency(data.tradePnl, { showSign: true })}
              </span>
            </div>
          )}

          {data.tiltEvent && (
            <div className="pt-1.5 mt-1 border-t border-[#1e2530] flex items-center justify-between text-[#ff6600]">
              <span className="flex items-center gap-1 text-[10px] font-bold">
                <AlertTriangle className="w-3 h-3" />
                {data.tiltEvent}
              </span>
              <span className="text-[10px] font-bold bg-[#ff6600]/20 px-1 py-0.5 rounded border border-[#ff6600]/40">
                +{data.pointsAdded} pts
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const isNetProfit = currentPnl >= 0;

  return (
    <div className="bb-card rounded-xl p-4 sm:p-5 flex flex-col justify-between">
      {/* Bloomberg Terminal Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#1e2530] mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#ff6600]" />
          <div>
            <h3 className="bb-header text-xs tracking-wider">
              Cumulative Intraday P&L Stream
            </h3>
            <span className="text-[10px] font-mono text-slate-400">
              Session Real-time Equity Curve // {chartData.length} Data Points
            </span>
          </div>
        </div>

        {/* Current Live PnL Badge */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
              Net Session P&L
            </span>
            <div
              className={`font-mono font-bold text-lg leading-tight flex items-center justify-end gap-1 ${
                isNetProfit ? 'text-[#00d084]' : 'text-[#ff3b3b]'
              }`}
            >
              {isNetProfit ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span>{formatCurrency(currentPnl, { showSign: true })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-64 sm:h-72 w-full">
        {chartData.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center border border-dashed border-[#1e2530] rounded-lg bg-[#0a0c10]/40">
            <Activity className="w-8 h-8 text-[#ff6600]/40 mb-2 animate-pulse" />
            <p className="text-xs font-mono text-slate-400">
              NO INTRADAY EXECUTIONS YET
            </p>
            <p className="text-[10px] font-mono text-slate-600 mt-0.5">
              Execute a trade or trigger a scenario to stream equity curve
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 12, right: 12, left: -10, bottom: 0 }}
            >
              <defs>
                {/* Dynamic Area Fill Gradient Split at 0 */}
                <linearGradient id="splitAreaColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d084" stopOpacity={0.35} />
                  <stop offset={`${gradientOffset * 100}%`} stopColor="#00d084" stopOpacity={0.03} />
                  <stop offset={`${gradientOffset * 100}%`} stopColor="#ff3b3b" stopOpacity={0.03} />
                  <stop offset="100%" stopColor="#ff3b3b" stopOpacity={0.35} />
                </linearGradient>

                {/* Stroke Gradient Split at 0 */}
                <linearGradient id="splitStrokeColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={`${gradientOffset * 100}%`} stopColor="#00d084" />
                  <stop offset={`${gradientOffset * 100}%`} stopColor="#ff3b3b" />
                </linearGradient>
              </defs>

              <CartesianGrid
                stroke="#1e2530"
                strokeDasharray="2 2"
                vertical={false}
              />

              <XAxis
                dataKey="time"
                stroke="#475569"
                fontSize={10}
                tickLine={false}
                fontFamily="IBM Plex Mono"
              />

              <YAxis
                stroke="#475569"
                fontSize={10}
                tickLine={false}
                fontFamily="IBM Plex Mono"
                tickFormatter={(val) => {
                  if (Math.abs(val) >= 1000) {
                    return `${val < 0 ? '-' : ''}${currencySymbol}${Math.abs(Math.round(val / 1000))}k`;
                  }
                  return `${val < 0 ? '-' : ''}${currencySymbol}${Math.abs(Math.round(val))}`;
                }}
              />

              <Tooltip content={<CustomTooltip />} />

              {/* Zero baseline */}
              <ReferenceLine y={0} stroke="#2a3545" strokeWidth={1.5} />

              {/* Vertical Reference Lines for Triggered Tilt Events */}
              {tiltEventPoints.map((pt, idx) => (
                <ReferenceLine
                  key={`tilt-ref-${idx}`}
                  x={pt.time}
                  stroke="#ff6600"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  label={{
                    value: 'TILT',
                    fill: '#ff6600',
                    fontSize: 9,
                    position: 'top',
                    fontFamily: 'IBM Plex Mono',
                  }}
                />
              ))}

              <Area
                type="monotone"
                dataKey="cumulativePnl"
                stroke="url(#splitStrokeColor)"
                strokeWidth={2}
                fill="url(#splitAreaColor)"
                isAnimationActive={true}
                dot={{
                  r: 3,
                  fill: '#0f1218',
                  stroke: isNetProfit ? '#00d084' : '#ff3b3b',
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 5,
                  fill: '#ff6600',
                  stroke: '#ffffff',
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#1e2530] text-[10px] font-mono text-slate-400 mt-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-[#00d084] inline-block" />
            <span>Profit Gradient</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-[#ff3b3b] inline-block" />
            <span>Drawdown Gradient</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-[#ff6600] inline-block border-t border-dashed border-[#ff6600]" />
            <span>Tilt Event Mark</span>
          </span>
        </div>
        <span className="text-slate-500">
          Range: {formatCurrency(minPnl)} → {formatCurrency(maxPnl)}
        </span>
      </div>
    </div>
  );
};
