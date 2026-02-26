"use client";

import { useMemo, useState } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from "chart.js";
import type { DailyPoint, HourlyPoint, LabelCount } from "@/lib/analytics";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

interface AdminChartsProps {
  daily7: DailyPoint[];
  daily30: DailyPoint[];
  hourly: HourlyPoint[];
  topDevices: LabelCount[];
  topCountries: LabelCount[];
}

export default function AdminCharts({ daily7, daily30, hourly, topDevices, topCountries }: AdminChartsProps) {
  const [range, setRange] = useState<7 | 30>(30);
  const daily = range === 7 ? daily7 : daily30;

  const dailyData = useMemo(
    () => ({
      labels: daily.map((point) => point.day.slice(5)),
      datasets: [
        {
          label: `Clicks (${range}d)`,
          data: daily.map((point) => point.clicks),
          borderColor: "#0f766e",
          backgroundColor: "rgba(15, 118, 110, 0.15)",
          fill: true,
          tension: 0.3
        }
      ]
    }),
    [daily, range]
  );

  const hourlyData = useMemo(
    () => ({
      labels: hourly.map((point) => point.hour),
      datasets: [
        {
          label: "Clicks by hour",
          data: hourly.map((point) => point.clicks),
          backgroundColor: "#0ea5e9"
        }
      ]
    }),
    [hourly]
  );

  const deviceData = useMemo(
    () => ({
      labels: topDevices.map((item) => item.label),
      datasets: [
        {
          data: topDevices.map((item) => item.clicks),
          backgroundColor: ["#0f766e", "#f59e0b", "#2563eb", "#dc2626", "#6b7280"]
        }
      ]
    }),
    [topDevices]
  );

  const countryData = useMemo(
    () => ({
      labels: topCountries.map((item) => item.label),
      datasets: [
        {
          label: "Clicks by country",
          data: topCountries.map((item) => item.clicks),
          backgroundColor: "#22c55e"
        }
      ]
    }),
    [topCountries]
  );

  return (
    <section className="charts-grid">
      <article className="card">
        <div className="chart-header">
          <h3>Daily clicks</h3>
          <div className="toggle-group">
            <button
              type="button"
              className={range === 7 ? "toggle active" : "toggle"}
              onClick={() => setRange(7)}
            >
              7d
            </button>
            <button
              type="button"
              className={range === 30 ? "toggle active" : "toggle"}
              onClick={() => setRange(30)}
            >
              30d
            </button>
          </div>
        </div>
        <Line data={dailyData} />
      </article>

      <article className="card">
        <h3>Hourly clicks (last 30d)</h3>
        <Bar data={hourlyData} />
      </article>

      <article className="card">
        <h3>Top devices</h3>
        <Doughnut data={deviceData} />
      </article>

      <article className="card">
        <h3>Top countries</h3>
        <Bar data={countryData} />
      </article>
    </section>
  );
}
