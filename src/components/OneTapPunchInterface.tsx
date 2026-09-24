'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { verifyStaffLocation } from '@/lib/geofence';

export interface EmployeeInfo {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  department: string;
  designation?: string;
  photo?: string | null;
  morningTime?: string;
  eveningTime?: string;
  shiftName?: string;
  shiftDisplay?: string;
  isNightShift?: boolean;
  isOff?: boolean;
  isShiftSwapped?: boolean;
  shiftChangeNotice?: string | null;
  shiftInstruction?: string | null;
  dayShiftStart?: string;
  dayShiftEnd?: string;
  nightShiftStart?: string;
  nightShiftEnd?: string;
  branch?: string;
  checkedIn?: boolean;
  checkedOut?: boolean;
  punchInTime?: string | null;
  punchOutTime?: string | null;
  punchInMode?: string | null;
  punchOutMode?: string | null;
}

interface Props {
  employee: EmployeeInfo;
  onBack: () => void;
  onSuccess?: () => void;
  autoResetSeconds?: number;
  mode?: 'KIOSK' | 'MOBILE_GEOFENCE';
  punchedBy?: string; // 'SECURITY' | employeeId | 'ADMIN'
  showLeaveAndHistory?: boolean;
}

export default function OneTapPunchInterface({
  employee,
  onBack,
  onSuccess,
  autoResetSeconds = 3,
  mode = 'KIOSK',
  punchedBy,
  showLeaveAndHistory = false,
}: Props) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const punchMode = mode || 'KIOSK';
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkedOut, setCheckedOut] = useState(false);
  const [punchInTime, setPunchInTime] = useState<string | null>(null);
  const [punchOutTime, setPunchOutTime] = useState<string | null>(null);
  const [punchInMode, setPunchInMode] = useState<string | null>(employee.punchInMode || null);
  const [punchOutMode, setPunchOutMode] = useState<string | null>(employee.punchOutMode || null);

  const [processing, setProcessing] = useState(false);
  const [punchSuccess, setPunchSuccess] = useState<string | null>(null);
  const [punchLateNotice, setPunchLateNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(autoResetSeconds);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [geoLocating, setGeoLocating] = useState(false);

  // New features state
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leaveTypeId: 'lt-casual', leaveTypeName: 'Casual Leave', fromDate: '', toDate: '', reason: '' });
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [leaveMsg, setLeaveMsg] = useState<{type: 'error' | 'success', text: string} | null>(null);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Web Audio chime for instant tactile/auditory feedback on one-tap punch
  const playChime = useCallback((type: 'IN' | 'OUT') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'IN') {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.12); // E5
        osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.25); // G5
      } else {
        osc.frequency.setValueAtTime(783.99, ctx.currentTime); // G5
        osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.12); // E5
        osc.frequency.exponentialRampToValueAtTime(523.25, ctx.currentTime + 0.25); // C5
      }
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio autoplay policy catch
    }
  }, []);

  // Fetch real-time status for today
  const checkStatus = useCallback(async () => {
    setLoadingStatus(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/kiosk/punch?employeeId=${encodeURIComponent(employee.id || employee.employeeId)}`);
      if (res.ok) {
        const data = await res.json();
        setCheckedIn(!!data.checkedIn);
        setCheckedOut(!!data.checkedOut);
        setPunchInTime(data.punchInTime);
        setPunchOutTime(data.punchOutTime);
        setPunchInMode(data.punchInMode || null);
        setPunchOutMode(data.punchOutMode || null);
      } else {
        setCheckedIn(!!employee.checkedIn);
        setCheckedOut(!!employee.checkedOut);
        setPunchInTime(employee.punchInTime || null);
        setPunchOutTime(employee.punchOutTime || null);
        setPunchInMode(employee.punchInMode || null);
        setPunchOutMode(employee.punchOutMode || null);
      }
    } catch {
      setCheckedIn(!!employee.checkedIn);
      setCheckedOut(!!employee.checkedOut);
      setPunchInTime(employee.punchInTime || null);
      setPunchOutTime(employee.punchOutTime || null);
      setPunchInMode(employee.punchInMode || null);
      setPunchOutMode(employee.punchOutMode || null);
    } finally {
      setLoadingStatus(false);
    }
  }, [employee]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Handle One-Tap Action with Dual Option Support (Kiosk vs Mobile Geo-Fence)
  const handlePunch = async (action: 'IN' | 'OUT') => {
    if (processing || geoLocating) return;
    setProcessing(true);
    setErrorMsg(null);

    // Duplicate Punch Prevention Guard (Zero Duplicate Tolerated)
    if (action === 'IN' && checkedIn) {
      const whoIn = (punchInMode === 'SECURITY' || punchInMode === 'KIOSK')
        ? 'Security Guard'
        : punchInMode === 'ADMIN'
        ? 'Admin'
        : punchInMode
        ? `Employee (${punchInMode})`
        : 'Staff / Security';
      setErrorMsg(`Aapka Punch-In already ${whoIn} dwara ${formatTimeStr(punchInTime)} par record kiya ja chuka hai. Dobara punch nahi lag sakta.`);
      setProcessing(false);
      return;
    }

    if (action === 'OUT' && checkedOut) {
      const whoOut = (punchOutMode === 'SECURITY' || punchOutMode === 'KIOSK')
        ? 'Security Guard'
        : punchOutMode === 'ADMIN'
        ? 'Admin'
        : punchOutMode
        ? `Employee (${punchOutMode})`
        : 'Staff / Security';
      setErrorMsg(`Aapka Check-Out already ${whoOut} dwara ${formatTimeStr(punchOutTime)} par record kiya ja chuka hai. Dobara punch nahi lag sakta.`);
      setProcessing(false);
      return;
    }

    let lat: number | undefined;
    let lng: number | undefined;
    let accuracy: number | undefined;

    const empAny = employee as any;
    const isSecurityGuard =
      punchedBy === 'SECURITY' ||
      (empAny.role && String(empAny.role).toLowerCase().includes('security')) ||
      (employee.designation && (employee.designation.toLowerCase().includes('guard') || employee.designation.toLowerCase().includes('security'))) ||
      (typeof employee.department === 'string' && employee.department.toLowerCase().includes('security')) ||
      (empAny.department?.name && String(empAny.department.name).toLowerCase().includes('security')) ||
      empAny.departmentId === 'dept-4' ||
      empAny.departmentId === 'dept-11';

    const isAdmin =
      punchedBy === 'ADMIN' ||
      (empAny.role && String(empAny.role).toLowerCase().includes('admin'));

    const isExempt = isSecurityGuard || isAdmin;

    // GPS boundary acquisition is STRICTLY MANDATORY for all employees (except Admin and Security)
    if (!isExempt) {
      setGeoLocating(true);
      try {
        const loc = await verifyStaffLocation(employee.employeeId || employee.id, empAny.role);
        lat = loc.latitude;
        lng = loc.longitude;
        accuracy = loc.accuracy;
      } catch (geoErr: any) {
        setProcessing(false);
        setGeoLocating(false);
        const msg = typeof geoErr === 'string' ? geoErr : geoErr?.message || 'Location verification failed';
        setErrorMsg(`📍 ${msg}`);
        return;
      } finally {
        setGeoLocating(false);
      }
    }

    try {
      const effectivePunchedBy = punchedBy || (punchMode === 'KIOSK' ? 'SECURITY' : (employee.employeeId || employee.id));

      const res = await fetch('/api/kiosk/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employee.id || employee.employeeId,
          action,
          punchMode,
          punchedBy: effectivePunchedBy,
          lat,
          lng,
          accuracy,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.deactivated) {
          try {
            localStorage.removeItem('kiosk_employee');
            sessionStorage.removeItem('kiosk_employee');
            localStorage.removeItem('GODWIN_REMEMBER_30DAYS');
            document.cookie = 'kiosk_employee=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
          } catch {}
          if (typeof window !== 'undefined') {
            window.location.href = '/login?deactivated=true';
            return;
          }
        }
        throw new Error(data.error || 'Failed to record punch');
      }

      playChime(action);

      // IMPORTANT: Always use server-returned timestamp (IST, server-side)
      // NEVER use new Date() here — client clock may be manipulated
      const serverPunchInIso: string | null = data.record?.punchIn || null;
      const serverPunchOutIso: string | null = data.record?.punchOut || null;

      const displayIso = action === 'IN' ? serverPunchInIso : serverPunchOutIso;
      const timeFormatted = displayIso
        ? new Date(displayIso).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata',
          })
        : new Date().toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          });

      const isLatePunch = data.status === 'LATE' || data.isLate;
      const lateMins = data.lateMinutes || 0;
      const lateDuration = lateMins >= 60
        ? `${Math.floor(lateMins / 60)}h ${lateMins % 60}m`
        : `${lateMins}m`;
      const scheduledStr = data.scheduledTime || employee.morningTime || 'scheduled time';

      const lateNoticeHindi = isLatePunch
        ? (data.lateNotice || `Aaj aap apne scheduled time (${scheduledStr}) se ${lateDuration} late hain.`)
        : null;

      const geoNote = punchMode === 'MOBILE_GEOFENCE' ? ` [📍 GPS Verified: ${data.record?.punchInCoordinates?.distanceMeters ?? 0}m]` : '';

      if (action === 'IN') {
        setCheckedIn(true);
        setPunchInTime(serverPunchInIso || new Date().toISOString());
        setPunchInMode(effectivePunchedBy);
        setPunchLateNotice(lateNoticeHindi);
        if (isLatePunch) {
          setPunchSuccess(`Check-In Recorded at ${timeFormatted} • ⚠️ Marked Late${geoNote}`);
        } else {
          setPunchSuccess(`Check-In Recorded at ${timeFormatted} • 🟢 On-Time / Present${geoNote}`);
        }
      } else {
        setCheckedOut(true);
        setPunchOutTime(serverPunchOutIso || new Date().toISOString());
        setPunchOutMode(effectivePunchedBy);
        const isEarly = data.isEarlyOut;
        const earlyMins = data.earlyOutMinutes || 0;
        const earlyDuration = earlyMins >= 60
          ? `${Math.floor(earlyMins / 60)}h ${earlyMins % 60}m`
          : `${earlyMins}m`;
        const scheduledOutStr = data.scheduledOutTime || employee.eveningTime || '18:00';
        const earlyNoticeHindi = isEarly
          ? (data.earlyNotice || `Aaj aap apne scheduled departure time (${scheduledOutStr}) se ${earlyDuration} pehle checkout kar rahe hain.`)
          : null;

        setPunchLateNotice(earlyNoticeHindi);
        if (isEarly) {
          setPunchSuccess(`Check-Out Recorded at ${timeFormatted} • ⚠️ Early Departure${geoNote}`);
        } else {
          setPunchSuccess(`Check-Out (Departure) Recorded at ${timeFormatted} • 🟢 Shift Completed${geoNote}`);
        }
      }

      if (onSuccess) onSuccess();

      // Trigger automatic countdown and return only for public kiosk station (not personal staff portal)
      if (!showLeaveAndHistory) {
        let rem = autoResetSeconds;
        setCountdown(rem);
        const timer = setInterval(() => {
          rem -= 1;
          setCountdown(rem);
          if (rem <= 0) {
            clearInterval(timer);
            onBack();
          }
        }, 1000);
      }

    } catch (err: any) {
      setErrorMsg(err.message || 'Could not record punch');
    } finally {
      setProcessing(false);
    }
  };

  const handleFetchHistory = async () => {
    setShowHistoryModal(true);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/kiosk/attendance?employeeId=${encodeURIComponent(employee.id || employee.employeeId)}`);
      if (res.ok) {
        const data = await res.json();
        setHistoryLogs(data.logs || []);
      }
    } catch {
      // Error fetching history
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingLeave) return;
    setSubmittingLeave(true);
    setLeaveMsg(null);
    try {
      const res = await fetch('/api/hr/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employee.id || employee.employeeId,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          designation: employee.designation,
          ...leaveForm
        })
      });
      const data = await res.json();
      if (res.ok) {
        setLeaveMsg({ type: 'success', text: 'Leave request submitted successfully!' });
        setTimeout(() => setShowLeaveModal(false), 2000);
      } else {
        setLeaveMsg({ type: 'error', text: data.error || data.message || 'Failed to submit' });
      }
    } catch (err: any) {
      setLeaveMsg({ type: 'error', text: err.message || 'Could not connect to server' });
    } finally {
      setSubmittingLeave(false);
    }
  };

  const calculatedDays = useMemo(() => {
    if (!leaveForm.fromDate || !leaveForm.toDate) return 0;
    const start = new Date(leaveForm.fromDate);
    const end = new Date(leaveForm.toDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }, [leaveForm.fromDate, leaveForm.toDate]);

  const openLeaveModal = () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setLeaveForm(prev => ({
      ...prev,
      fromDate: prev.fromDate || todayStr,
      toDate: prev.toDate || todayStr,
    }));
    setLeaveMsg(null);
    setShowLeaveModal(true);
  };

  const formatTimeStr = (isoString?: string | null) => {
    if (!isoString) return '--:--';
    try {
      return new Date(isoString).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '--:--';
    }
  };

  const getInitials = (first: string, last: string) => {
    return `${(first?.[0] || '').toUpperCase()}${(last?.[0] || '').toUpperCase()}` || 'EP';
  };

  // Dynamic single-action state:
  // 1. Not checked in yet -> 'IN' (Check-In Arrival)
  // 2. Checked in & not checked out -> 'OUT' (Check-Out Departure)
  // 3. Checked out -> 'DONE' (Completed for Today)
  const currentAction: 'IN' | 'OUT' | 'DONE' = !checkedIn
    ? 'IN'
    : !checkedOut
    ? 'OUT'
    : 'DONE';

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '820px',
        margin: '0 auto',
        padding: 'clamp(0.75rem, 2vw, 1.25rem)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
      }}
    >
      {/* Top Header Navigation Bar - Only for Kiosk mode to switch employee (self-service dashboard already has page header) */}
      {!showLeaveAndHistory && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.5rem',
            borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid #1e293b',
            paddingBottom: '0.45rem',
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              background: 'transparent',
              border: isLight ? '1px solid #cbd5e1' : '1px solid #334155',
              color: isLight ? '#334155' : '#cbd5e1',
              padding: '0.35rem 0.75rem',
              borderRadius: '7px',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
            title="Return to employee list"
          >
            <span>←</span>
            <span>Switch Employee</span>
          </button>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--error)',
            borderRadius: '10px',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            fontSize: '0.88rem',
            fontWeight: 600,
          }}
        >
          <span style={{ fontSize: '1.15rem' }}>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Success Celebration Alert / Late Arrival Alert */}
      {punchSuccess && (
        <div
          style={{
            padding: '1.15rem 1.25rem',
            backgroundColor: punchLateNotice ? (isLight ? '#fffbeb' : 'rgba(245, 158, 11, 0.12)') : (isLight ? '#f0fdf4' : 'rgba(16, 185, 129, 0.12)'),
            color: punchLateNotice ? (isLight ? '#92400e' : '#fbbf24') : 'var(--success)',
            borderRadius: '16px',
            border: punchLateNotice ? '2px solid #f59e0b' : '2px solid var(--success)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.45rem',
            textAlign: 'center',
            boxShadow: punchLateNotice ? '0 8px 25px rgba(245, 158, 11, 0.25)' : '0 8px 25px rgba(16, 185, 129, 0.25)',
            animation: 'scaleUp 0.2s ease-out',
          }}
        >
          <div style={{ fontSize: '2.2rem' }}>{punchLateNotice ? '⚠️' : '🎉'}</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{punchSuccess}</div>

          {punchLateNotice && (
            <div
              style={{
                width: '100%',
                backgroundColor: isLight ? '#fef3c7' : 'rgba(245, 158, 11, 0.25)',
                border: '1.5px solid rgba(245, 158, 11, 0.5)',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                fontSize: '0.98rem',
                fontWeight: 700,
                color: isLight ? '#78350f' : '#fef08a',
                lineHeight: 1.4,
              }}
            >
              📢 {punchLateNotice}
            </div>
          )}

          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {showLeaveAndHistory
              ? 'Attendance logged in Godwin ERP • Session active for 30 days'
              : <>Attendance logged in Godwin ERP • Auto-resetting for next employee in <strong>{countdown}s</strong></>}
          </p>
          <button
            type="button"
            onClick={() => {
              setPunchSuccess(null);
              setPunchLateNotice(null);
              if (!showLeaveAndHistory) onBack();
            }}
            style={{
              marginTop: '0.35rem',
              padding: '0.5rem 1.35rem',
              borderRadius: '8px',
              border: 'none',
              background: punchLateNotice ? '#f59e0b' : 'var(--success)',
              color: 'white',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: punchLateNotice ? '0 4px 12px rgba(245, 158, 11, 0.3)' : '0 4px 12px rgba(16, 185, 129, 0.3)',
            }}
          >
            {showLeaveAndHistory ? '✓ Great, Continue' : 'Done (Clock Next Person)'}
          </button>
        </div>
      )}

      {/* Employee Identity Card */}
      <div
        style={{
          background: isLight ? '#ffffff' : '#1e293b',
          borderRadius: '16px',
          padding: 'clamp(0.85rem, 2vw, 1.25rem)',
          border: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '0.65rem',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Department banner strip */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '5px',
            background: checkedIn
              ? (checkedOut ? '#64748b' : 'linear-gradient(90deg, #10b981, #059669)')
              : 'linear-gradient(90deg, #3b82f6, #6366f1)',
          }}
        />

        {/* Employee Photo / Avatar */}
        <div style={{ position: 'relative', marginTop: '0.25rem' }}>
          {employee.photo ? (
            <img
              src={employee.photo}
              alt={`${employee.firstName} ${employee.lastName}`}
              style={{
                width: '84px',
                height: '84px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: checkedIn && !checkedOut ? '3px solid #10b981' : '3px solid #3b82f6',
                boxShadow: checkedIn && !checkedOut
                  ? '0 0 16px rgba(16, 185, 129, 0.4)'
                  : '0 6px 16px rgba(0,0,0,0.15)',
              }}
            />
          ) : (
            <div
              style={{
                width: '84px',
                height: '84px',
                borderRadius: '50%',
                background: checkedIn && !checkedOut
                  ? 'linear-gradient(135deg, #10b981 0%, #047857 100%)'
                  : 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                fontWeight: 900,
                border: checkedIn && !checkedOut ? '3px solid #10b981' : '3px solid rgba(255,255,255,0.2)',
                boxShadow: checkedIn && !checkedOut
                  ? '0 0 16px rgba(16, 185, 129, 0.45)'
                  : '0 8px 20px rgba(37, 99, 235, 0.35)',
              }}
            >
              {getInitials(employee.firstName, employee.lastName)}
            </div>
          )}

          {/* Status Indicator Dot on Avatar */}
          <div
            title={checkedIn && !checkedOut ? 'Currently On Shift' : 'Off Shift'}
            style={{
              position: 'absolute',
              bottom: '2px',
              right: '2px',
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              backgroundColor: checkedIn && !checkedOut ? '#10b981' : (checkedOut ? '#64748b' : '#94a3b8'),
              border: `2.5px solid ${isLight ? '#ffffff' : '#1e293b'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.65rem',
              color: 'white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}
          >
            {checkedIn && !checkedOut ? '✓' : (checkedOut ? '✕' : '•')}
          </div>
        </div>

        {/* Name & Designation Details */}
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 'clamp(1.2rem, 3.5vw, 1.55rem)',
              fontWeight: 800,
              color: isLight ? '#0f172a' : '#f8fafc',
              letterSpacing: '-0.02em',
            }}
          >
            {employee.firstName} {employee.lastName}
          </h2>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              flexWrap: 'wrap',
              marginTop: '0.25rem',
            }}
          >
            <span
              style={{
                backgroundColor: isLight ? '#eff6ff' : 'rgba(37, 99, 235, 0.25)',
                color: isLight ? '#1d4ed8' : '#93c5fd',
                padding: '3px 8px',
                borderRadius: '99px',
                fontSize: '0.78rem',
                fontWeight: 700,
              }}
            >
              {employee.department || 'Hotel Department'}
            </span>
            <span
              style={{
                color: isLight ? '#475569' : '#cbd5e1',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              • {employee.designation || 'Staff'}
            </span>
            <span
              style={{
                fontFamily: 'monospace',
                backgroundColor: isLight ? '#f1f5f9' : '#0f172a',
                color: isLight ? '#334155' : '#cbd5e1',
                padding: '2px 7px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: 700,
              }}
            >
              {employee.employeeId}
            </span>
          </div>

          {/* Shift Schedule Badge (Clearly shows 8 PM to 8 AM for night shifts) */}
          {(employee.morningTime || employee.eveningTime || employee.shiftDisplay) && (() => {
            const mTime = employee.morningTime || '09:00';
            const eTime = employee.eveningTime || '18:00';
            const isNight = employee.isNightShift || mTime === '20:00' || eTime === '08:00' || (employee.shiftName && employee.shiftName.toLowerCase().includes('night'));
            
            const format12H = (t?: string) => {
              if (!t) return '';
              const trimmed = t.trim();
              if (trimmed.toUpperCase() === 'OFF') return 'Weekly Off';
              const parts = trimmed.split(':');
              if (parts.length < 2) return trimmed;
              const h = parseInt(parts[0], 10);
              const m = parts[1];
              if (isNaN(h)) return trimmed;
              const ampm = h >= 12 ? 'PM' : 'AM';
              const h12 = h % 12 === 0 ? 12 : h % 12;
              const mClean = m.padStart(2, '0');
              return mClean === '00' ? `${h12} ${ampm}` : `${h12}:${mClean} ${ampm}`;
            };

            const timingText = `${format12H(mTime)} to ${format12H(eTime)}`;

            const shiftLabel = employee.shiftName
              ? employee.shiftName
              : isNight
              ? 'Night Shift'
              : mTime === '13:00'
              ? 'Afternoon Shift'
              : mTime === '10:00' && eTime === '22:00'
              ? 'Break Shift'
              : 'Day Shift';

            return (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  marginTop: '0.4rem',
                  padding: '0.35rem 0.85rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  backgroundColor: isNight
                    ? (isLight ? '#ede9fe' : 'rgba(139, 92, 246, 0.22)')
                    : (isLight ? '#e0f2fe' : 'rgba(14, 165, 233, 0.18)'),
                  color: isNight
                    ? (isLight ? '#6d28d9' : '#c084fc')
                    : (isLight ? '#0369a1' : '#38bdf8'),
                  border: isNight
                    ? (isLight ? '1px solid #c4b5fd' : '1px solid rgba(139, 92, 246, 0.4)')
                    : (isLight ? '1px solid #bae6fd' : '1px solid rgba(14, 165, 233, 0.35)'),
                  boxShadow: isNight ? '0 2px 8px rgba(109, 40, 217, 0.15)' : undefined,
                }}
              >
                <span>{isNight ? '🌙' : '⏰'}</span>
                <span>
                  Shift: <strong>{timingText}</strong>
                  {' '}
                  <span style={{ fontSize: '0.78rem', opacity: 0.9 }}>({shiftLabel})</span>
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontFamily: 'monospace',
                    opacity: 0.75,
                    paddingLeft: '0.2rem',
                  }}
                >
                  [{mTime} – {eTime}]
                </span>
              </div>
            );
          })()}
        </div>

        {/* Roster Shift Swap Instruction Banner for Kiosk Guard & Staff */}
        {(employee.shiftInstruction || employee.shiftChangeNotice || employee.isShiftSwapped || employee.morningTime === '20:00') && (
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '0.65rem 0.95rem',
              borderRadius: '10px',
              backgroundColor: isLight ? '#f5f3ff' : 'rgba(139, 92, 246, 0.15)',
              border: isLight ? '1.5px solid #c4b5fd' : '1.5px solid rgba(139, 92, 246, 0.45)',
              color: isLight ? '#5b21b6' : '#d8b4fe',
              fontSize: '0.84rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              boxShadow: '0 2px 8px rgba(109, 40, 217, 0.1)',
            }}
          >
            <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>📢</span>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontWeight: 800, fontSize: '0.86rem', color: isLight ? '#4c1d95' : '#e9d5ff' }}>
                Duty Roster Shift Notice (ड्यूटी रोस्टर निर्देश)
              </div>
              <div style={{ fontSize: '0.8rem', marginTop: '1px', opacity: 0.95 }}>
                {employee.shiftInstruction || employee.shiftChangeNotice || (employee.morningTime === '20:00' ? 'Duty roster mein Night Shift assign hui hai. Aane ka samay raat 8:00 PM (8 PM – 8 AM) hai.' : 'Duty roster ke anusaar shift timings update ho gayi hai.')}
              </div>
            </div>
          </div>
        )}

        {/* Live Attendance Status Badge */}
        <div
          style={{
            width: '100%',
            maxWidth: '480px',
            padding: '0.55rem 1rem',
            borderRadius: '10px',
            backgroundColor: loadingStatus
              ? (isLight ? '#f8fafc' : '#0f172a')
              : checkedIn && !checkedOut
              ? (isLight ? '#ecfdf5' : 'rgba(16, 185, 129, 0.15)')
              : checkedOut
              ? (isLight ? '#f1f5f9' : 'rgba(100, 116, 139, 0.2)')
              : (isLight ? '#eff6ff' : 'rgba(59, 130, 246, 0.15)'),
            border: loadingStatus
              ? (isLight ? '1px solid #cbd5e1' : '1px solid #334155')
              : checkedIn && !checkedOut
              ? (isLight ? '1px solid #a7f3d0' : '1px solid rgba(16, 185, 129, 0.4)')
              : checkedOut
              ? (isLight ? '1px solid #cbd5e1' : '1px solid rgba(100, 116, 139, 0.4)')
              : (isLight ? '1px solid #bfdbfe' : '1px solid rgba(59, 130, 246, 0.35)'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.4rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', textAlign: 'left' }}>
            <span style={{ fontSize: '1.05rem' }}>
              {loadingStatus ? '⏳' : checkedIn && !checkedOut ? '🟢' : checkedOut ? '🔴' : '⚪'}
            </span>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isLight ? '#0f172a' : '#f8fafc' }}>
                {loadingStatus
                  ? 'Checking Live Status...'
                  : checkedIn && !checkedOut
                  ? (punchInMode === 'SECURITY' || punchInMode === 'KIOSK')
                    ? '🛡️ Checked-In by Security Guard (On Shift)'
                    : 'Currently Checked-In (On Shift)'
                  : checkedOut
                  ? (punchOutMode === 'SECURITY' || punchOutMode === 'KIOSK')
                    ? '🛡️ Shift Completed (Checked-Out by Security)'
                    : 'Shift Completed for Today'
                  : 'Not Checked-In Today'}
              </div>
              <div style={{ fontSize: '0.72rem', color: isLight ? '#475569' : '#cbd5e1' }}>
                {checkedIn && punchInTime && (
                  <span>
                    Checked In: <strong>{formatTimeStr(punchInTime)}</strong>
                    {(punchInMode === 'SECURITY' || punchInMode === 'KIOSK') && (
                      <span style={{ marginLeft: '4px', color: '#10b981', fontWeight: 700 }}>[🛡️ Security]</span>
                    )}
                  </span>
                )}
                {checkedOut && punchOutTime && (
                  <span>
                    {' '}• Out: <strong>{formatTimeStr(punchOutTime)}</strong>
                    {(punchOutMode === 'SECURITY' || punchOutMode === 'KIOSK') && (
                      <span style={{ marginLeft: '4px', color: '#ef4444', fontWeight: 700 }}>[🛡️ Security]</span>
                    )}
                  </span>
                )}
                {!checkedIn && <span>Ready to record Arrival punch</span>}
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: '99px',
              backgroundColor: checkedIn && !checkedOut ? '#10b981' : (checkedOut ? '#64748b' : '#3b82f6'),
              color: 'white',
              letterSpacing: '0.04em',
            }}
          >
            {checkedIn && !checkedOut ? 'ON SHIFT' : (checkedOut ? 'COMPLETED' : 'READY')}
          </div>
        </div>

        {/* Security Guard Punch Notice (Informed Notice for Employee) */}
        {checkedIn && !checkedOut && (punchInMode === 'SECURITY' || punchInMode === 'KIOSK') && (
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '0.65rem 0.95rem',
              borderRadius: '10px',
              backgroundColor: isLight ? '#f0fdf4' : 'rgba(16, 185, 129, 0.12)',
              border: isLight ? '1.5px solid #86efac' : '1.5px solid rgba(16, 185, 129, 0.4)',
              color: isLight ? '#166534' : '#86efac',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              lineHeight: 1.35,
              textAlign: 'left',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.1)',
            }}
          >
            <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>🛡️</span>
            <div>
              <div style={{ fontWeight: 800 }}>Security Guard ne Punch-In kar diya hai ({formatTimeStr(punchInTime)})</div>
              <div style={{ fontSize: '0.74rem', opacity: 0.9, marginTop: '2px' }}>
                Aapka arrival punch lag chuka hai. Dobara punch karne ki zaroorat nahi hai. Shift complete hone par hi Check-Out karein.
              </div>
            </div>
          </div>
        )}

        {/* Shift Completed Notice Banner */}
        {checkedOut && (
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '0.65rem 0.95rem',
              borderRadius: '10px',
              backgroundColor: isLight ? '#f8fafc' : 'rgba(100, 116, 139, 0.12)',
              border: isLight ? '1.5px solid #cbd5e1' : '1.5px solid rgba(100, 116, 139, 0.35)',
              color: isLight ? '#334155' : '#cbd5e1',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              lineHeight: 1.35,
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>
              {(punchOutMode === 'SECURITY' || punchOutMode === 'KIOSK') ? '🛡️' : '✓'}
            </span>
            <div>
              <div style={{ fontWeight: 800 }}>
                {(punchOutMode === 'SECURITY' || punchOutMode === 'KIOSK')
                  ? `Security Guard dwara Check-Out record ho gaya hai (${formatTimeStr(punchOutTime)})`
                  : `Check-Out Complete Ho Chuka Hai (${formatTimeStr(punchOutTime)})`}
              </div>
              <div style={{ fontSize: '0.74rem', opacity: 0.85, marginTop: '2px' }}>
                Aaj ki shift complete ho chuki hai. Dobara punch nahi lag sakta.
              </div>
            </div>
          </div>
        )}
      </div>


      {/* ========================================================================= */}
      {/* DYNAMIC ONE-TAP PUNCH ACTION (SPACE-SAVING AUTO-MORPH: IN -> OUT -> DONE) */}
      {/* ========================================================================= */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (currentAction === 'IN') handlePunch('IN');
            else if (currentAction === 'OUT') handlePunch('OUT');
          }}
          disabled={processing || loadingStatus || currentAction === 'DONE'}
          className={`punch-btn ${
            currentAction === 'IN'
              ? 'punch-btn-in'
              : currentAction === 'OUT'
              ? 'punch-btn-out'
              : 'punch-btn-done'
          }`}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '520px',
            padding: 'clamp(0.85rem, 2vw, 1.35rem) 1.5rem',
            borderRadius: '18px',
            border: currentAction === 'IN'
              ? '3px solid #10b981'
              : currentAction === 'OUT'
              ? '3px solid #ef4444'
              : (isLight ? '2px solid #cbd5e1' : '2px solid #334155'),
            background: currentAction === 'IN'
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
              : currentAction === 'OUT'
              ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
              : (isLight ? 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)' : 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'),
            color: currentAction === 'DONE' ? (isLight ? '#475569' : '#94a3b8') : '#ffffff',
            cursor: (processing || loadingStatus || currentAction === 'DONE') ? 'not-allowed' : 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            boxShadow: currentAction === 'IN' && !processing
              ? '0 0 0 5px rgba(16, 185, 129, 0.25), 0 12px 28px rgba(16, 185, 129, 0.4)'
              : currentAction === 'OUT' && !processing
              ? '0 0 0 5px rgba(239, 68, 68, 0.25), 0 12px 28px rgba(239, 68, 68, 0.4)'
              : 'var(--shadow)',
            opacity: processing ? 0.75 : 1,
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            minHeight: 'clamp(88px, 15vw, 125px)',
          }}
        >
          {/* Highlight Badge */}
          {currentAction === 'IN' && (
            <div
              style={{
                position: 'absolute',
                top: '-11px',
                background: '#047857',
                color: '#ffffff',
                border: '2px solid #34d399',
                padding: '2px 14px',
                borderRadius: '99px',
                fontSize: '0.72rem',
                fontWeight: 900,
                letterSpacing: '0.05em',
                boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                animation: 'pulseGlow 2s infinite',
              }}
            >
              ★ ONE-TAP ACTION (ARRIVAL)
            </div>
          )}

          {currentAction === 'OUT' && (
            <div
              style={{
                position: 'absolute',
                top: '-11px',
                background: '#b91c1c',
                color: '#ffffff',
                border: '2px solid #f87171',
                padding: '2px 14px',
                borderRadius: '99px',
                fontSize: '0.72rem',
                fontWeight: 900,
                letterSpacing: '0.05em',
                boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                animation: 'pulseGlowRed 2s infinite',
              }}
            >
              ★ ONE-TAP ACTION (DEPARTURE)
            </div>
          )}

          {currentAction === 'DONE' && (
            <div
              style={{
                position: 'absolute',
                top: '-11px',
                background: isLight ? '#64748b' : '#334155',
                color: '#ffffff',
                border: '2px solid #94a3b8',
                padding: '2px 14px',
                borderRadius: '99px',
                fontSize: '0.72rem',
                fontWeight: 800,
                letterSpacing: '0.05em',
              }}
            >
              ✓ COMPLETED FOR TODAY
            </div>
          )}

          <div style={{ fontSize: '2rem', lineHeight: 1 }}>
            {currentAction === 'IN' ? '🟢' : currentAction === 'OUT' ? '🔴' : '🏁'}
          </div>

          <div style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: '-0.01em' }}>
            {currentAction === 'IN'
              ? 'Check-In (Arrival)'
              : currentAction === 'OUT'
              ? 'Check-Out (Departure)'
              : 'Shift Completed (Attendance Done)'}
          </div>

          <div
            style={{
              fontSize: '0.84rem',
              fontWeight: 600,
              opacity: currentAction === 'DONE' ? 0.85 : 0.95,
              textAlign: 'center',
            }}
          >
            {processing
              ? (currentAction === 'IN' ? 'Recording Arrival Punch...' : 'Recording Departure Punch...')
              : currentAction === 'IN'
              ? 'One-Tap Arrival Punch • Tap to Clock In'
              : currentAction === 'OUT'
              ? `Checked In at ${formatTimeStr(punchInTime)} • Tap to Clock Out`
              : `In: ${formatTimeStr(punchInTime)} • Out: ${formatTimeStr(punchOutTime)} • Dobara punch nahi hoga`}
          </div>
        </button>
      </div>

      {/* Secondary Actions (Request Leave, My Attendance & Log Out) - ONLY for self-service staff logged in with email & password */}
      {/* Secondary Actions (Request Leave, My Attendance & Log Out) - ONLY for self-service staff logged in with email & password */}
      {showLeaveAndHistory && (
        <div
          style={{
            display: 'flex',
            gap: '0.65rem',
            justifyContent: 'center',
            marginTop: '0.5rem',
            flexWrap: 'wrap',
            width: '100%',
            maxWidth: '520px',
          }}
        >
          <button
            type="button"
            onClick={openLeaveModal}
            style={{
              flex: '1 1 135px',
              padding: '0.65rem 1rem',
              borderRadius: '10px',
              border: isLight ? '1.5px solid #cbd5e1' : '1.5px solid #475569',
              background: isLight ? '#ffffff' : '#1e293b',
              color: isLight ? '#0f172a' : '#f8fafc',
              fontWeight: 700,
              fontSize: '0.86rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              boxShadow: isLight ? '0 2px 6px rgba(0,0,0,0.06)' : '0 2px 6px rgba(0,0,0,0.3)',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            <span>🌴</span> <span>Request Leave</span>
          </button>
          <button
            type="button"
            onClick={handleFetchHistory}
            style={{
              flex: '1 1 135px',
              padding: '0.65rem 1rem',
              borderRadius: '10px',
              border: isLight ? '1.5px solid #cbd5e1' : '1.5px solid #475569',
              background: isLight ? '#ffffff' : '#1e293b',
              color: isLight ? '#0f172a' : '#f8fafc',
              fontWeight: 700,
              fontSize: '0.86rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              boxShadow: isLight ? '0 2px 6px rgba(0,0,0,0.06)' : '0 2px 6px rgba(0,0,0,0.3)',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            <span>📅</span> <span>My Attendance</span>
          </button>
          <button
            type="button"
            onClick={onBack}
            style={{
              flex: '1 1 110px',
              padding: '0.65rem 1rem',
              borderRadius: '10px',
              border: '1.5px solid rgba(239, 68, 68, 0.35)',
              background: isLight ? '#fef2f2' : 'rgba(239, 68, 68, 0.15)',
              color: '#dc2626',
              fontWeight: 700,
              fontSize: '0.86rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              boxShadow: isLight ? '0 2px 6px rgba(239, 68, 68, 0.1)' : '0 2px 6px rgba(0,0,0,0.3)',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
            title="Sign out of your account"
          >
            <span>🚪</span> <span>Log Out</span>
          </button>
        </div>
      )}

      {/* Footer Instructions / Switch button */}
      <div style={{ textAlign: 'center', marginTop: '0.25rem' }}>
        <p style={{ color: isLight ? '#475569' : '#cbd5e1', fontSize: '0.8rem', fontWeight: 500, margin: 0 }}>
          💡 Tap the highlighted button to record your punch in 1 tap. Godwin ERP automatically stamps the server timestamp and calculates shift hours.
        </p>
      </div>

      {/* ============================================================ */}
      {/* LEAVE REQUEST MODAL (ORGANIZED, RESPONSIVE & MOBILE-OPTIMIZED) */}
      {/* ============================================================ */}
      {showLeaveAndHistory && showLeaveModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLeaveModal(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 'clamp(0.75rem, 3vw, 1.5rem)',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              background: isLight ? '#ffffff' : '#1e293b',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '480px',
              maxHeight: 'calc(100vh - 2rem)',
              display: 'flex',
              flexDirection: 'column',
              border: isLight ? '1px solid #cbd5e1' : '1px solid #475569',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              overflow: 'hidden',
              boxSizing: 'border-box',
              animation: 'scaleUp 0.18s ease-out',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.15rem 1.4rem',
                borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                background: isLight ? '#f8fafc' : '#0f172a',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.3rem',
                    boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)',
                    flexShrink: 0,
                  }}
                >
                  🌴
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3
                    style={{
                      margin: 0,
                      color: isLight ? '#0f172a' : '#f8fafc',
                      fontSize: '1.15rem',
                      fontWeight: 800,
                      lineHeight: 1.2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    Submit Leave Request
                  </h3>
                  <p
                    style={{
                      margin: '2px 0 0 0',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {employee.firstName} {employee.lastName} • {employee.employeeId}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                title="Close"
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  border: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
                  background: isLight ? '#ffffff' : '#1e293b',
                  color: 'var(--text-muted)',
                  fontSize: '1.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body (Scrollable with border-box on all elements) */}
            <div
              style={{
                padding: '1.25rem 1.4rem',
                overflowY: 'auto',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxSizing: 'border-box',
              }}
            >
              {leaveMsg && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    background: leaveMsg.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    color: leaveMsg.type === 'success' ? '#10b981' : '#ef4444',
                    border: leaveMsg.type === 'success' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxSizing: 'border-box',
                  }}
                >
                  <span>{leaveMsg.type === 'success' ? '✅' : '⚠️'}</span>
                  <span>{leaveMsg.text}</span>
                </div>
              )}

              <form id="leave-request-form" onSubmit={handleSubmitLeave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', boxSizing: 'border-box' }}>
                {/* Leave Type */}
                <div style={{ width: '100%', boxSizing: 'border-box' }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '0.35rem',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: isLight ? '#334155' : '#cbd5e1',
                    }}
                  >
                    Leave Category *
                  </label>
                  <select
                    value={leaveForm.leaveTypeId}
                    onChange={e => {
                      const name = e.target.options[e.target.selectedIndex].text;
                      setLeaveForm({ ...leaveForm, leaveTypeId: e.target.value, leaveTypeName: name });
                    }}
                    style={{
                      width: '100%',
                      maxWidth: '100%',
                      boxSizing: 'border-box',
                      height: '44px',
                      padding: '0 12px',
                      borderRadius: '10px',
                      border: isLight ? '1.5px solid #cbd5e1' : '1.5px solid #475569',
                      background: isLight ? '#f8fafc' : '#0f172a',
                      color: isLight ? '#0f172a' : '#f8fafc',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      outline: 'none',
                    }}
                  >
                    <option value="lt-casual">🏖️ Casual Leave (CL)</option>
                    <option value="lt-sick">🤒 Sick Leave (SL)</option>
                    <option value="lt-annual">📅 Annual / Earned Leave (EL)</option>
                    <option value="lt-unpaid">📄 Unpaid Leave</option>
                  </select>
                </div>

                {/* Dates: 2-column responsive layout */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '0.75rem',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ minWidth: 0, boxSizing: 'border-box' }}>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: '0.35rem',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        color: isLight ? '#334155' : '#cbd5e1',
                      }}
                    >
                      From Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={leaveForm.fromDate}
                      onChange={e => {
                        const newFrom = e.target.value;
                        setLeaveForm(prev => ({
                          ...prev,
                          fromDate: newFrom,
                          toDate: prev.toDate && prev.toDate < newFrom ? newFrom : prev.toDate,
                        }));
                      }}
                      style={{
                        width: '100%',
                        maxWidth: '100%',
                        boxSizing: 'border-box',
                        height: '44px',
                        padding: '0 10px',
                        borderRadius: '10px',
                        border: isLight ? '1.5px solid #cbd5e1' : '1.5px solid #475569',
                        background: isLight ? '#f8fafc' : '#0f172a',
                        color: isLight ? '#0f172a' : '#f8fafc',
                        fontSize: '0.9rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div style={{ minWidth: 0, boxSizing: 'border-box' }}>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: '0.35rem',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        color: isLight ? '#334155' : '#cbd5e1',
                      }}
                    >
                      To Date *
                    </label>
                    <input
                      type="date"
                      required
                      min={leaveForm.fromDate}
                      value={leaveForm.toDate}
                      onChange={e => setLeaveForm({ ...leaveForm, toDate: e.target.value })}
                      style={{
                        width: '100%',
                        maxWidth: '100%',
                        boxSizing: 'border-box',
                        height: '44px',
                        padding: '0 10px',
                        borderRadius: '10px',
                        border: isLight ? '1.5px solid #cbd5e1' : '1.5px solid #475569',
                        background: isLight ? '#f8fafc' : '#0f172a',
                        color: isLight ? '#0f172a' : '#f8fafc',
                        fontSize: '0.9rem',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Duration indicator banner */}
                {calculatedDays > 0 && (
                  <div
                    style={{
                      padding: '0.65rem 0.9rem',
                      borderRadius: '10px',
                      background: 'rgba(37, 99, 235, 0.08)',
                      border: '1px solid rgba(37, 99, 235, 0.25)',
                      color: 'var(--primary)',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxSizing: 'border-box',
                    }}
                  >
                    <span>📅 Requested Leave Duration:</span>
                    <span style={{ fontSize: '0.92rem', fontWeight: 800 }}>
                      {calculatedDays} {calculatedDays === 1 ? 'Day' : 'Days'}
                    </span>
                  </div>
                )}

                {/* Reason */}
                <div style={{ width: '100%', boxSizing: 'border-box' }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '0.35rem',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: isLight ? '#334155' : '#cbd5e1',
                    }}
                  >
                    Reason / Purpose for Leave *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={leaveForm.reason}
                    onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    placeholder="Specify the reason for taking leave (e.g. personal, medical, urgent family matters)..."
                    style={{
                      width: '100%',
                      maxWidth: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: isLight ? '1.5px solid #cbd5e1' : '1.5px solid #475569',
                      background: isLight ? '#f8fafc' : '#0f172a',
                      color: isLight ? '#0f172a' : '#f8fafc',
                      fontSize: '0.88rem',
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '1rem 1.4rem',
                borderTop: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
                display: 'flex',
                gap: '0.75rem',
                background: isLight ? '#f8fafc' : '#0f172a',
                flexShrink: 0,
                boxSizing: 'border-box',
              }}
            >
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                style={{
                  flex: 1,
                  height: '44px',
                  background: isLight ? '#ffffff' : '#1e293b',
                  border: isLight ? '1px solid #cbd5e1' : '1px solid #475569',
                  color: isLight ? '#0f172a' : '#f8fafc',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="leave-request-form"
                disabled={submittingLeave}
                style={{
                  flex: 1.5,
                  height: '44px',
                  background: 'var(--primary)',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '10px',
                  cursor: submittingLeave ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                  opacity: submittingLeave ? 0.7 : 1,
                }}
              >
                {submittingLeave ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* ATTENDANCE HISTORY MODAL (CLEAN, ORGANIZED & RESPONSIVE)     */}
      {/* ============================================================ */}
      {showLeaveAndHistory && showHistoryModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowHistoryModal(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 'clamp(0.75rem, 3vw, 1.5rem)',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              background: isLight ? '#ffffff' : '#1e293b',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '680px',
              maxHeight: 'calc(100vh - 2rem)',
              display: 'flex',
              flexDirection: 'column',
              border: isLight ? '1px solid #cbd5e1' : '1px solid #475569',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              overflow: 'hidden',
              boxSizing: 'border-box',
              animation: 'scaleUp 0.18s ease-out',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '1.15rem 1.4rem',
                borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: isLight ? '#f8fafc' : '#0f172a',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.4rem' }}>📅</span>
                <div>
                  <h3 style={{ margin: 0, color: isLight ? '#0f172a' : '#f8fafc', fontSize: '1.15rem', fontWeight: 800 }}>
                    My Attendance History
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Last 30 days activity for {employee.firstName} {employee.lastName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                title="Close"
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  border: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
                  background: isLight ? '#ffffff' : '#1e293b',
                  color: 'var(--text-muted)',
                  fontSize: '1.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {/* Table Content with horizontal scroll */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '1rem 1.25rem', boxSizing: 'border-box' }}>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: isLight ? '#475569' : '#cbd5e1' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
                  <div>Loading attendance records...</div>
                </div>
              ) : historyLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: isLight ? '#475569' : '#cbd5e1' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
                  <div>No attendance records found for this period.</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', minWidth: '460px', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ borderBottom: isLight ? '2px solid #e2e8f0' : '2px solid #334155', color: isLight ? '#475569' : '#cbd5e1', textAlign: 'left' }}>
                        <th style={{ padding: '0.65rem 0.5rem' }}>Date</th>
                        <th style={{ padding: '0.65rem 0.5rem' }}>Punch In</th>
                        <th style={{ padding: '0.65rem 0.5rem' }}>Punch Out</th>
                        <th style={{ padding: '0.65rem 0.5rem' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyLogs.map((log, idx) => (
                        <tr key={idx} style={{ borderBottom: isLight ? '1px solid #f1f5f9' : '1px solid #334155', color: isLight ? '#0f172a' : '#f8fafc' }}>
                          <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600 }}>
                            {new Date(log.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', color: '#10b981', fontWeight: 700 }}>
                            {log.punchIn ? new Date(log.punchIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', color: '#ef4444', fontWeight: 700 }}>
                            {log.punchOut ? new Date(log.punchOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '99px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              backgroundColor: log.status === 'LATE' ? 'rgba(245, 158, 11, 0.15)' : log.status === 'ABSENT' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                              color: log.status === 'LATE' ? '#f59e0b' : log.status === 'ABSENT' ? '#ef4444' : '#10b981'
                            }}>
                              {log.status || 'ON_TIME'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '0.85rem 1.4rem',
                borderTop: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
                display: 'flex',
                justifyContent: 'flex-end',
                background: isLight ? '#f8fafc' : '#0f172a',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                style={{
                  padding: '0.5rem 1.25rem',
                  background: 'var(--primary)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '9px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}


      <style jsx>{`
        @keyframes pulseGlow {
          0%, 100% {
            box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
          }
          50% {
            box-shadow: 0 0 20px rgba(16, 185, 129, 0.9);
          }
        }
        @keyframes pulseGlowRed {
          0%, 100% {
            box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
          }
          50% {
            box-shadow: 0 0 20px rgba(239, 68, 68, 0.9);
          }
        }
        @keyframes scaleUp {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .punch-btn:hover:not(:disabled) {
          transform: scale(1.04) translateY(-2px) !important;
        }
        .punch-btn:active:not(:disabled) {
          transform: scale(0.98) !important;
        }
      `}</style>
    </div>
  );
}
