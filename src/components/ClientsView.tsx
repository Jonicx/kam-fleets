import React, { useMemo, useState } from 'react';
import { Building2, Mail, Pencil, Phone, Plus, Search, Trash2, X } from 'lucide-react';
import type { Client } from '../types/database.ts';

type ClientInput = Omit<Client, 'id' | 'created_at' | 'updated_at'>;

interface ClientsViewProps {
  clients: Client[];
  onCreateClient: (data: ClientInput) => void;
  onUpdateClient: (id: string, updates: Partial<ClientInput>) => void;
  onDeleteClient: (id: string) => void;
}

const emptyClient: ClientInput = {
  name: '',
  contact_person: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
};

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100';

export const ClientsView: React.FC<ClientsViewProps> = ({ clients, onCreateClient, onUpdateClient, onDeleteClient }) => {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ClientInput>(emptyClient);
  const [error, setError] = useState('');
  const [deleteCandidate, setDeleteCandidate] = useState<Client | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const filteredClients = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return clients
      .filter((client) => !query || [client.name, client.contact_person, client.phone, client.email, client.address]
        .some((value) => value?.toLocaleLowerCase().includes(query)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, search]);

  const beginEdit = (client: Client) => {
    setEditingId(client.id);
    setForm({
      name: client.name,
      contact_person: client.contact_person ?? '',
      phone: client.phone ?? '',
      email: client.email ?? '',
      address: client.address ?? '',
      notes: client.notes ?? '',
    });
    setError('');
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyClient);
    setError('');
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      if (editingId) onUpdateClient(editingId, form);
      else onCreateClient(form);
      resetForm();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'The client could not be saved.');
    }
  };

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900">
            <Building2 className="h-6 w-6 text-amber-500" /> Clients
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">{clients.length}</span>
          </h1>
          <p className="mt-1 text-xs text-slate-500">Manage customer contacts and link them to trips and invoices.</p>
        </div>
        <label className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clients..." className={`${inputClass} pl-9`} />
        </label>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid content-start gap-3 sm:grid-cols-2">
          {filteredClients.map((client) => (
            <article key={client.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold text-slate-900">{client.name}</h2>
                  {client.contact_person && <p className="mt-1 truncate text-xs text-slate-500">{client.contact_person}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" aria-label={`Edit ${client.name}`} onClick={() => beginEdit(client)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label={`Delete ${client.name}`} onClick={() => { setDeleteCandidate(client); setDeleteError(''); }} className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {client.phone && <p className="mt-3 flex items-center gap-2 text-xs text-slate-600"><Phone className="h-3.5 w-3.5 shrink-0" />{client.phone}</p>}
              {client.email && <p className="mt-2 flex min-w-0 items-center gap-2 text-xs text-slate-600"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{client.email}</span></p>}
              {client.address && <p className="mt-2 text-xs text-slate-500">{client.address}</p>}
            </article>
          ))}
          {filteredClients.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center sm:col-span-2">
              <Building2 className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-700">{clients.length ? 'No matching clients' : 'No clients added yet'}</p>
              <p className="mt-1 text-xs text-slate-500">{clients.length ? 'Try another search.' : 'Add a client to associate it with trips and invoices.'}</p>
            </div>
          )}
        </div>

        <form onSubmit={submit} className="h-fit space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">{editingId ? 'Edit client' : 'Add a client'}</h2>
            {editingId && <button type="button" aria-label="Cancel editing" onClick={resetForm} className="rounded-md p-1 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>}
          </div>
          {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}
          <label className="block text-xs font-semibold text-slate-600">Client / company name *
            <input required maxLength={150} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={`${inputClass} mt-1`} />
          </label>
          <label className="block text-xs font-semibold text-slate-600">Contact person
            <input maxLength={150} value={form.contact_person} onChange={(event) => setForm({ ...form, contact_person: event.target.value })} className={`${inputClass} mt-1`} />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <label className="block text-xs font-semibold text-slate-600">Phone
              <input type="tel" maxLength={30} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className={`${inputClass} mt-1`} />
            </label>
            <label className="block text-xs font-semibold text-slate-600">Email
              <input type="email" maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={`${inputClass} mt-1`} />
            </label>
          </div>
          <label className="block text-xs font-semibold text-slate-600">Address
            <input maxLength={500} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className={`${inputClass} mt-1`} />
          </label>
          <label className="block text-xs font-semibold text-slate-600">Notes
            <textarea rows={3} maxLength={2000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className={`${inputClass} mt-1`} />
          </label>
          <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-700">
            <Plus className="h-4 w-4" />{editingId ? 'Save changes' : 'Add client'}
          </button>
        </form>
      </div>

      {deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="delete-client-title" className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h2 id="delete-client-title" className="text-sm font-bold text-slate-900">Delete {deleteCandidate.name}?</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">Clients linked to trips or invoices cannot be deleted.</p>
            {deleteError && <p role="alert" className="mt-3 text-xs font-semibold text-rose-700">{deleteError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => { setDeleteCandidate(null); setDeleteError(''); }} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
              <button type="button" onClick={() => {
                try {
                  onDeleteClient(deleteCandidate.id);
                  setDeleteCandidate(null);
                  setDeleteError('');
                } catch (deleteError) {
                  setDeleteError(deleteError instanceof Error ? deleteError.message : 'The client could not be deleted.');
                }
              }} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700">Delete client</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
