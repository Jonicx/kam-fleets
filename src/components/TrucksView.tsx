import React, { useState } from 'react';
import {
  Truck as TruckIcon,
  Plus,
  Search,
  Wrench,
  CheckCircle2,
  Navigation2,
  Trash2,
  X,
  AlertCircle,
  Eye,
  Pencil,
} from 'lucide-react';
import { EnrichedTrip, Truck, TruckServiceRecord, TruckServiceType, TruckStatus } from '../types/database.ts';
import { formatTsh } from '../utils/currency.ts';
import { canEditTruckServiceRecord } from '../utils/truckService.ts';

interface TrucksViewProps {
  trucks: Truck[];
  serviceRecords: TruckServiceRecord[];
  trips: EnrichedTrip[];
  onCreateTruck: (truck: Omit<Truck, 'id' | 'created_at' | 'updated_at'>) => void;
  onCreateServiceRecord: (
    record: Omit<TruckServiceRecord, 'id' | 'created_at' | 'timestamp'> & { timestamp?: string }
  ) => void;
  onUpdateServiceRecord: (
    id: string,
    updates: Pick<TruckServiceRecord, 'record_type' | 'item_name' | 'price' | 'mechanic_name' | 'service_location' | 'timestamp'>
  ) => void;
  onUpdateTruckStatus: (id: string, status: TruckStatus) => void;
  onDeleteTruck: (id: string) => void;
  onUpdateTruck: (id: string, updates: Partial<Omit<Truck, 'id' | 'created_at' | 'updated_at'>>) => void;
}

export const TrucksView: React.FC<TrucksViewProps> = ({
  trucks,
  serviceRecords,
  trips,
  onCreateTruck,
  onCreateServiceRecord,
  onUpdateServiceRecord,
  onUpdateTruckStatus,
  onDeleteTruck,
  onUpdateTruck,
}) => {
  const [editingTruckId, setEditingTruckId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | TruckStatus>('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [serviceTruckId, setServiceTruckId] = useState<string | null>(null);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingServiceRecordId, setEditingServiceRecordId] = useState<string | null>(null);
  const [serviceType, setServiceType] = useState<TruckServiceType>('Service');
  const [serviceItem, setServiceItem] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [mechanicName, setMechanicName] = useState('');
  const [serviceLocation, setServiceLocation] = useState('');
  const [serviceTimestamp, setServiceTimestamp] = useState('');
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [serviceSuccess, setServiceSuccess] = useState<string | null>(null);

  // Form states
  const [licensePlate, setLicensePlate] = useState('');
  const [model, setModel] = useState('');
  const [status, setStatus] = useState<TruckStatus>('Available');
  const [year, setYear] = useState('2022');
  const [capacityTons, setCapacityTons] = useState('30');
  const [currentMileage, setCurrentMileage] = useState('80000');

  const filteredTrucks = trucks.filter((t) => {
    const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
    const matchesSearch =
      t.license_plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.model.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const payload = {
        license_plate: licensePlate.trim().toUpperCase(),
        model: model.trim(),
        status,
        year: parseInt(year) || undefined,
        capacity_tons: parseFloat(capacityTons) || undefined,
        current_mileage: parseInt(currentMileage) || 0,
      };
      if (editingTruckId) {
        const { status: _status, ...details } = payload;
        const current = trucks.find((truck) => truck.id === editingTruckId);
        onUpdateTruck(editingTruckId, current?.status === 'On Trip' ? details : payload);
      } else {
        onCreateTruck(payload);
      }
      setEditingTruckId(null);
      setLicensePlate('');
      setModel('');
      setShowAddModal(false);
    } catch (err: any) {
      setErrorMsg(err.message || (editingTruckId ? 'Failed to update truck.' : 'Failed to create truck.'));
    }
  };

  const openEditTruck = (truck: Truck) => {
    setErrorMsg(null);
    setEditingTruckId(truck.id);
    setLicensePlate(truck.license_plate);
    setModel(truck.model);
    setStatus(truck.status);
    setYear(truck.year ? String(truck.year) : '');
    setCapacityTons(truck.capacity_tons ? String(truck.capacity_tons) : '');
    setCurrentMileage(String(truck.current_mileage || 0));
    setShowAddModal(true);
  };

  const handleDelete = (id: string) => {
    setErrorMsg(null);
    try {
      onDeleteTruck(id);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const openServiceModal = (truckId: string, openForm = true) => {
    setServiceTruckId(truckId);
    setShowServiceForm(openForm);
    setEditingServiceRecordId(null);
    setServiceError(null);
    setServiceSuccess(null);
    setServiceType('Service');
    setServiceItem('');
    setServicePrice('');
    setMechanicName('');
    setServiceLocation('');
    setServiceTimestamp('');
  };

  const handleCreateServiceRecord = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!serviceTruckId) return;
    setServiceError(null);
    setServiceSuccess(null);
    try {
      const recordFields = {
        record_type: serviceType,
        item_name: serviceItem.trim(),
        price: Number(servicePrice),
        mechanic_name: mechanicName.trim(),
        service_location: serviceLocation.trim(),
      };
      if (editingServiceRecordId) {
        onUpdateServiceRecord(editingServiceRecordId, {
          ...recordFields,
          timestamp: new Date(serviceTimestamp).toISOString(),
        });
        setServiceSuccess('Service record updated.');
        setEditingServiceRecordId(null);
        setShowServiceForm(false);
      } else {
        onCreateServiceRecord({
          truck_id: serviceTruckId,
          ...recordFields,
        });
        setServiceSuccess('Service record saved. Truck status changed to Maintenance.');
      }
      setServiceItem('');
      setServicePrice('');
      setMechanicName('');
      setServiceLocation('');
      setServiceTimestamp('');
    } catch (err) {
      setServiceError(err instanceof Error ? err.message : 'Failed to save truck service record.');
    }
  };

  const beginServiceRecordEdit = (record: TruckServiceRecord) => {
    const timestamp = new Date(record.timestamp);
    setEditingServiceRecordId(record.id);
    setShowServiceForm(true);
    setServiceError(null);
    setServiceSuccess(null);
    setServiceType(record.record_type);
    setServiceItem(record.item_name);
    setServicePrice(String(record.price));
    setMechanicName(record.mechanic_name);
    setServiceLocation(record.service_location);
    setServiceTimestamp(
      new Date(timestamp.getTime() - timestamp.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    );
  };

  const serviceTruck = trucks.find((truck) => truck.id === serviceTruckId);
  const selectedTruckServiceRecords = serviceTruckId
    ? [
        ...serviceRecords
          .filter((record) => record.truck_id === serviceTruckId)
          .map((record) => ({
            source_kind: 'truck_service' as const,
            id: record.id,
            record_type: record.record_type,
            item_name: record.item_name,
            price: Number(record.price),
            mechanic_name: record.mechanic_name,
            service_location: record.service_location,
            timestamp: record.timestamp,
          })),
        ...trips
          .filter((trip) => trip.truck_id === serviceTruckId)
          .flatMap((trip) =>
            trip.spare_parts.map((part) => ({
              source_kind: 'trip_spare_part' as const,
              id: part.id,
              record_type: 'Spare Part' as const,
              item_name: part.part_name,
              price: Number(part.price),
              mechanic_name: part.replaced_by || 'Field Workshop',
              service_location: `Trip: ${trip.origin} → ${trip.destination}`,
              timestamp: part.timestamp,
            }))
          ),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    : [];
  const selectedTruckServiceTotal = selectedTruckServiceRecords.reduce(
    (total, record) => total + Number(record.price),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Fleet Trucks Management</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
              {trucks.length} Units
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Heavy haulage vehicle inventory, availability state, and maintenance status tracking
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMsg(null);
            setEditingTruckId(null);
            setLicensePlate('');
            setModel('');
            setStatus('Available');
            setShowAddModal(true);
          }}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold transition shadow-sm self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Add Heavy Truck</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by license plate or model..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
          {(['All', 'Available', 'On Trip', 'Maintenance'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
              {st !== 'All' && (
                <span className="ml-1 text-[10px] opacity-75">
                  ({trucks.filter((t) => t.status === st).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Trucks Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <ul className="divide-y divide-slate-100 md:hidden">
          {filteredTrucks.map((truck) => (
            <li key={truck.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-bold text-slate-900">{truck.license_plate}</p>
                  <p className="truncate text-xs text-slate-500">{truck.model}{truck.year ? ` · ${truck.year}` : ''}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  truck.status === 'Available' ? 'bg-emerald-100 text-emerald-800' : truck.status === 'On Trip' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                }`}>{truck.status}</span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div><dt className="text-slate-500">Capacity</dt><dd className="font-semibold text-slate-800">{truck.capacity_tons ? `${truck.capacity_tons} Tons` : '-'}</dd></div>
                <div><dt className="text-slate-500">Mileage</dt><dd className="font-mono text-slate-800">{(truck.current_mileage || 0).toLocaleString()} km</dd></div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                {truck.status !== 'On Trip' && (
                  <button
                    type="button"
                    onClick={() => (truck.status === 'Maintenance' ? onUpdateTruckStatus(truck.id, 'Available') : openServiceModal(truck.id))}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold transition bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    {truck.status === 'Maintenance' ? 'Finish Service' : 'Service Truck'}
                  </button>
                )}
                <button type="button" onClick={() => openServiceModal(truck.id, false)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold transition bg-slate-100 text-slate-700 hover:bg-slate-200">History</button>
                <button type="button" onClick={() => openEditTruck(truck)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold transition bg-slate-100 text-slate-700 hover:bg-slate-200">Edit</button>
                <button type="button" onClick={() => handleDelete(truck.id)} aria-label={`Delete ${truck.license_plate}`} className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[960px] text-left text-[13px] text-slate-600 md:min-w-0 md:text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px] font-bold tracking-wider md:text-[10px]">
              <tr>
                <th className="py-3.5 px-4">License Plate</th>
                <th className="py-3.5 px-4">Model &amp; Specs</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Haul Capacity</th>
                <th className="py-3.5 px-4">Odometer Mileage</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTrucks.map((truck) => (
                <tr key={truck.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-4 px-4 font-mono font-bold text-slate-900 text-sm">
                    {truck.license_plate}
                  </td>
                  <td className="py-4 px-4">
                    <div className="font-semibold text-slate-900">{truck.model}</div>
                    <div className="text-xs text-slate-400 md:text-[11px]">Year: {truck.year || 'N/A'}</div>
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold md:text-[10px] ${
                        truck.status === 'Available'
                          ? 'bg-emerald-100 text-emerald-800'
                          : truck.status === 'On Trip'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {truck.status === 'Available' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                      {truck.status === 'On Trip' && <Navigation2 className="h-3 w-3 mr-1" />}
                      {truck.status === 'Maintenance' && <Wrench className="h-3 w-3 mr-1" />}
                      {truck.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 font-semibold text-slate-700">
                    {truck.capacity_tons ? `${truck.capacity_tons} Tons` : '-'}
                  </td>
                  <td className="py-4 px-4 font-mono text-slate-700">
                    {truck.current_mileage ? `${truck.current_mileage.toLocaleString()} km` : '0 km'}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      {/* Toggle Maintenance */}
                      {truck.status !== 'On Trip' && (
                        <button
                          onClick={() => {
                            if (truck.status === 'Maintenance') {
                              onUpdateTruckStatus(truck.id, 'Available');
                            } else {
                              openServiceModal(truck.id);
                            }
                          }}
                          title={truck.status === 'Maintenance' ? 'Mark as Available' : 'Record truck service'}
                          className="px-2 py-1 rounded text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition md:text-[11px]"
                        >
                          {truck.status === 'Maintenance' ? 'Finish Service' : 'Service Truck'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openServiceModal(truck.id, false)}
                        title={`View service history for ${truck.license_plate}`}
                        aria-label={`View service history for ${truck.license_plate}`}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition"
                      >
                        <Eye className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditTruck(truck)}
                        title={`Edit ${truck.license_plate}`}
                        aria-label={`Edit ${truck.license_plate}`}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(truck.id)}
                        title="Delete Truck (Protected by FK ON DELETE RESTRICT)"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Truck Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="modal-readable bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <TruckIcon className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-bold">{editingTruckId ? 'Edit Fleet Truck' : 'Register New Fleet Truck'}</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-3.5">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  License Plate * (UNIQUE)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. RAK 392G"
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono uppercase focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Model &amp; Manufacturer *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scania G460 Heavy Hauler"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    {editingTruckId ? 'Status' : 'Initial Status'}
                  </label>
                  <select
                    value={status}
                    disabled={Boolean(editingTruckId) && status === 'On Trip'}
                    title={editingTruckId && status === 'On Trip' ? 'Status changes automatically when the trip is completed.' : undefined}
                    onChange={(e) => setStatus(e.target.value as TruckStatus)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="Available">Available</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="On Trip">On Trip</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Manufacturing Year
                  </label>
                  <input
                    type="number"
                    min="1995"
                    max="2027"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Capacity (Tons)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={capacityTons}
                    onChange={(e) => setCapacityTons(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Odometer (km)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={currentMileage}
                    onChange={(e) => setCurrentMileage(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition"
                >
                  {editingTruckId ? 'Save Changes' : 'Save Truck'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {serviceTruck && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setServiceTruckId(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="truck-service-title"
            className="modal-readable bg-white w-full max-w-xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
          >
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-start justify-between border-b border-slate-800">
              <div className="min-w-0">
                <h2 id="truck-service-title" className="text-base sm:text-lg font-extrabold tracking-tight flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>
                    {showServiceForm
                      ? editingServiceRecordId
                        ? 'Edit Service Record'
                        : 'Truck Service Record'
                      : 'Service History'}
                  </span>
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  {serviceTruck.license_plate} · {serviceTruck.model}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setServiceTruckId(null)}
                aria-label="Close truck service modal"
                className="p-1.5 rounded-lg text-red-400 hover:text-white hover:bg-red-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 max-sm:[&_label]:text-xs max-sm:[&_input]:text-sm max-sm:[&_input]:py-2 max-sm:[&_select]:text-sm max-sm:[&_select]:py-2">
              {showServiceForm && (
              <form onSubmit={handleCreateServiceRecord} className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    {editingServiceRecordId ? 'Edit Service Record' : 'Record Required Work'}
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {editingServiceRecordId
                      ? 'Records can be edited for up to 7 days after they are recorded.'
                      : 'Saving a record will place this truck in Maintenance.'}
                  </p>
                </div>

                {serviceError && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{serviceError}</span>
                  </div>
                )}
                {serviceSuccess && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                    {serviceSuccess}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="service-type" className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Work Type *
                    </label>
                    <select
                      id="service-type"
                      required
                      value={serviceType}
                      onChange={(e) => setServiceType(e.target.value as TruckServiceType)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="Service">Service</option>
                      <option value="Spare Part">Spare Part Replacement</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="service-item" className="text-[11px] font-semibold text-slate-700 block mb-1">
                      {serviceType === 'Service' ? 'Service Needed *' : 'Spare Part to Replace *'}
                    </label>
                    <input
                      id="service-item"
                      type="text"
                      required
                      maxLength={160}
                      placeholder={serviceType === 'Service' ? 'e.g. Brake system inspection' : 'e.g. Front brake pads'}
                      value={serviceItem}
                      onChange={(e) => setServiceItem(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="service-price" className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Price (Tsh) *
                    </label>
                    <input
                      id="service-price"
                      type="number"
                      min="0"
                      step="1"
                      required
                      placeholder="e.g. 150000"
                      value={servicePrice}
                      onChange={(e) => setServicePrice(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="mechanic-name" className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Mechanic Name *
                    </label>
                    <input
                      id="mechanic-name"
                      type="text"
                      required
                      maxLength={120}
                      placeholder="e.g. Juma Mwakalinga"
                      value={mechanicName}
                      onChange={(e) => setMechanicName(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="service-location" className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Where It Was Serviced *
                    </label>
                    <input
                      id="service-location"
                      type="text"
                      required
                      maxLength={160}
                      placeholder="e.g. Arusha Central Garage"
                      value={serviceLocation}
                      onChange={(e) => setServiceLocation(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  {editingServiceRecordId && (
                    <div className="sm:col-span-2">
                      <label htmlFor="service-timestamp" className="text-[11px] font-semibold text-slate-700 block mb-1">
                        Date and Time *
                      </label>
                      <input
                        id="service-timestamp"
                        type="datetime-local"
                        required
                        value={serviceTimestamp}
                        onChange={(e) => setServiceTimestamp(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (editingServiceRecordId) {
                        setEditingServiceRecordId(null);
                        setShowServiceForm(false);
                        setServiceError(null);
                      } else {
                        setServiceTruckId(null);
                      }
                    }}
                    className="w-full px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 sm:w-auto"
                  >
                    {editingServiceRecordId ? 'Cancel Edit' : 'Close'}
                  </button>
                  <button
                    type="submit"
                    className="w-full px-4 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition sm:w-auto"
                  >
                    {editingServiceRecordId ? 'Save Changes' : 'Save Service Record'}
                  </button>
                </div>
              </form>
              )}

              <section aria-labelledby="truck-service-history-title" className="border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 id="truck-service-history-title" className="text-sm sm:text-base font-bold uppercase tracking-wider text-slate-800">
                    Total Spent:{' '}
                    {formatTsh(selectedTruckServiceTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h3>
                  {!showServiceForm && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowServiceForm(true);
                        setServiceError(null);
                        setServiceSuccess(null);
                      }}
                      className="shrink-0 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-amber-400"
                    >
                      Add Service Record
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">Records can be edited for up to 7 days after they are recorded.</p>
                {selectedTruckServiceRecords.length === 0 ? (
                  <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    No service records have been added for this truck.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {selectedTruckServiceRecords.map((record) => {
                      const editableRecord =
                        record.source_kind === 'truck_service'
                          ? serviceRecords.find((serviceRecord) => serviceRecord.id === record.id)
                          : undefined;
                      return (
                        <div key={`${record.source_kind}-${record.id}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <span className="text-xs font-bold uppercase tracking-wide text-amber-700">
                                {record.record_type}
                              </span>
                              <p className="text-sm sm:text-base font-bold leading-snug text-slate-900 break-words">{record.item_name}</p>
                            </div>
                            <span className="text-sm sm:text-base font-bold font-mono text-slate-900">
                              {formatTsh(record.price, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-slate-700">
                            Mechanic: {record.mechanic_name} · Location: {record.service_location}
                          </p>
                          <p className="mt-1.5 text-xs text-slate-500">
                            {new Date(record.timestamp).toLocaleString()}
                          </p>
                          {editableRecord && (
                            <div className="mt-2 flex justify-end">
                              {canEditTruckServiceRecord(editableRecord) ? (
                                <button
                                  type="button"
                                  onClick={() => beginServiceRecordEdit(editableRecord)}
                                  className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                                >
                                  <Pencil className="h-4 w-4" />
                                  Edit Service
                                </button>
                              ) : (
                                <span className="text-xs font-medium text-slate-500">Edit window expired</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                   </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
