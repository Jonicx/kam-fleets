import React, { useState } from 'react';
import {
  Users,
  Plus,
  Search,
  CheckCircle2,
  Navigation2,
  Clock,
  Trash2,
  X,
  Phone,
  FileText,
  AlertCircle,
  Pencil,
} from 'lucide-react';
import { Driver, DriverStatus } from '../types/database.ts';

interface DriversViewProps {
  drivers: Driver[];
  onCreateDriver: (driver: Omit<Driver, 'id' | 'created_at' | 'updated_at'>) => void;
  onUpdateDriverStatus: (id: string, status: DriverStatus) => void;
  onDeleteDriver: (id: string) => void;
  onUpdateDriver: (id: string, updates: Partial<Omit<Driver, 'id' | 'created_at' | 'updated_at'>>) => void;
}

export const DriversView: React.FC<DriversViewProps> = ({
  drivers,
  onCreateDriver,
  onUpdateDriverStatus,
  onDeleteDriver,
  onUpdateDriver,
}) => {
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | DriverStatus>('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<DriverStatus>('Available');
  const [experienceYears, setExperienceYears] = useState('7');

  const filteredDrivers = drivers.filter((d) => {
    const matchesStatus = statusFilter === 'All' || d.status === statusFilter;
    const matchesSearch =
      d.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.license_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.phone.includes(searchTerm);
    return matchesStatus && matchesSearch;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const payload = {
        full_name: fullName.trim(),
        license_number: licenseNumber.trim().toUpperCase(),
        phone: phone.trim(),
        status,
        experience_years: parseInt(experienceYears) || 1,
      };
      if (editingDriverId) {
        const { status: _status, ...details } = payload;
        const current = drivers.find((driver) => driver.id === editingDriverId);
        onUpdateDriver(editingDriverId, current?.status === 'On Trip' ? details : payload);
      } else {
        onCreateDriver(payload);
      }
      setEditingDriverId(null);
      setFullName('');
      setLicenseNumber('');
      setPhone('');
      setShowAddModal(false);
    } catch (err: any) {
      setErrorMsg(err.message || (editingDriverId ? 'Failed to update driver.' : 'Failed to create driver.'));
    }
  };

  const openEditDriver = (driver: Driver) => {
    setErrorMsg(null);
    setEditingDriverId(driver.id);
    setFullName(driver.full_name);
    setLicenseNumber(driver.license_number);
    setPhone(driver.phone);
    setStatus(driver.status);
    setExperienceYears(String(driver.experience_years || 1));
    setShowAddModal(true);
  };

  const handleDelete = (id: string) => {
    setErrorMsg(null);
    try {
      onDeleteDriver(id);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Drivers Directory</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
              {drivers.length} Drivers
            </span> 
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Commercial heavy haulage drivers, license tracking, and duty assignments
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMsg(null);
            setEditingDriverId(null);
            setFullName('');
            setLicenseNumber('');
            setPhone('');
            setStatus('Available');
            setShowAddModal(true);
          }}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold transition shadow-sm self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Register New Driver</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by driver name, license number, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
          {(['All', 'Available', 'On Trip', 'Off Duty'] as const).map((st) => (
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
                  ({drivers.filter((d) => d.status === st).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Drivers Table */}
      <div className="md:overflow-hidden md:rounded-xl md:border md:border-slate-200 md:bg-white md:shadow-xs">
        <ul className="space-y-3 md:hidden">
          {filteredDrivers.map((driver) => (
            <li key={driver.id} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold leading-5 text-slate-900">{driver.full_name}</p>
                  <p className="mt-0.5 truncate font-mono text-xs text-slate-500">{driver.license_number}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  driver.status === 'Available' ? 'bg-emerald-100 text-emerald-800' : driver.status === 'On Trip' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'
                }`}>{driver.status}</span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs">
                <div className="min-w-0"><dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Phone</dt><dd className="mt-0.5 truncate"><a href={`tel:${driver.phone}`} className="font-semibold text-blue-700">{driver.phone}</a></dd></div>
                <div className="min-w-0 border-l border-slate-200 pl-3"><dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Experience</dt><dd className="mt-0.5 font-semibold text-slate-800">{driver.experience_years || 1} Years</dd></div>
              </dl>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {driver.status !== 'On Trip' && (
                  <button
                    type="button"
                    onClick={() => onUpdateDriverStatus(driver.id, driver.status === 'Off Duty' ? 'Available' : 'Off Duty')}
                    className="rounded-lg px-2.5 py-2 text-xs font-semibold transition bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    {driver.status === 'Off Duty' ? 'Set Available' : 'Set Off Duty'}
                  </button>
                )}
                <button type="button" onClick={() => openEditDriver(driver)} className="rounded-lg px-2.5 py-2 text-xs font-semibold transition bg-slate-100 text-slate-700 hover:bg-slate-200">Edit</button>
                <button type="button" onClick={() => handleDelete(driver.id)} aria-label={`Delete ${driver.full_name}`} className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto pb-1 [scrollbar-width:thin] md:block">
          <table className="w-full min-w-[960px] text-left text-[13px] text-slate-600 md:min-w-0 md:text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px] font-bold tracking-wider md:text-[10px]">
              <tr>
                <th className="py-3.5 px-3 sm:px-4">Full Name</th>
                <th className="py-3.5 px-3 sm:px-4">License Number</th>
                <th className="py-3.5 px-3 sm:px-4">Phone Number</th>
                <th className="py-3.5 px-3 sm:px-4">Status</th>
                <th className="py-3.5 px-3 sm:px-4">Commercial Experience</th>
                <th className="py-3.5 px-3 text-right sm:px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDrivers.map((driver) => (
                <tr key={driver.id} className="hover:bg-slate-50/70 transition align-top">
                  <td className="py-4 px-3 sm:px-4">
                    <div className="text-[13px] font-bold text-slate-900 md:text-xs">{driver.full_name}</div>
                  </td>
                  <td className="py-4 px-3 font-mono font-semibold text-slate-800 sm:px-4">
                    {driver.license_number}
                  </td>
                  <td className="py-4 px-3 font-mono text-slate-700 sm:px-4">
                    <span className="flex items-center space-x-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400 md:h-3 md:w-3" />
                      <span className="text-[13px] md:text-[11px]">{driver.phone}</span>
                    </span>
                  </td>
                  <td className="py-4 px-3 sm:px-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold md:text-[10px] ${
                        driver.status === 'Available'
                          ? 'bg-emerald-100 text-emerald-800'
                          : driver.status === 'On Trip'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {driver.status === 'Available' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                      {driver.status === 'On Trip' && <Navigation2 className="h-3 w-3 mr-1" />}
                      {driver.status === 'Off Duty' && <Clock className="h-3 w-3 mr-1" />}
                      {driver.status}
                    </span>
                  </td>
                  <td className="py-4 px-3 font-semibold text-slate-700 sm:px-4">
                    {driver.experience_years ? `${driver.experience_years} Years` : '1 Year'}
                  </td>
                  <td className="py-4 px-3 text-right sm:px-4">
                    <div className="flex items-center justify-end gap-1.5">
                      {driver.status !== 'On Trip' && (
                        <button
                          onClick={() =>
                            onUpdateDriverStatus(
                              driver.id,
                              driver.status === 'Off Duty' ? 'Available' : 'Off Duty'
                            )
                          }
                          className="px-2 py-1.5 rounded text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition md:text-[11px]"
                        >
                          {driver.status === 'Off Duty' ? 'Set Available' : 'Set Off Duty'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openEditDriver(driver)}
                        title={`Edit ${driver.full_name}`}
                        aria-label={`Edit ${driver.full_name}`}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(driver.id)}
                        title="Delete Driver (Protected by FK ON DELETE RESTRICT)"
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

      {/* Add Driver Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-start justify-center p-3 sm:items-start sm:p-4">
          <div className="modal-readable bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-bold">{editingDriverId ? 'Edit Driver' : 'Register Commercial Driver'}</h3>
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
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samuel Mugenzi"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Commercial Driver License Number * (UNIQUE)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DL-RW-771829"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono uppercase focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Phone Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +250 788 333 444"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    {editingDriverId ? 'Status' : 'Initial Status'}
                  </label>
                  <select
                    value={status}
                    disabled={Boolean(editingDriverId) && status === 'On Trip'}
                    title={editingDriverId && status === 'On Trip' ? 'Status changes automatically when the trip is completed.' : undefined}
                    onChange={(e) => setStatus(e.target.value as DriverStatus)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="Available">Available</option>
                    <option value="Off Duty">Off Duty</option>
                    <option value="On Trip">On Trip</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Experience (Years)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
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
                  {editingDriverId ? 'Save Changes' : 'Save Driver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
