import ReactECharts from 'echarts-for-react';

const AXIS = '#334155';
const TEXT = '#94a3b8';

export function FunnelChart({
  data,
}: {
  data: { sent: number; opened: number; clicked: number; submitted: number };
}) {
  // Rótulos INTERNOS (name: value) para nunca estourarem a largura do card.
  const option = {
    tooltip: { trigger: 'item', formatter: '{b}: {c}' },
    series: [
      {
        type: 'funnel',
        left: '2%',
        right: '2%',
        top: 8,
        bottom: 8,
        width: '96%',
        minSize: '30%',
        maxSize: '100%',
        gap: 2,
        funnelAlign: 'center',
        label: {
          position: 'inside',
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          formatter: '{b}: {c}',
        },
        labelLine: { show: false },
        itemStyle: { borderColor: '#0f172a', borderWidth: 2 },
        emphasis: { label: { fontSize: 14 } },
        data: [
          { value: data.sent, name: 'Enviado', itemStyle: { color: '#3b82f6' } },
          { value: data.opened, name: 'Aberto', itemStyle: { color: '#22c55e' } },
          { value: data.clicked, name: 'Clicado', itemStyle: { color: '#f59e0b' } },
          {
            value: data.submitted,
            name: 'Submeteu',
            itemStyle: { color: '#ef4444' },
          },
        ],
      },
    ],
  };
  return <ReactECharts option={option} style={{ height: 260, width: '100%' }} />;
}

// Legenda explicativa das etapas do funil.
export function FunnelLegend() {
  const items = [
    { c: '#3b82f6', label: 'Enviado', desc: 'e-mails que saíram' },
    { c: '#22c55e', label: 'Aberto', desc: 'abriram o e-mail' },
    { c: '#f59e0b', label: 'Clicado', desc: 'clicaram no link (caíram)' },
    { c: '#ef4444', label: 'Submeteu', desc: 'enviaram dados no formulário' },
  ];
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs text-slate-400">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ background: i.c }}
          />
          <span className="text-slate-300">{i.label}</span>
          <span>— {i.desc}</span>
        </div>
      ))}
    </div>
  );
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
