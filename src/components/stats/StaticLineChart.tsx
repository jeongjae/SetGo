import React, { useMemo } from 'react';

type ChartDataPoint = {
  label: string;      // e.g. "05/19"
  oneRm: number;      // Estimated 1RM
  volume: number;     // Volume of the session
};

type StaticLineChartProps = {
  data: ChartDataPoint[];
  locale: 'ko' | 'en';
};

export function StaticLineChart({ data, locale }: StaticLineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl bg-[#F2F2F7] text-xs font-bold text-[#8E8E93]">
        {locale === 'ko' ? '데이터가 부족합니다' : 'Not enough data'}
      </div>
    );
  }

  // ViewBox: 300 x 140
  const width = 300;
  const height = 140;
  
  const paddingLeft = 35;
  const paddingRight = 45;
  const paddingTop = 20;
  const paddingBottom = 25;
  
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Calculate bounds
  const { maxOneRm, minOneRm, maxVolume, minVolume } = useMemo(() => {
    const oneRms = data.map((d) => d.oneRm);
    const volumes = data.map((d) => d.volume);
    
    const max1 = Math.max(...oneRms, 10);
    const min1 = Math.max(0, Math.min(...oneRms, 0));
    const maxV = Math.max(...volumes, 100);
    const minV = Math.max(0, Math.min(...volumes, 0));
    
    // Add 10% margin on top
    const margin1 = (max1 - min1) * 0.1 || 2;
    const marginV = (maxV - minV) * 0.1 || 10;
    
    return {
      maxOneRm: max1 + margin1,
      minOneRm: Math.max(0, min1 - margin1),
      maxVolume: maxV + marginV,
      minVolume: Math.max(0, minV - marginV),
    };
  }, [data]);

  // Points computation
  const points = useMemo(() => {
    return data.map((d, index) => {
      const x = data.length === 1 
        ? paddingLeft + chartWidth / 2 
        : paddingLeft + (index / (data.length - 1)) * chartWidth;
      
      const oneRmY = paddingTop + chartHeight - 
        ((d.oneRm - minOneRm) / (maxOneRm - minOneRm || 1)) * chartHeight;
        
      const volumeY = paddingTop + chartHeight - 
        ((d.volume - minVolume) / (maxVolume - minVolume || 1)) * chartHeight;

      return { x, oneRmY, volumeY, label: d.label, oneRm: d.oneRm, volume: d.volume };
    });
  }, [data, minOneRm, maxOneRm, minVolume, maxVolume, chartWidth, chartHeight]);

  const oneRmPath = points.map((p) => `${p.x},${p.oneRmY}`).join(' ');
  const volumePath = points.map((p) => `${p.x},${p.volumeY}`).join(' ');

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.015)]">
      <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider mb-2">
        <div className="flex items-center gap-1.5 text-[#2EC4B6]">
          <span className="inline-block h-2 w-2 rounded-full bg-[#2EC4B6]" />
          <span>1RM (kg)</span>
        </div>
        <div className="flex items-center gap-1.5 text-[#FF9500]">
          <span className="inline-block h-2 w-2 rounded-none bg-[#FF9500]" />
          <span>{locale === 'ko' ? '볼륨 (kg)' : 'Vol (kg)'}</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible">
        {/* Horizontal grid lines */}
        {[0, 0.5, 1].map((ratio) => {
          const y = paddingTop + ratio * chartHeight;
          return (
            <line
              key={ratio}
              x1={paddingLeft}
              y1={y}
              x2={width - paddingRight}
              y2={y}
              stroke="#F2F2F7"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          );
        })}

        {/* 1RM Left Y-Axis labels */}
        <text x={paddingLeft - 6} y={paddingTop + 4} textAnchor="end" className="fill-[#8E8E93] text-[8px] font-bold font-mono">
          {Math.round(maxOneRm)}
        </text>
        <text x={paddingLeft - 6} y={paddingTop + chartHeight / 2 + 3} textAnchor="end" className="fill-[#8E8E93] text-[8px] font-bold font-mono">
          {Math.round((maxOneRm + minOneRm) / 2)}
        </text>
        <text x={paddingLeft - 6} y={paddingTop + chartHeight + 3} textAnchor="end" className="fill-[#8E8E93] text-[8px] font-bold font-mono">
          {Math.round(minOneRm)}
        </text>

        {/* Volume Right Y-Axis labels */}
        <text x={width - paddingRight + 6} y={paddingTop + 4} textAnchor="start" className="fill-[#8E8E93] text-[8px] font-bold font-mono">
          {Math.round(maxVolume).toLocaleString()}
        </text>
        <text x={width - paddingRight + 6} y={paddingTop + chartHeight / 2 + 3} textAnchor="start" className="fill-[#8E8E93] text-[8px] font-bold font-mono">
          {Math.round((maxVolume + minVolume) / 2).toLocaleString()}
        </text>
        <text x={width - paddingRight + 6} y={paddingTop + chartHeight + 3} textAnchor="start" className="fill-[#8E8E93] text-[8px] font-bold font-mono">
          {Math.round(minVolume).toLocaleString()}
        </text>

        {/* Volume Path (Orange dotted line) */}
        {data.length > 1 && (
          <polyline
            points={volumePath}
            fill="none"
            stroke="#FF9500"
            strokeWidth="2"
            strokeDasharray="4 3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* 1RM Path (Teal solid line) */}
        {data.length > 1 && (
          <polyline
            points={oneRmPath}
            fill="none"
            stroke="#2EC4B6"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Draw data markers */}
        {points.map((p) => (
          <g key={p.label}>
            {/* Volume marker (Orange Square) */}
            <rect
              x={p.x - 2.5}
              y={p.volumeY - 2.5}
              width="5"
              height="5"
              fill="#FF9500"
              stroke="#FFFFFF"
              strokeWidth="1"
            />
            {/* 1RM marker (Teal Circle) */}
            <circle
              cx={p.x}
              cy={p.oneRmY}
              r="3.5"
              fill="#2EC4B6"
              stroke="#FFFFFF"
              strokeWidth="1.2"
            />
            {/* Date label */}
            <text
              x={p.x}
              y={height - paddingBottom + 12}
              textAnchor="middle"
              className="fill-[#8E8E93] text-[8px] font-bold"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
