import React, { useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface MiniSparklineProps {
  data: number[];
  color?: string;
  height?: number;
  className?: string;
}

export function MiniSparkline({ data, color = 'var(--accent-primary)', height = 32, className = '' }: MiniSparklineProps) {
  const chartData = useMemo(() => data.map((v, i) => ({ i, v })), [data]);

  if (!data.length || data.every(v => v === 0)) return null;

  return (
    <div className={className} style={{ height, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`spark-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#spark-${color.replace(/[^a-z0-9]/gi, '')})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
