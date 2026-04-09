import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  ReferenceLine
} from 'recharts';

const data = [
  { name: 'vs MIA', value: 32 },
  { name: '@ NYK', value: 24 },
  { name: 'vs PHI', value: 29 },
  { name: '@ MIA', value: 35 },
  { name: 'vs MIL', value: 26 },
];

const LINE_VALUE = 27.5;

interface PlayerChartProps {
  lineValue: number;
}

export function PlayerChart({ lineValue }: PlayerChartProps) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 30, right: 0, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#888', fontSize: 10, fontWeight: 'bold' }}
            dy={10}
          />
          <YAxis hide domain={[0, 'dataMax + 10']} />
          <Tooltip 
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            contentStyle={{ 
              backgroundColor: '#0a0a0a', 
              border: '1px solid #1a1a1a', 
              borderRadius: '0px',
              fontSize: '10px',
              fontFamily: 'JetBrains Mono'
            }}
          />
          <ReferenceLine 
            y={lineValue} 
            stroke="#22c55e" 
            strokeDasharray="4 4" 
            strokeOpacity={0.5}
            label={{ 
              position: 'right', 
              value: `LINE: ${lineValue}`, 
              fill: '#22c55e', 
              fontSize: 10, 
              fontWeight: 'bold',
              fontFamily: 'JetBrains Mono'
            }}
          />
          <Bar 
            dataKey="value" 
            barSize={40} 
            label={{ 
              position: 'top', 
              fill: '#fff', 
              fontSize: 12, 
              fontWeight: 'bold', 
              fontFamily: 'JetBrains Mono',
              dy: -10 
            }}
          >
            {data.map((entry, index) => {
              let color = '#ef4444'; // default red
              if (entry.value > lineValue) color = '#22c55e'; // green
              else if (entry.value === lineValue) color = '#888888'; // gray
              
              return (
                <Cell 
                  key={`cell-${index}`} 
                  fill={color} 
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
