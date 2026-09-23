import React, { useState, useEffect } from 'react';
import {
  Users, Plus, Search, MapPin, Phone, Mail, Calendar,
  CheckCircle2, Clock, AlertCircle, ChevronRight, X,
  Shield, Edit, PlusCircle, Repeat, User, HardHat
} from 'lucide-react';
import {
  getCustomers, getCustomerById, createCustomer, updateCustomer,
  addCustomerLocation, createRecurringService, getTreatments, getStaff
} from '../api';
import EditCustomerModal from '../components/EditCustomerModal';

export default function CustomersView({
  selectedCustomerId,
  onSelectJob,
  onOpenAddCustomer,
  currentRole,
  currentTechnicianId,
  isMobileView
}) {
  const isTechnician = currentRole === 'TECHNICIAN' || (Boolean(currentTechnicianId) && currentRole !== 'ADMIN' && currentRole !== 'MANAGER');
  const lockedTechId = currentTechnicianId ? String(currentTechnicianId) : (isTechnician ? (typeof window !== 'undefined' ? localStorage.getItem('tech_preferred_id') || '' : '') : '');

  // In mobile view or technician mode, default to showing ONLY customers where jobs are done
  const [jobDoneOnly, setJobDoneOnly] = useState(() => isTechnician || Boolean(isMobileView));

  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Active Customer Detail Drawer
  const [activeCustomer, setActiveCustomer] = useState(null);
  const [activeCustomerDetails, setActiveCustomerDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Edit Customer Modal
  const [editingCustomer, setEditingCustomer] = useState(null);

  // Modals
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [showAddRecurringModal, setShowAddRecurringModal] = useState(false);

  // Metadata
  const [treatments, setTreatments] = useState([]);
  const [staff, setStaff] = useState([]);

  // Form states
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '', contact_person: '', phone: '', email: '',
    address: '', location: '', latitude: '', longitude: '',
    special_instructions: '', primary_location_name: ''
  });

  const [newLocationForm, setNewLocationForm] = useState({
    location_name: '', address: '', latitude: '', longitude: '', contact_person: '', phone: ''
  });

  const [newRecurringForm, setNewRecurringForm] = useState({
    location_id: '', treatment_id: '', frequency: 'MONTHLY',
    preferred_day: 'MON', preferred_time: '09:00', duration_minutes: 60,
    technician_id: '', salesman_id: '', start_date: new Date().toISOString().substring(0, 10),
    notes: '', generate_immediate_job: true
  });

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const params = { search, page, limit: 30 };
      if (jobDoneOnly || isTechnician) {
        params.job_done_only = 'true';
        if (lockedTechId) {
          params.technician_id = lockedTechId;
        }
      }
      const res = await getCustomers(params);
      setCustomers(res.customers || []);
      setTotal(res.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerDetails = async (id) => {
    setLoadingDetails(true);
    try {
      const params = {};
      if (jobDoneOnly || isTechnician) {
        params.job_done_only = 'true';
        if (lockedTechId) {
          params.technician_id = lockedTechId;
        }
      }
      const res = await getCustomerById(id, params);
      setActiveCustomer(res.customer);
      setActiveCustomerDetails(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [search, page, jobDoneOnly, lockedTechId, isTechnician]);

  useEffect(() => {
    if (selectedCustomerId) {
      loadCustomerDetails(selectedCustomerId);
    }
  }, [selectedCustomerId]);

  useEffect(() => {
    getTreatments().then(r => setTreatments(r.treatments || []));
    getStaff().then(r => setStaff(r.staff || []));
  }, []);

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      const res = await createCustomer(newCustomerForm);
      alert('Customer created successfully!');
      setShowAddCustomerModal(false);
      setNewCustomerForm({
        name: '', contact_person: '', phone: '', email: '',
        address: '', location: '', latitude: '', longitude: '',
        special_instructions: '', primary_location_name: ''
      });
      loadCustomers();
      loadCustomerDetails(res.customer.id);
    } catch (err) {
      alert(`Error creating customer: ${err.message}`);
    }
  };

  const handleAddLocation = async (e) => {
    e.preventDefault();
    try {
      await addCustomerLocation(activeCustomer.id, newLocationForm);
      alert('Location added successfully!');
      setShowAddLocationModal(false);
      setNewLocationForm({ location_name: '', address: '', latitude: '', longitude: '', contact_person: '', phone: '' });
      loadCustomerDetails(activeCustomer.id);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleCreateRecurring = async (e) => {
    e.preventDefault();
    try {
      await createRecurringService({
        ...newRecurringForm,
        customer_id: activeCustomer.id
      });
      alert('Recurring service created and initial job generated!');
      setShowAddRecurringModal(false);
      loadCustomerDetails(activeCustomer.id);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 pb-12">

      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
            <span>{isTechnician || jobDoneOnly ? 'Job Done Customers' : 'Customer Management & Service Timelines'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {isTechnician || jobDoneOnly
              ? 'Showing only client accounts where service jobs have been completed.'
              : 'Manage customers, multi-location sites, recurring contracts, and complete historical service timelines.'}
          </p>
        </div>

        {!isTechnician && (
          <button
            onClick={() => setShowAddCustomerModal(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Customer</span>
          </button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={isTechnician ? "Search your completed job customers..." : "Search by customer name, code, contact person, phone, or location..."}
            className="w-full bg-slate-50 text-xs sm:text-sm pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 justify-between sm:justify-end">
          {/* Toggle pill for Admin/Manager, locked badge for Technician */}
          {isTechnician ? (
            <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Job Done Customers Only</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setJobDoneOnly(!jobDoneOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                jobDoneOnly
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{jobDoneOnly ? 'Job Done Only' : 'All Customers'}</span>
            </button>
          )}

          <div className="text-xs font-semibold text-slate-500 whitespace-nowrap">
            Showing <span className="text-slate-900 font-bold">{customers.length}</span> of {total}
          </div>
        </div>
      </div>

      {/* Customer Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {customers.map(c => (
          <div
            key={c.id}
            onClick={() => loadCustomerDetails(c.id)}
            className={`bg-white p-4 sm:p-5 rounded-2xl border transition cursor-pointer hover:shadow-md flex flex-col justify-between ${
              activeCustomer?.id === c.id ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200 shadow-2xs'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                    {c.customer_code}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    c.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {c.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {!isTechnician && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingCustomer(c);
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 font-bold text-[11px] rounded-lg border border-slate-200 hover:border-blue-300 flex items-center gap-1 transition shadow-2xs"
                    title="Edit Customer Details"
                  >
                    <Edit className="w-3 h-3 text-blue-600" />
                    <span>Edit</span>
                  </button>
                )}
              </div>

              <h3 className="font-bold text-slate-900 text-base mt-2 line-clamp-1">{c.name}</h3>

              <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                {c.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="line-clamp-1">{c.location}</span>
                  </div>
                )}
                {c.contact_person && (
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{c.contact_person}</span>
                  </div>
                )}
                {c.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{c.phone}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-3">
                <span><strong className="text-slate-800">{c.total_locations || 1}</strong> loc(s)</span>
                <span><strong className="text-slate-800">{c.active_services || 0}</strong> recurring</span>
                <span><strong className="text-emerald-700">{c.completed_jobs_count || 0}</strong> done</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        ))}
      </div>

      {/* Customer Detail Drawer / Modal */}
      {activeCustomer && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex justify-end">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl overflow-y-auto flex flex-col animate-in slide-in-from-right duration-200">

            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                    {activeCustomer.customer_code}
                  </span>
                  <h2 className="font-extrabold text-lg text-slate-900">{activeCustomer.name}</h2>
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                  <span>{activeCustomer.contact_person || 'No contact'}</span>
                  <span>&bull;</span>
                  <span>{activeCustomer.phone || 'No phone'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isTechnician && activeCustomer.phone && (
                  <a
                    href={`tel:${activeCustomer.phone}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call Client</span>
                  </a>
                )}

                {!isTechnician && (
                  <button
                    type="button"
                    onClick={() => setEditingCustomer(activeCustomer)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 transition shadow-2xs"
                    title="Edit Customer Profile"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit Profile</span>
                  </button>
                )}
                <button
                  onClick={() => setActiveCustomer(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div className="p-4 sm:p-6 space-y-6 flex-1 pb-28">

              {/* Action Bar for Locations & Services (Admins / Managers only) */}
              {!isTechnician && (
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingCustomer(activeCustomer)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit Customer Details
                  </button>
                  <button
                    onClick={() => setShowAddLocationModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-500" /> Add Location
                  </button>
                  <button
                    onClick={() => setShowAddRecurringModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-xl border border-emerald-200 transition"
                  >
                    <Repeat className="w-3.5 h-3.5 text-emerald-600" /> Add Recurring Contract
                  </button>
                </div>
              )}

              {/* Service Locations List */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Service Locations ({activeCustomerDetails?.locations?.length || 0})</h3>
                <div className="space-y-2">
                  {activeCustomerDetails?.locations?.map(loc => (
                    <div key={loc.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{loc.location_name}</span>
                          {loc.is_primary ? <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold">Primary</span> : null}
                        </div>
                        <div className="text-slate-500 mt-0.5">{loc.address}</div>
                      </div>
                      {loc.phone && <span className="font-mono text-slate-600">{loc.phone}</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Recurring Services (Admins & Managers Only) */}
              {!isTechnician && (
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Active Recurring Services ({activeCustomerDetails?.recurring_services?.length || 0})</h3>
                  {activeCustomerDetails?.recurring_services?.length === 0 ? (
                    <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400">No recurring services configured yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {activeCustomerDetails?.recurring_services?.map(r => (
                        <div key={r.id} className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span
                              style={{ backgroundColor: `${r.treatment_color || '#10B981'}20`, color: r.treatment_color || '#10B981' }}
                              className="px-2 py-0.5 rounded font-bold"
                            >
                              {r.treatment_code}
                            </span>
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                              {r.frequency}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-slate-600 text-[11px] pt-1">
                            <span>Next Service: <strong className="text-slate-900">{r.next_service_date}</strong></span>
                            <span>Pref: {r.preferred_day || 'Any'} at {r.preferred_time || '09:00'}</span>
                          </div>
                          {r.technician_name && (
                            <div className="text-[11px] text-slate-500">Tech: {r.technician_name}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* CUSTOMER SERVICE HISTORY TIMELINE */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  {isTechnician ? 'Completed Job History' : 'Service History Timeline'}
                </h3>
                {activeCustomerDetails?.timeline?.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400">No services logged yet.</div>
                ) : (
                  <div className="relative border-l-2 border-slate-200 ml-3 space-y-4 py-2">
                    {activeCustomerDetails?.timeline?.map((item, idx) => {
                      const isCompleted = item.status === 'COMPLETED';
                      const isScheduled = item.status === 'TO_BE_DONE' || item.status === 'ASSIGNED' || item.status === 'CONFIRMED';
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (onSelectJob) onSelectJob(item.id);
                          }}
                          className="relative pl-6 cursor-pointer group"
                        >
                          {/* Timeline dot */}
                          <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center ${
                            isCompleted ? 'border-emerald-500' : isScheduled ? 'border-blue-500' : 'border-slate-300'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              isCompleted ? 'bg-emerald-500' : isScheduled ? 'bg-blue-500' : 'bg-slate-400'
                            }`} />
                          </div>

                          <div className="p-3 bg-slate-50 hover:bg-emerald-50/50 rounded-xl border border-slate-200 group-hover:border-emerald-300 transition text-xs">
                            <div className="flex items-center justify-between font-bold">
                              <span className="text-slate-900">{item.scheduled_date}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-extrabold ${
                                isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                              }`}>
                                {item.status}
                              </span>
                            </div>

                            <div className="mt-1 flex items-center gap-2 font-semibold text-slate-800">
                              <span>{item.treatment_code}</span>
                              {item.location_name && <span className="text-slate-400 font-normal">at {item.location_name}</span>}
                            </div>

                            {item.technician_name && (
                              <div className="flex flex-wrap items-center gap-2 text-[11px] mt-1.5">
                                <span className="flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md font-bold">
                                  <User className="w-3 h-3 text-emerald-600" />
                                  Tech: {item.technician_name}
                                </span>
                                <span className="flex items-center gap-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md font-bold">
                                  <HardHat className="w-3 h-3 text-amber-600" />
                                  Crew: {item.crew_count > 1 ? `${item.crew_count} people` : '1 worker (Solo)'}
                                </span>
                              </div>
                            )}

                            {/* Accompanying Workers / Labourers with Name & Phone */}
                            {(() => {
                              let workers = [];
                              try {
                                if (item.workers_info) {
                                  workers = typeof item.workers_info === 'string' ? JSON.parse(item.workers_info) : item.workers_info;
                                }
                              } catch (e) {}

                              if (Array.isArray(workers) && workers.length > 0) {
                                return (
                                  <div className="mt-2 p-2.5 bg-amber-50/50 rounded-xl border border-amber-200/70 text-[11px] space-y-1">
                                    <div className="font-bold text-amber-900 flex items-center gap-1 text-[10px] uppercase tracking-wider">
                                      <Users className="w-3 h-3 text-amber-600" />
                                      <span>Accompanying Workers ({workers.length}):</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                                      {workers.map((w, wi) => (
                                        <span key={wi} className="inline-flex items-center gap-1 bg-white text-slate-800 px-2 py-1 rounded-lg text-[10px] font-semibold border border-amber-200 shadow-2xs">
                                          <span className="font-bold text-slate-900">{w.name}</span>
                                          {w.phone && (
                                            <span className="text-emerald-700 font-mono flex items-center gap-0.5">
                                              <Phone className="w-2.5 h-2.5 text-emerald-600" />
                                              {w.phone}
                                            </span>
                                          )}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}

                            {item.technician_notes && (
                              <div className="text-[11px] text-slate-600 mt-1 italic bg-white p-2 rounded border border-slate-100">
                                "{item.technician_notes}"
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Add New Customer</h2>
              <button onClick={() => setShowAddCustomerModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                  placeholder="e.g. CEWAS (TANDEM SPEED)"
                  className="w-full mt-1 p-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Contact Person</label>
                  <input
                    type="text"
                    value={newCustomerForm.contact_person}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, contact_person: e.target.value })}
                    placeholder="e.g. Mr. Rashika"
                    className="w-full mt-1 p-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Phone</label>
                  <input
                    type="text"
                    value={newCustomerForm.phone}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                    placeholder="e.g. 0771234567"
                    className="w-full mt-1 p-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Email</label>
                  <input
                    type="email"
                    value={newCustomerForm.email}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                    placeholder="customer@email.com"
                    className="w-full mt-1 p-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">Primary Location Name</label>
                  <input
                    type="text"
                    value={newCustomerForm.location}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, location: e.target.value, primary_location_name: e.target.value })}
                    placeholder="e.g. Rathmalana Factory"
                    className="w-full mt-1 p-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">GPS Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={newCustomerForm.latitude}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, latitude: e.target.value })}
                    placeholder="e.g. 6.9271"
                    className="w-full mt-1 p-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700">GPS Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={newCustomerForm.longitude}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, longitude: e.target.value })}
                    placeholder="e.g. 79.8612"
                    className="w-full mt-1 p-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">Special Instructions / Duration</label>
                <textarea
                  rows={2}
                  value={newCustomerForm.special_instructions}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, special_instructions: e.target.value })}
                  placeholder="e.g. Weekdays after 2pm, 2 PCT required"
                  className="w-full mt-1 p-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-xs"
                >
                  Create Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Location Modal */}
      {showAddLocationModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Add Service Location</h2>
              <button onClick={() => setShowAddLocationModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddLocation} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700">Location Name *</label>
                <input
                  type="text"
                  required
                  value={newLocationForm.location_name}
                  onChange={(e) => setNewLocationForm({ ...newLocationForm, location_name: e.target.value })}
                  placeholder="e.g. Depot Warehouse, Wattala Plant"
                  className="w-full mt-1 p-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700">Address</label>
                <input
                  type="text"
                  value={newLocationForm.address}
                  onChange={(e) => setNewLocationForm({ ...newLocationForm, address: e.target.value })}
                  placeholder="Full physical address"
                  className="w-full mt-1 p-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowAddLocationModal(false)} className="px-4 py-2 text-slate-600 font-semibold">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-xl">Save Location</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Recurring Service Modal */}
      {showAddRecurringModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Add Recurring Contract</h2>
              <button onClick={() => setShowAddRecurringModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRecurring} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Location</label>
                  <select
                    value={newRecurringForm.location_id}
                    onChange={(e) => setNewRecurringForm({ ...newRecurringForm, location_id: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden"
                  >
                    <option value="">All / Primary Location</option>
                    {activeCustomerDetails?.locations?.map(l => (
                      <option key={l.id} value={l.id}>{l.location_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Treatment *</label>
                  <select
                    required
                    value={newRecurringForm.treatment_id}
                    onChange={(e) => setNewRecurringForm({ ...newRecurringForm, treatment_id: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden"
                  >
                    <option value="">Select Treatment</option>
                    {treatments.map(t => (
                      <option key={t.id} value={t.id}>{t.code} - {t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Frequency *</label>
                  <select
                    value={newRecurringForm.frequency}
                    onChange={(e) => setNewRecurringForm({ ...newRecurringForm, frequency: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden font-semibold"
                  >
                    <option value="DAILY">DAILY</option>
                    <option value="WEEKLY">WEEKLY</option>
                    <option value="FORTNIGHTLY">FORTNIGHTLY</option>
                    <option value="MONTHLY">MONTHLY</option>
                    <option value="3 MONTHLY">3 MONTHLY</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Preferred Day</label>
                  <select
                    value={newRecurringForm.preferred_day}
                    onChange={(e) => setNewRecurringForm({ ...newRecurringForm, preferred_day: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden"
                  >
                    <option value="MON">Monday</option>
                    <option value="TUE">Tuesday</option>
                    <option value="WED">Wednesday</option>
                    <option value="THU">Thursday</option>
                    <option value="FRI">Friday</option>
                    <option value="SAT">Saturday</option>
                    <option value="SUN">Sunday</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Preferred Time</label>
                  <input
                    type="time"
                    value={newRecurringForm.preferred_time}
                    onChange={(e) => setNewRecurringForm({ ...newRecurringForm, preferred_time: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700">Assign Technician</label>
                  <select
                    value={newRecurringForm.technician_id}
                    onChange={(e) => setNewRecurringForm({ ...newRecurringForm, technician_id: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden"
                  >
                    <option value="">Unassigned</option>
                    {staff.filter(s => s.role === 'TECHNICIAN').map(s => (
                      <option key={s.id} value={s.id}>{s.full_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700">Assign Salesman</label>
                  <select
                    value={newRecurringForm.salesman_id}
                    onChange={(e) => setNewRecurringForm({ ...newRecurringForm, salesman_id: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden"
                  >
                    <option value="">Unassigned</option>
                    {staff.filter(s => s.role === 'SALESMAN').map(s => (
                      <option key={s.id} value={s.id}>{s.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={newRecurringForm.generate_immediate_job}
                    onChange={(e) => setNewRecurringForm({ ...newRecurringForm, generate_immediate_job: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Automatically generate first job on scheduled date</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowAddRecurringModal(false)} className="px-4 py-2 font-semibold text-slate-600">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-xl">Save & Generate</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Details Panel / Modal */}
      <EditCustomerModal
        isOpen={!!editingCustomer}
        customer={editingCustomer}
        onClose={() => setEditingCustomer(null)}
        onCustomerUpdated={(updated) => {
          loadCustomers();
          if (activeCustomer?.id === updated.id) {
            loadCustomerDetails(updated.id);
          }
        }}
      />

    </div>
  );
}
