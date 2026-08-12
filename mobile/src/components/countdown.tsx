import { useEffect, useRef, useState } from "react";
import { AppState, Text, View, type TextProps } from "react-native";
import { Radius, Space, Text as Type, Weight, useTheme } from "@/theme";

/**
 * A live countdown to the pick deadline.
 *
 * Three things make this less trivial than it looks on a phone:
 *
 *  1. **Tick rate follows urgency.** Seconds matter in the last hour and
 *     nowhere else, so the timer runs once a second under an hour and once a
 *     minute above it. A 1 Hz timer running for three days is a battery bug.
 *  2. **Backgrounding.** JS timers are throttled or frozen when the app isn't
 *     foreground, so the clock would drift or stall. Rather than trust it, we
 *     recompute from the wall clock every time the app becomes active.
 *  3. **It stops.** At zero the interval is cleared — nothing keeps ticking
 *     into negative numbers behind a "Locked" label.
 */

export interface Remaining {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function remainingFrom(target: number): Remaining {
  const total = Math.max(0, target - Date.now());
  return {
    total,
    days: Math.floor(total / 86_400_000),
    hours: Math.floor(total / 3_600_000) % 24,
    minutes: Math.floor(total / 60_000) % 60,
    seconds: Math.floor(total / 1000) % 60,
    expired: total <= 0,
  };
}

export function useCountdown(iso: string | null | undefined): Remaining | null {
  const target = iso ? new Date(iso).getTime() : NaN;
  const valid = !Number.isNaN(target);
  const [now, setNow] = useState(() => (valid ? remainingFrom(target) : null));
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!valid) {
      setNow(null);
      return;
    }

    const stop = () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };

    const tick = () => {
      const next = remainingFrom(target);
      setNow(next);
      if (next.expired) stop();
    };

    const start = () => {
      stop();
      tick();
      const left = target - Date.now();
      if (left <= 0) return;
      // Under an hour, seconds are worth showing; above it they're just heat.
      timer.current = setInterval(tick, left < 3_600_000 ? 1000 : 60_000);
    };

    start();

    // Coming back from the background: recompute immediately and re-pick the
    // interval, since we may have crossed the one-hour boundary while away.
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") start();
    });

    return () => {
      stop();
      sub.remove();
    };
  }, [target, valid]);

  return now;
}

/** "2 days 4 hrs" · "3 hrs 12 min" · "08:41" in the last hour. */
export function formatRemaining(r: Remaining): string {
  if (r.expired) return "Locked";
  if (r.days > 0) return `${r.days}d ${r.hours}h`;
  if (r.hours > 0) return `${r.hours}h ${r.minutes}m`;
  return `${String(r.minutes).padStart(2, "0")}:${String(r.seconds).padStart(2, "0")}`;
}

/**
 * The deadline as a pill. Turns coral inside the last hour — the one moment
 * this game asks you to hurry.
 */
export function DeadlinePill({
  deadline,
  style,
}: {
  deadline: string | null | undefined;
  style?: TextProps["style"];
}) {
  const { colors } = useTheme();
  const left = useCountdown(deadline);
  if (!left) return null;

  const urgent = !left.expired && left.total < 3_600_000;
  const bg = left.expired ? colors.paper3 : urgent ? colors.accentWash : colors.paper3;
  const ink = left.expired ? colors.muted : urgent ? colors.accentInk : colors.ink2;

  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: Radius.pill,
        paddingHorizontal: Space.sm,
        paddingVertical: Space.xxs,
        alignSelf: "flex-start",
      }}
      accessibilityRole="timer"
      accessibilityLabel={
        left.expired ? "Picks are locked" : `Picks lock in ${formatRemaining(left)}`
      }
    >
      <Text
        style={[
          {
            color: ink,
            fontSize: Type.xs,
            fontWeight: Weight.bold,
            // Digits that don't jitter as the seconds change.
            fontVariant: ["tabular-nums"],
          },
          style,
        ]}
      >
        {left.expired ? "Locked" : `Locks in ${formatRemaining(left)}`}
      </Text>
    </View>
  );
}
