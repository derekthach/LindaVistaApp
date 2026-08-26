'use client';

import type { CSSProperties } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import type { ChartDataset } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const chartFrameStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  minHeight: 0,
  overflow: 'hidden',
};

export default function LineChart({
  labels,
  data,
  label,
  color = 'rgba(22, 163, 74, 1)',
  comparisonData,
  comparisonLabel,
  comparisonColor,
  yAxisIntegersOnly = true,
  tooltipValueFormat,
  denseCategoryAxis = false,
}: {
  labels: string[];
  data: number[];
  label: string;
  color?: string;
  comparisonData?: number[];
  comparisonLabel?: string;
  /** Stroke for the dashed series; defaults to same as primary `color` (GA-style same hue) */
  comparisonColor?: string;
  yAxisIntegersOnly?: boolean;
  /** If set, tooltip shows this string per point (e.g. currency) */
  tooltipValueFormat?: (value: number) => string;
  /** Rotate/skip x labels when many category ticks (e.g. full calendar month). */
  denseCategoryAxis?: boolean;
}) {
  const comparisonStroke = comparisonColor ?? color;

  const datasets: ChartDataset<'line'>[] = [
    {
      label,
      data,
      backgroundColor: color.replace('1)', '0.15)'),
      borderColor: color,
      borderWidth: 2,
      tension: 0.2,
      fill: true,
      order: 1,
    },
  ];

  if (
    comparisonData &&
    comparisonLabel &&
    comparisonData.length === labels.length &&
    comparisonData.length > 0
  ) {
    datasets.push({
      label: comparisonLabel,
      data: comparisonData,
      backgroundColor: 'transparent',
      borderColor: comparisonStroke,
      borderWidth: 2,
      borderDash: [6, 4],
      tension: 0.2,
      fill: false,
      pointBackgroundColor: comparisonStroke,
      pointBorderColor: comparisonStroke,
      order: 2,
    });
  }

  return (
    <div style={chartFrameStyle}>
      <Line
        data={{
          labels,
          datasets,
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            ...(denseCategoryAxis
              ? {
                  x: {
                    ticks: {
                      maxRotation: 45,
                      autoSkip: true,
                      maxTicksLimit: 16,
                    },
                  },
                }
              : {}),
            y: {
              beginAtZero: true,
              ticks: yAxisIntegersOnly ? { precision: 0 } : {},
            },
          },
          plugins: {
            legend: {
              display: datasets.length > 1,
              position: 'bottom',
            },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const raw = ctx.parsed.y;
                  if (raw === undefined || raw === null) return `${ctx.dataset.label}: —`;
                  const v = Number(raw);
                  if (tooltipValueFormat) {
                    return `${ctx.dataset.label}: ${tooltipValueFormat(v)}`;
                  }
                  return `${ctx.dataset.label}: ${v}`;
                },
              },
            },
          },
        }}
      />
    </div>
  );
}
