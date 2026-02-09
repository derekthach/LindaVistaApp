'use client';

import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function BarChart({
  labels,
  data,
  label,
  color = 'rgba(234, 179, 8, 1)',
  horizontal = false,
}: {
  labels: string[];
  data: number[];
  label: string;
  color?: string;
  horizontal?: boolean;
}) {
  return (
    <Bar
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
        scales: {
          [horizontal ? 'x' : 'y']: { beginAtZero: true, ticks: { precision: 0 } },
        },
      }}
    />
  );
}
