import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '../auth/authStore';
import { apiRequest } from '../../services/api';
import {
  SupervisorWorkResponse,
  SupervisorWorkOrderItem,
} from '../../types';
import {
  SUPERVISOR_I18N,
  STAGE_TRANSLATIONS,
  Language,
  translateUnit,
  formatDateLocalized,
} from './supervisorTranslations';
import { ProductionUpdateForm } from './ProductionUpdateForm';
import { OfflineQueueDrawer } from '../../components/OfflineQueueDrawer';
import {
  isEffectiveOnline,
  isOfflineSimulated,
  setOfflineSimulated,
  getPendingOfflineCount,
  getPendingQueueList,
  discardOfflineUpdate,
  retryOfflineUpdate,
  getStorageQuota,
} from '../../offline/queue/queue';
import {
  syncOfflineQueue,
  getNetworkQuality,
  registerOfflineSyncListeners,
  NetworkQuality,
} from '../../offline/sync/sync';
import {
  cacheSupervisorWork,
  getCachedSupervisorWork,
  PendingUpdateRecord,
  StorageQuotaInfo,
} from '../../offline/db';
import { CustomSelect, Option } from '../../components/CustomSelect';
import {
  Layers,
  ChevronRight,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Building2,
  Clock,
  RefreshCw,
  X,
  Package,
  Wifi,
  WifiOff,
  Signal,
  HardDrive,
  Eye,
  Trash2,
  RotateCcw,
  AlertTriangle,
  ExternalLink,
  Search,
} from 'lucide-react';

export const MyWorkPage: React.FC = () => {
  const { user } = useAuthStore();
  const [lang, setLang] = useState<Language>(
    (localStorage.getItem('threadflow_lang') as Language) ||
      (user?.languagePreference === 'ta' ? 'ta' : 'en')
  );

  const t = SUPERVISOR_I18N[lang];

  // Work Data state
  const [workData, setWorkData] = useState<SupervisorWorkResponse | null>(null);
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string>(
    user?.role === 'SUPERVISOR' && user?.assignedUnitId ? user.assignedUnitId : 'ALL'
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active form modal / selected order
  const [selectedOrder, setSelectedOrder] = useState<SupervisorWorkOrderItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Feature 7: Offline Queue, Quality & Simulation States
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(isEffectiveOnline());
  const [isSimulated, setIsSimulated] = useState<boolean>(isOfflineSimulated());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>(getNetworkQuality());
  const [storageQuota, setStorageQuota] = useState<StorageQuotaInfo | null>(null);

  // Queue Drawer Modal state
  const [isQueueDrawerOpen, setIsQueueDrawerOpen] = useState(false);
  const [pendingList, setPendingList] = useState<PendingUpdateRecord[]>([]);

  // Refresh pending count & list
  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingOfflineCount();
    setPendingCount(count);
  }, []);

  const loadPendingList = useCallback(async () => {
    const list = await getPendingQueueList();
    setPendingList(list);
    const quota = await getStorageQuota();
    setStorageQuota(quota);
  }, []);

  // Fetch Supervisor Work from API (with offline cache fallback)
  const fetchWork = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const isSupervisor = user?.role === 'SUPERVISOR';
    const effectiveUnit = isSupervisor && user?.assignedUnitId ? user.assignedUnitId : selectedUnitFilter;
    const cacheKey = `work_${effectiveUnit || 'default'}`;
    const url =
      isSupervisor && user?.assignedUnitId
        ? `/production/work?unitId=${user.assignedUnitId}`
        : selectedUnitFilter && selectedUnitFilter !== 'ALL'
        ? `/production/work?unitId=${selectedUnitFilter}`
        : '/production/work';

    if (isEffectiveOnline()) {
      try {
        const response = await apiRequest<{ data: SupervisorWorkResponse }>(url);
        setWorkData(response.data);
        await cacheSupervisorWork(cacheKey, response.data);
      } catch (err: any) {
        console.warn('API fetch failed, checking offline cache:', err);
        const cached = await getCachedSupervisorWork(cacheKey);
        if (cached) {
          setWorkData(cached);
        } else {
          setError(err.message || 'Failed to load supervisor work orders');
        }
      } finally {
        setIsLoading(false);
      }
    } else {
      // Offline mode: load from IndexedDB cache
      const cached = await getCachedSupervisorWork(cacheKey);
      if (cached) {
        setWorkData(cached);
      } else {
        setError(
          lang === 'ta'
            ? 'இணைய இணைப்பு இல்லை, சேமிக்கப்பட்ட தரவு எதுவும் கிடைக்கவில்லை.'
            : 'No internet connection and no cached data available.'
        );
      }
      setIsLoading(false);
    }
  }, [user?.assignedUnitId, selectedUnitFilter, lang]);

  useEffect(() => {
    fetchWork();
  }, [fetchWork]);

  // Synchronize language changes & queue updates
  useEffect(() => {
    refreshPendingCount();
    getStorageQuota().then(setStorageQuota);

    // Register background listeners
    const unregisterSync = registerOfflineSyncListeners();

    const handleLangChange = (e: any) => {
      if (e.detail?.lang) {
        setLang(e.detail.lang);
      }
    };

    const handleNetworkChange = () => {
      setIsOnline(isEffectiveOnline());
      setIsSimulated(isOfflineSimulated());
      setNetworkQuality(getNetworkQuality());
      refreshPendingCount();
    };

    const handleQualityChange = (e: any) => {
      if (e.detail) {
        setNetworkQuality(e.detail);
      }
    };

    const handleQueueChange = () => {
      refreshPendingCount();
      loadPendingList();
    };

    const handleQueueSynced = (e: any) => {
      refreshPendingCount();
      loadPendingList();
      fetchWork();
      if (e.detail?.synced > 0) {
        setToastMessage(
          lang === 'ta'
            ? `${e.detail.synced} ஆஃப்லைன் பதிவுகள் வெற்றிகரமாக சர்வரில் சேர்க்கப்பட்டது!`
            : `Successfully synchronized ${e.detail.synced} offline shift updates!`
        );
      }
    };

    const handleOptimisticUpdate = async () => {
      const cacheKey = `work_${user?.assignedUnitId || 'default'}`;
      const cached = await getCachedSupervisorWork(cacheKey);
      if (cached) {
        setWorkData({ ...cached });
      }
      refreshPendingCount();
    };

    window.addEventListener('threadflow-lang-change', handleLangChange);
    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);
    window.addEventListener('threadflow-network-change', handleNetworkChange);
    window.addEventListener('threadflow-quality-changed', handleQualityChange);
    window.addEventListener('threadflow-queue-changed', handleQueueChange);
    window.addEventListener('threadflow-queue-synced', handleQueueSynced);
    window.addEventListener('threadflow-cache-optimistic-updated', handleOptimisticUpdate);

    return () => {
      unregisterSync();
      window.removeEventListener('threadflow-lang-change', handleLangChange);
      window.removeEventListener('online', handleNetworkChange);
      window.removeEventListener('offline', handleNetworkChange);
      window.removeEventListener('threadflow-network-change', handleNetworkChange);
      window.removeEventListener('threadflow-quality-changed', handleQualityChange);
      window.removeEventListener('threadflow-queue-changed', handleQueueChange);
      window.removeEventListener('threadflow-queue-synced', handleQueueSynced);
      window.removeEventListener('threadflow-cache-optimistic-updated', handleOptimisticUpdate);
      window.removeEventListener('threadflow-open-queue-drawer', handleOpenQueueDrawer);
    };
  }, [refreshPendingCount, loadPendingList, fetchWork, user?.assignedUnitId, lang]);

  // Initial fetch & listener for open drawer
  useEffect(() => {
    fetchWork();
    const handleDrawer = () => {
      handleOpenQueueDrawer();
    };
    window.addEventListener('threadflow-open-queue-drawer', handleDrawer);
    return () => window.removeEventListener('threadflow-open-queue-drawer', handleDrawer);
  }, [fetchWork]);

  // Toggle offline simulation switch
  const handleToggleSimulation = () => {
    const nextVal = !isSimulated;
    setOfflineSimulated(nextVal);
    setIsSimulated(nextVal);
    setIsOnline(isEffectiveOnline());
    setNetworkQuality(getNetworkQuality());
    if (!nextVal) {
      setTimeout(() => syncOfflineQueue(), 300);
    }
  };

  // Manual Trigger Sync from MyWorkPage
  const handleManualSync = async () => {
    if (!isEffectiveOnline()) return;
    setIsSyncing(true);
    try {
      await syncOfflineQueue();
    } finally {
      setIsSyncing(false);
      refreshPendingCount();
      loadPendingList();
    }
  };

  // Open Queue Drawer
  const handleOpenQueueDrawer = async () => {
    await loadPendingList();
    setIsQueueDrawerOpen(true);
  };

  // Only active, incomplete floor jobs - completed jobs removed
  // Close modal or drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedOrder) setSelectedOrder(null);
        if (isQueueDrawerOpen) setIsQueueDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedOrder, isQueueDrawerOpen]);

  const sortedOrders = useMemo(() => {
    if (!workData?.orders) return [];
    return workData.orders.filter((order) => {
      const activeStage = order.activeMilestone;
      const isCompleted = Boolean(
        !activeStage ||
        activeStage.remainingQuantity === 0 ||
        activeStage.completedQuantity >= activeStage.targetQuantity ||
        (order as any).isCompleted ||
        (order.milestones && order.milestones.every((m) => m.completedQuantity >= m.targetQuantity))
      );
      if (isCompleted) return false;

      // Unit filter: supervisors are strictly scoped to their assigned unit; merchandisers/admins can filter
      if (
        user?.role !== 'SUPERVISOR' &&
        selectedUnitFilter !== 'ALL' &&
        order.unit?.id !== selectedUnitFilter &&
        (order as any).assignedUnitId !== selectedUnitFilter
      ) {
        return false;
      }

      // Search filter: PO number, style name, buyer company name
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchPo = order.poNumber?.toLowerCase().includes(q);
        const matchStyle = order.style?.toLowerCase().includes(q);
        const matchBuyer = order.buyer?.name?.toLowerCase().includes(q) || order.buyer?.code?.toLowerCase().includes(q);
        if (!matchPo && !matchStyle && !matchBuyer) return false;
      }

      return true;
    });
  }, [workData?.orders, selectedUnitFilter, searchTerm]);

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-300">
      {/* Floating Toast Message */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 max-w-md bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold border border-slate-700 animate-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="flex-1">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Page Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {lang === 'ta' ? 'தொழிற்சாலை உற்பத்தி தளம்' : 'Floor Production Work'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {lang === 'ta'
              ? 'நடப்பு உற்பத்தி ஆர்டர்கள் மற்றும் மேற்பார்வையாளர் ஷிப்ட் பதிவுகள்'
              : 'Active floor work orders, shift logs and supervisor output tracking'}
            {workData?.unit && (
              <span className="block mt-0.5 text-slate-600 font-medium">
                • {workData.unit.name}
                {(workData.unit as any).supervisors && (workData.unit as any).supervisors.length > 0 && (
                  <span className="text-slate-500 font-normal">
                    {' '}({lang === 'ta' ? 'மேற்பார்வையாளர்கள்' : 'Supervisors'}: {(workData.unit as any).supervisors.map((s: any) => s.name).join(', ')})
                  </span>
                )}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          {/* Search bar for PO ID, Style Name, and Company */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={lang === 'ta' ? 'PO, ஸ்டைல் அல்லது நிறுவனத்தைத் தேடு...' : 'Search PO, style or buyer...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40 shadow-2xs font-medium"
            />
          </div>

          {user?.role === 'SUPERVISOR' ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-50 border border-sky-200 rounded-xl text-xs font-semibold text-sky-900 shadow-2xs">
              <Building2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span className="truncate">
                {workData?.unit ? translateUnit(workData.unit.name, lang) : 'Assigned Unit'}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-100 text-sky-800">
                {workData?.unit?.code || 'UNIT'}
              </span>
            </div>
          ) : (
            <div className="w-full sm:w-56">
              <CustomSelect
                value={selectedUnitFilter}
                options={[
                  { value: 'ALL', label: lang === 'ta' ? 'அனைத்து பிரிவுகள்' : 'All Manufacturing Units' },
                  ...(workData?.allUnits || [
                    { id: 'unit-1', name: 'Unit 1 (Cotton Hub - Own)', code: 'UNIT_1', type: 'OWN' },
                    { id: 'unit-2', name: 'Unit 2 (Stitching Hub - Own)', code: 'UNIT_2', type: 'OWN' },
                    { id: 'sub-1', name: 'Subcontract - PrintTex', code: 'PRINTTEX', type: 'SUBCONTRACTOR' },
                  ]).map((u: any) => ({
                    value: u.id,
                    label: translateUnit(u.name, lang),
                    badge: u.type === 'SUBCONTRACTOR' ? 'Subcontract' : 'In-House',
                  })),
                ]}
                onChange={(val) => setSelectedUnitFilter(val)}
                placeholder="Select Unit"
                buttonClassName="bg-white border-slate-200 py-1.5 text-xs font-semibold text-slate-800"
              />
            </div>
          )}

          <button
            type="button"
            onClick={fetchWork}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-xs transition cursor-pointer self-end sm:self-auto shrink-0"
            title="Refresh order statuses"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading && !workData ? (
        <div className="py-20 text-center space-y-3 bg-white rounded-2xl border border-slate-200/80">
          <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-bold text-slate-500">
            {lang === 'ta' ? 'ஆர்டர்கள் ஏற்றப்படுகிறது...' : 'Loading active floor orders...'}
          </p>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <p className="text-sm font-bold text-rose-800">{error}</p>
          <button
            type="button"
            onClick={fetchWork}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      ) : (
        <>
          {/* Active Orders Responsive Grid */}
          <div>
            <div className="flex items-center justify-between mb-3.5 px-1">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-sky-600" />
                {t.activeOrders} ({sortedOrders.length})
              </h2>
              <span className="text-xs font-semibold text-slate-500">
                {t.clickToLog}
              </span>
            </div>

            {sortedOrders.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center border border-slate-200/90 shadow-2xs">
                <p className="text-sm font-semibold text-slate-500">
                  {t.noActiveOrders}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {sortedOrders.map((order) => {
                  const activeStage = order.activeMilestone;
                  const isCompleted = Boolean(
                    !activeStage ||
                    activeStage.remainingQuantity === 0 ||
                    activeStage.completedQuantity >= activeStage.targetQuantity ||
                    (order as any).isCompleted
                  );

                  const stageLabel = activeStage
                    ? STAGE_TRANSLATIONS[activeStage.stage]?.[lang] || activeStage.stage
                    : (lang === 'ta' ? 'முடிந்தது' : 'Done');

                  const isSelected = selectedOrder?.orderId === order.orderId;
                  const isOptimistic = (order as any).hasOptimisticPending;
                  const primaryStyleName = order.style.split(' (')[0].split(' - ')[0];

                  return (
                    <div
                      key={order.orderId}
                      onClick={() => {
                        if (activeStage) {
                          setSelectedOrder(order);
                        }
                      }}
                      className={`bg-white rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow-md overflow-hidden flex flex-col justify-between group ${
                        isSelected
                          ? 'border-amber-500 ring-2 ring-amber-400/50 shadow-md'
                          : isCompleted
                          ? 'border-emerald-200/90 hover:border-emerald-300'
                          : 'border-slate-200/90 hover:border-slate-300'
                      }`}
                    >
                      {/* Top Header Bar Styled with Dark Navy Matching Table Headers */}
                      <div className="bg-[#0C2D48] text-white px-4 py-2.5 flex items-center justify-between border-b border-[#143D60] gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-sm font-extrabold text-sky-400 inline-flex items-center gap-1 shrink-0">
                            <span>{order.poNumber}</span>
                            <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                          </span>
                          <span className="text-white/40 font-light">•</span>
                          <span className="font-bold text-white text-xs sm:text-sm truncate">
                            {primaryStyleName}
                          </span>
                        </div>
                        <div className="shrink-0 flex items-center gap-1.5">
                          {isCompleted ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-white shadow-2xs">
                              <CheckCircle2 className="w-3 h-3 text-white" />
                              {lang === 'ta' ? 'முடிந்தது' : 'Done'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-900/90 text-sky-200 border border-sky-600/80">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                              {stageLabel}
                            </span>
                          )}
                          {isOptimistic && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-amber-950 animate-pulse">
                              <Clock className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Content Area */}
                      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                        <div>
                          {/* Buyer & Delivery Date */}
                          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                            <span className="font-bold text-slate-800">{order.buyer.name}</span>
                            <span className="flex items-center gap-1 text-slate-500 font-medium">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {formatDateLocalized(order.exFactoryDate, lang)}
                            </span>
                          </div>

                          {/* Assigned Unit Display */}
                          <div className="mt-2.5 flex items-center gap-1.5 text-xs">
                            <Building2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                            <span className="font-semibold text-slate-700 truncate">
                              {order.unit?.name ? translateUnit(order.unit.name, lang) : (order.unit?.code || '')}
                            </span>
                            {order.unit?.type === 'SUBCONTRACTOR' && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                                Subcontract
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Stage Progress Bar */}
                        {activeStage && (
                          <div className="pt-2 border-t border-slate-100">
                            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                              <span className="text-slate-600">
                                {t.completedPcs}:{' '}
                                <span className="text-slate-900 font-black">
                                  {activeStage.completedQuantity.toLocaleString()}
                                </span>{' '}
                                / {activeStage.targetQuantity.toLocaleString()} {t.pieces}
                              </span>
                              <span className="text-sky-800 font-black font-mono">
                                {activeStage.progressPct}%
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/80">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  activeStage.progressPct >= 100 ? 'bg-emerald-500' : 'bg-sky-600'
                                }`}
                                style={{ width: `${Math.min(100, activeStage.progressPct)}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Per-Size Breakdown Pills (S, M, L, XL separately) */}
                        {order.orderLines && order.orderLines.length > 0 && (
                          <div className="pt-2 border-t border-slate-100">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1.5">
                              <span className="flex items-center gap-1 text-slate-700">
                                <Layers className="w-3 h-3 text-sky-600" />
                                <span>{t.sizeBreakdownTitle}</span>
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono font-semibold">
                                {order.orderLines.reduce((acc, l) => acc + l.completedQty, 0).toLocaleString()} pcs • {order.orderLines.length} {t.sizesCount}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                              {order.orderLines.map((line) => {
                                const isDone = line.completedQty >= line.plannedQty;
                                const pct =
                                  line.plannedQty > 0
                                    ? Math.min(100, Math.round((line.completedQty / line.plannedQty) * 100))
                                    : 0;
                                return (
                                  <div
                                    key={line.id}
                                    className={`px-2 py-1.5 rounded-lg border text-center transition-all ${
                                      isDone
                                        ? 'bg-emerald-50/80 border-emerald-200'
                                        : 'bg-slate-50 border-slate-200/80'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between text-[11px] leading-tight font-black mb-0.5">
                                      <span className="text-slate-900">{line.size}</span>
                                      <span
                                        className={`text-[9px] font-bold ${
                                          isDone ? 'text-emerald-700' : 'text-slate-500'
                                        }`}
                                      >
                                        {pct}%
                                      </span>
                                    </div>
                                    <div className="text-[10px] font-mono text-slate-600 truncate">
                                      {line.completedQty.toLocaleString()}/{line.plannedQty.toLocaleString()}
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-1 mt-1 overflow-hidden">
                                      <div
                                        className={`h-1 rounded-full transition-all duration-300 ${
                                          isDone ? 'bg-emerald-500' : 'bg-sky-500'
                                        }`}
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Bottom Action Footer */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                          {isCompleted ? (
                            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-300 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Completed (0 pcs left)
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60">
                              {t.remainingPcs}: {activeStage?.remainingQuantity.toLocaleString()} {t.pieces}
                            </span>
                          )}
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs font-black text-sky-700 group-hover:text-sky-900 group-hover:translate-x-0.5 transition-all cursor-pointer"
                          >
                            <span>{isCompleted ? 'View / Log' : t.logOutput}</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* MODAL / DRAWER FOR PRODUCTION UPDATE FORM */}
      {selectedOrder && selectedOrder.activeMilestone && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-6 animate-in fade-in">
          <div className="w-full max-w-xl bg-slate-50 rounded-2xl sm:rounded-3xl max-h-[94vh] overflow-y-auto overflow-x-hidden p-3.5 sm:p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-base font-black text-slate-900">
                  {t.productionModalTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-300 flex items-center justify-center font-bold text-xs transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ProductionUpdateForm
              order={selectedOrder}
              activeMilestone={selectedOrder.activeMilestone}
              lang={lang}
              onSuccess={(msg) => {
                setSelectedOrder(null);
                setToastMessage(msg);
                fetchWork();
              }}
              onCancel={() => setSelectedOrder(null)}
            />
          </div>
        </div>
      )}

      {/* Global Offline Queue Drawer handled by AppLayout */}
    </div>
  );
};