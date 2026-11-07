import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { WorkScheduleModal } from './WorkScheduleModal';
import { useAuthStore } from '../features/auth/authStore';
import { getAuthoritativeServerDate } from '../services/api';
import { useLanguage } from '../hooks/useLanguage';

export const SidebarCalendar: React.FC = () => {
  const { user } = useAuthStore();
  const { lang } = useLanguage();

  // Dynamic today anchor linked to authoritative server time
  const [today, setToday] = useState<Date>(() => getAuthoritativeServerDate());

  useEffect(() => {
    const timer = setInterval(() => {
      setToday(getAuthoritativeServerDate());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Selected view month & year initialized to today's month & year
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const t = getAuthoritativeServerDate();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(() => getAuthoritativeServerDate());

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth(); // 0-indexed

  // Month navigation
  const prevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  // Month title localized
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const monthTitle = currentMonth.toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Days calculations
  // Sunday = 0, Monday = 1 ... Saturday = 6
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Days with scheduled factory work/events (excluding Sundays)
  const hasEvent = (d: number) => {
    const checkDate = new Date(year, month, d);
    // Factory shop-floor operations run Monday through Saturday; Sundays are non-working rest days
    if (checkDate.getDay() === 0) return false;
    return true;
  };

  const handleDayClick = (dayNum: number, isCurrentMonthDay: boolean) => {
    if (!isCurrentMonthDay) return;
    const clicked = new Date(year, month, dayNum);
    setSelectedDate(clicked);
    setIsModalOpen(true);
  };

  const weekDayHeaders = lang === 'ta'
    ? ['ஞா', 'தி', 'செ', 'பு', 'வி', 'வெ', 'ச']
    : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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
    const isToday =
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === d;
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
      {/* Elevated Navy Calendar Card */}
      <div className="rounded-2xl p-3 bg-gradient-to-b from-[#133F65] to-[#0E2F4D] text-white shadow-xl border border-sky-400/35 ring-1 ring-white/10 select-none">
        {/* Month Header with Navigation */}
        <div className="flex items-center justify-between mb-2.5 px-1 pb-1.5 border-b border-sky-400/20">
          <span className="text-xs font-black uppercase tracking-wider text-amber-300 font-mono drop-shadow-xs">
            {monthTitle}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-sky-200 hover:text-white transition-all cursor-pointer active:scale-95"
              title="Previous Month"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-sky-200 hover:text-white transition-all cursor-pointer active:scale-95"
              title="Next Month"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Days of Week Row */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
          {weekDayHeaders.map((w, idx) => (
            <span
              key={idx}
              className={`text-[10px] font-black uppercase font-mono ${
                idx === 0 || idx === 6 ? 'text-amber-400/80' : 'text-sky-200/60'
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
                  className="h-6 flex items-center justify-center text-[10px] font-medium text-sky-200/25 cursor-default"
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
                    ? 'bg-amber-400 text-slate-950 font-black shadow-md ring-2 ring-amber-300 scale-105 z-10'
                    : isSelected
                    ? 'bg-sky-500 text-white font-black shadow-sm ring-1 ring-sky-300'
                    : 'text-sky-100 hover:bg-white/15 hover:text-white'
                }`}
                title={
                  lang === 'ta'
                    ? `${year} ${monthNames[month]} ${cell.day} அன்று திட்டமிடப்பட்ட பணிகள்`
                    : `View planned work for ${monthNames[month]} ${cell.day}, ${year}`
                }
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
                        : 'bg-amber-400'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Footer Prompt */}
        <div className="mt-2.5 pt-2 border-t border-sky-400/20 flex items-center justify-between text-[10px] text-sky-200/80 px-1">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>{lang === 'ta' ? 'திட்டமிடப்பட்ட பணி' : 'Event planned'}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              const now = getAuthoritativeServerDate();
              setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
              setSelectedDate(now);
              setIsModalOpen(true);
            }}
            className="text-amber-300 hover:text-amber-200 font-bold hover:underline cursor-pointer"
          >
            {lang === 'ta'
              ? `இன்று (${today.toLocaleDateString('ta-IN', { month: 'short' })} ${String(today.getDate()).padStart(2, '0')})`
              : `Today (${today.toLocaleDateString('en-US', { month: 'short' })} ${String(today.getDate()).padStart(2, '0')})`}
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
