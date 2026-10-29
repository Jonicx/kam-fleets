import React, { useState } from 'react';
import {
  Database,
  Code2,
  Table as TableIcon,
  Play,
  Copy,
  Check,
  Download,
  Key,
  Link as LinkIcon,
  Layers,
  Zap,
  HelpCircle,
  FileCode,
  Sparkles,
} from 'lucide-react';
import { dbStore } from '../db/store.ts';

export const SchemaStudioView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'erd' | 'sql' | 'indexes' | 'orm' | 'query'>('erd');
  const [copied, setCopied] = useState(false);

  // SQL Runner state
  const [queryInput, setQueryInput] = useState(
    'SELECT trips.id, origin, destination, truck_plate, driver_name, budget_allocated, total_spent FROM trips JOIN trucks ON trips.truck_id = trucks.id JOIN drivers ON trips.driver_id = drivers.id;'
  );
  const [queryResult, setQueryResult] = useState<{
    columns: string[];
    rows: any[];
    rowCount: number;
    executionTimeMs: number;
  } | null>(() => dbStore.executeMockSql('SELECT * FROM trips JOIN trucks'));

  const handleCopySql = () => {
    navigator.clipboard.writeText(RAW_SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSql = () => {
    const blob = new Blob([RAW_SQL_SCHEMA], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kam_fleets_schema.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  const runQuery = (sql: string) => {
    setQueryInput(sql);
    const res = dbStore.executeMockSql(sql);
    setQueryResult(res);
  };

  return (
    <div className="space-y-6">
      {/* Studio Header */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
              <Database className="h-4 w-4" />
              <span>Database Architecture &amp; Engineering Studio</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              KAM Fleets Relational Schema, Models &amp; Indexes
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Production-ready PostgreSQL database definitions with referential integrity constraints,
              composite foreign key indexes, dynamic delay logs, and Drizzle ORM models.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopySql}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? 'Copied SQL' : 'Copy DDL'}</span>
            </button>

            <button
              onClick={handleDownloadSql}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-xs"
            >
              <Download className="h-4 w-4" />
              <span>Download .sql</span>
            </button>
          </div>
        </div>

        {/* Studio Sub-Navigation */}
        <div className="flex border-t border-slate-800 mt-6 pt-3 space-x-2 overflow-x-auto scrollbar-none">
          {[
            { id: 'erd', label: 'Interactive ER Diagram', icon: Layers },
            { id: 'indexes', label: 'Index Optimization Matrix', icon: Zap },
            { id: 'sql', label: 'PostgreSQL DDL Scripts', icon: FileCode },
            { id: 'orm', label: 'Drizzle ORM & Models', icon: Code2 },
            { id: 'query', label: 'Live SQL Query Sandbox', icon: Play },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: INTERACTIVE ER DIAGRAM */}
      {activeTab === 'erd' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs">
            <div className="text-xs text-slate-600">
              <span className="font-bold text-slate-900">Entity-Relationship Visual Map: </span>
              6 Tables with Foreign Key integrity constraints (<code>ON DELETE RESTRICT</code> for fleet/staff &amp; <code>ON DELETE CASCADE</code> for trip children).
            </div>
            <div className="flex items-center space-x-3 text-[11px] text-slate-500">
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>PK (Primary Key)</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                <span>FK (Foreign Key)</span>
              </span>
            </div>
          </div>

          {/* ERD Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* TRUCKS */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <TableIcon className="h-4 w-4 text-amber-400" />
                  <span className="font-mono font-bold text-sm">trucks</span>
                </div>
                <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">
                  Parent Table
                </span>
              </div>
              <div className="p-3 text-xs divide-y divide-slate-100 font-mono">
                <div className="py-1.5 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5 text-amber-700 font-bold">
                    <Key className="h-3 w-3" />
                    <span>id</span>
                  </span>
                  <span className="text-slate-400 text-[11px]">UUID (PK)</span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-900 font-semibold">license_plate</span>
                  <span className="text-blue-600 text-[11px]">VARCHAR(32) UNIQUE</span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-700">model</span>
                  <span className="text-slate-400 text-[11px]">VARCHAR(120)</span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-700">status</span>
                  <span className="text-emerald-700 text-[11px]">ENUM (Available, On Trip, Maint)</span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-700">year</span>
                  <span className="text-slate-400 text-[11px]">INTEGER</span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-700">capacity_tons</span>
                  <span className="text-slate-400 text-[11px]">NUMERIC(5,2)</span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-700">current_mileage</span>
                  <span className="text-slate-400 text-[11px]">INTEGER</span>
                </div>
                <div className="py-1.5 flex items-center justify-between text-slate-400 text-[11px]">
                  <span>created_at / updated_at</span>
                  <span>TIMESTAMPTZ</span>
                </div>
              </div>
            </div>

            {/* DRIVERS */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <TableIcon className="h-4 w-4 text-amber-400" />
                  <span className="font-mono font-bold text-sm">drivers</span>
                </div>
                <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">
                  Parent Table
                </span>
              </div>
              <div className="p-3 text-xs divide-y divide-slate-100 font-mono">
                <div className="py-1.5 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5 text-amber-700 font-bold">
                    <Key className="h-3 w-3" />
                    <span>id</span>
                  </span>
                  <span className="text-slate-400 text-[11px]">UUID (PK)</span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-900 font-semibold">full_name</span>
                  <span className="text-slate-400 text-[11px]">VARCHAR(150)</span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-900 font-semibold">license_number</span>
                  <span className="text-blue-600 text-[11px]">VARCHAR(50) UNIQUE</span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-700">phone</span>
                  <span className="text-slate-400 text-[11px]">VARCHAR(30)</span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-700">status</span>
                  <span className="text-emerald-700 text-[11px]">ENUM (Available, On Trip, Off Duty)</span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-700">experience_years</span>
                  <span className="text-slate-400 text-[11px]">INTEGER</span>
                </div>
                <div className="py-1.5 flex items-center justify-between text-slate-400 text-[11px]">
                  <span>created_at / updated_at</span>
                  <span>TIMESTAMPTZ</span>
                </div>
              </div>
            </div>

            {/* TRIPS */}
            <div className="bg-white rounded-xl border-2 border-blue-400 shadow-md overflow-hidden md:col-span-2 lg:col-span-1">
              <div className="bg-blue-900 text-white px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <TableIcon className="h-4 w-4 text-blue-300" />
                  <span className="font-mono font-bold text-sm">trips</span>
                </div>
                <span className="text-[10px] bg-blue-800 px-2 py-0.5 rounded text-blue-200 font-mono">
                  Core Associative Entity
                </span>
              </div>
              <div className="p-3 text-xs divide-y divide-slate-100 font-mono">
                <div className="py-1.5 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5 text-amber-700 font-bold">
                    <Key className="h-3 w-3" />
                    <span>id</span>
                  </span>
                  <span className="text-slate-400 text-[11px]">UUID (PK)</span>
                </div>
                <div className="py-1.5 flex items-center justify-between bg-blue-50/50 px-1 rounded">
                  <span className="flex items-center space-x-1.5 text-blue-700 font-bold">
                    <LinkIcon className="h-3 w-3" />
                    <span>truck_id</span>
                  </span>
                  <span className="text-blue-700 text-[10px]">FK → trucks.id [RESTRICT]</span>
                </div>
                <div className="py-1.5 flex items-center justify-between bg-blue-50/50 px-1 rounded">
                  <span className="flex items-center space-x-1.5 text-blue-700 font-bold">
                    <LinkIcon className="h-3 w-3" />
                    <span>driver_id</span>
                  </span>
                  <span className="text-blue-700 text-[10px]">FK → drivers.id [RESTRICT]</span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-700">status</span>
                  <span className="text-emerald-700 text-[11px]">ENUM (Planned, Ongoing, Done)</span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-700">origin / destination</span>
                  <span className="text-slate-400 text-[11px]">VARCHAR(255)</span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-700">scheduled_start / end</span>
                  <span className="text-slate-400 text-[11px]">TIMESTAMPTZ</span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-900 font-semibold">budget_allocated</span>
                  <span className="text-emerald-700 text-[11px]">NUMERIC(12,2) CHECK &gt;= 0</span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-900 font-semibold">driver_pay</span>
                  <span className="text-blue-700 text-[11px]">NUMERIC(10,2) CHECK &gt;= 0</span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-700">delay_reasons</span>
                  <span className="text-slate-400 text-[11px]">TEXT[] (summary array)</span>
                </div>
              </div>
            </div>

            {/* EXPENSES */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <TableIcon className="h-4 w-4 text-emerald-400" />
                  <span className="font-mono font-bold text-sm">expenses</span>
                </div>
                <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">
                  1:N Child of trips
                </span>
              </div>
              <div className="p-3 text-xs divide-y divide-slate-100 font-mono">
                <div className="py-1.5 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5 text-amber-700 font-bold">
                    <Key className="h-3 w-3" />
                    <span>id</span>
                  </span>
                  <span className="text-slate-400 text-[11px]">UUID (PK)</span>
                </div>
                <div className="py-1.5 flex items-center justify-between bg-blue-50/50 px-1 rounded">
                  <span className="flex items-center space-x-1.5 text-blue-700 font-bold">
                    <LinkIcon className="h-3 w-3" />
                    <span>trip_id</span>
                  </span>
                  <span className="text-blue-700 text-[10px]">FK → trips.id [CASCADE]</span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-900 font-semibold">expense_type</span>
                  <span className="text-emerald-700 text-[10px]">Fuel, Tolls, Police/Bribes...</span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-900 font-semibold">amount</span>
                  <span className="text-emerald-700 text-[11px]">NUMERIC(10,2) CHECK &gt; 0</span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-700">description</span>
                  <span className="text-slate-400 text-[11px]">TEXT</span>
                </div>
                <div className="py-1.5 flex items-center justify-between text-slate-400 text-[11px]">
                  <span>timestamp / created_at</span>
                  <span>TIMESTAMPTZ</span>
                </div>
              </div>
            </div>

            {/* SPARE PARTS */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <TableIcon className="h-4 w-4 text-orange-400" />
                  <span className="font-mono font-bold text-sm">spare_parts</span>
                </div>
                <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">
                  1:N Child of trips
                </span>
              </div>
              <div className="p-3 text-xs divide-y divide-slate-100 font-mono">
                <div className="py-1.5 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5 text-amber-700 font-bold">
                    <Key className="h-3 w-3" />
                    <span>id</span>
                  </span>
                  <span className="text-slate-400 text-[11px]">UUID (PK)</span>
                </div>
                <div className="py-1.5 flex items-center justify-between bg-blue-50/50 px-1 rounded">
                  <span className="flex items-center space-x-1.5 text-blue-700 font-bold">
                    <LinkIcon className="h-3 w-3" />
                    <span>trip_id</span>
                  </span>
                  <span className="text-blue-700 text-[10px]">FK → trips.id [CASCADE]</span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-900 font-semibold">part_name</span>
                  <span className="text-slate-400 text-[11px]">VARCHAR(255)</span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-900 font-semibold">price</span>
                  <span className="text-emerald-700 text-[11px]">NUMERIC(10,2) CHECK &gt;= 0</span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-700">replaced_by</span>
                  <span className="text-slate-400 text-[11px]">VARCHAR(150)</span>
                </div>
                <div className="py-1.5 flex items-center justify-between text-slate-400 text-[11px]">
                  <span>timestamp / created_at</span>
                  <span>TIMESTAMPTZ</span>
                </div>
              </div>
            </div>

            {/* DYNAMIC TRIP DELAY LOGS */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <TableIcon className="h-4 w-4 text-purple-400" />
                  <span className="font-mono font-bold text-sm">trip_delay_logs</span>
                </div>
                <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">
                  Dynamic Logs Table
                </span>
              </div>
              <div className="p-3 text-xs divide-y divide-slate-100 font-mono">
                <div className="py-1.5 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5 text-amber-700 font-bold">
                    <Key className="h-3 w-3" />
                    <span>id</span>
                  </span>
                  <span className="text-slate-400 text-[11px]">UUID (PK)</span>
                </div>
                <div className="py-1.5 flex items-center justify-between bg-blue-50/50 px-1 rounded">
                  <span className="flex items-center space-x-1.5 text-blue-700 font-bold">
                    <LinkIcon className="h-3 w-3" />
                    <span>trip_id</span>
                  </span>
                  <span className="text-blue-700 text-[10px]">FK → trips.id [CASCADE]</span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-900 font-semibold">reason</span>
                  <span className="text-slate-400 text-[11px]">TEXT NOT NULL</span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-700">severity</span>
                  <span className="text-amber-700 text-[11px]">Low, Medium, High, Critical</span>
                </div>
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-slate-700">location / duration</span>
                  <span className="text-slate-400 text-[11px]">VARCHAR(255) / INT</span>
                </div>
                <div className="py-1.5 flex items-center justify-between text-slate-400 text-[11px]">
                  <span>timestamp</span>
                  <span>TIMESTAMPTZ NOT NULL</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INDEX OPTIMIZATION MATRIX */}
      {activeTab === 'indexes' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <span>Foreign Key &amp; Query Acceleration Indexes</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              In heavy haulage databases with high log volumes, unindexed foreign keys cause expensive sequential table scans (O(n)).
              These B-Tree indexes provide O(log n) lookups for trip aggregations, fleet status, and timeline filters.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                name: 'idx_trips_truck_id',
                table: 'trips',
                column: 'truck_id',
                type: 'B-Tree Index',
                purpose: 'Accelerates queries retrieving all trips or mileage for a specific truck. Prevents full-table scans during truck history reports.',
                cardinality: 'High',
              },
              {
                name: 'idx_trips_driver_id',
                table: 'trips',
                column: 'driver_id',
                type: 'B-Tree Index',
                purpose: 'Optimizes driver dispatch lookups, personnel trip logs, and prevents blocking locks when updating drivers.',
                cardinality: 'High',
              },
              {
                name: 'idx_trips_status',
                table: 'trips',
                column: 'status',
                type: 'B-Tree Index',
                purpose: 'Accelerates dashboard live monitoring queries filtering by status (Ongoing / Planned / Completed).',
                cardinality: 'Medium (3 states)',
              },
              {
                name: 'idx_expenses_trip_id',
                table: 'expenses',
                column: 'trip_id',
                type: 'B-Tree Index',
                purpose: 'Crucial for financial rollups. Speeds up SUM(amount) calculations and nested JOIN operations per trip.',
                cardinality: 'High',
              },
              {
                name: 'idx_expenses_type',
                table: 'expenses',
                column: 'expense_type',
                type: 'B-Tree Index',
                purpose: 'Speeds up categorical analysis (e.g. Fuel vs Tolls vs Police/Bribes expenditure breakdown).',
                cardinality: 'Medium (5 types)',
              },
              {
                name: 'idx_spare_parts_trip_id',
                table: 'spare_parts',
                column: 'trip_id',
                type: 'B-Tree Index',
                purpose: 'Accelerates emergency roadside maintenance aggregations by trip ID. Supports instantaneous total cost joins.',
                cardinality: 'High',
              },
              {
                name: 'idx_trip_delay_logs_trip_id',
                table: 'trip_delay_logs',
                column: 'trip_id',
                type: 'B-Tree Index',
                purpose: 'Provides instant timeline generation for trip delay reports and customs clearance logs.',
                cardinality: 'High',
              },
              {
                name: 'idx_trips_scheduled_start',
                table: 'trips',
                column: 'scheduled_start',
                type: 'B-Tree Index',
                purpose: 'Optimizes date-range filters for dispatch schedules and quarterly logistics financial reporting.',
                cardinality: 'High',
              },
            ].map((idx) => (
              <div key={idx.name} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {idx.name}
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold">{idx.type}</span>
                </div>
                <div className="text-xs text-slate-700">
                  Target: <strong>{idx.table}.{idx.column}</strong>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {idx.purpose}
                </p>
                <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100 flex justify-between">
                  <span>Index Strategy: Direct Foreign Identifier</span>
                  <span>Cardinality: {idx.cardinality}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: POSTGRESQL DDL SCRIPTS */}
      {activeTab === 'sql' && (
        <div className="bg-slate-950 text-slate-200 rounded-xl p-4 font-mono text-xs overflow-x-auto border border-slate-800 shadow-md">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <span className="text-slate-400 font-sans text-xs font-semibold">
              schema.sql (PostgreSQL 13+ DDL with Foreign Keys &amp; Indexes)
            </span>
            <button
              onClick={handleCopySql}
              className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              {copied ? 'Copied!' : 'Copy SQL'}
            </button>
          </div>
          <pre className="text-emerald-400 leading-relaxed">
            {RAW_SQL_SCHEMA}
          </pre>
        </div>
      )}

      {/* TAB 4: DRIZZLE ORM & TYPES */}
      {activeTab === 'orm' && (
        <div className="bg-slate-950 text-slate-200 rounded-xl p-4 font-mono text-xs overflow-x-auto border border-slate-800 shadow-md">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <span className="text-slate-400 font-sans text-xs font-semibold">
              src/db/schema.ts (Drizzle ORM TypeScript Definitions &amp; Relations)
            </span>
          </div>
          <pre className="text-blue-300 leading-relaxed">
            {DRIZZLE_ORM_CODE}
          </pre>
        </div>
      )}

      {/* TAB 5: LIVE SQL QUERY SANDBOX */}
      {activeTab === 'query' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Interactive Query Runner</h3>
                <p className="text-xs text-slate-500">
                  Execute relational queries against the active KAM Fleets database tables
                </p>
              </div>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                Live Data Connected
              </span>
            </div>

            {/* Quick Query Presets */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-semibold mr-1">Presets:</span>
              <button
                onClick={() => runQuery('SELECT * FROM trips JOIN trucks ON trips.truck_id = trucks.id JOIN drivers ON trips.driver_id = drivers.id;')}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition"
              >
                Trips with Truck &amp; Driver JOIN
              </button>
              <button
                onClick={() => runQuery('SELECT expense_type, COUNT(*) as count, SUM(amount) as total FROM expenses GROUP BY expense_type;')}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition"
              >
                Expense Category Breakdown
              </button>
              <button
                onClick={() => runQuery('SELECT * FROM trucks WHERE status = Available;')}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition"
              >
                All Available Trucks
              </button>
              <button
                onClick={() => runQuery('SELECT * FROM spare_parts;')}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition"
              >
                Roadside Maintenance Spare Parts
              </button>
              <button
                onClick={() => runQuery('SELECT * FROM trip_delay_logs;')}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition"
              >
                Dynamic Delay Incident Logs
              </button>
            </div>

            {/* Input & Run CTA */}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Enter SQL SELECT query..."
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                onClick={() => runQuery(queryInput)}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-xs"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Execute</span>
              </button>
            </div>
          </div>

          {/* Results Table */}
          {queryResult && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">
                  Returned <strong>{queryResult.rowCount} rows</strong>
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Query time: {queryResult.executionTimeMs}ms (Indexed Scan)
                </span>
              </div>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 text-[10px] uppercase font-bold">
                    <tr>
                      {queryResult.columns.map((col) => (
                        <th key={col} className="py-2.5 px-3">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {queryResult.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        {queryResult.columns.map((col) => (
                          <td key={col} className="py-2.5 px-3 text-slate-800">
                            {row[col] !== undefined ? String(row[col]) : '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const RAW_SQL_SCHEMA = `-- KAM Fleets: PostgreSQL DDL Script
-- Tables: trucks, drivers, trips, trip_delay_logs, expenses, spare_parts

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Domain Enums
CREATE TYPE truck_status_enum AS ENUM ('Available', 'On Trip', 'Maintenance');
CREATE TYPE driver_status_enum AS ENUM ('Available', 'On Trip', 'Off Duty');
CREATE TYPE trip_status_enum AS ENUM ('Planned', 'Ongoing', 'Completed');
CREATE TYPE expense_type_enum AS ENUM ('Fuel', 'Tolls', 'Police/Bribes', 'Food', 'Other');

-- 1. TRUCKS
CREATE TABLE trucks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_plate VARCHAR(32) NOT NULL UNIQUE,
    model VARCHAR(120) NOT NULL,
    status truck_status_enum NOT NULL DEFAULT 'Available',
    year INT CHECK (year >= 1990),
    capacity_tons NUMERIC(5, 2) CHECK (capacity_tons > 0),
    current_mileage INT DEFAULT 0 CHECK (current_mileage >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. DRIVERS
CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(150) NOT NULL,
    license_number VARCHAR(50) NOT NULL UNIQUE,
    phone VARCHAR(30) NOT NULL,
    status driver_status_enum NOT NULL DEFAULT 'Available',
    experience_years INT DEFAULT 1 CHECK (experience_years >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. TRIPS
CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID NOT NULL REFERENCES trucks(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    driver_id UUID NOT NULL REFERENCES drivers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    status trip_status_enum NOT NULL DEFAULT 'Planned',
    origin VARCHAR(255) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,
    budget_allocated NUMERIC(12, 2) NOT NULL CHECK (budget_allocated >= 0),
    driver_pay NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (driver_pay >= 0),
    cargo_type VARCHAR(150),
    notes TEXT,
    delay_reasons TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. DYNAMIC DELAY LOGS
CREATE TABLE trip_delay_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON UPDATE CASCADE ON DELETE CASCADE,
    reason TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'Medium' CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
    location VARCHAR(255),
    duration_minutes INT DEFAULT 0 CHECK (duration_minutes >= 0),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. EXPENSES
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON UPDATE CASCADE ON DELETE CASCADE,
    expense_type expense_type_enum NOT NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    description TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. SPARE PARTS
CREATE TABLE spare_parts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON UPDATE CASCADE ON DELETE CASCADE,
    part_name VARCHAR(255) NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    description TEXT,
    replaced_by VARCHAR(150),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Performance Foreign Key & Query Indexes
CREATE INDEX idx_trips_truck_id ON trips(truck_id);
CREATE INDEX idx_trips_driver_id ON trips(driver_id);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trips_scheduled_start ON trips(scheduled_start);
CREATE INDEX idx_expenses_trip_id ON expenses(trip_id);
CREATE INDEX idx_expenses_type ON expenses(expense_type);
CREATE INDEX idx_expenses_timestamp ON expenses(timestamp);
CREATE INDEX idx_spare_parts_trip_id ON spare_parts(trip_id);
CREATE INDEX idx_spare_parts_timestamp ON spare_parts(timestamp);
CREATE INDEX idx_trip_delay_logs_trip_id ON trip_delay_logs(trip_id);
`;

const DRIZZLE_ORM_CODE = `// src/db/schema.ts - Drizzle ORM Definition
import { relations } from 'drizzle-orm';
import {
  pgTable, uuid, varchar, integer, numeric, text, timestamp, pgEnum, jsonb, index
} from 'drizzle-orm/pg-core';

export const truckStatusEnum = pgEnum('truck_status', ['Available', 'On Trip', 'Maintenance']);
export const driverStatusEnum = pgEnum('driver_status', ['Available', 'On Trip', 'Off Duty']);
export const tripStatusEnum = pgEnum('trip_status', ['Planned', 'Ongoing', 'Completed']);
export const expenseTypeEnum = pgEnum('expense_type', ['Fuel', 'Tolls', 'Police/Bribes', 'Food', 'Other']);

export const trucks = pgTable('trucks', {
  id: uuid('id').defaultRandom().primaryKey(),
  licensePlate: varchar('license_plate', { length: 32 }).notNull().unique(),
  model: varchar('model', { length: 120 }).notNull(),
  status: truckStatusEnum('status').default('Available').notNull(),
  capacityTons: numeric('capacity_tons', { precision: 5, scale: 2 }),
  currentMileage: integer('current_mileage').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const drivers = pgTable('drivers', {
  id: uuid('id').defaultRandom().primaryKey(),
  fullName: varchar('full_name', { length: 150 }).notNull(),
  licenseNumber: varchar('license_number', { length: 50 }).notNull().unique(),
  phone: varchar('phone', { length: 30 }).notNull(),
  status: driverStatusEnum('status').default('Available').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const trips = pgTable('trips', {
  id: uuid('id').defaultRandom().primaryKey(),
  truckId: uuid('truck_id').notNull().references(() => trucks.id, { onDelete: 'restrict' }),
  driverId: uuid('driver_id').notNull().references(() => drivers.id, { onDelete: 'restrict' }),
  status: tripStatusEnum('status').default('Planned').notNull(),
  origin: varchar('origin', { length: 255 }).notNull(),
  destination: varchar('destination', { length: 255 }).notNull(),
  scheduledStart: timestamp('scheduled_start', { withTimezone: true }).notNull(),
  scheduledEnd: timestamp('scheduled_end', { withTimezone: true }).notNull(),
  budgetAllocated: numeric('budget_allocated', { precision: 12, scale: 2 }).notNull(),
  driverPay: numeric('driver_pay', { precision: 10, scale: 2 }).default('0.00').notNull(),
  delayReasons: jsonb('delay_reasons').$type<string[]>().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_trips_truck_id').on(table.truckId),
  index('idx_trips_driver_id').on(table.driverId),
  index('idx_trips_status').on(table.status),
]);

export const expenses = pgTable('expenses', {
  id: uuid('id').defaultRandom().primaryKey(),
  tripId: uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  expenseType: expenseTypeEnum('expense_type').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  description: text('description'),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_expenses_trip_id').on(table.tripId),
  index('idx_expenses_type').on(table.expenseType),
]);

export const spareParts = pgTable('spare_parts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tripId: uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  partName: varchar('part_name', { length: 255 }).notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  description: text('description'),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_spare_parts_trip_id').on(table.tripId),
]);
`;
