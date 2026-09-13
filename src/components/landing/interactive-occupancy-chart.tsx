"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import p from "./premium.module.css";

const periods = {
  "7 дней": {
    values: [72, 75, 78, 81, 84],
    previous: [68, 70, 72, 75, 77],
    labels: ["7 сен", "9 сен", "11 сен", "13 сен", "Сегодня"],
  },
  "14 дней": {
    values: [67, 72, 76, 80, 84],
    previous: [65, 67, 70, 73, 75],
    labels: ["1 сен", "4 сен", "7 сен", "10 сен", "Сегодня"],
  },
  "30 дней": {
    values: [61, 67, 73, 79, 84],
    previous: [58, 63, 68, 72, 74],
    labels: ["15 авг", "22 авг", "29 авг", "5 сен", "Сегодня"],
  },
} as const;

type Period = keyof typeof periods;

const xFor = (index: number) => 20 + index * 70;
const yFor = (value: number) => 102 - (value - 55) * 2.45;
const pathFor = (values: readonly number[]) => values.map((value, index) => `${index ? "L" : "M"}${xFor(index)} ${yFor(value)}`).join(" ");

export function InteractiveOccupancyChart() {
  const [period, setPeriod] = useState<Period>("14 дней");
  const [selected, setSelected] = useState(4);
  const data = periods[period];
  const currentValue = data.values[selected];

  function selectPeriod(nextPeriod: Period) {
    setPeriod(nextPeriod);
    setSelected(4);
  }

  return <>
    <div className={p.panelHeading}>
      <h3>Загрузка</h3>
      <div className={p.chartPeriods} role="group" aria-label="Период графика">
        {(Object.keys(periods) as Period[]).map(option => <button key={option} type="button" aria-pressed={period === option} onClick={() => selectPeriod(option)}>{option}</button>)}
      </div>
    </div>
    <div className={p.chartValue}>{currentValue}% <span><ArrowUpRight size={15} />{currentValue - data.previous[selected]} п.п.</span><small>{data.labels[selected]}</small></div>
    <div className={p.interactiveChart}>
      <svg viewBox="0 0 320 110" fill="none" role="img" aria-label={`График загрузки за ${period}`}>
        <defs><linearGradient id="occupancy-fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#8fbea1" stopOpacity=".45" /><stop offset="1" stopColor="#dce9df" stopOpacity="0" /></linearGradient></defs>
        <path d={`${pathFor(data.values)} L300 110 L20 110Z`} fill="url(#occupancy-fill)" />
        <path d={pathFor(data.previous)} className={p.previousChartLine} />
        <path d={pathFor(data.values)} className={p.currentChartLine} />
      </svg>
      {data.values.map((value, index) => <button
        key={`${period}-${data.labels[index]}`}
        type="button"
        className={p.chartPoint}
        data-selected={selected === index}
        style={{ left: `${xFor(index) / 3.2}%`, top: `${yFor(value) / 1.1}%` }}
        aria-label={`${data.labels[index]}: загрузка ${value}%`}
        aria-pressed={selected === index}
        onClick={() => setSelected(index)}
        onPointerEnter={() => setSelected(index)}
        onFocus={() => setSelected(index)}
      ><span>{value}%</span></button>)}
    </div>
    <div className={p.chartDates}>{data.labels.map(label => <span key={label}>{label}</span>)}</div>
    <div className={p.chartLegend}><span><i />Текущий период</span><span><i />Прошлый период</span><em>Наведите или нажмите на точку</em></div>
  </>;
}
