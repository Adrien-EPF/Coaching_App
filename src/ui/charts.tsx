import React, { useState } from "react";
import { GestureResponderEvent, Pressable, View } from "react-native";
import Svg, { Line, Circle, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { PERIODS, Period } from "../domain/progressSeries";
import { Chip, Row, Txt } from "./kit";
import { fonts, space, useColors } from "./theme";

const PAD = { left: 40, right: 12, top: 12, bottom: 24 };

/** A "nice" top for an axis: a round number at or above the max. */
function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  return [1, 2, 2.5, 5, 10].map((m) => m * pow).find((v) => v >= max) ?? max;
}

export interface ChartPoint {
  /** Position on the x axis (any increasing number, e.g. days). */
  x: number;
  y: number;
}

export interface ChartMark {
  x: number;
  color: string;
}

export interface ChartGuide {
  y: number;
  color: string;
}

/**
 * A single-series line chart in SVG. Touch anywhere to select the nearest point.
 * Vertical marks (e.g. a change of Training Goal) and dashed horizontal guides (e.g. a target) are drawn behind the line.
 */
export function LineChart({
  points,
  marks = [],
  guides = [],
  xTicks = [],
  selected,
  onSelect,
  formatY = (v) => String(Math.round(v)),
  height = 200,
  label,
}: {
  points: ChartPoint[];
  marks?: ChartMark[];
  guides?: ChartGuide[];
  /** Labels under the axis, at an x position. */
  xTicks?: { x: number; label: string }[];
  selected: number | null;
  onSelect: (index: number | null) => void;
  formatY?: (v: number) => string;
  height?: number;
  /** Read by screen readers. */
  label: string;
}) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const xs = [...points.map((p) => p.x), ...marks.map((m) => m.x)];
  const ys = [...points.map((p) => p.y), ...guides.map((g) => g.y)];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const span = Math.max(hi - lo, hi * 0.05, 1);
  const yMin = Math.max(0, lo - span * 0.15);
  const yMax = hi + span * 0.15;
  const plotW = Math.max(width - PAD.left - PAD.right, 1);
  const plotH = height - PAD.top - PAD.bottom;
  const sx = (x: number) => PAD.left + (maxX === minX ? plotW / 2 : ((x - minX) / (maxX - minX)) * plotW);
  const sy = (y: number) => PAD.top + plotH - ((y - yMin) / (yMax - yMin)) * plotH;
  const grid = [0, 1, 2, 3].map((i) => yMin + ((yMax - yMin) * i) / 3);

  const pick = (e: GestureResponderEvent) => {
    const x = e.nativeEvent.locationX;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(sx(p.x) - x) < Math.abs(sx(points[best].x) - x)) best = i;
    });
    onSelect(best === selected ? null : best);
  };

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 && points.length > 0 ? (
        <Pressable accessibilityRole="image" accessibilityLabel={label} onPress={pick}>
          <Svg width={width} height={height}>
            {grid.map((g) => (
              <React.Fragment key={g}>
                <Line x1={PAD.left} x2={width - PAD.right} y1={sy(g)} y2={sy(g)} stroke={c.line} strokeWidth={1} />
                <SvgText x={PAD.left - 6} y={sy(g) + 4} fontSize={11} fontFamily={fonts.sansMedium} fill={c.inkMuted} textAnchor="end">
                  {formatY(g)}
                </SvgText>
              </React.Fragment>
            ))}
            {marks.map((m, i) => (
              <Line key={i} x1={sx(m.x)} x2={sx(m.x)} y1={PAD.top} y2={PAD.top + plotH} stroke={m.color} strokeWidth={2} />
            ))}
            {guides.map((g, i) => (
              <Line key={i} x1={PAD.left} x2={width - PAD.right} y1={sy(g.y)} y2={sy(g.y)} stroke={g.color} strokeWidth={2} strokeDasharray="6 4" />
            ))}
            {xTicks.map((t) => (
              <SvgText key={t.x} x={sx(t.x)} y={height - 6} fontSize={11} fontFamily={fonts.sansMedium} fill={c.inkMuted} textAnchor="middle">
                {t.label}
              </SvgText>
            ))}
            <Polyline points={points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ")} fill="none" stroke={c.ink} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => (
              <Circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={i === selected ? 7 : 4} fill={i === selected ? c.lime : c.surfaceRaised} stroke={c.ink} strokeWidth={2} />
            ))}
          </Svg>
        </Pressable>
      ) : null}
    </View>
  );
}

export interface BarSegment {
  value: number;
  color: string;
}

export interface Bar {
  segments: BarSegment[];
  /** Under the bar; leave empty on most bars of a long chart. */
  label?: string;
}

/** Stacked bars in SVG, one per slot (e.g. a week). Touch a bar to select it; empty slots stay selectable. */
export function BarChart({
  bars,
  selected,
  onSelect,
  formatY = (v) => String(Math.round(v)),
  height = 160,
  label,
}: {
  bars: Bar[];
  selected: number | null;
  onSelect: (index: number | null) => void;
  formatY?: (v: number) => string;
  height?: number;
  label: string;
}) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const total = (b: Bar) => b.segments.reduce((sum, s) => sum + s.value, 0);
  const top = niceMax(Math.max(0, ...bars.map(total)));
  const plotW = Math.max(width - PAD.left - PAD.right, 1);
  const plotH = height - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(bars.length, 1);
  const barW = Math.max(Math.min(slot * 0.7, 32), 2);
  const sy = (v: number) => PAD.top + plotH - (v / top) * plotH;

  const pick = (e: GestureResponderEvent) => {
    const i = Math.floor((e.nativeEvent.locationX - PAD.left) / slot);
    onSelect(i >= 0 && i < bars.length ? i : null);
  };

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 && bars.length > 0 ? (
        <Pressable accessibilityRole="image" accessibilityLabel={label} onPress={pick}>
          <Svg width={width} height={height}>
            {[0, 0.5, 1].map((f) => (
              <React.Fragment key={f}>
                <Line x1={PAD.left} x2={width - PAD.right} y1={sy(top * f)} y2={sy(top * f)} stroke={c.line} strokeWidth={1} />
                <SvgText x={PAD.left - 6} y={sy(top * f) + 4} fontSize={11} fontFamily={fonts.sansMedium} fill={c.inkMuted} textAnchor="end">
                  {formatY(top * f)}
                </SvgText>
              </React.Fragment>
            ))}
            {bars.map((b, i) => {
              const x = PAD.left + slot * i + (slot - barW) / 2;
              let acc = 0;
              return (
                <React.Fragment key={i}>
                  {i === selected ? <Rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={plotH} fill={c.limeSoft} /> : null}
                  {b.segments.map((s, k) => {
                    const y0 = sy(acc);
                    acc += s.value;
                    return s.value > 0 ? <Rect key={k} x={x} y={sy(acc)} width={barW} height={y0 - sy(acc)} fill={s.color} /> : null;
                  })}
                  {b.label ? (
                    <SvgText x={x + barW / 2} y={height - 6} fontSize={11} fontFamily={fonts.sansMedium} fill={c.inkMuted} textAnchor="middle">
                      {b.label}
                    </SvgText>
                  ) : null}
                </React.Fragment>
              );
            })}
          </Svg>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A color swatch and its label: the legend of a chart never relies on color alone. */
export function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
      <View style={{ width: 16, height: 0, borderTopWidth: 3, borderTopColor: color, borderStyle: dashed ? "dashed" : "solid" }} />
      <Txt kind="caption" muted>{label}</Txt>
    </View>
  );
}

/** The period of a chart: 1 month, 3 months, 6 months, all. */
export function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <Row>
      {PERIODS.map((p) => (
        <Chip key={p.key} label={p.label} selected={value === p.key} onPress={() => onChange(p.key)} />
      ))}
    </Row>
  );
}
