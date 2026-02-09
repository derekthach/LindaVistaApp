'use client';

import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export default function LineChart({
  labels,
  data,
  label,
  color = 'rgba(22, 163, 74, 1)',
}: {
  labels: string[];
  data: number[];
  label: string;
  color?: string;
}) {
  return (
    <Line
      data={{
        labels,
        datasets: [
          {
            label,
            data,
            backgroundColor: color.replace('1)', '0.2)'),
            borderColor: color,
            borderWidth: 2,
            tension: 0.2,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
        },
      }}
    />
  );
}
