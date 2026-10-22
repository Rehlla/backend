// src/components/ui/meeting-scheduler.tsx
//
// Date-range scheduler card (adapted from an Originui-style shadcn component).
// Re-skinned for the Dahab Luxury theme engine: every color routes through the
// theme-reactive tokens (--color-accent-primary gold, --surface-card,
// --border-subtle), display type uses the Cormorant/El Messiri font-display
// stack, and animation runs through `motion/react` like the rest of the app.
"use client";

import * as React from "react";
import { useState } from "react";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isAfter,
  isBefore,
} from "date-fns";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";

import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export interface MeetingSchedulerProps {
  /** The main title for the scheduler card. */
  title?: string;
  /** A short description under the title. */
  description?: string;
  /** The text for the schedule confirmation button. */
  scheduleButtonText?: string;
  /** The text for the cancel button. */
  cancelButtonText?: string;
  /** Weekday headers, Monday-first. Defaults to English abbreviations. */
  weekdayLabels?: string[];
  /** Initial selected start date. */
  initialStartDate?: Date;
  /** Initial selected end date. */
  initialEndDate?: Date;
  /** Callback fired when the schedule button is clicked. The dates carry
   *  the user-picked times (defaults 09:00 / 10:00 when untouched). */
  onSchedule: (details: { startDate: Date | null; endDate: Date | null; aiNotes: boolean }) => void;
  /** Callback fired when the cancel button is clicked. */
  onCancel: () => void;
}

const formatTime = (date: Date | null) => (date ? format(date, "h:mm a") : "—");

/** 30-minute steps across a 24h dial — coarse enough to tap, fine enough to be real. */
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
});

/** Applies an "HH:mm" to a date without touching its day component. */
const withTime = (date: Date, hhmm: string): Date => {
  const [h, m] = hhmm.split(":").map(Number);
  const next = new Date(date);
  next.setHours(h, m, 0, 0);
  return next;
};

export const MeetingScheduler: React.FC<MeetingSchedulerProps> = ({
  title = "Schedule a meeting",
  description = "Create your next meeting easily.",
  scheduleButtonText = "Schedule",
  cancelButtonText = "Cancel",
  weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  initialStartDate,
  initialEndDate,
  onSchedule,
  onCancel,
}) => {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(initialStartDate || new Date()));
  const [startDate, setStartDate] = useState<Date | null>(initialStartDate || null);
  const [endDate, setEndDate] = useState<Date | null>(initialEndDate || null);
  const [aiNotes, setAiNotes] = useState(false);

  // Real time selection — defaults mirror the original static display so an
  // untouched picker still schedules at 9:00 → 10:00.
  const [startTime, setStartTime] = useState<string>(
    initialStartDate ? format(initialStartDate, "HH:mm") : "09:00",
  );
  const [endTime, setEndTime] = useState<string>(
    initialEndDate ? format(initialEndDate, "HH:mm") : "10:00",
  );

  const handleStartTimeChange = (hhmm: string) => {
    setStartTime(hhmm);
    if (startDate) setStartDate(withTime(startDate, hhmm));
  };
  const handleEndTimeChange = (hhmm: string) => {
    setEndTime(hhmm);
    if (endDate) setEndDate(withTime(endDate, hhmm));
  };

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 }),
  });

  const handleDateClick = (day: Date) => {
    if (!startDate || (startDate && endDate)) {
      setStartDate(withTime(day, startTime));
      setEndDate(null);
    } else if (isBefore(day, startDate)) {
      setStartDate(withTime(day, startTime));
    } else {
      setEndDate(withTime(day, endTime));
    }
  };

  const getEventSummary = () => {
    if (!startDate || !endDate) return "Select start and end dates to schedule";  /* Apple HIG: clear action feedback */
    const startFormatted = format(startDate, "MMM d");
    if (!endDate) return `${startFormatted}`;
    return `${startFormatted} – ${format(endDate, "MMM d")}, ${formatTime(startDate)} – ${formatTime(endDate)}`;
  };

  return (
    <Card className="w-full max-w-4xl overflow-hidden border-border-subtle bg-surface-card/90 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.52  /* Apple HIG: align to --dg-dur-slow (520ms) design token */, ease: "easeOut" }}
      >
        <CardHeader className="flex-row items-start gap-4">
          <div className="rounded-full bg-accent-primary/10 p-3 text-accent-primary">
            <Clock className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="grid grid-cols-1 gap-8 p-6 md:grid-cols-2">
          {/* Left: calendar */}
          <div className="flex flex-col">
            <div className="mb-4 flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} aria-label="Previous month">
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </Button>
              <AnimatePresence mode="wait">
                <motion.h3
                  key={format(currentMonth, "MMMM yyyy")}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className="font-display text-lg font-medium"
                >
                  {format(currentMonth, "MMMM yyyy")}
                </motion.h3>
              </AnimatePresence>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} aria-label="Next month">
                <ChevronRight className="h-5 w-5" aria-hidden />
              </Button>
            </div>

            <div className="grid grid-cols-7 text-center text-xs text-text-secondary">
              {weekdayLabels.map((day) => (
                <div key={day} className="py-2">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const isSelected =
                  (startDate && isSameDay(day, startDate)) || (endDate && isSameDay(day, endDate));
                const isInRange = startDate && endDate && isAfter(day, startDate) && isBefore(day, endDate);
                const isStart = startDate && isSameDay(day, startDate);
                const isEnd = endDate && isSameDay(day, endDate);

                return (
                  <motion.button
                    key={day.toString()}
                    type="button"
                    onClick={() => handleDateClick(day)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      "relative flex h-10 w-10 items-center justify-center rounded-full text-sm transition-colors duration-200",
                      !isSameMonth(day, currentMonth) && "text-text-secondary/40",
                      isSameDay(day, new Date()) && !isSelected && "font-bold text-accent-primary",
                      isSelected && "bg-accent-primary text-[var(--accent-primary-ink)]",
                      isInRange && "rounded-none bg-accent-primary/15 text-text-primary",
                      isStart && "rounded-r-none",
                      isEnd && "rounded-l-none",
                    )}
                  >
                    {format(day, "d")}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Right: inputs */}
          <div className="flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="scheduler-start-date" className="text-sm">Start date*</Label>
                <div className="mt-2 flex items-center rounded-xl border border-border-subtle bg-canvas p-3">
                  <span className="flex-grow text-sm">
                    {startDate ? format(startDate, "MMMM d, yyyy") : "—"}
                  </span>
                  <select
                    aria-label="Start time"
                    value={startTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                    className="cursor-pointer rounded-lg bg-accent-primary/10 px-3 py-1 text-sm font-semibold text-accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dg-focus)]  /* Apple HIG: visible focus ring */"
                  >
                    {TIME_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{format(withTime(new Date(), opt), "h:mm a")}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="scheduler-end-date" className="text-sm">End date*</Label>
                <div className="mt-2 flex items-center rounded-xl border border-border-subtle bg-canvas p-3">
                  <span className="flex-grow text-sm">
                    {endDate ? format(endDate, "MMMM d, yyyy") : "—"}
                  </span>
                  <select
                    aria-label="End time"
                    value={endTime}
                    onChange={(e) => handleEndTimeChange(e.target.value)}
                    className="cursor-pointer rounded-lg bg-accent-primary/10 px-3 py-1 text-sm font-semibold text-accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dg-focus)]  /* Apple HIG: visible focus ring */"
                  >
                    {TIME_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{format(withTime(new Date(), opt), "h:mm a")}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <Label htmlFor="scheduler-ai-notes">AI notes</Label>
                <Switch id="scheduler-ai-notes" checked={aiNotes} onCheckedChange={setAiNotes} />
              </div>
            </div>

            <div className="border-t border-border-subtle pt-4">
              <p className="mb-4 text-sm text-text-secondary">{getEventSummary()}</p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={onCancel}>{cancelButtonText}</Button>
                <Button onClick={() => onSchedule({ startDate, endDate, aiNotes })} disabled={!startDate || !endDate}>
                  {scheduleButtonText}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </motion.div>
    </Card>
  );
};
