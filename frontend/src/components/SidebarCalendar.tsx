import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { WorkScheduleModal } from './WorkScheduleModal';
import { useAuthStore } from '../features/auth/authStore';

export const SidebarCalendar: React.FC = () => {
  const { user } = useAuthStore();

  // Selected view month & year (Anchor: November 2026)
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date(2026, 10, 1));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(2026, 10, 4));

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth(); // 0-indexed

  // Month navigation
  const prevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  // Month name
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const monthTitle = `${monthNames[month]} ${year}`;

  // Days calculations
  // Sunday = 0, Monday = 1 ... Saturday = 6
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Days with scheduled work/events:
  // For November 2026, days 2, 3, 4 (Today), 5, 6, 9, 12, 18, 20, 24 have scheduled PO events/line work
  const hasEvent = (d: number) => {
    if (year === 2026 && month === 10) {
      return [2, 3, 4, 5, 6, 9, 10, 12, 14, 18, 20, 24].includes(d);
    }
    // Periodic event pattern for other months
    return d % 3 === 0 || d % 5 === 0;
  };

  const handleDayClick = (dayNum: number, isCurrentMonthDay: boolean) => {
    if (!isCurrentMonthDay) return;
    const clicked = new Date(year, month, dayNum);
    setSelectedDate(clicked);
    setIsModalOpen(true);
  };

  const weekDayHeaders = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Grid builder
  const calendarCells = [];

  // 1. Previous month trailing days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    calendarCells.push({
      day: daysInPrevMonth - i,
      isCurrentMonth: false,
      key: `prev-${i}`,
    });
  }

  // 2. Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = year === 2026 && month === 10 && d === 4;
    calendarCells.push({
      day: d,
      isCurrentMonth: true,
      isToday,
      hasDot: hasEvent(d),
      key: `curr-${d}`,
    });
  }

  // 3. Next month leading days to complete grid (multiples of 7)
  const remainingCells = (7 - (calendarCells.length % 7)) % 7;
  for (let j = 1; j <= remainingCells; j++) {
    calendarCells.push({
      day: j,
      isCurrentMonth: false,
      key: `next-${j}`,
    });
  }

  return (
    <>
      {/* Light-Themed Month Calendar Card */}
      <div className="rounded-2xl p-3 bg-white text-slate-800 shadow-md border border-slate-200/90 select-none">
        {/* Month Header with Navigation */}
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-900 font-mono">
            {monthTitle}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Days of Week Row */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1.5 border-b border-slate-100 pb-1">
          {weekDayHeaders.map((w, idx) => (
            <span
              key={idx}
              className={`text-[10px] font-black uppercase font-mono ${
                idx === 0 || idx === 6 ? 'text-rose-500' : 'text-slate-400'
              }`}
            >
              {w}
            </span>
          ))}
        </div>

        {/* Day Number Grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {calendarCells.map((cell) => {
            if (!cell.isCurrentMonth) {
              return (
                <div
                  key={cell.key}
                  className="h-6 flex items-center justify-center text-[10px] font-medium text-slate-300 cursor-default"
                >
                  {cell.day}
                </div>
              );
            }

            const isSelected =
              selectedDate.getFullYear() === year &&
              selectedDate.getMonth() === month &&
              selectedDate.getDate() === cell.day;

            return (
              <button
                key={cell.key}
                type="button"
                onClick={() => handleDayClick(cell.day, true)}
                className={`h-6 rounded-lg text-[10px] font-bold font-mono relative flex flex-col items-center justify-center transition-all cursor-pointer ${
                  cell.isToday
                    ? 'bg-amber-400 text-slate-950 font-black shadow-xs ring-2 ring-amber-300/80 scale-105'
                    : isSelected
                    ? 'bg-[#0C2D48] text-white font-black shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                }`}
                title={`View planned work for ${monthNames[month]} ${cell.day}, ${year}`}
              >
                <span>{cell.day}</span>
                {/* Single Event Related Dot Indicator */}
                {cell.hasDot && (
                  <span
                    className={`w-1 h-1 rounded-full absolute bottom-0.5 ${
                      cell.isToday
                        ? 'bg-slate-950'
                        : isSelected
                        ? 'bg-amber-300'
                        : 'bg-amber-500'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Footer Prompt */}
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 px-0.5">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Event planned</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedDate(new Date(2026, 10, 4));
              setIsModalOpen(true);
            }}
            className="text-amber-600 hover:text-amber-700 font-bold hover:underline cursor-pointer"
          >
            Today (Nov 04)
          </button>
        </div>
      </div>

      {/* Center Event Work Schedule Modal */}
      <WorkScheduleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedDate={selectedDate}
      />
    </>
  );
};
