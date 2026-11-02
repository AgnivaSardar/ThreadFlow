import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { OrderListItem, Buyer, Unit, RiskLevel, PaginationMeta } from '../../types';
import { apiRequest } from '../../services/api';
import { StatusBadge } from '../../components/StatusBadge';
import { CustomSelect, Option } from '../../components/CustomSelect';
import { OrderForm } from './OrderForm';
import { BulkShiftModal } from './BulkShiftModal';
import { useAuthStore } from '../auth/authStore';

export const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { hasRole } = useAuthStore();
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
  const [statusFilter, setStatusFilter] = useState<'ALL' | RiskLevel>('ALL');
  const [buyerFilter, setBuyerFilter] = useState<string>('ALL');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');
  const [shipWeekFilter, setShipWeekFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

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

  const handleStatusChange = (status: 'ALL' | RiskLevel) => {
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Export Order Board</h1>
          <p className="text-xs text-slate-500 mt-1">
            Active export purchase orders and milestone schedules
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchOrders}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-xs transition cursor-pointer"
            title="Refresh order statuses"
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
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {hasRole('MERCHANDISER', 'ADMIN') && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0C2D48] hover:bg-[#143D60] text-white font-semibold rounded-xl text-xs shadow-md transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Export Order
            </button>
          )}
        </div>
      </div>

      {/* Sticky Filter Bar (Solid white bg for hardware-accelerated smooth scrolling) */}
      <div className="sticky top-0 z-10 bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Status Tabs (RED / AMBER / GREEN) */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            {(['ALL', 'GREEN', 'AMBER', 'RED'] as const).map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  statusFilter === s
                    ? s === 'RED'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : s === 'AMBER'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : s === 'GREEN'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s === 'ALL' ? 'All Orders' : s}
              </button>
            ))}
          </div>

          {/* Quick Search */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search PO number, style code, or description..."
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </form>
        </div>

        {/* Custom Dropdown Selectors */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1 border-t border-slate-100 text-xs">
          {/* Buyer Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Buyer
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
              Manufacturing Unit
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
              Ship Week (CW)
            </label>
            <CustomSelect
              value={shipWeekFilter}
              options={shipWeekOptions}
              onChange={handleShipWeekChange}
            />
          </div>

          {/* Result Count Indicator */}
          <div className="flex items-end justify-end pb-1 text-slate-500 font-medium text-xs">
            <span>
              Total: <strong className="text-slate-800">{pagination.total}</strong> orders
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
          <p className="text-xs text-slate-500 font-medium">Loading export orders & TNA pipelines...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Filter className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Orders Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No export orders match the active filter criteria. Try clearing search terms or selecting 'All Orders'.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={orders.length > 0 && selectedOrderIds.length === orders.length}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                      title="Select all orders on this page"
                    />
                  </th>
                  <th className="py-3.5 px-4">PO & Style</th>
                  <th className="py-3.5 px-4">Buyer & Market</th>
                  <th className="py-3.5 px-4">Assigned Unit</th>
                  <th className="py-3.5 px-4 text-right">Order Qty</th>
                  <th className="py-3.5 px-4">Active Stage & Progress</th>
                  <th className="py-3.5 px-4">Ex-Factory</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {orders.map((order) => {
                  const isSelected = selectedOrderIds.includes(order.id);
                  return (
                    <tr
                      key={order.id}
                      onClick={() => navigate(`/orders/${order.id}`)}
                      className={`transition group cursor-pointer select-none ${
                        isSelected ? 'bg-sky-50/80 hover:bg-sky-50' : 'hover:bg-sky-50/50'
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
                          className="font-mono text-xs font-bold text-sky-700 hover:text-sky-900 hover:underline block"
                        >
                          {order.poNumber}
                        </Link>
                        <span className="text-xs font-medium text-slate-800 line-clamp-1">
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
                            {order.activeStage}
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
                          <span>Stage {order.activeStageSequence} of 7</span>
                          <span className="font-mono">
                            {(order.activeMilestoneCompleted || 0).toLocaleString()} / {(order.activeMilestoneTarget || order.totalQuantity).toLocaleString()} pcs
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
                          {order.workingDaysLeft}d left (CW {order.shipWeek})
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
                        <StatusBadge status={order.healthStatus} size="sm" />
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Link
                          to={`/orders/${order.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 transition"
                        >
                          TNA Detail <ArrowRight className="w-3.5 h-3.5" />
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
              Showing{' '}
              <span className="font-semibold text-slate-800">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-slate-800">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{' '}
              of <span className="font-semibold text-slate-800">{pagination.total}</span> export orders
            </div>

            <div className="flex items-center gap-4">
              {/* Rows per page selector with CustomSelect */}
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="text-slate-400">Rows:</span>
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

      {/* Floating Multi-PO Bulk Action Bar */}
      {selectedOrderIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#0C2D48] text-white px-5 py-3 rounded-2xl shadow-2xl border border-sky-400/30 flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span className="text-xs font-bold font-mono">
              {selectedOrderIds.length} {selectedOrderIds.length === 1 ? 'Order' : 'Orders'} Selected
            </span>
            <span className="text-sky-300 text-xs">
              (
              {orders
                .filter((o) => selectedOrderIds.includes(o.id))
                .reduce((sum, o) => sum + o.totalQuantity, 0)
                .toLocaleString()}{' '}
              pcs)
            </span>
          </div>

          <div className="h-4 w-px bg-slate-700" />

          {hasRole('MERCHANDISER', 'ADMIN') && (
            <button
              type="button"
              onClick={() => setIsBulkShiftModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              Bulk Shift Ex-Factory Date
            </button>
          )}

          <button
            type="button"
            onClick={() => setSelectedOrderIds([])}
            className="text-xs font-semibold text-sky-200 hover:text-white transition cursor-pointer"
          >
            Clear Selection
          </button>
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
