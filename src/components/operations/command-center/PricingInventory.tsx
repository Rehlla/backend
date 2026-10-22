import React, { useState, useEffect, useCallback } from 'react';
import { DollarSign, Package, Calendar, RefreshCw, Search, Filter, Edit3, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../../../services/api';
import { useLanguage } from '../../../i18n/LanguageContext';
import { SectionHeader, TabBar, StatusBadge, EmptyState, DashCard, Skeleton, DataTable } from './ui';
import { Pagination, usePagination } from './Pagination';

// ─── Types ──────────────────────────────────────────────────────────────────
interface SkuItem {
  id: string;
  supplierId: string;
  serviceType: string;
  title: string;
  titleAr: string;
  description: string;
  basePriceEGP: number;
  maxCapacityPerSlot: number;
  active: boolean;
  supplierName: string;
  slotCount: number;
}

interface InventorySlot {
  id: string;
  skuId: string;
  date: string;
  timeSlot: string;
  totalCapacity: number;
  reservedCapacity: number;
  heldCapacity: number;
  priceEGP: number;
  status: string;
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function PricingInventory() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('skus');
  const [skus, setSkus] = useState<SkuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editingSkuId, setEditingSkuId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editCapacity, setEditCapacity] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [skuSaved, setSkuSaved] = useState<string | null>(null);

  // Inventory state
  const [selectedSku, setSelectedSku] = useState<string>('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10); });
  const [slots, setSlots] = useState<InventorySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editSlotPrice, setEditSlotPrice] = useState('');
  const [editSlotCap, setEditSlotCap] = useState('');

  const fetchSkus = useCallback(async () => {
    try {
      const data = await api.getAdminSkus();
      setSkus(data.skus || []);
    } catch { /* non-critical */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSkus(); }, [fetchSkus]);

  const fetchSlots = useCallback(async () => {
    if (!selectedSku) return;
    setSlotsLoading(true);
    try {
      const data = await api.getAdminInventory(selectedSku, startDate, endDate);
      setSlots(data.slots || []);
    } catch { setSlots([]); } finally { setSlotsLoading(false); }
  }, [selectedSku, startDate, endDate]);

  useEffect(() => { if (selectedSku) fetchSlots(); }, [fetchSlots, selectedSku]);

  const handleSkuSave = async (skuId: string) => {
    setSaving(skuId);
    try {
      const patch: Record<string, any> = {};
      if (editPrice) patch.basePriceEGP = Number(editPrice);
      if (editCapacity) patch.maxCapacityPerSlot = Number(editCapacity);
      await api.updateAdminSku(skuId, patch);
      setEditingSkuId(null);
      setSkuSaved(skuId);
      setTimeout(() => setSkuSaved(null), 3000);
      fetchSkus();
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    } finally { setSaving(null); }
  };

  const handleSlotSave = async (slotId: string) => {
    setSaving(slotId);
    try {
      const patch: Record<string, any> = {};
      if (editSlotPrice) patch.priceEGP = Number(editSlotPrice);
      if (editSlotCap) patch.totalCapacity = Number(editSlotCap);
      await api.updateAdminInventorySlot(slotId, patch);
      setEditingSlotId(null);
      fetchSlots();
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    } finally { setSaving(null); }
  };

  const filteredSkus = skus.filter(sku => {
    if (filter !== 'all' && sku.serviceType !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return sku.title.toLowerCase().includes(q) || sku.titleAr.includes(q) || sku.supplierName.toLowerCase().includes(q) || sku.id.toLowerCase().includes(q);
    }
    return true;
  });

  const { page, setPage, totalPages, paginatedItems, totalItems, pageSize } = usePagination(filteredSkus, 20);

  const serviceTypes = [...new Set(skus.map(s => s.serviceType))].sort();

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={DollarSign}
        iconColor="text-[var(--accent-secondary)]"
        title="Pricing & Inventory"
        subtitle={`${skus.length} SKUs · ${skus.filter(s => s.active).length} active`}
      />

      <TabBar
        tabs={[
          { id: 'skus', label: 'Products & Pricing', count: skus.length },
          { id: 'inventory', label: 'Inventory Slots' },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'skus' && (
        <>
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by title, supplier, ID…"
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/40 focus:outline-none focus:border-[var(--accent-primary)]/50"
              />
            </div>
            <TabBar
              tabs={[{ id: 'all', label: 'All' }, ...serviceTypes.map(st => ({ id: st, label: st }))]}
              activeTab={filter}
              onChange={setFilter}
              variant="pill"
            />
          </div>

          {/* SKU Table */}
          {loading ? (
            <Skeleton variant="table" />
          ) : filteredSkus.length === 0 ? (
            <EmptyState icon={Package} title="No SKUs found" description="No products match your filters" />
          ) : (
            <>
              <DashCard padding="none">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-[var(--btn-util-bg)] text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                      <tr>
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-3">Service</th>
                        <th className="py-2.5 px-3">Supplier</th>
                        <th className="py-2.5 px-3 text-right">Price (EGP)</th>
                        <th className="py-2.5 px-3 text-center">Capacity</th>
                        <th className="py-2.5 px-3 text-center">Slots</th>
                        <th className="py-2.5 px-3 text-center">Active</th>
                        <th className="py-2.5 px-3 text-center">Edit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {paginatedItems.map(sku => {
                        const isEditing = editingSkuId === sku.id;
                        const justSaved = skuSaved === sku.id;
                        return (
                          <tr key={sku.id} className="hover:bg-[var(--btn-util-bg)]/30 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="text-[var(--accent-primary)] font-bold font-mono text-[10px]">{sku.id}</div>
                              <div className="text-[var(--text-primary)] font-semibold">{sku.title}</div>
                              <div className="text-[var(--text-muted)] text-[10px]">{sku.titleAr}</div>
                            </td>
                            <td className="py-2.5 px-3"><StatusBadge status={sku.serviceType} /></td>
                            <td className="py-2.5 px-3 text-[var(--text-muted)]">{sku.supplierName}</td>
                            <td className="py-2.5 px-3 text-right">
                              {isEditing ? (
                                <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} className="w-20 px-2 py-1 rounded bg-[var(--btn-util-bg)] border border-[var(--accent-primary)]/50 text-xs text-right text-[var(--text-primary)] focus:outline-none" />
                              ) : (
                                <span className="font-bold text-[var(--text-primary)] font-mono">{sku.basePriceEGP.toLocaleString()}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {isEditing ? (
                                <input type="number" value={editCapacity} onChange={e => setEditCapacity(e.target.value)} className="w-16 px-2 py-1 rounded bg-[var(--btn-util-bg)] border border-[var(--accent-primary)]/50 text-xs text-center text-[var(--text-primary)] focus:outline-none" />
                              ) : (
                                <span className="font-mono">{sku.maxCapacityPerSlot}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center text-[var(--text-muted)]">{sku.slotCount}</td>
                            <td className="py-2.5 px-3 text-center">
                              {sku.active ? <span className="text-emerald-400">✓</span> : <span className="text-red-400">✗</span>}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {isEditing ? (
                                <div className="flex items-center gap-1 justify-center">
                                  <button type="button" onClick={() => handleSkuSave(sku.id)} disabled={saving === sku.id} className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold cursor-pointer disabled:opacity-50">
                                    {saving === sku.id ? '…' : 'Save'}
                                  </button>
                                  <button type="button" onClick={() => setEditingSkuId(null)} className="px-2 py-0.5 rounded bg-[var(--btn-util-bg)] text-[var(--text-muted)] text-[10px] font-bold cursor-pointer">Cancel</button>
                                </div>
                              ) : (
                                <button type="button" onClick={() => {
                                  setEditingSkuId(sku.id);
                                  setEditPrice(String(sku.basePriceEGP));
                                  setEditCapacity(String(sku.maxCapacityPerSlot));
                                }} className="p-1 rounded hover:bg-[var(--btn-util-bg)] cursor-pointer">
                                  {justSaved ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Edit3 className="w-3 h-3 text-[var(--text-muted)]" />}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </DashCard>
              {totalPages > 1 && (
                <div className="flex justify-center pt-2">
                  <Pagination page={page} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPageChange={setPage} />
                </div>
              )}
            </>
          )}
        </>
      )}

      {activeTab === 'inventory' && (
        <>
          {/* SKU selector + date range */}
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={selectedSku}
              onChange={e => setSelectedSku(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] cursor-pointer focus:outline-none min-w-[200px]"
            >
              <option value="">Select a product…</option>
              {skus.map(s => (
                <option key={s.id} value={s.id}>{s.title} ({s.id})</option>
              ))}
            </select>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-3 py-1.5 rounded-xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none" />
            <span className="text-[var(--text-muted)]">→</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-3 py-1.5 rounded-xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none" />
            <button type="button" onClick={fetchSlots} disabled={!selectedSku} aria-label={t('cmd.overview.refresh')} className="p-1.5 rounded-lg bg-[var(--btn-util-bg)] hover:bg-[var(--surface-container)] text-[var(--text-muted)] cursor-pointer disabled:opacity-50">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {!selectedSku ? (
            <EmptyState icon={Package} title="Select a product" description="Choose a SKU above to view its inventory slots" />
          ) : slotsLoading ? (
            <Skeleton variant="table" />
          ) : slots.length === 0 ? (
            <EmptyState icon={Calendar} title="No slots found" description="No inventory slots for this date range" />
          ) : (
            <DashCard padding="none">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-[var(--btn-util-bg)] text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Time Slot</th>
                      <th className="py-2.5 px-3 text-right">Price (EGP)</th>
                      <th className="py-2.5 px-3 text-center">Capacity</th>
                      <th className="py-2.5 px-3 text-center">Reserved</th>
                      <th className="py-2.5 px-3 text-center">Held</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-center">Edit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {slots.map(slot => {
                      const isEditing = editingSlotId === slot.id;
                      return (
                        <tr key={slot.id} className="hover:bg-[var(--btn-util-bg)]/30 transition-colors">
                          <td className="py-2.5 px-3 font-mono">{slot.date}</td>
                          <td className="py-2.5 px-3">{slot.timeSlot}</td>
                          <td className="py-2.5 px-3 text-right">
                            {isEditing ? (
                              <input type="number" value={editSlotPrice} onChange={e => setEditSlotPrice(e.target.value)} className="w-20 px-2 py-1 rounded bg-[var(--btn-util-bg)] border border-[var(--accent-primary)]/50 text-xs text-right text-[var(--text-primary)] focus:outline-none" />
                            ) : (
                              <span className="font-bold font-mono">{slot.priceEGP.toLocaleString()}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isEditing ? (
                              <input type="number" value={editSlotCap} onChange={e => setEditSlotCap(e.target.value)} className="w-16 px-2 py-1 rounded bg-[var(--btn-util-bg)] border border-[var(--accent-primary)]/50 text-xs text-center text-[var(--text-primary)] focus:outline-none" />
                            ) : (
                              <span className="font-mono">{slot.totalCapacity}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-amber-400">{slot.reservedCapacity}</td>
                          <td className="py-2.5 px-3 text-center font-mono text-sky-400">{slot.heldCapacity}</td>
                          <td className="py-2.5 px-3 text-center"><StatusBadge status={slot.status} size="sm" /></td>
                          <td className="py-2.5 px-3 text-center">
                            {isEditing ? (
                              <div className="flex items-center gap-1 justify-center">
                                <button type="button" onClick={() => handleSlotSave(slot.id)} disabled={saving === slot.id} className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold cursor-pointer disabled:opacity-50">
                                  {saving === slot.id ? '…' : 'Save'}
                                </button>
                                <button type="button" onClick={() => setEditingSlotId(null)} className="px-2 py-0.5 rounded bg-[var(--btn-util-bg)] text-[var(--text-muted)] text-[10px] font-bold cursor-pointer">Cancel</button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => {
                                setEditingSlotId(slot.id);
                                setEditSlotPrice(String(slot.priceEGP));
                                setEditSlotCap(String(slot.totalCapacity));
                              }} className="p-1 rounded hover:bg-[var(--btn-util-bg)] cursor-pointer">
                                <Edit3 className="w-3 h-3 text-[var(--text-muted)]" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </DashCard>
          )}
        </>
      )}
    </div>
  );
}
