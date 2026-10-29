import React, { Suspense, lazy, useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { TripsView } from './components/TripsView.tsx';
import { TrucksView } from './components/TrucksView.tsx';
import { DriversView } from './components/DriversView.tsx';
import { ExpensesAndPartsView } from './components/ExpensesAndPartsView.tsx';
import { TripDetailModal } from './components/TripDetailModal.tsx';
import { NewTripModal } from './components/NewTripModal.tsx';
import { UpdateTripModal } from './components/UpdateTripModal.tsx';
import { TripEditModal } from './components/TripEditModal.tsx';
import { NeonAuthGate } from './components/NeonAuthGate.tsx';
import { ProfileModal } from './components/ProfileModal.tsx';
import { dbStore } from './db/store.ts';
import { UserProvider, useUser } from './contexts/UserContext.tsx';
import { neonAuthClient, updateCurrentUser } from './neon.ts';

const AdminDashboardView = lazy(() =>
  import('./components/AdminDashboardView.tsx').then((module) => ({ default: module.AdminDashboardView })),
);
const SchemaStudioView = lazy(() =>
  import('./components/SchemaStudioView.tsx').then((module) => ({ default: module.SchemaStudioView })),
);
import {
  Truck,
  Driver,
  Trip,
  Expense,
  SparePart,
  EnrichedTrip,
  DatabaseStats,
  TruckStatus,
  TruckServiceRecord,
  DriverStatus,
  TripStatus,
  ExpenseType,
  Invoice,
  Payment,
  PaymentMethod,
  AuditLog,
} from './types/database.ts';

function FleetTripManagerApp() {
  const { userName, userEmail, userRole, profilePictureId, setUserInfo } = useUser();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [updatingTripId, setUpdatingTripId] = useState<string | null>(null);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [showNewTripModal, setShowNewTripModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetSuccessToast, setResetSuccessToast] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const handleSignOut = async () => {
    try {
      const result = await neonAuthClient.signOut();
      if (result.error) {
        console.error('Sign out error:', result.error);
      }
      window.location.reload();
    } catch (error) {
      console.error('Sign out failed:', error);
      window.location.reload();
    }
  };

  // Reactive DB store state
  const [trucks, setTrucks] = useState<Truck[]>(() => dbStore.getTrucks());
  const [truckServiceRecords, setTruckServiceRecords] = useState<TruckServiceRecord[]>(() => dbStore.getTruckServiceRecords());
  const [drivers, setDrivers] = useState<Driver[]>(() => dbStore.getDrivers());
  const [trips, setTrips] = useState<Trip[]>(() => dbStore.getTrips());
  const [enrichedTrips, setEnrichedTrips] = useState<EnrichedTrip[]>(() => dbStore.getEnrichedTrips());
  const [expenses, setExpenses] = useState<Expense[]>(() => dbStore.getExpenses());
  const [spareParts, setSpareParts] = useState<SparePart[]>(() => dbStore.getSpareParts());
  const [stats, setStats] = useState<DatabaseStats>(() => dbStore.getStats());
  const [invoices, setInvoices] = useState<Invoice[]>(() => dbStore.getInvoices());
  const [payments, setPayments] = useState<Payment[]>(() => dbStore.getPayments());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => dbStore.getAuditLogs());
  const [auditActor, setAuditActor] = useState(() => dbStore.getAuditActor());

  useEffect(() => {
    const syncDb = () => {
      setTrucks(dbStore.getTrucks());
      setTruckServiceRecords(dbStore.getTruckServiceRecords());
      setDrivers(dbStore.getDrivers());
      setTrips(dbStore.getTrips());
      setEnrichedTrips(dbStore.getEnrichedTrips());
      setExpenses(dbStore.getExpenses());
      setSpareParts(dbStore.getSpareParts());
      setStats(dbStore.getStats());
      setInvoices(dbStore.getInvoices());
      setPayments(dbStore.getPayments());
      setAuditLogs(dbStore.getAuditLogs());
      setAuditActor(dbStore.getAuditActor());
    };

    const unsubscribe = dbStore.subscribe(syncDb);
    return () => {
      unsubscribe();
    };
  }, []);

  const isAdmin = dbStore.getRole() === 'Admin';
  const selectedTrip = selectedTripId ? dbStore.getEnrichedTrip(selectedTripId) : null;
  const updatingTrip = updatingTripId ? dbStore.getEnrichedTrip(updatingTripId) : null;
  const editingTrip = editingTripId ? dbStore.getEnrichedTrip(editingTripId) : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
        onResetDb={() => setShowResetConfirm(true)}
        onOpenNewTripModal={() => setShowNewTripModal(true)}
        userName={userName}
        userEmail={userEmail}
        profilePictureId={profilePictureId}
        onSignOut={handleSignOut}
        onOpenProfile={() => setShowProfileModal(true)}
        isSticky={activeTab !== 'admin'}
        isAdmin={isAdmin}
      />

      {/* Reset Success Toast */}
      {resetSuccessToast && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold text-center shadow-sm">
          Sample fleet data restored. Invoices and payments were cleared; local audit history was retained.
        </div>
      )}

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Suspense
          fallback={<p role="status" className="py-16 text-center text-sm font-semibold text-slate-500">Loading...</p>}
        >
        {activeTab === 'dashboard' && (
          <DashboardView
            stats={stats}
            enrichedTrips={enrichedTrips}
            onSelectTrip={(id) => setSelectedTripId(id)}
            onOpenUpdateModal={(id) => setUpdatingTripId(id)}
            onOpenNewTrip={() => setShowNewTripModal(true)}
            onNavigateToSchema={() => setActiveTab('schema')}
          />
        )}

        {activeTab === 'admin' && isAdmin && (
          <AdminDashboardView
            trips={enrichedTrips}
            trucks={trucks}
            drivers={drivers}
            truckServiceRecords={truckServiceRecords}
            invoices={invoices}
            payments={payments}
            auditLogs={auditLogs}
            onSelectTrip={(id) => setSelectedTripId(id)}
            onCreateInvoice={(data) => dbStore.createInvoice(data)}
            onCreatePayment={(data) => dbStore.createPayment(data)}
            onVoidInvoice={(id, reason) => dbStore.voidInvoice(id, reason)}
            onReversePayment={(id, reason) => dbStore.reversePayment(id, reason)}
          />
        )}

        {activeTab === 'trips' && (
          <TripsView
            trips={enrichedTrips}
            onSelectTrip={(id) => setSelectedTripId(id)}
            onOpenUpdateModal={(id) => setUpdatingTripId(id)}
            onOpenNewTripModal={() => setShowNewTripModal(true)}
            onUpdateTripStatus={(id, status) => dbStore.updateTrip(id, { status })}
            onDeleteTrip={(id) => dbStore.deleteTrip(id)}
            onEditTrip={(id) => setEditingTripId(id)}
          />
        )}

        {activeTab === 'trucks' && (
          <TrucksView
            trucks={trucks}
            serviceRecords={truckServiceRecords}
            trips={enrichedTrips}
            onCreateTruck={(data) => dbStore.createTruck(data)}
            onCreateServiceRecord={(data) => dbStore.createTruckServiceRecord(data)}
            onUpdateServiceRecord={(id, updates) => dbStore.updateTruckServiceRecord(id, updates)}
            onUpdateTruckStatus={(id, status) => dbStore.updateTruck(id, { status })}
            onDeleteTruck={(id) => dbStore.deleteTruck(id)}
            onUpdateTruck={(id, updates) => dbStore.updateTruck(id, updates)}
          />
        )}

        {activeTab === 'drivers' && (
          <DriversView
            drivers={drivers}
            onCreateDriver={(data) => dbStore.createDriver(data)}
            onUpdateDriverStatus={(id, status) => dbStore.updateDriver(id, { status })}
            onDeleteDriver={(id) => dbStore.deleteDriver(id)}
            onUpdateDriver={(id, updates) => dbStore.updateDriver(id, updates)}
          />
        )}

        {activeTab === 'expenses' && (
          <ExpensesAndPartsView
            expenses={expenses}
            spareParts={spareParts}
            trucks={trucks}
            truckServiceRecords={truckServiceRecords}
            trips={enrichedTrips}
            onDeleteExpense={(id) => dbStore.deleteExpense(id)}
            onDeleteSparePart={(id) => dbStore.deleteSparePart(id)}
            onSaveEntry={(kind, values, id) => {
              if (kind === 'expense') {
                const data = { expense_type: values.category, amount: values.amount, description: values.description, timestamp: values.timestamp };
                if (id) dbStore.updateExpense(id, data);
                else dbStore.createExpense({ trip_id: values.trip_id, ...data });
              } else {
                const data = { part_name: values.name, price: values.amount, description: values.description, replaced_by: values.replaced_by, timestamp: values.timestamp };
                if (id) dbStore.updateSparePart(id, data);
                else dbStore.createSparePart({ trip_id: values.trip_id, ...data });
              }
            }}
            onUpdateTruckServiceRecord={(id, updates) => dbStore.updateTruckServiceRecord(id, updates)}
            onSelectTrip={(id) => setSelectedTripId(id)}
          />
        )}

        {activeTab === 'schema' && <SchemaStudioView />}
        </Suspense>
      </main>


      {/* Modals */}
      {editingTrip && (
        <TripEditModal
          trip={editingTrip}
          trucks={trucks}
          drivers={drivers}
          onSave={(id, updates) => dbStore.updateTrip(id, updates)}
          onClose={() => setEditingTripId(null)}
        />
      )}
      {updatingTrip && (
        <UpdateTripModal
          trip={updatingTrip}
          onClose={() => setUpdatingTripId(null)}
          onUpdateStatus={(id, status) => dbStore.updateTrip(id, { status })}
          onAddDelayLog={(id, log) => dbStore.addDelayLog(id, log)}
          onRemoveDelayLog={(id, logId) => dbStore.removeDelayLog(id, logId)}
          onAddExpense={(id, exp) => dbStore.createExpense({ trip_id: id, ...exp })}
          onDeleteExpense={(id) => dbStore.deleteExpense(id)}
          onAddSparePart={(id, part) => dbStore.createSparePart({ trip_id: id, ...part })}
          onDeleteSparePart={(id) => dbStore.deleteSparePart(id)}
        />
      )}

      {selectedTrip && (
        <TripDetailModal
          trip={selectedTrip}
          onClose={() => setSelectedTripId(null)}
          onOpenUpdateModal={(id) => setUpdatingTripId(id)}
          onUpdateStatus={(id, status) => dbStore.updateTrip(id, { status })}
          onAddDelayLog={(id, log) => dbStore.addDelayLog(id, log)}
          onRemoveDelayLog={(id, logId) => dbStore.removeDelayLog(id, logId)}
          onAddExpense={(id, exp) => dbStore.createExpense({ trip_id: id, ...exp })}
          onDeleteExpense={(id) => dbStore.deleteExpense(id)}
          onAddSparePart={(id, part) => dbStore.createSparePart({ trip_id: id, ...part })}
          onDeleteSparePart={(id) => dbStore.deleteSparePart(id)}
        />
      )}

      {showNewTripModal && (
        <NewTripModal
          trucks={trucks}
          drivers={drivers}
          onClose={() => setShowNewTripModal(false)}
          onCreateTrip={(data) => {
            const newTrip = dbStore.createTrip(data);
            setUpdatingTripId(newTrip.id);
          }}
        />
      )}

      {/* Reset Database Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="modal-readable bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Reset Sample Database?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              This restores Trucks, Drivers, Trips, Expenses, Spare Parts, and Truck Service History to the sample dataset and clears invoices and payments. The local audit history is retained and the reset is recorded as an event.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  dbStore.resetToDefault();
                  setShowResetConfirm(false);
                  setResetSuccessToast(true);
                  setTimeout(() => setResetSuccessToast(false), 3000);
                }}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition shadow-sm"
              >
                Reset Database
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <ProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          userName={userName}
          userEmail={userEmail}
          profilePictureId={profilePictureId}
          onSave={async (data) => {
            try {
              await updateCurrentUser({
                name: data.name,
                phone: data.phone,
                profilePictureId: data.profilePictureId,
              });
              setUserInfo({
                userName: data.name,
                userEmail: data.email,
                userRole,
                profilePictureId: data.profilePictureId,
              });
            } catch (error) {
              console.error('Failed to update profile:', error);
              alert('Failed to update profile. Please try again.');
            }
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <UserProvider>
      <NeonAuthGate>
        <FleetTripManagerApp />
      </NeonAuthGate>
    </UserProvider>
  );
}
