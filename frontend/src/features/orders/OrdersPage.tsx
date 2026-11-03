import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  Loader2,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import { OrderListItem, Buyer, Unit, RiskLevel, PaginationMeta } from '../../types';
import { apiRequest } from '../../services/api';
import { StatusBadge } from '../../components/StatusBadge';
import { CustomSelect, Option } from '../../components/CustomSelect';
import { OrderForm } from './OrderForm';
import { BulkShiftModal } from './BulkShiftModal';
import { useAuthStore } from '../auth/authStore';
import { ShiftCutoffBanner } from '../dashboard/ShiftCutoffBanner';
import { useLanguage } from '../../hooks/useLanguage';
import { STAGE_TRANSLATIONS } from '../supervisor/supervisorTranslations';

export const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { hasRole } = useAuthStore();
  const { isTa, t } = useLanguage();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Multi-Selection State for Bulk Actions
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isBulkShiftModalOpen, setIsBulkShiftModalOpen] = useState(false);

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  // Sticky Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | RiskLevel | 'COMPLETED'>('ALL');
  const [buyerFilter, setBuyerFilter] = useState<string>('ALL');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');
  const [shipWeekFilter, setShipWeekFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isMobileFilterExpanded, setIsMobileFilterExpanded] = useState<boolean>(false);

  // Order Creation Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchMasterData = async () => {
    try {
      const res = await apiRequest<{ success: boolean; data: { buyers: Buyer[]; units: Unit[] } }>(
        '/orders/master-data'
      );
      setBuyers(res.data.buyers || []);
      setUnits(res.data.units || []);
    } catch {
      // Non-blocking fallback
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (buyerFilter !== 'ALL') params.append('buyerId', buyerFilter);
      if (unitFilter !== 'ALL') params.append('unitId', unitFilter);
      if (shipWeekFilter !== 'ALL') params.append('shipWeek', shipWeekFilter);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      const res = await apiRequest<{
        success: boolean;
        data: OrderListItem[];
        pagination?: PaginationMeta;
      }>(`/orders?${params.toString()}`);

      setOrders(res.data || []);
      if (res.pagination) {
        setPagination(res.pagination);
      } else {
        setPagination({
          page,
          limit,
          total: res.data?.length || 0,
          totalPages: Math.ceil((res.data?.length || 0) / limit) || 1,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, buyerFilter, unitFilter, shipWeekFilter, page, limit]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
  };

  const handleStatusChange = (status: 'ALL' | RiskLevel | 'COMPLETED') => {
    setStatusFilter(status);
    setPage(1);
  };

  const handleBuyerChange = (val: string) => {
    setBuyerFilter(val);
    setPage(1);
  };

  const handleUnitChange = (val: string) => {
    setUnitFilter(val);
    setPage(1);
  };

  const handleShipWeekChange = (val: string) => {
    setShipWeekFilter(val);
    setPage(1);
  };

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const aCompleted = Boolean(
        a.healthStatus === 'COMPLETED' ||
        (a.activeStage === 'FINISHING' && a.activeStageProgressPct >= 100)
      );
      const bCompleted = Boolean(
        b.healthStatus === 'COMPLETED' ||
        (b.activeStage === 'FINISHING' && b.activeStageProgressPct >= 100)
      );

      if (aCompleted && !bCompleted) return 1;
      if (!aCompleted && bCompleted) return -1;
      return 0;
    });
  }, [orders]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    });
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === orders.length && orders.length > 0) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(orders.map((o) => o.id));
    }
  };

  const toggleSelectOrder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleExportCsv = () => {
    if (orders.length === 0) return;
    const headers = [
      'PO Number',
      'Style',
      'Buyer',
      'Buyer Code',
      'Country',
      'Assigned Unit',
      'Total Quantity (pcs)',
      'Ship Week (CW)',
      'Working Days Left',
      'Ex-Factory Date',
      'Active Stage',
      'Stage Progress (%)',
      'Health Status',
    ];

    const rows = orders.map((o) => [
      `"${o.poNumber}"`,
      `"${o.style.replace(/"/g, '""')}"`,
      `"${o.buyer.name}"`,
      `"${o.buyer.code}"`,
      `"${o.buyer.country || 'Europe'}"`,
      `"${o.unit.name}"`,
      o.totalQuantity,
      o.shipWeek,
      o.workingDaysLeft,
      new Date(o.exFactoryDate).toISOString().split('T')[0],
      `"${o.activeStage}"`,
      o.activeStageProgressPct,
      o.healthStatus,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ThreadFlow_TNA_Orders_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Derive available ship weeks from orders list
  const availableShipWeeks = Array.from(new Set(orders.map((o) => o.shipWeek))).sort((a, b) => a - b);

  const buyerOptions: Option[] = [
    { value: 'ALL', label: 'All Foreign Buyers' },
    ...buyers.map((b) => ({
      value: b.id,
      label: `${b.name} (${b.code})`,
      badge: b.country || 'Europe',
    })),
  ];

  const unitOptions: Option[] = [
    { value: 'ALL', label: 'All Production Units' },
    ...units.map((u) => ({
      value: u.id,
      label: u.name,
      badge: u.type === 'SUBCONTRACTOR' ? 'Subcontract' : 'In-House',
    })),
  ];

  const shipWeekOptions: Option[] = [
    { value: 'ALL', label: 'All Ship Weeks' },
    ...availableShipWeeks.map((cw) => ({
      value: cw.toString(),
      label: `Calendar Week ${cw}`,
    })),
  ];

  const limitOptions: Option[] = [
    { value: '5', label: '5 per page' },
    { value: '10', label: '10 per page' },
    { value: '20', label: '20 per page' },
    { value: '50', label: '50 per page' },
  ];

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Page Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t.orders.title}</h1>
          <p className="text-xs text-slate-500 mt-1">
            {t.orders.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchOrders}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-xs transition cursor-pointer"
            title={t.common.refresh}
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleExportCsv}
            disabled={orders.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold rounded-xl text-xs shadow-xs transition disabled:opacity-50 cursor-pointer"
            title="Export currently filtered orders to CSV"
          >
            <Download className="w-4 h-4 text-sky-700" />
            <span className="hidden sm:inline">{t.common.exportCsv}</span>
          </button>

          {hasRole('MERCHANDISER', 'ADMIN') && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0C2D48] hover:bg-[#143D60] text-white font-semibold rounded-xl text-xs shadow-md transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {t.orders.newOrder}
            </button>
          )}
        </div>
      </div>

      {/* Shift Cut-Off Missing Update Detector (Feature 13 - Compact Alert) */}
      <ShiftCutoffBanner />

      {/* Filter Bar (Relative on mobile so it never covers content when scrolling; Sticky on sm+) */}
      <div className="relative sm:sticky sm:top-0 z-10 bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3">
          {/* Status Tabs (Actual Terms: Critical Deficit / Buffer Caution / On Track / Completed) */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1 sm:gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto no-scrollbar">
              {(
                [
                  { key: 'ALL', label: isTa ? 'அனைத்து ஆர்டர்கள்' : 'All Orders', shortLabel: isTa ? 'அனைத்தும்' : 'All', dot: '' },
                  { key: 'RED', label: isTa ? 'முக்கிய பற்றாக்குறை' : 'Critical Deficit', shortLabel: isTa ? 'முக்கியம்' : 'Critical', dot: 'bg-rose-500' },
                  { key: 'AMBER', label: isTa ? 'எச்சரிக்கை' : 'Buffer Caution', shortLabel: isTa ? 'எச்சரிக்கை' : 'Caution', dot: 'bg-amber-500' },
                  { key: 'GREEN', label: isTa ? 'சரியான பாதை' : 'On Track', shortLabel: isTa ? 'பாதை' : 'On Track', dot: 'bg-emerald-500' },
                  { key: 'COMPLETED', label: isTa ? 'முடிந்தது' : 'Completed', shortLabel: isTa ? 'முடிந்தது' : 'Completed', dot: 'bg-emerald-600' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleStatusChange(tab.key)}
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    statusFilter === tab.key
                      ? tab.key === 'RED'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : tab.key === 'AMBER'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : tab.key === 'GREEN'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : tab.key === 'COMPLETED'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.dot && statusFilter !== tab.key && (
                    <span className={`w-1.5 h-1.5 rounded-full ${tab.dot}`} />
                  )}
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Mobile Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setIsMobileFilterExpanded(!isMobileFilterExpanded)}
              className="sm:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
              title="Toggle dropdown filters"
            >
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>{t.common.filter}</span>
              {(buyerFilter !== 'ALL' || unitFilter !== 'ALL' || shipWeekFilter !== 'ALL') && (
                <span className="w-4 h-4 rounded-full bg-sky-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {(buyerFilter !== 'ALL' ? 1 : 0) + (unitFilter !== 'ALL' ? 1 : 0) + (shipWeekFilter !== 'ALL' ? 1 : 0)}
                </span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isMobileFilterExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Quick Search */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t.orders.searchOrders}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </form>
        </div>

        {/* Custom Dropdown Selectors (Collapsible on mobile to maximize viewport, visible on sm+) */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs ${isMobileFilterExpanded ? 'block' : 'hidden sm:grid'}`}>
          {/* Buyer Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              {isTa ? 'வாங்குபவர்' : 'Buyer'}
            </label>
            <CustomSelect
              value={buyerFilter}
              options={buyerOptions}
              onChange={handleBuyerChange}
            />
          </div>

          {/* Unit Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              {isTa ? 'உற்பத்திப் பிரிவு' : 'Manufacturing Unit'}
            </label>
            <CustomSelect
              value={unitFilter}
              options={unitOptions}
              onChange={handleUnitChange}
            />
          </div>

          {/* Ship Week Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              {isTa ? 'கப்பல் வாரம் (CW)' : 'Ship Week (CW)'}
            </label>
            <CustomSelect
              value={shipWeekFilter}
              options={shipWeekOptions}
              onChange={handleShipWeekChange}
            />
          </div>

          {/* Result Count Indicator */}
          <div className="flex items-end justify-between sm:justify-end pb-1 text-slate-500 font-medium text-xs">
            <span>
              {isTa ? 'மொத்தம்:' : 'Total:'} <strong className="text-slate-800">{pagination.total}</strong> {isTa ? 'ஆர்டர்கள்' : 'orders'}
            </span>
          </div>
        </div>
      </div>

      {/* Orders Data Table */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">{t.common.loading}</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Filter className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">{t.orders.noOrdersMatch}</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {isTa ? 'தேடல் அல்லது வடிகட்டிகளை மாற்றி முயற்சிக்கவும்.' : "No export orders match the active filter criteria. Try clearing search terms or selecting 'All Orders'."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[760px]">
              <thead className="bg-[#0C2D48] text-white font-bold uppercase text-[10px] tracking-wider border-b border-[#143D60]">
                <tr>
                  <th className="py-3.5 px-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={orders.length > 0 && selectedOrderIds.length === orders.length}
                      onChange={toggleSelectAll}
                      className="rounded border-white/30 bg-white/20 text-sky-400 focus:ring-sky-400 cursor-pointer"
                      title="Select all orders on this page"
                    />
                  </th>
                  <th className="py-3.5 px-4 text-slate-100">{t.orders.poAndStyle}</th>
                  <th className="py-3.5 px-4 text-slate-100">{t.orders.buyerAndMarket}</th>
                  <th className="py-3.5 px-4 text-slate-100">{t.orders.assignedUnit}</th>
                  <th className="py-3.5 px-4 text-right text-slate-100">{t.orders.orderQty}</th>
                  <th className="py-3.5 px-4 text-slate-100">{t.orders.activeStageProgress}</th>
                  <th className="py-3.5 px-4 text-slate-100">{t.common.exFactory}</th>
                  <th className="py-3.5 px-4 text-center text-slate-100">{t.orders.statusCol}</th>
                  <th className="py-3.5 px-4 text-right text-slate-100">{t.orders.actionCol}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {sortedOrders.map((order: OrderListItem) => {
                  const isSelected = selectedOrderIds.includes(order.id);
                  const isCompleted =
                    order.healthStatus === 'COMPLETED' ||
                    (order.activeStage === 'FINISHING' && order.activeStageProgressPct >= 100);

                  return (
                    <tr
                      key={order.id}
                      onClick={() => navigate(`/orders/${order.id}`)}
                      className={`transition group cursor-pointer select-none ${
                        isSelected
                          ? 'bg-sky-100/90 hover:bg-sky-100'
                          : 'even:bg-slate-50/80 odd:bg-white hover:bg-sky-50/60'
                      }`}
                    >
                      {/* Checkbox Column */}
                      <td
                        className="py-3 px-3 text-center"
                        onClick={(e) => toggleSelectOrder(order.id, e)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                        />
                      </td>

                      {/* PO & Style */}
                      <td className="py-3 px-4">
                        <Link
                          to={`/orders/${order.id}`}
                          className="font-mono text-xs font-extrabold text-sky-700 hover:text-sky-900 inline-flex items-center gap-1 group/link mb-0.5"
                        >
                          <span>{order.poNumber}</span>
                          <ExternalLink className="w-3 h-3 text-sky-500 group-hover/link:translate-x-0.5 transition-transform" />
                        </Link>
                        <span className="text-xs font-medium text-slate-800 line-clamp-1 block">
                          {order.style}
                        </span>
                      </td>

                      {/* Buyer */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{order.buyer.name}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          {order.buyer.code} • {order.buyer.country || 'Europe'}
                        </div>
                      </td>

                      {/* Unit */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{order.unit.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {order.unit.type === 'SUBCONTRACTOR' ? 'Subcontract Unit' : 'In-House Facility'}
                        </div>
                      </td>

                      {/* Order Qty */}
                      <td className="py-3 px-4 text-right font-mono">
                        <div className="font-bold text-slate-900">{order.totalQuantity.toLocaleString()} pcs</div>
                        <div className="text-[10px] text-slate-400">
                          {order.orderLines.length} Size Ratios
                        </div>
                      </td>

                      {/* Active Stage & Progress */}
                      <td className="py-3 px-4 min-w-[210px]">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                order.activeStageProgressPct >= 100 ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                              }`}
                            ></span>
                            {isTa ? (STAGE_TRANSLATIONS[order.activeStage]?.ta || order.activeStage) : order.activeStage}
                          </span>
                          <span className="font-mono font-bold text-slate-800">
                            {order.activeStageProgressPct}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-1">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              order.activeStageProgressPct >= 100
                                ? 'bg-emerald-500'
                                : order.healthStatus === 'RED'
                                ? 'bg-rose-500'
                                : order.healthStatus === 'AMBER'
                                ? 'bg-amber-500'
                                : 'bg-sky-500'
                            }`}
                            style={{ width: `${Math.max(4, Math.min(100, order.activeStageProgressPct))}%` }}
                          ></div>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                          <span>{isTa ? `நிலை ${order.activeStageSequence} / 7` : `Stage ${order.activeStageSequence} of 7`}</span>
                          <span className="font-mono">
                            {(order.activeMilestoneCompleted || 0).toLocaleString()} / {(order.activeMilestoneTarget || order.totalQuantity).toLocaleString()} {isTa ? 'துண்டுகள்' : 'pcs'}
                          </span>
                        </div>
                      </td>

                      {/* Ex-Factory & Critical Path Buffer Tag */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(order.exFactoryDate)}
                        </div>
                        <div className="text-[11px] text-amber-700 font-medium">
                          {order.workingDaysLeft}{isTa ? ' நாள்கள் எஞ்சியுள்ளன' : 'd left'} (CW {order.shipWeek})
                        </div>
                        {order.hasCriticalBottleneck && (
                          <div className="mt-0.5">
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200"
                              title={`Current stage exceeded planned completion, compressing downstream buffers by ${order.bufferCompressionDays} days`}
                            >
                              <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                              Buffer -{order.bufferCompressionDays}d
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <StatusBadge status={isCompleted ? 'COMPLETED' : order.healthStatus} size="sm" />
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Link
                          to={`/orders/${order.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 transition"
                        >
                          {isTa ? 'TNA விவரம்' : 'TNA Detail'} <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Controls Bar */}
        {pagination.total > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1 px-1">
            {/* Showing Count */}
            <div className="text-xs text-slate-500 font-medium">
              {isTa ? (
                <>
                  காண்பிக்கப்படுகிறது{' '}
                  <span className="font-semibold text-slate-800">
                    {(pagination.page - 1) * pagination.limit + 1}
                  </span>{' '}
                  முதல்{' '}
                  <span className="font-semibold text-slate-800">
                    {Math.min(pagination.page * pagination.limit, pagination.total)}
                  </span>{' '}
                  வரை (மொத்தம் <span className="font-semibold text-slate-800">{pagination.total}</span> ஏற்றுமதி ஆர்டர்கள்)
                </>
              ) : (
                <>
                  Showing{' '}
                  <span className="font-semibold text-slate-800">
                    {(pagination.page - 1) * pagination.limit + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-semibold text-slate-800">
                    {Math.min(pagination.page * pagination.limit, pagination.total)}
                  </span>{' '}
                  of <span className="font-semibold text-slate-800">{pagination.total}</span> export orders
                </>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Rows per page selector with CustomSelect */}
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="text-slate-400">{isTa ? 'வரிசைகள்:' : 'Rows:'}</span>
                <CustomSelect
                  value={limit.toString()}
                  options={limitOptions}
                  onChange={(val) => {
                    setLimit(Number(val));
                    setPage(1);
                  }}
                  className="w-28"
                  buttonClassName="py-1 px-2.5"
                />
              </div>

              {/* Prev / Page / Next Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition cursor-pointer"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 text-xs font-bold rounded-lg transition cursor-pointer ${
                      p === page
                        ? 'bg-[#0C2D48] text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages}
                  className="p-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition cursor-pointer"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )}

      {/* Floating Multi-PO Bulk Action Bar (Hidden when modal is open to avoid background clutter) */}
      {!isBulkShiftModalOpen && selectedOrderIds.length > 0 && (
        <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-24px)] sm:w-auto max-w-xl bg-[#0C2D48] text-white px-3.5 py-2.5 sm:px-5 sm:py-3 rounded-2xl shadow-2xl border border-sky-400/30 flex items-center justify-between sm:justify-start gap-2 sm:gap-4 animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0"></span>
            <div className="text-xs font-mono truncate">
              <span className="font-bold">{selectedOrderIds.length}</span>
              <span className="text-slate-300 hidden sm:inline"> {selectedOrderIds.length === 1 ? 'Order' : 'Orders'}</span>
              <span className="text-slate-300 sm:hidden"> sel</span>
              <span className="text-sky-300 ml-1 text-[11px] sm:text-xs">
                ({orders
                  .filter((o) => selectedOrderIds.includes(o.id))
                  .reduce((sum, o) => sum + o.totalQuantity, 0)
                  .toLocaleString()}{' '}
                pcs)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {hasRole('MERCHANDISER', 'ADMIN') && (
              <button
                type="button"
                onClick={() => setIsBulkShiftModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-950 text-xs font-bold shadow-xs transition cursor-pointer whitespace-nowrap"
              >
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>Shift Date</span>
                <span className="hidden sm:inline"> (Bulk)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSelectedOrderIds([])}
              className="text-xs font-semibold text-sky-200 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition cursor-pointer whitespace-nowrap"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Bulk Shift Ex-Factory Date Modal */}
      <BulkShiftModal
        isOpen={isBulkShiftModalOpen}
        onClose={() => setIsBulkShiftModalOpen(false)}
        onSuccess={() => {
          setSelectedOrderIds([]);
          fetchOrders();
        }}
        selectedOrders={orders.filter((o) => selectedOrderIds.includes(o.id))}
      />

      {/* Order Creation Modal */}
      <OrderForm
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onOrderCreated={fetchOrders}
        buyers={buyers}
        units={units}
      />
    </div>
  );
};
