import React, { useState } from 'react';
import { Users, MapPin, Phone, Mail, Building, Plus, X, Check, FileText, Compass, AlertCircle } from 'lucide-react';
import { createCustomer } from '../api';

export default function CreateCustomerModal({ isOpen, onClose, onCustomerCreated }) {
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    location: '',
    primary_location_name: '',
    address: '',
    latitude: '',
    longitude: '',
    special_instructions: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Customer name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await createCustomer(formData);
      if (res.success && res.customer) {
        if (onCustomerCreated) onCustomerCreated(res.customer);
        onClose();
        // Reset form
        setFormData({
          name: '',
          contact_person: '',
          phone: '',
          email: '',
          location: '',
          primary_location_name: '',
          address: '',
          latitude: '',
          longitude: '',
          special_instructions: ''
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to create customer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                Add New Customer
                <span className="text-[10px] bg-emerald-500/40 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Global Quick Add
                </span>
              </h2>
              <p className="text-xs text-emerald-100 mt-0.5">
                Register a new commercial or residential customer profile with service location.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form id="create-customer-form" onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          
          {/* Section 1: Customer Info */}
          <div>
            <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-wider text-[11px] mb-3 pb-1 border-b border-slate-100">
              <Building className="w-3.5 h-3.5 text-emerald-600" />
              <span>Customer Identification</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1">
                <label className="font-bold text-slate-800">
                  Customer / Business Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Shangri-La Hotel Colombo / Amagi Foods"
                  required
                  className="w-full bg-slate-50 text-sm font-semibold px-3.5 py-2.5 rounded-xl border border-slate-200 focus:bg-white focus:border-emerald-500 focus:outline-hidden transition"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" /> Contact Person Name
                </label>
                <input
                  type="text"
                  name="contact_person"
                  value={formData.contact_person}
                  onChange={handleChange}
                  placeholder="e.g. Mr. Sunil Perera (Manager)"
                  className="w-full bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 focus:bg-white focus:border-emerald-500 focus:outline-hidden transition"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" /> Contact Phone / Mobile
                </label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="e.g. 0771234567 / 0112345678"
                  className="w-full bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 focus:bg-white focus:border-emerald-500 focus:outline-hidden transition"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="e.g. operations@clientdomain.lk"
                  className="w-full bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 focus:bg-white focus:border-emerald-500 focus:outline-hidden transition"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Location & Address */}
          <div>
            <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-wider text-[11px] mb-3 pb-1 border-b border-slate-100">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>Service Location & Site Address</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-bold text-slate-800">
                  Region / City / Area
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="e.g. Colombo 03, Katunayake, Kandy"
                  className="w-full bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 focus:bg-white focus:border-emerald-500 focus:outline-hidden transition"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800">
                  Primary Location Name
                </label>
                <input
                  type="text"
                  name="primary_location_name"
                  value={formData.primary_location_name}
                  onChange={handleChange}
                  placeholder="e.g. Main Kitchen / Factory Branch"
                  className="w-full bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 focus:bg-white focus:border-emerald-500 focus:outline-hidden transition"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="font-bold text-slate-800">
                  Full Street Address
                </label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows={2}
                  placeholder="e.g. No. 45/A, Galle Road, Colombo 03"
                  className="w-full bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 focus:bg-white focus:border-emerald-500 focus:outline-hidden transition resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-slate-400" /> Latitude (GPS)
                </label>
                <input
                  type="text"
                  name="latitude"
                  value={formData.latitude}
                  onChange={handleChange}
                  placeholder="e.g. 6.9271"
                  className="w-full bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 focus:bg-white focus:border-emerald-500 focus:outline-hidden transition font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-slate-400" /> Longitude (GPS)
                </label>
                <input
                  type="text"
                  name="longitude"
                  value={formData.longitude}
                  onChange={handleChange}
                  placeholder="e.g. 79.8612"
                  className="w-full bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 focus:bg-white focus:border-emerald-500 focus:outline-hidden transition font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Site Instructions */}
          <div>
            <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-wider text-[11px] mb-3 pb-1 border-b border-slate-100">
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              <span>Special Site & Operational Instructions</span>
            </div>

            <div className="space-y-1">
              <textarea
                name="special_instructions"
                value={formData.special_instructions}
                onChange={handleChange}
                rows={2}
                placeholder="e.g. Security check required at gate. Service after 6:00 PM only. Pet dogs in back garden."
                className="w-full bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 focus:bg-white focus:border-emerald-500 focus:outline-hidden transition resize-none"
              />
            </div>
          </div>

        </form>

        {/* Modal Footer */}
        <div className="p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold text-xs rounded-xl hover:bg-slate-200 transition"
          >
            Cancel
          </button>

          <button
            type="submit"
            form="create-customer-form"
            disabled={loading}
            className="flex items-center gap-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-200 disabled:opacity-50 transition"
          >
            <Check className="w-4 h-4" />
            <span>{loading ? 'Creating Customer...' : 'Create Customer'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
