import { useEffect, useRef } from "react";
import Plotly from "plotly.js-dist-min";

interface PlotlyRendererProps {
  data: unknown[];
  layout?: {
    xaxis?: Record<string, unknown>;
    yaxis?: Record<string, unknown>;
    [key: string]: unknown;
  };
  config?: Record<string, unknown>;
}

export default function PlotlyRenderer({ data, layout, config }: PlotlyRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Purge any existing plot inside the container
    Plotly.purge(el);

    const { xaxis, yaxis, margin, height: layoutHeight, polar, ...restLayout } = layout || {};

    // Analyze data traces to classify chart type family
    const traces = Array.isArray(data) ? data : [];
    let isPolar = false;
    let isCartesian = false;
    let isNonAxis = false;

    for (const trace of traces) {
      if (trace && typeof trace === "object") {
        const type = (trace as Record<string, unknown>).type;
        if (typeof type === "string") {
          const t = type.toLowerCase();
          if (t === "scatterpolar" || t === "barpolar") {
            isPolar = true;
          } else if (t === "pie" || t === "treemap" || t === "sunburst") {
            isNonAxis = true;
          } else {
            isCartesian = true;
          }
        }
      }
    }

    // Default to Cartesian if nothing explicit found
    if (!isPolar && !isCartesian && !isNonAxis) {
      isCartesian = true;
    }

    // Apply premium styling defaults aligned with MindVault's palette
    const finalLayout: Record<string, unknown> = {
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      font: {
        family: "Inter, system-ui, -apple-system, sans-serif",
        color: "rgba(27, 26, 23, 0.8)",
      },
      margin: { t: 40, r: 20, b: 40, l: 40, ...(margin as Record<string, unknown>) },
      height: layoutHeight || 360,
      ...restLayout,
    };

    if (isPolar) {
      finalLayout.polar = {
        bgcolor: "transparent",
        radialaxis: {
          visible: true,
          gridcolor: "rgba(188, 108, 37, 0.08)",
          linecolor: "rgba(188, 108, 37, 0.12)",
          tickcolor: "rgba(188, 108, 37, 0.12)",
        },
        angularaxis: {
          gridcolor: "rgba(188, 108, 37, 0.08)",
          linecolor: "rgba(188, 108, 37, 0.12)",
          tickcolor: "rgba(188, 108, 37, 0.12)",
        },
        ...(polar as Record<string, unknown>),
      };
    } else if (isCartesian) {
      finalLayout.xaxis = {
        automargin: true,
        gridcolor: "rgba(188, 108, 37, 0.06)",
        linecolor: "rgba(188, 108, 37, 0.12)",
        zerolinecolor: "rgba(188, 108, 37, 0.18)",
        tickcolor: "rgba(188, 108, 37, 0.12)",
        ...(xaxis as Record<string, unknown>),
      };
      finalLayout.yaxis = {
        automargin: true,
        gridcolor: "rgba(188, 108, 37, 0.06)",
        linecolor: "rgba(188, 108, 37, 0.12)",
        zerolinecolor: "rgba(188, 108, 37, 0.18)",
        tickcolor: "rgba(188, 108, 37, 0.12)",
        ...(yaxis as Record<string, unknown>),
      };
    }

    const finalConfig = {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ["toImage", "sendDataToCloud"],
      ...config,
    };

    try {
      Plotly.newPlot(el, data, finalLayout, finalConfig);
    } catch (err) {
      console.error("Plotly.newPlot rendering exception:", err);
    }

    const handleResize = () => {
      if (el) {
        Plotly.Plots.resize(el);
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (el) {
        Plotly.purge(el);
      }
    };
  }, [data, layout, config]);

  return (
    <div
      ref={containerRef}
      className="plotly-graph-container"
      style={{ width: "100%", height: "100%", minHeight: "300px" }}
    />
  );
}
export type { PlotlyRendererProps };
