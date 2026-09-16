'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/components/ThemeProvider';

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
  branch?: string;
  checkedIn?: boolean;
  checkedOut?: boolean;
  punchInTime?: string | null;
  punchOutTime?: string | null;
}

interface Props {
  employee: EmployeeInfo;
  onBack: () => void;
  onSuccess?: () => void;
  autoResetSeconds?: number;
  mode?: 'KIOSK' | 'MOBILE_GEOFENCE';
  showLeaveAndHistory?: boolean;
}

export default function OneTapPunchInterface({
  employee,
  onBack,
  onSuccess,
  autoResetSeconds = 3,
  mode = 'KIOSK',
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

  const [processing, setProcessing] = useState(false);
  const [punchSuccess, setPunchSuccess] = useState<string | null>(null);
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
      } else {
        setCheckedIn(!!employee.checkedIn);
        setCheckedOut(!!employee.checkedOut);
        setPunchInTime(employee.punchInTime || null);
        setPunchOutTime(employee.punchOutTime || null);
      }
    } catch {
      setCheckedIn(!!employee.checkedIn);
      setCheckedOut(!!employee.checkedOut);
      setPunchInTime(employee.punchInTime || null);
      setPunchOutTime(employee.punchOutTime || null);
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

    let lat: number | undefined;
    let lng: number | undefined;

    // Mobile GPS boundary acquisition
    if (punchMode === 'MOBILE_GEOFENCE') {
      setGeoLocating(true);
      try {
        if (typeof window === 'undefined' || !navigator.geolocation) {
          throw new Error('Geolocation is not supported by your browser.');
        }

        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          });
        });

        lat = position.coords.latitude;
        lng = position.coords.longitude;
      } catch (geoErr: any) {
        setProcessing(false);
        setGeoLocating(false);
        let msg = '📍 Please turn ON GPS / Location on your device to punch within 80m of hotel premises.';
        if (geoErr?.code === 1) { // PERMISSION_DENIED
          msg = '📍 Location Permission Denied: Please allow Location Access in your browser settings so we can verify you are within 80m of hotel premises.';
        } else if (geoErr?.code === 2) { // POSITION_UNAVAILABLE
          msg = '📍 Device GPS is OFF: Please turn ON GPS / Location in your device settings to verify you are on hotel premises.';
        } else if (geoErr?.code === 3) { // TIMEOUT
          msg = '📍 GPS Signal Timeout: Could not detect your location. Please ensure device GPS is turned ON and retry.';
        } else if (geoErr?.message) {
          msg = `📍 GPS Error: ${geoErr.message}. Please make sure device GPS / Location is turned ON.`;
        }
        setErrorMsg(msg);
        return;
      } finally {
        setGeoLocating(false);
      }
    }

    try {
      const res = await fetch('/api/kiosk/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employee.id || employee.employeeId,
          action,
          punchMode,
          lat,
          lng,
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

      const lateNote = data.status === 'LATE' ? ' ⚠️ (Marked Late - Grace Period Exceeded)' : '';
      const geoNote = punchMode === 'MOBILE_GEOFENCE' ? ` [📍 GPS Verified: ${data.record?.punchInCoordinates?.distanceMeters ?? 0}m]` : '';

      if (action === 'IN') {
        setCheckedIn(true);
        setPunchInTime(serverPunchInIso || new Date().toISOString());
        setPunchSuccess(`Check-In (Arrival) Recorded at ${timeFormatted}${lateNote}${geoNote}`);
      } else {
        setCheckedOut(true);
        setPunchOutTime(serverPunchOutIso || new Date().toISOString());
        setPunchSuccess(`Check-Out (Departure) Recorded at ${timeFormatted}${geoNote}`);
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
      {/* Top Header Navigation Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid #1e293b',
          paddingBottom: '0.65rem',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'transparent',
            border: isLight ? '1px solid #cbd5e1' : '1px solid #334155',
            color: isLight ? '#334155' : '#cbd5e1',
            padding: '0.45rem 0.95rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'all 0.15s ease',
          }}
        >
          <span>{showLeaveAndHistory ? '🚪' : '←'}</span>
          <span>{showLeaveAndHistory ? 'Sign Out' : 'Switch Employee'}</span>
        </button>

        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              color: 'var(--primary)',
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {currentTime.toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
            })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {currentTime.toLocaleDateString('en-IN', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </div>
        </div>
      </div>

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

      {/* Success Celebration Alert */}
      {punchSuccess && (
        <div
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            color: 'var(--success)',
            borderRadius: '12px',
            border: '2px solid var(--success)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.4rem',
            textAlign: 'center',
            boxShadow: '0 8px 25px rgba(16, 185, 129, 0.25)',
            animation: 'scaleUp 0.2s ease-out',
          }}
        >
          <div style={{ fontSize: '2rem' }}>🎉</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{punchSuccess}</div>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {showLeaveAndHistory
              ? 'Attendance logged in Godwin ERP • Session active for 30 days'
              : <>Attendance logged in Godwin ERP • Auto-resetting for next employee in <strong>{countdown}s</strong></>}
          </p>
          <button
            type="button"
            onClick={() => {
              setPunchSuccess(null);
              if (!showLeaveAndHistory) onBack();
            }}
            style={{
              marginTop: '0.35rem',
              padding: '0.4rem 1.15rem',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--success)',
              color: 'white',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
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

          {(employee.morningTime || employee.eveningTime) && (
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.78rem', color: isLight ? '#475569' : '#cbd5e1' }}>
              ⏰ Shift: <strong>{employee.morningTime || '09:00'} – {employee.eveningTime || '18:00'}</strong>
            </p>
          )}
        </div>

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
                  ? 'Currently Checked-In (On Shift)'
                  : checkedOut
                  ? 'Shift Completed for Today'
                  : 'Not Checked-In Today'}
              </div>
              <div style={{ fontSize: '0.72rem', color: isLight ? '#475569' : '#cbd5e1' }}>
                {checkedIn && punchInTime && (
                  <span>Checked In: <strong>{formatTimeStr(punchInTime)}</strong></span>
                )}
                {checkedOut && punchOutTime && (
                  <span> • Out: <strong>{formatTimeStr(punchOutTime)}</strong></span>
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
            {checkedIn && !checkedOut ? 'ON SHIFT' : (checkedOut ? 'OUT' : 'READY')}
          </div>
        </div>
      </div>

      {/* 20m In-Premises Geo-Fence Active Status */}
      <div
        style={{
          padding: '0.45rem 0.85rem',
          borderRadius: '8px',
          backgroundColor: isLight ? '#ecfdf5' : 'rgba(16, 185, 129, 0.15)',
          border: isLight ? '1px solid #a7f3d0' : '1px dashed rgba(52, 211, 153, 0.4)',
          color: isLight ? '#065f46' : '#34d399',
          fontSize: '0.75rem',
          fontWeight: 600,
          textAlign: 'center',
          maxWidth: '520px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        {punchMode === 'KIOSK' ? (
          <>
            🛡️ <strong>Guard Terminal Kiosk:</strong> Verified On-Premises Terminal (Hotel Grand Godwin &amp; Godwin Deluxe).
          </>
        ) : (
          <>
            📍 <strong>Geo-Fence Active:</strong> Verifies coordinates against Hotel Grand Godwin &amp; Hotel Godwin Deluxe premises (80m in-premises boundary). Device GPS must be ON.
          </>
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
              : 'Shift Completed'}
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
              : `In: ${formatTimeStr(punchInTime)} • Out: ${formatTimeStr(punchOutTime)} • All punches logged`}
          </div>
        </button>
      </div>

      {/* Secondary Actions (Request Leave & My Attendance) - ONLY for self-service staff logged in with email & password */}
      {showLeaveAndHistory && (
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowLeaveModal(true)}
            style={{
              padding: '0.65rem 1.3rem',
              borderRadius: '10px',
              border: isLight ? '1.5px solid #cbd5e1' : '1.5px solid #475569',
              background: isLight ? '#ffffff' : '#1e293b',
              color: isLight ? '#0f172a' : '#f8fafc',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: isLight ? '0 2px 6px rgba(0,0,0,0.06)' : '0 2px 6px rgba(0,0,0,0.3)',
              transition: 'all 0.15s'
            }}
          >
            <span>🌴</span> <span>Request Leave</span>
          </button>
          <button
            type="button"
            onClick={handleFetchHistory}
            style={{
              padding: '0.65rem 1.3rem',
              borderRadius: '10px',
              border: isLight ? '1.5px solid #cbd5e1' : '1.5px solid #475569',
              background: isLight ? '#ffffff' : '#1e293b',
              color: isLight ? '#0f172a' : '#f8fafc',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: isLight ? '0 2px 6px rgba(0,0,0,0.06)' : '0 2px 6px rgba(0,0,0,0.3)',
              transition: 'all 0.15s'
            }}
          >
            <span>📅</span> <span>My Attendance</span>
          </button>
        </div>
      )}

      {/* Footer Instructions / Switch button */}
      <div style={{ textAlign: 'center', marginTop: '0.25rem' }}>
        <p style={{ color: isLight ? '#475569' : '#cbd5e1', fontSize: '0.8rem', fontWeight: 500, margin: 0 }}>
          💡 Tap the highlighted button to record your punch in 1 tap. Godwin ERP automatically stamps the server timestamp and calculates shift hours.
        </p>
      </div>

      {/* Leave Request Modal */}
      {showLeaveAndHistory && showLeaveModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: isLight ? '#ffffff' : '#1e293b', padding: '1.75rem', borderRadius: '16px', width: '92%', maxWidth: '500px', border: isLight ? '1px solid #cbd5e1' : '1px solid #475569', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)' }}>
            <h3 style={{ margin: '0 0 1.25rem 0', color: isLight ? '#0f172a' : '#f8fafc', fontSize: '1.25rem', fontWeight: 800 }}>Submit Leave Request</h3>
            <form onSubmit={handleSubmitLeave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {leaveMsg && (
                <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: leaveMsg.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)', color: leaveMsg.type === 'success' ? '#10b981' : '#ef4444', fontWeight: 600, fontSize: '0.85rem' }}>
                  {leaveMsg.text}
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 180px' }}>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', fontWeight: 600, color: isLight ? '#334155' : '#cbd5e1' }}>From Date</label>
                  <input type="date" required value={leaveForm.fromDate} onChange={e => setLeaveForm({...leaveForm, fromDate: e.target.value})} style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: isLight ? '1.5px solid #cbd5e1' : '1.5px solid #475569', background: isLight ? '#f8fafc' : '#0f172a', color: isLight ? '#0f172a' : '#f8fafc', fontSize: '0.9rem' }} />
                </div>
                <div style={{ flex: '1 1 180px' }}>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', fontWeight: 600, color: isLight ? '#334155' : '#cbd5e1' }}>To Date</label>
                  <input type="date" required value={leaveForm.toDate} onChange={e => setLeaveForm({...leaveForm, toDate: e.target.value})} style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: isLight ? '1.5px solid #cbd5e1' : '1.5px solid #475569', background: isLight ? '#f8fafc' : '#0f172a', color: isLight ? '#0f172a' : '#f8fafc', fontSize: '0.9rem' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', fontWeight: 600, color: isLight ? '#334155' : '#cbd5e1' }}>Leave Type</label>
                <select value={leaveForm.leaveTypeId} onChange={e => {
                  const name = e.target.options[e.target.selectedIndex].text;
                  setLeaveForm({...leaveForm, leaveTypeId: e.target.value, leaveTypeName: name});
                }} style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: isLight ? '1.5px solid #cbd5e1' : '1.5px solid #475569', background: isLight ? '#f8fafc' : '#0f172a', color: isLight ? '#0f172a' : '#f8fafc', fontSize: '0.9rem' }}>
                  <option value="lt-casual">Casual Leave</option>
                  <option value="lt-sick">Sick Leave</option>
                  <option value="lt-annual">Annual Leave</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', fontWeight: 600, color: isLight ? '#334155' : '#cbd5e1' }}>Reason</label>
                <textarea required rows={3} value={leaveForm.reason} onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})} placeholder="Reason for leave..." style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: isLight ? '1.5px solid #cbd5e1' : '1.5px solid #475569', background: isLight ? '#f8fafc' : '#0f172a', color: isLight ? '#0f172a' : '#f8fafc', fontSize: '0.9rem' }}></textarea>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                <button type="button" onClick={() => setShowLeaveModal(false)} style={{ flex: 1, padding: '0.7rem', background: isLight ? '#f1f5f9' : '#334155', border: isLight ? '1px solid #cbd5e1' : '1px solid #475569', color: isLight ? '#0f172a' : '#f8fafc', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
                <button type="submit" disabled={submittingLeave} style={{ flex: 1, padding: '0.7rem', background: 'var(--primary)', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>{submittingLeave ? 'Submitting...' : 'Submit Request'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showLeaveAndHistory && showHistoryModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: isLight ? '#ffffff' : '#1e293b', padding: '1.75rem', borderRadius: '16px', width: '92%', maxWidth: '700px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', border: isLight ? '1px solid #cbd5e1' : '1px solid #475569', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, color: isLight ? '#0f172a' : '#f8fafc', fontSize: '1.25rem', fontWeight: 800 }}>My Attendance (Last 30 Days)</h3>
              <button type="button" onClick={() => setShowHistoryModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', color: isLight ? '#475569' : '#cbd5e1', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: isLight ? '#475569' : '#cbd5e1' }}>Loading history...</div>
              ) : historyLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: isLight ? '#475569' : '#cbd5e1' }}>No attendance records found.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: '500px', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ borderBottom: isLight ? '2px solid #e2e8f0' : '2px solid #334155', color: isLight ? '#475569' : '#cbd5e1', textAlign: 'left' }}>
                        <th style={{ padding: '0.75rem 0' }}>Date</th>
                        <th style={{ padding: '0.75rem 0' }}>Punch In</th>
                        <th style={{ padding: '0.75rem 0' }}>Punch Out</th>
                        <th style={{ padding: '0.75rem 0' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyLogs.map((log, idx) => (
                        <tr key={idx} style={{ borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid #334155', color: isLight ? '#0f172a' : '#f8fafc' }}>
                          <td style={{ padding: '0.75rem 0', fontWeight: 600 }}>{new Date(log.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                          <td style={{ padding: '0.75rem 0', color: '#10b981', fontWeight: 700 }}>{log.punchIn ? new Date(log.punchIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</td>
                          <td style={{ padding: '0.75rem 0', color: '#ef4444', fontWeight: 700 }}>{log.punchOut ? new Date(log.punchOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</td>
                          <td style={{ padding: '0.75rem 0' }}>
                            <span style={{ padding: '0.2rem 0.6rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: log.status === 'LATE' ? 'rgba(245, 158, 11, 0.15)' : log.status === 'ABSENT' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: log.status === 'LATE' ? '#f59e0b' : log.status === 'ABSENT' ? '#ef4444' : '#10b981' }}>
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
