import ReactECharts from 'echarts-for-react';

const AXIS = '#334155';
const TEXT = '#94a3b8';

export function FunnelChart({
  data,
}: {
  data: { sent: number; opened: number; clicked: number; submitted: number };
}) {
  const option = {
    tooltip: { trigger: 'item', formatter: '{b}: {c}' },
    series: [
      {
        type: 'funnel',
        left: '5%',
        right: '5%',
        top: 10,
        bottom: 10,
        minSize: '20%',
        gap: 3,
        label: { color: '#e2e8f0', formatter: '{b}\n{c}' },
        itemStyle: { borderColor: '#0f172a', borderWidth: 2 },
        data: [
          { value: data.sent, name: 'Enviado', itemStyle: { color: '#3b82f6' } },
          { value: data.opened, name: 'Aberto', itemStyle: { color: '#22c55e' } },
          { value: data.clicked, name: 'Clicado', itemStyle: { color: '#f59e0b' } },
          {
            value: data.submitted,
            name: 'Submeteu dados',
            itemStyle: { color: '#ef4444' },
          },
        ],
      },
    ],
  };
  return <ReactECharts option={option} style={{ height: 280 }} />;
}

export function SectorChart({
  data,
  onSelect,
}: {
  data: { department: string; clickRate: number; clicked: number; total: number }[];
  onSelect?: (department: string) => void;
}) {
  const option = {
    grid: { left: 8, right: 24, top: 20, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      formatter: (p: { name: string; value: number }[]) =>
        `${p[0].name}: ${p[0].value}%`,
    },
    xAxis: {
      type: 'value',
      max: 100,
      axisLabel: { color: TEXT, formatter: '{value}%' },
      splitLine: { lineStyle: { color: AXIS } },
    },
    yAxis: {
      type: 'category',
      data: data.map((d) => d.department),
      axisLabel: { color: TEXT },
      axisLine: { lineStyle: { color: AXIS } },
    },
    series: [
      {
        type: 'bar',
        data: data.map((d) => ({
          value: d.clickRate,
          itemStyle: {
            color: d.clickRate >= 50 ? '#ef4444' : d.clickRate >= 25 ? '#f59e0b' : '#22c55e',
            borderRadius: [0, 4, 4, 0],
          },
        })),
        label: { show: true, position: 'right', color: '#e2e8f0', formatter: '{c}%' },
        barMaxWidth: 26,
      },
    ],
  };
  return (
    <ReactECharts
      option={option}
      style={{ height: Math.max(140, data.length * 44) }}
      onEvents={{
        click: (p: { name: string }) => onSelect?.(p.name),
      }}
    />
  );
}
