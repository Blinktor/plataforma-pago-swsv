import React, { useState, useEffect } from 'react';
import { 
  Bed, 
  Users, 
  Calendar, 
  MapPin, 
  ShieldCheck, 
  QrCode, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Send, 
  Lock, 
  Unlock, 
  Search,
  Check,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Filter,
  DollarSign,
  Database
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './supabaseClient';

// Sample Villa & Event Data
const INITIAL_EVENT = {
  id: 'ev-01',
  title: 'Sunset Beach & Airbnb Villa Night 🌴',
  subtitle: 'Evento Exclusivo para Parejas | Capacidad Limitada por Camas',
  location: 'Villa Sol & Mar, Tulum / Playa del Carmen',
  date: 'Sábado, 15 de Agosto 2026 - 7:00 PM',
  noBedCapacityMax: 15,
  noBedPrice: 80, // USD
};

const INITIAL_ROOMS = [
  {
    id: 'room-1',
    name: 'Suite Presidencial frente al Mar',
    description: 'Habitación luxury con vista directa al mar, jacuzzi y balcón privado.',
    beds: [
      { id: 'bed-101', number: 1, type: 'King Size VIP', capacity: '1 Pareja (2 pers)', price: 250, status: 'available', reservedBy: null, paymentStatus: null },
      { id: 'bed-102', number: 2, type: 'King Size VIP', capacity: '1 Pareja (2 pers)', price: 250, status: 'available', reservedBy: null, paymentStatus: null },
    ]
  },
  {
    id: 'room-2',
    name: 'Habitación Master Balcón',
    description: 'Vista a la piscina principal y aire acondicionado independiente.',
    beds: [
      { id: 'bed-201', number: 3, type: 'Queen Size Premium', capacity: '1 Pareja (2 pers)', price: 200, status: 'available', reservedBy: null, paymentStatus: null },
      { id: 'bed-202', number: 4, type: 'Queen Size Premium', capacity: '1 Pareja (2 pers)', price: 200, status: 'available', reservedBy: null, paymentStatus: null },
    ]
  },
  {
    id: 'room-3',
    name: 'Bungalow Tropical Jardín',
    description: 'Rodeado de naturaleza, ambiente relajado y baño completo.',
    beds: [
      { id: 'bed-301', number: 5, type: 'Matrimonial Gold', capacity: '1 Pareja (2 pers)', price: 170, status: 'available', reservedBy: null, paymentStatus: null },
      { id: 'bed-302', number: 6, type: 'Matrimonial Gold', capacity: '1 Pareja (2 pers)', price: 170, status: 'available', reservedBy: null, paymentStatus: null },
      { id: 'bed-303', number: 7, type: 'Matrimonial Gold', capacity: '1 Pareja (2 pers)', price: 170, status: 'available', reservedBy: null, paymentStatus: null },
    ]
  }
];

const INITIAL_NO_BED_BOOKINGS = [];

export default function App() {
  const [isAdmin, setIsAdmin] = useState(() => {
    return sessionStorage.getItem('swsv_admin') === 'true';
  });
  const [eventData, setEventData] = useState(INITIAL_EVENT);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [isEditEventModalOpen, setIsEditEventModalOpen] = useState(false);

  // Edit Event Form State
  const [editTitle, setEditTitle] = useState(eventData.title);
  const [editSubtitle, setEditSubtitle] = useState(eventData.subtitle);
  const [editLocation, setEditLocation] = useState(eventData.location);
  const [editDate, setEditDate] = useState(eventData.date);
  const [editNoBedPrice, setEditNoBedPrice] = useState(eventData.noBedPrice);
  const [editNoBedMax, setEditNoBedMax] = useState(eventData.noBedCapacityMax);

  const [rooms, setRooms] = useState(INITIAL_ROOMS);
  const [noBedBookings, setNoBedBookings] = useState(INITIAL_NO_BED_BOOKINGS);
  const [selectedBed, setSelectedBed] = useState(null);
  const [bookingMode, setBookingMode] = useState(null); // 'with_bed' or 'no_bed'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generatedTicket, setGeneratedTicket] = useState(null);

  // Form State
  const [formPartner1, setFormPartner1] = useState('');
  const [formPartner2, setFormPartner2] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPaymentMethod, setFormPaymentMethod] = useState('pay_on_site');

  // Handle Admin Toggle
  const handleToggleAdminClick = () => {
    if (isAdmin) {
      setIsAdmin(false);
      sessionStorage.removeItem('swsv_admin');
    } else {
      setIsPinModalOpen(true);
    }
  };

  const handleVerifyPin = (e) => {
    e.preventDefault();
    const correctPin = import.meta.env.VITE_ADMIN_PIN || '2026';
    if (pinInput === correctPin) {
      setIsAdmin(true);
      sessionStorage.setItem('swsv_admin', 'true');
      setIsPinModalOpen(false);
      setPinInput('');
    } else {
      alert('🔒 PIN Incorrecto. Acceso Denegado.');
      setPinInput('');
    }
  };

  // Past Event History State (preserves historical record when starting a new event)
  const [pastEvents, setPastEvents] = useState(() => {
    const saved = localStorage.getItem('swsv_event_history');
    return saved ? JSON.parse(saved) : [];
  });

  const handleResetAllBookings = () => {
    // 1. ARCHIVE HISTORICAL SNAPSHOT
    const activeOccupiedBeds = rooms.flatMap(r => r.beds).filter(b => b.status !== 'available');
    if (activeOccupiedBeds.length > 0 || noBedBookings.length > 0) {
      const archiveRecord = {
        id: 'hist-' + Date.now(),
        eventTitle: eventData.title,
        date: eventData.date,
        archivedAt: new Date().toLocaleDateString('es-ES'),
        totalRevenue: (occupiedBedsCount * 200) + (noBedBookings.length * 80),
        occupiedBedsCount: activeOccupiedBeds.length,
        noBedCouplesCount: noBedBookings.length,
        couplesList: [
          ...activeOccupiedBeds.map(b => ({ partner: b.reservedBy || 'Pareja Registrada', type: `Cama #${b.number} (${b.type})`, status: b.paymentStatus === 'paid' ? 'Pagado' : 'Pendiente' })),
          ...noBedBookings.map(b => ({ partner: `${b.partner1} & ${b.partner2}`, type: 'Pase Sin Cama', status: b.paymentStatus === 'paid' ? 'Pagado' : 'Pendiente' }))
        ]
      };

      setPastEvents(prev => {
        const updated = [archiveRecord, ...prev];
        localStorage.setItem('swsv_event_history', JSON.stringify(updated));
        return updated;
      });
    }

    // 2. RESET ACTIVE BEDS AND NO-BED STATE
    setRooms(prev => prev.map(room => ({
      ...room,
      beds: room.beds.map(bed => ({
        ...bed,
        status: 'available',
        reservedBy: null,
        paymentStatus: null,
        phone: null
      }))
    })));

    setNoBedBookings([]);

    // 3. UPDATE SUPABASE BEDS TO AVAILABLE (BOOKING HISTORICAL RECORDS REMAIN IN SUPABASE DB)
    if (isSupabaseConfigured && supabase) {
      supabase.from('beds').update({ status: 'available' }).neq('id', '00000000-0000-0000-0000-000000000000');
    }
  };

  const handleSaveEventData = (e) => {
    e.preventDefault();
    const updated = {
      ...eventData,
      title: editTitle,
      subtitle: editSubtitle,
      location: editLocation,
      date: editDate,
      noBedPrice: Number(editNoBedPrice),
      noBedCapacityMax: Number(editNoBedMax)
    };
    setEventData(updated);
    setIsEditEventModalOpen(false);

    // Ask organizer if they want to reset all bookings to 0 for this new party
    if (window.confirm('🎉 Evento actualizado. ¿Deseas vaciar todas las reservas anteriores para iniciar este evento desde 0 (todas las camas libres)?')) {
      handleResetAllBookings();
    }

    // Save to Supabase if configured
    if (isSupabaseConfigured && supabase) {
      supabase.from('events').upsert([{
        id: updated.id,
        title: updated.title,
        subtitle: updated.subtitle,
        location: updated.location,
        event_date: new Date().toISOString(),
        no_bed_max_capacity: updated.noBedCapacityMax,
        no_bed_price: updated.noBedPrice
      }]).then(({ error }) => {
        if (error) console.error('Error saving event to Supabase:', error);
      });
    }
  };

  // Supabase Realtime Listener (if configured)
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    // Fetch initial beds & setup realtime channel
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'beds' },
        (payload) => {
          console.log('Realtime change received for beds:', payload);
          // Refetch beds or update state dynamically
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Stats calculation
  const totalBeds = rooms.reduce((acc, r) => acc + r.beds.length, 0);
  const availableBedsCount = rooms.reduce((acc, r) => acc + r.beds.filter(b => b.status === 'available').length, 0);
  const pendingBedsCount = rooms.reduce((acc, r) => acc + r.beds.filter(b => b.status === 'reserved').length, 0);
  const occupiedBedsCount = rooms.reduce((acc, r) => acc + r.beds.filter(b => b.status === 'occupied').length, 0);
  const noBedCount = noBedBookings.length;
  const noBedAvailable = INITIAL_EVENT.noBedCapacityMax - noBedCount;

  // Open modal for bed reservation
  const handleSelectBed = (bed, room) => {
    if (bed.status !== 'available' && !isAdmin) return;
    setSelectedBed({ ...bed, roomName: room.name });
    setBookingMode('with_bed');
    setIsModalOpen(true);
  };

  // Open modal for no bed reservation
  const handleSelectNoBed = () => {
    if (noBedAvailable <= 0 && !isAdmin) return;
    setSelectedBed(null);
    setBookingMode('no_bed');
    setIsModalOpen(true);
  };

  // Handle Form Submission
  const handleSubmitBooking = async (e) => {
    e.preventDefault();
    if (!formPartner1 || !formPartner2 || !formPhone) {
      alert('Por favor completa los nombres de ambos integrantes de la pareja y el WhatsApp.');
      return;
    }

    const ticketId = 'SWSV-' + Math.floor(1000 + Math.random() * 9000);
    const price = bookingMode === 'with_bed' ? selectedBed.price : INITIAL_EVENT.noBedPrice;

    const newTicketData = {
      id: ticketId,
      partner1: formPartner1,
      partner2: formPartner2,
      phone: formPhone,
      mode: bookingMode,
      bedInfo: selectedBed,
      price: price,
      paymentMethod: formPaymentMethod,
      paymentStatus: 'pending_postpay',
      createdAt: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    };

    // If Supabase is connected, call stored function or insert
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.rpc('book_bed_atomic', {
          p_event_id: 'ev-01',
          p_bed_id: selectedBed ? selectedBed.id : null,
          p_booking_type: bookingMode,
          p_partner1: formPartner1,
          p_partner2: formPartner2,
          p_phone: formPhone,
          p_payment_method: formPaymentMethod,
          p_price: price,
          p_ticket_code: ticketId
        });
        if (error) console.error('Supabase booking error:', error);
      } catch (err) {
        console.error('Database transaction error:', err);
      }
    }

    // Local UI State Update
    if (bookingMode === 'with_bed' && selectedBed) {
      setRooms(prevRooms => prevRooms.map(room => ({
        ...room,
        beds: room.beds.map(bed => {
          if (bed.id === selectedBed.id) {
            return {
              ...bed,
              status: 'reserved',
              reservedBy: `${formPartner1} & ${formPartner2}`,
              paymentStatus: 'pending_postpay',
              phone: formPhone
            };
          }
          return bed;
        })
      })));
    } else {
      setNoBedBookings(prev => [
        ...prev,
        {
          id: 'nb-' + Date.now(),
          partner1: formPartner1,
          partner2: formPartner2,
          phone: formPhone,
          paymentStatus: 'pending_postpay',
          date: new Date().toISOString().split('T')[0]
        }
      ]);
    }

    setGeneratedTicket(newTicketData);
    setIsModalOpen(false);
    setFormPartner1('');
    setFormPartner2('');
    setFormPhone('');
  };

  // Admin Actions
  const handleAdminApprovePayment = (bedId) => {
    setRooms(prev => prev.map(room => ({
      ...room,
      beds: room.beds.map(bed => {
        if (bed.id === bedId) {
          return { ...bed, status: 'occupied', paymentStatus: 'paid' };
        }
        return bed;
      })
    })));
  };

  const handleAdminReleaseBed = (bedId) => {
    setRooms(prev => prev.map(room => ({
      ...room,
      beds: room.beds.map(bed => {
        if (bed.id === bedId) {
          return { ...bed, status: 'available', paymentStatus: null, reservedBy: null, phone: null };
        }
        return bed;
      })
    })));
  };

  const handleAdminApproveNoBed = (id) => {
    setNoBedBookings(prev => prev.map(item => item.id === id ? { ...item, paymentStatus: 'paid' } : item));
  };

  const handleAdminDeleteNoBed = (id) => {
    setNoBedBookings(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '80px' }}>
      {/* TOP HEADER */}
      <header className="glass-panel" style={{ borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0, position: 'sticky', top: 0, zIndex: 50, padding: '14px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img 
              src="/logo.png" 
              alt="Swinger El Salvador" 
              style={{ 
                width: '58px', 
                height: '58px', 
                borderRadius: '16px', 
                objectFit: 'cover',
                boxShadow: '0 0 20px rgba(245, 158, 11, 0.45)',
                border: '1.5px solid rgba(245, 158, 11, 0.6)'
              }} 
            />
            <div>
              <h1 style={{ 
                fontSize: '1.45rem', 
                fontWeight: 800, 
                letterSpacing: '-0.3px', 
                color: '#fbbf24',
                textShadow: '0 2px 10px rgba(0,0,0,0.7)'
              }}>
                Swinger El Salvador
              </h1>
              <span style={{ fontSize: '0.88rem', color: '#f59e0b', fontWeight: 700, letterSpacing: '0.5px' }}>@Swinger_SV</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Supabase Connection Status Pill (Solo visible en Modo Organizador/Admin) */}
            {isAdmin && (
              <div style={{
                padding: '6px 14px',
                borderRadius: '20px',
                background: isSupabaseConfigured ? 'rgba(16, 185, 129, 0.18)' : 'rgba(245, 158, 11, 0.15)',
                border: `1px solid ${isSupabaseConfigured ? 'var(--status-free)' : 'var(--gold)'}`,
                color: isSupabaseConfigured ? '#34d399' : 'var(--gold)',
                fontSize: '0.78rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Database size={14} />
                {isSupabaseConfigured ? '🟢 Supabase Conectado' : '🟡 Modo Local'}
              </div>
            )}

            <div className="badge-live">
              <span className="dot-live"></span>
              EN VIVO
            </div>

            {/* Mode Switcher */}
            <button 
              onClick={handleToggleAdminClick}
              style={{
                background: isAdmin ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                border: `1px solid ${isAdmin ? 'var(--gold)' : 'rgba(255, 255, 255, 0.15)'}`,
                color: isAdmin ? 'var(--gold)' : 'var(--text-main)',
                padding: '8px 16px',
                borderRadius: '12px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              {isAdmin ? <Lock size={16} /> : <Unlock size={16} />}
              {isAdmin ? 'Modo Organizador (Admin)' : 'Vista Cliente'}
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '32px auto 0 auto', padding: '0 20px' }}>
        
        {/* HERO EVENT SECTION */}
        <section className="glass-panel" style={{ padding: '32px', marginBottom: '32px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ 
            position: 'absolute', 
            top: 0, 
            right: 0, 
            width: '50%', 
            height: '100%', 
            background: 'radial-gradient(circle at 70% 30%, rgba(236, 72, 153, 0.15), transparent 70%)',
            pointerEvents: 'none'
          }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <span style={{ padding: '4px 12px', borderRadius: '20px', background: 'rgba(139, 92, 246, 0.2)', border: '1px solid rgba(139, 92, 246, 0.4)', color: '#c084fc', fontSize: '0.8rem', fontWeight: 600 }}>
                🔥 Próximo Evento Destacado
              </span>
              <span style={{ padding: '4px 12px', borderRadius: '20px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fbbf24', fontSize: '0.8rem', fontWeight: 600 }}>
                💑 Exclusivo Parejas
              </span>
            </div>

            <h2 style={{ fontSize: '2.2rem', fontWeight: 800, lineHeight: '1.2' }}>
              {eventData.title}
            </h2>

            <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', maxWidth: '700px' }}>
              {eventData.subtitle}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginTop: '8px', color: '#e5e7eb', fontSize: '0.95rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={18} color="var(--primary)" />
                <span>{eventData.location}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} color="var(--secondary)" />
                <span>{eventData.date}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} color="var(--status-free)" />
                <span>Pago Posterior (Sitio / Transferencia)</span>
              </div>
            </div>

            {/* REAL-TIME AVAILABILITY METERS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '20px' }}>
              
              <div className="glass-card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <span>Camas Disponibles libres</span>
                  <Bed size={18} color="var(--status-free)" />
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: availableBedsCount > 0 ? 'var(--status-free)' : 'var(--status-occupied)' }}>
                  {availableBedsCount} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 400 }}>/ {totalBeds} camas</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginTop: '10px', overflow: 'hidden' }}>
                  <div style={{ width: `${(availableBedsCount / totalBeds) * 100}%`, height: '100%', background: 'var(--status-free)', borderRadius: '3px', transition: 'width 0.5s ease' }} />
                </div>
              </div>

              <div className="glass-card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <span>Reservadas (Pendientes)</span>
                  <Clock size={18} color="var(--gold)" />
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: 'var(--gold)' }}>
                  {pendingBedsCount} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 400 }}>camas</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '8px' }}>
                  En proceso de confirmación post-pago
                </span>
              </div>

              <div className="glass-card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <span>Cupos Pareja (Sin Cama)</span>
                  <Users size={18} color="var(--primary)" />
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px', color: '#c084fc' }}>
                  {noBedAvailable} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 400 }}>libres</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginTop: '10px', overflow: 'hidden' }}>
                  <div style={{ width: `${((INITIAL_EVENT.noBedCapacityMax - noBedAvailable) / INITIAL_EVENT.noBedCapacityMax) * 100}%`, height: '100%', background: 'var(--primary)', borderRadius: '3px' }} />
                </div>
              </div>

            </div>

          </div>
        </section>

        {/* ORGANIZER ADMIN VIEW OVERLAY SUMMARY IF ADMIN MODE */}
        {isAdmin && (
          <section className="glass-panel" style={{ padding: '24px', marginBottom: '32px', border: '1px solid var(--gold)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={22} /> Panel de Control del Organizador
              </h3>
              
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button 
                  onClick={() => {
                    setEditTitle(eventData.title);
                    setEditSubtitle(eventData.subtitle);
                    setEditLocation(eventData.location);
                    setEditDate(eventData.date);
                    setEditNoBedPrice(eventData.noBedPrice);
                    setEditNoBedMax(eventData.noBedCapacityMax);
                    setIsEditEventModalOpen(true);
                  }}
                  style={{
                    background: 'rgba(245, 158, 11, 0.2)',
                    border: '1px solid var(--gold)',
                    color: 'var(--gold)',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  ✏️ Editar Próxima Fiesta
                </button>

                <button 
                  onClick={() => {
                    if (window.confirm('⚠️ ¿Estás seguro de vaciar todas las reservas anteriores? Todas las camas pasarán a estar LIBRES y la cuenta volverá a 0.')) {
                      handleResetAllBookings();
                    }
                  }}
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid var(--status-occupied)',
                    color: '#fca5a5',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  🔄 Vaciar / Reiniciar Reservas a 0
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ingreso Estimado Total:</span>
                <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                  ${(occupiedBedsCount + pendingBedsCount) * 200 + noBedCount * 80} USD
                </p>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cobrado en Sitio / Pagado:</span>
                <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--status-free)', marginTop: '4px' }}>
                  ${occupiedBedsCount * 200 + noBedBookings.filter(b=>b.paymentStatus==='paid').length * 80} USD
                </p>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '14px', borderRadius: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pendiente por Cobrar:</span>
                <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--gold)', marginTop: '4px' }}>
                  ${pendingBedsCount * 200 + noBedBookings.filter(b=>b.paymentStatus!=='paid').length * 80} USD
                </p>
              </div>
            </div>

            {/* HISTORIAL ARCHIVADO DE EVENTOS PASADOS */}
            {pastEvents.length > 0 && (
              <div style={{ marginTop: '20px', borderTop: '1px border-glass', paddingTop: '16px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#c084fc', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📜 Historial de Eventos Anteriores y Asistencias Archivadas ({pastEvents.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {pastEvents.map((evt) => (
                    <div key={evt.id} style={{ background: 'rgba(0,0,0,0.25)', padding: '12px 16px', borderRadius: '10px', fontSize: '0.82rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', fontWeight: 700, color: 'var(--gold)' }}>
                        <span>🎉 {evt.eventTitle} ({evt.date})</span>
                        <span>Ingreso Generado: ${evt.totalRevenue} USD</span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Camas Vendidas: {evt.occupiedBedsCount} | Parejas Sin Cama: {evt.noBedCouplesCount} | Archivado el: {evt.archivedAt}
                      </div>
                      {evt.couplesList && evt.couplesList.length > 0 && (
                        <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#e5e7eb' }}>
                          <strong>Parejas Registradas:</strong> {evt.couplesList.map(c => `${c.partner} (${c.type})`).join(' • ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* BED PICKER & ROOM LAYOUT */}
        <section style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                📍 Mapa de Habitaciones y Camas
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Selecciona la cama de tu preferencia para tu pareja. El pago se realiza posteriormente.
              </p>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--status-free)' }}></span>
                <span>Disponible (Verde)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--status-pending)' }}></span>
                <span>Reservada (Pendiente Post-pago)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--status-occupied)' }}></span>
                <span>Ocupada (Confirmada)</span>
              </div>
            </div>
          </div>

          {/* ROOMS GRID */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {rooms.map((room) => (
              <div key={room.id} className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f3f4f6' }}>{room.name}</h4>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>{room.description}</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                  {room.beds.map((bed) => {
                    const isFree = bed.status === 'available';
                    const isPending = bed.status === 'reserved';
                    const isPaid = bed.status === 'occupied';

                    return (
                      <div 
                        key={bed.id}
                        onClick={() => handleSelectBed(bed, room)}
                        className="glass-card"
                        style={{
                          padding: '18px',
                          cursor: (isFree || isAdmin) ? 'pointer' : 'not-allowed',
                          borderLeft: `4px solid ${
                            isFree ? 'var(--status-free)' : isPending ? 'var(--status-pending)' : 'var(--status-occupied)'
                          }`,
                          opacity: isPaid && !isAdmin ? 0.75 : 1,
                          position: 'relative'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, color: 'var(--text-muted)' }}>
                              CAMA #{bed.number}
                            </span>
                            <h5 style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '2px' }}>{bed.type}</h5>
                          </div>
                          
                          <span style={{ 
                            padding: '4px 10px', 
                            borderRadius: '12px', 
                            fontSize: '0.75rem', 
                            fontWeight: 700,
                            background: isFree ? 'rgba(16, 185, 129, 0.15)' : isPending ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: isFree ? 'var(--status-free)' : isPending ? 'var(--status-pending)' : 'var(--status-occupied)',
                            border: `1px solid ${isFree ? 'var(--status-free)' : isPending ? 'var(--status-pending)' : 'var(--status-occupied)'}`
                          }}>
                            {isFree ? 'LIBRE' : isPending ? 'PENDIENTE PAGO' : 'OCUPADA'}
                          </span>
                        </div>

                        <div style={{ marginTop: '14px', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Users size={14} /> Capacidad: {bed.capacity}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)', fontWeight: 600 }}>
                            <DollarSign size={14} color="var(--gold)" /> Precio: ${bed.price} USD / Pareja
                          </div>
                          
                          {bed.reservedBy && (
                            <div style={{ marginTop: '6px', fontSize: '0.8rem', color: '#c084fc', fontStyle: 'italic' }}>
                              👤 Reservado por: {bed.reservedBy}
                            </div>
                          )}
                        </div>

                        {/* CTA button inside card */}
                        <div style={{ marginTop: '16px' }}>
                          {isFree ? (
                            <button className="glow-btn" style={{ width: '100%', padding: '10px', fontSize: '0.85rem' }}>
                              Reservar esta Cama
                            </button>
                          ) : isAdmin ? (
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                              {isPending && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleAdminApprovePayment(bed.id); }}
                                  style={{ flex: 1, padding: '6px', background: 'var(--status-free)', border: 'none', borderRadius: '6px', color: '#000', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
                                >
                                  Marcar Pagado
                                </button>
                              )}
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleAdminReleaseBed(bed.id); }}
                                style={{ flex: 1, padding: '6px', background: 'rgba(239, 68, 68, 0.3)', border: '1px solid var(--status-occupied)', borderRadius: '6px', color: '#fff', fontSize: '0.75rem', cursor: 'pointer' }}
                              >
                                Liberar Cama
                              </button>
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                              No disponible
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* OPTION FOR NO-BED COUPLES (SOLO FIESTA / DAY PASS) */}
        <section className="glass-panel" style={{ padding: '28px', marginBottom: '40px', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.05))', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--secondary)', fontWeight: 700, letterSpacing: '1px' }}>
                ¿PREFIERES ASISTIR SIN CAMA?
              </span>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px' }}>
                Pase de Pareja "Solo Fiesta / Day Pass"
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '600px', marginTop: '4px' }}>
                Si no necesitas habitación pero quieres disfrutar de la fiesta, piscina y ambiente de la villa con tu pareja.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Precio por Pareja:</span>
                <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--gold)' }}>${INITIAL_EVENT.noBedPrice} USD</span>
              </div>

              <button 
                onClick={handleSelectNoBed}
                disabled={noBedAvailable <= 0}
                className="glow-btn"
                style={{ padding: '14px 28px', fontSize: '0.95rem' }}
              >
                {noBedAvailable > 0 ? 'Reservar Cupo Sin Cama' : 'Agotado'}
              </button>
            </div>
          </div>
        </section>

        {/* ADMIN NO-BED LIST TABLE */}
        {isAdmin && (
          <section className="glass-panel" style={{ padding: '24px', marginBottom: '40px' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', color: 'var(--gold)' }}>
              📋 Registro de Parejas Asistentes SIN Cama (Admin)
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-glass)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px' }}>ID / Pareja</th>
                    <th style={{ padding: '10px' }}>Contacto WhatsApp</th>
                    <th style={{ padding: '10px' }}>Estado Pago</th>
                    <th style={{ padding: '10px' }}>Acciones Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {noBedBookings.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px 10px', fontWeight: 600 }}>
                        {item.partner1} & {item.partner2}
                      </td>
                      <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>{item.phone}</td>
                      <td style={{ padding: '12px 10px' }}>
                        <span style={{ 
                          padding: '4px 8px', 
                          borderRadius: '8px', 
                          fontSize: '0.75rem', 
                          fontWeight: 700,
                          background: item.paymentStatus === 'paid' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                          color: item.paymentStatus === 'paid' ? 'var(--status-free)' : 'var(--gold)'
                        }}>
                          {item.paymentStatus === 'paid' ? 'Pagado en Sitio' : 'Pendiente Post-Pago'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {item.paymentStatus !== 'paid' && (
                            <button 
                              onClick={() => handleAdminApproveNoBed(item.id)}
                              style={{ padding: '4px 8px', background: 'var(--status-free)', border: 'none', borderRadius: '4px', color: '#000', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                              Aprobar
                            </button>
                          )}
                          <button 
                            onClick={() => handleAdminDeleteNoBed(item.id)}
                            style={{ padding: '4px 8px', background: 'rgba(239, 68, 68, 0.3)', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '0.75rem', cursor: 'pointer' }}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

      </main>

      {/* MODAL RESERVA POST-PAGO */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div 
            className="glass-panel" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '520px', width: '100%', padding: '28px', border: '1px solid rgba(139, 92, 246, 0.4)', borderRadius: '24px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Confirmar Reserva de Pareja</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--gold)' }}>Modalidad Post-Pago (Pagas al asistir o transferir)</span>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitBooking} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ background: 'rgba(255,255,255,0.04)', padding: '14px', borderRadius: '12px', fontSize: '0.88rem' }}>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>TIPO DE RESEVA SELECCIONADA:</span>
                <strong style={{ fontSize: '1.05rem', color: '#c084fc', marginTop: '2px', display: 'block' }}>
                  {bookingMode === 'with_bed' ? `🛌 ${selectedBed?.roomName} - Cama #${selectedBed?.number} (${selectedBed?.type})` : '🍹 Pase Pareja Solo Fiesta (Sin Cama)'}
                </strong>
                <span style={{ color: 'var(--gold)', fontWeight: 700, display: 'block', marginTop: '4px' }}>
                  Total a pagar: ${bookingMode === 'with_bed' ? selectedBed?.price : INITIAL_EVENT.noBedPrice} USD
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Nombre Integrante 1 (Pareja)</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ej: Carlos Mendoza"
                  value={formPartner1}
                  onChange={(e) => setFormPartner1(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-glass)', color: '#fff', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Nombre Integrante 2 (Pareja)</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ej: Sofía Ramírez"
                  value={formPartner2}
                  onChange={(e) => setFormPartner2(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-glass)', color: '#fff', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Número de WhatsApp (Para enviar Ticket)</label>
                <input 
                  type="tel" 
                  required
                  placeholder="+52 998 123 4567"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-glass)', color: '#fff', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Opción de Post-Pago Preferida</label>
                <select 
                  value={formPaymentMethod}
                  onChange={(e) => setFormPaymentMethod(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-glass)', color: '#fff', fontSize: '0.9rem' }}
                >
                  <option value="pay_on_site">💵 Pago en la Puerta del Evento (Efectivo/Terminal)</option>
                  <option value="bank_transfer">📱 Transferencia Previa (Confirmar por WhatsApp)</option>
                </select>
              </div>

              <div style={{ marginTop: '8px' }}>
                <button type="submit" className="glow-btn" style={{ width: '100%', padding: '14px', fontSize: '1rem' }}>
                  Generar Reserva Post-Pago 🎫
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL GENERATED TICKET DIGITAL QR */}
      {generatedTicket && (
        <div className="modal-overlay" onClick={() => setGeneratedTicket(null)}>
          <div 
            className="ticket-pass"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '440px', width: '100%', padding: '32px' }}
          >
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <span style={{ fontSize: '0.75rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 800 }}>
                PASS VIP POST-PAGO
              </span>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', marginTop: '2px' }}>
                SWSV SUNSET PARTY
              </h3>
              <div style={{ display: 'inline-block', marginTop: '6px', padding: '4px 12px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.2)', border: '1px solid var(--gold)', color: 'var(--gold)', fontSize: '0.78rem', fontWeight: 700 }}>
                PENDIENTE DE PAGO EN ENTRADA
              </div>
            </div>

            {/* QR SVG SIMULATED */}
            <div style={{ background: '#fff', padding: '16px', borderRadius: '16px', display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
              <svg width="140" height="140" viewBox="0 0 100 100">
                <rect width="100" height="100" fill="#ffffff" />
                <path d="M10 10h30v30h-30z M15 15h20v20h-20z M60 10h30v30h-30z M65 15h20v20h-20z M10 60h30v30h-30z M15 65h20v20h-20z" fill="#000" />
                <rect x="50" y="50" width="15" height="15" fill="#000" />
                <rect x="70" y="65" width="20" height="10" fill="#000" />
                <rect x="55" y="75" width="15" height="15" fill="#000" />
                <rect x="20" y="20" width="10" height="10" fill="#8b5cf6" />
                <rect x="70" y="20" width="10" height="10" fill="#8b5cf6" />
              </svg>
            </div>

            <div style={{ borderTop: '1px dashed rgba(255,255,255,0.2)', paddingTop: '16px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Ticket ID:</span>
                <strong style={{ color: 'var(--gold)' }}>#{generatedTicket.id}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Pareja:</span>
                <span>{generatedTicket.partner1} & {generatedTicket.partner2}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Asignación:</span>
                <span style={{ color: '#c084fc' }}>
                  {generatedTicket.mode === 'with_bed' ? `Cama #${generatedTicket.bedInfo?.number}` : 'Cupo Sin Cama'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Monto a pagar:</span>
                <strong>${generatedTicket.price} USD</strong>
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a 
                href={`https://wa.me/?text=${encodeURIComponent(`Hola Organizador! Acabo de hacer la reserva #${generatedTicket.id} a nombre de ${generatedTicket.partner1} & ${generatedTicket.partner2} para el evento SWSV. Modalidad: ${generatedTicket.mode === 'with_bed' ? 'Con Cama #' + generatedTicket.bedInfo?.number : 'Sin Cama'}. Confirmaré pago en puerta.`)}`}
                target="_blank" 
                rel="noreferrer"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px', 
                  padding: '12px', 
                  borderRadius: '12px', 
                  background: '#25D366', 
                  color: '#000', 
                  fontWeight: 700, 
                  textDecoration: 'none',
                  fontSize: '0.9rem'
                }}
              >
                <Send size={18} /> Confirmar Reserva por WhatsApp
              </a>

              <button 
                onClick={() => setGeneratedTicket(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Cerrar Ventana
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL PIN DE ADMINISTRADOR */}
      {isPinModalOpen && (
        <div className="modal-overlay" onClick={() => setIsPinModalOpen(false)}>
          <div 
            className="glass-panel" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '380px', width: '100%', padding: '28px', borderRadius: '20px', border: '1px solid var(--gold)' }}
          >
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.2)', border: '1px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
                <Lock size={24} color="var(--gold)" />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Acceso de Organizador</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Ingresa tu PIN de seguridad para acceder al panel de administración.
              </p>
            </div>

            <form onSubmit={handleVerifyPin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input 
                type="password" 
                autoFocus
                required
                maxLength={6}
                placeholder="Ingresa PIN (Ej: 2026)"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--gold)', color: '#fff', fontSize: '1.1rem', textAlign: 'center', letterSpacing: '4px', fontWeight: 700 }}
              />

              <button type="submit" className="glow-btn" style={{ padding: '12px', fontSize: '0.95rem' }}>
                Ingresar como Admin 🔑
              </button>

              <button 
                type="button" 
                onClick={() => setIsPinModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
              >
                Cancelar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR DATOS DE LA FIESTA */}
      {isEditEventModalOpen && (
        <div className="modal-overlay" onClick={() => setIsEditEventModalOpen(false)}>
          <div 
            className="glass-panel" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '520px', width: '100%', padding: '28px', borderRadius: '24px', border: '1px solid var(--gold)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--gold)' }}>✏️ Editar Próxima Fiesta</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Los cambios se actualizarán en vivo para todos los usuarios.</span>
              </div>
              <button 
                onClick={() => setIsEditEventModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEventData} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Título del Evento</label>
                <input 
                  type="text" 
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-glass)', color: '#fff', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Subtítulo / Descripción CORTA</label>
                <input 
                  type="text" 
                  required
                  value={editSubtitle}
                  onChange={(e) => setEditSubtitle(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-glass)', color: '#fff', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Ubicación / Villa</label>
                  <input 
                    type="text" 
                    required
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-glass)', color: '#fff', fontSize: '0.9rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Fecha y Hora</label>
                  <input 
                    type="text" 
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-glass)', color: '#fff', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Precio Pareja Sin Cama (USD)</label>
                  <input 
                    type="number" 
                    required
                    value={editNoBedPrice}
                    onChange={(e) => setEditNoBedPrice(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-glass)', color: '#fff', fontSize: '0.9rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Capacidad Max Sin Cama</label>
                  <input 
                    type="number" 
                    required
                    value={editNoBedMax}
                    onChange={(e) => setEditNoBedMax(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-glass)', color: '#fff', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '12px' }}>
                <button type="submit" className="glow-btn" style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}>
                  Guardar Cambios del Evento 💾
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
