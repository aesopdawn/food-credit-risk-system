"use client";
import { useEffect, useRef } from "react";
import * as echarts from "echarts";

// 轻量 ECharts React 包装（不依赖 echarts-for-react，避免与 React 19 的 peer 冲突）
export default function EChart({
  option,
  height = 300,
}: {
  option: echarts.EChartsCoreOption;
  height?: number | string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chart.setOption(option);
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [option]);

  return <div ref={ref} style={{ width: "100%", height }} />;
}
