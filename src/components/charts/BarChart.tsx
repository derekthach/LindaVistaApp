'use client';

import { useMemo, type CSSProperties } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  type Plugin,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const chartFrameStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  minHeight: 0,
  overflow: 'hidden',
};

function valueAxisMaxFromData(data: number[]): number | undefined {
  if (data.length === 0) return undefined;
  const peak = Math.max(...data);
  if (peak <= 0) return undefined;
  return peak + Math.max(1, Math.ceil(peak * 0.12));
}

function horizontalBarValueLabelsPlugin(): Plugin<'bar'> {
  return {
    id: 'horizontalBarValueLabels',
    afterDatasetsDraw(chart) {
      if (chart.options.indexAxis !== 'y') return;
      const { ctx, chartArea } = chart;
      ctx.save();
      ctx.fillStyle = '#374151';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      chart.data.datasets.forEach((_dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        meta.data.forEach((element, index) => {
          const raw = chart.data.datasets[datasetIndex]?.data[index];
          const value = typeof raw === 'number' ? raw : Number(raw);
          if (!Number.isFinite(value)) return;
          const props = element.getProps(['x', 'y'], true);
          const label = String(value);
          const textWidth = ctx.measureText(label).width;
          let x = props.x + 6;
          if (chartArea && x + textWidth > chartArea.right) {
            x = Math.max(chartArea.left, chartArea.right - textWidth - 2);
          }
          ctx.fillText(label, x, props.y);
        });
      });
      ctx.restore();
    },
  };
}

export default function BarChart({
  labels,
  data,
  label,
  color = 'rgba(234, 179, 8, 1)',
  horizontal = false,
  showValueLabels = false,
  valueAxisMax,
}: {
  labels: string[];
  data: number[];
  label: string;
  color?: string;
  horizontal?: boolean;
  /** When true (horizontal bars), draw the count at the end of each bar. */
  showValueLabels?: boolean;
  /** Cap for the value axis; defaults to a padded max from `data` when horizontal. */
  valueAxisMax?: number;
}) {
  const plugins = useMemo(
    () => (showValueLabels && horizontal ? [horizontalBarValueLabelsPlugin()] : []),
    [showValueLabels, horizontal]
  );

  const resolvedValueMax =
    valueAxisMax ?? (horizontal ? valueAxisMaxFromData(data) : undefined);

  return (
    <div style={chartFrameStyle}>
      <Bar
        plugins={plugins}
        data={{
          labels,
          datasets: [
            {
              label,
              data,
              backgroundColor: color.replace('1)', '0.5)'),
              borderColor: color,
              borderWidth: 1.5,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: horizontal ? 'y' : 'x',
          layout: {
            padding: showValueLabels && horizontal ? { right: 28 } : undefined,
          },
          plugins: {
            legend: { display: false },
          },
          scales: {
            [horizontal ? 'x' : 'y']: {
              beginAtZero: true,
              max: resolvedValueMax,
              ticks: { precision: 0 },
            },
          },
        }}
      />
    </div>
  );
}
