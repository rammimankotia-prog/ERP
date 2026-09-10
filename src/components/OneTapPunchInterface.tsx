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
}

export default function OneTapPunchInterface({
  employee,
  onBack,
  onSuccess,
  autoResetSeconds = 3,
}: Props) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

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
        // Fallback to employee's initial state if available
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

  // Handle One-Tap Action
  const handlePunch = async (action: 'IN' | 'OUT') => {
    if (processing) return;
    setProcessing(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/kiosk/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employee.id || employee.employeeId,
          action,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record punch');
      }

      playChime(action);

      const timeFormatted = new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });

      if (action === 'IN') {
        setCheckedIn(true);
        setPunchInTime(new Date().toISOString());
        setPunchSuccess(`Check-In (Arrival) Recorded at ${timeFormatted}`);
      } else {
        setCheckedOut(true);
        setPunchOutTime(new Date().toISOString());
        setPunchSuccess(`Check-Out (Departure) Recorded at ${timeFormatted}`);
      }

      if (onSuccess) onSuccess();

      // Trigger automatic countdown and return
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

    } catch (err: any) {
      setErrorMsg(err.message || 'Could not record punch');
      setProcessing(false);
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

  // Status check rule:
  // If NOT checked in -> Check-In button is highlighted default
  // If ALREADY checked in (and not checked out) -> Check-Out button is highlighted default
  const isCheckOutHighlighted = checkedIn && !checkedOut;
  const isCheckInHighlighted = !checkedIn;

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '820px',
        margin: '0 auto',
        padding: 'clamp(1rem, 3vw, 2rem)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.75rem',
      }}
    >
      {/* Top Header Navigation Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid #1e293b',
          paddingBottom: '1rem',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'transparent',
            border: isLight ? '1px solid #cbd5e1' : '1px solid #334155',
            color: isLight ? '#334155' : '#cbd5e1',
            padding: '0.6rem 1.1rem',
            borderRadius: '10px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease',
          }}
        >
          <span>←</span>
          <span>Switch Employee</span>
        </button>

        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: '1.35rem',
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
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
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
            padding: '1rem 1.25rem',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--error)',
            borderRadius: '12px',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.95rem',
            fontWeight: 600,
          }}
        >
          <span style={{ fontSize: '1.3rem' }}>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Success Celebration Alert */}
      {punchSuccess && (
        <div
          style={{
            padding: '1.25rem 1.5rem',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            color: 'var(--success)',
            borderRadius: '14px',
            border: '2px solid var(--success)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem',
            textAlign: 'center',
            boxShadow: '0 8px 25px rgba(16, 185, 129, 0.25)',
            animation: 'scaleUp 0.2s ease-out',
          }}
        >
          <div style={{ fontSize: '2.5rem' }}>🎉</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{punchSuccess}</div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Attendance logged in Godwin ERP • Auto-resetting for next employee in <strong>{countdown}s</strong>
          </p>
          <button
            type="button"
            onClick={onBack}
            style={{
              marginTop: '0.5rem',
              padding: '0.45rem 1.25rem',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--success)',
              color: 'white',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Done (Clock Next Person)
          </button>
        </div>
      )}

      {/* Employee Identity Card */}
      <div
        style={{
          background: isLight ? '#ffffff' : '#1e293b',
          borderRadius: '20px',
          padding: 'clamp(1.25rem, 3vw, 2rem)',
          border: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '1rem',
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
            height: '6px',
            background: checkedIn
              ? (checkedOut ? '#64748b' : 'linear-gradient(90deg, #10b981, #059669)')
              : 'linear-gradient(90deg, #3b82f6, #6366f1)',
          }}
        />

        {/* Employee Photo / Avatar */}
        <div style={{ position: 'relative', marginTop: '0.5rem' }}>
          {employee.photo ? (
            <img
              src={employee.photo}
              alt={`${employee.firstName} ${employee.lastName}`}
              style={{
                width: '110px',
                height: '110px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: checkedIn && !checkedOut ? '4px solid #10b981' : '4px solid #3b82f6',
                boxShadow: checkedIn && !checkedOut
                  ? '0 0 20px rgba(16, 185, 129, 0.4)'
                  : '0 8px 20px rgba(0,0,0,0.15)',
              }}
            />
          ) : (
            <div
              style={{
                width: '110px',
                height: '110px',
                borderRadius: '50%',
                background: checkedIn && !checkedOut
                  ? 'linear-gradient(135deg, #10b981 0%, #047857 100%)'
                  : 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.5rem',
                fontWeight: 900,
                border: checkedIn && !checkedOut ? '4px solid #10b981' : '4px solid rgba(255,255,255,0.2)',
                boxShadow: checkedIn && !checkedOut
                  ? '0 0 20px rgba(16, 185, 129, 0.45)'
                  : '0 10px 25px rgba(37, 99, 235, 0.35)',
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
              bottom: '4px',
              right: '4px',
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              backgroundColor: checkedIn && !checkedOut ? '#10b981' : (checkedOut ? '#64748b' : '#94a3b8'),
              border: `3px solid ${isLight ? '#ffffff' : '#1e293b'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              color: 'white',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
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
              fontSize: 'clamp(1.4rem, 4vw, 1.85rem)',
              fontWeight: 800,
              color: 'var(--text-main)',
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
              gap: '0.5rem',
              flexWrap: 'wrap',
              marginTop: '0.4rem',
            }}
          >
            <span
              style={{
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                color: 'var(--primary)',
                padding: '4px 10px',
                borderRadius: '99px',
                fontSize: '0.82rem',
                fontWeight: 700,
              }}
            >
              {employee.department || 'Hotel Department'}
            </span>
            <span
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              • {employee.designation || 'Staff'}
            </span>
            <span
              style={{
                fontFamily: 'monospace',
                backgroundColor: isLight ? '#f1f5f9' : '#0f172a',
                color: 'var(--text-muted)',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
              }}
            >
              {employee.employeeId}
            </span>
          </div>

          {(employee.morningTime || employee.eveningTime) && (
            <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              ⏰ Scheduled Shift: <strong>{employee.morningTime || '09:00'} – {employee.eveningTime || '18:00'}</strong>
            </p>
          )}
        </div>

        {/* Live Attendance Status Badge */}
        <div
          style={{
            width: '100%',
            maxWidth: '500px',
            padding: '0.75rem 1.25rem',
            borderRadius: '12px',
            backgroundColor: loadingStatus
              ? (isLight ? '#f8fafc' : '#0f172a')
              : checkedIn && !checkedOut
              ? 'rgba(16, 185, 129, 0.1)'
              : checkedOut
              ? 'rgba(100, 116, 139, 0.1)'
              : 'rgba(59, 130, 246, 0.08)',
            border: loadingStatus
              ? '1px solid var(--border)'
              : checkedIn && !checkedOut
              ? '1px solid rgba(16, 185, 129, 0.3)'
              : checkedOut
              ? '1px solid rgba(100, 116, 139, 0.3)'
              : '1px solid rgba(59, 130, 246, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textAlign: 'left' }}>
            <span style={{ fontSize: '1.2rem' }}>
              {loadingStatus ? '⏳' : checkedIn && !checkedOut ? '🟢' : checkedOut ? '🔴' : '⚪'}
            </span>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {loadingStatus
                  ? 'Checking Live Status...'
                  : checkedIn && !checkedOut
                  ? 'Currently Checked-In (Active On Shift)'
                  : checkedOut
                  ? 'Shift Completed for Today'
                  : 'Not Checked-In Today'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {checkedIn && punchInTime && (
                  <span>Checked In: <strong>{formatTimeStr(punchInTime)}</strong></span>
                )}
                {checkedOut && punchOutTime && (
                  <span> • Checked Out: <strong>{formatTimeStr(punchOutTime)}</strong></span>
                )}
                {!checkedIn && <span>Ready to record Arrival punch</span>}
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              padding: '3px 8px',
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

      {/* ========================================================================= */}
      {/* THE TWO BIG PUNCH BUTTONS (ONE-TAP ACTION WITH SMART HIGHLIGHTING) */}
      {/* ========================================================================= */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {/* ======================================================================= */}
        {/* 🟢 BUTTON 1: CHECK-IN (ARRIVAL) */}
        {/* ======================================================================= */}
        <button
          type="button"
          onClick={() => handlePunch('IN')}
          disabled={processing || checkedIn}
          className={`punch-btn punch-btn-in ${isCheckInHighlighted ? 'highlighted-default' : ''}`}
          style={{
            position: 'relative',
            padding: '2rem 1.5rem',
            borderRadius: '20px',
            border: isCheckInHighlighted
              ? '3px solid #10b981'
              : '2px solid rgba(16, 185, 129, 0.3)',
            background: checkedIn
              ? (isLight ? '#f1f5f9' : '#0f172a')
              : isCheckInHighlighted
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
              : 'linear-gradient(135deg, rgba(16, 185, 129, 0.9), rgba(5, 150, 105, 0.9))',
            color: checkedIn ? 'var(--text-muted)' : '#ffffff',
            cursor: checkedIn || processing ? 'not-allowed' : 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            boxShadow: isCheckInHighlighted && !processing && !checkedIn
              ? '0 0 0 6px rgba(16, 185, 129, 0.3), 0 16px 36px rgba(16, 185, 129, 0.45)'
              : 'var(--shadow)',
            transform: isCheckInHighlighted && !processing && !checkedIn ? 'scale(1.02)' : 'scale(1)',
            opacity: checkedIn ? 0.55 : 1,
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            minHeight: '160px',
          }}
        >
          {/* Highlight Badge */}
          {isCheckInHighlighted && !checkedIn && (
            <div
              style={{
                position: 'absolute',
                top: '-12px',
                background: '#047857',
                color: '#ffffff',
                border: '2px solid #34d399',
                padding: '3px 12px',
                borderRadius: '99px',
                fontSize: '0.72rem',
                fontWeight: 900,
                letterSpacing: '0.05em',
                boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                animation: 'pulseGlow 2s infinite',
              }}
            >
              ★ DEFAULT ACTION (ARRIVAL)
            </div>
          )}

          <div style={{ fontSize: '2.5rem', lineHeight: 1 }}>🟢</div>

          <div style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.01em' }}>
            Check-In (Arrival)
          </div>

          <div
            style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              opacity: checkedIn ? 0.7 : 0.95,
            }}
          >
            {checkedIn
              ? `Already Checked In at ${formatTimeStr(punchInTime)}`
              : 'One-Tap Arrival Punch'}
          </div>

          {processing && !checkedIn && (
            <div style={{ fontSize: '0.8rem', fontWeight: 700, marginTop: '0.25rem' }}>
              Recording Punch...
            </div>
          )}
        </button>

        {/* ======================================================================= */}
        {/* 🔴 BUTTON 2: CHECK-OUT (DEPARTURE) */}
        {/* ======================================================================= */}
        <button
          type="button"
          onClick={() => handlePunch('OUT')}
          disabled={processing || !checkedIn || checkedOut}
          className={`punch-btn punch-btn-out ${isCheckOutHighlighted ? 'highlighted-default' : ''}`}
          style={{
            position: 'relative',
            padding: '2rem 1.5rem',
            borderRadius: '20px',
            border: isCheckOutHighlighted
              ? '3px solid #ef4444'
              : '2px solid rgba(239, 68, 68, 0.3)',
            background: !checkedIn || checkedOut
              ? (isLight ? '#f1f5f9' : '#0f172a')
              : isCheckOutHighlighted
              ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
              : 'linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(220, 38, 38, 0.9))',
            color: !checkedIn || checkedOut ? 'var(--text-muted)' : '#ffffff',
            cursor: !checkedIn || checkedOut || processing ? 'not-allowed' : 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            boxShadow: isCheckOutHighlighted && !processing && !checkedOut
              ? '0 0 0 6px rgba(239, 68, 68, 0.3), 0 16px 36px rgba(239, 68, 68, 0.45)'
              : 'var(--shadow)',
            transform: isCheckOutHighlighted && !processing && !checkedOut ? 'scale(1.02)' : 'scale(1)',
            opacity: !checkedIn || checkedOut ? 0.55 : 1,
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            minHeight: '160px',
          }}
        >
          {/* Highlight Badge */}
          {isCheckOutHighlighted && (
            <div
              style={{
                position: 'absolute',
                top: '-12px',
                background: '#b91c1c',
                color: '#ffffff',
                border: '2px solid #f87171',
                padding: '3px 12px',
                borderRadius: '99px',
                fontSize: '0.72rem',
                fontWeight: 900,
                letterSpacing: '0.05em',
                boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                animation: 'pulseGlowRed 2s infinite',
              }}
            >
              ★ DEFAULT ACTION (DEPARTURE)
            </div>
          )}

          <div style={{ fontSize: '2.5rem', lineHeight: 1 }}>🔴</div>

          <div style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.01em' }}>
            Check-Out (Departure)
          </div>

          <div
            style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              opacity: !checkedIn || checkedOut ? 0.7 : 0.95,
            }}
          >
            {!checkedIn
              ? 'Check-In required first'
              : checkedOut
              ? `Already Checked Out at ${formatTimeStr(punchOutTime)}`
              : 'One-Tap Departure Punch'}
          </div>

          {processing && checkedIn && !checkedOut && (
            <div style={{ fontSize: '0.8rem', fontWeight: 700, marginTop: '0.25rem' }}>
              Recording Punch...
            </div>
          )}
        </button>
      </div>

      {/* Footer Instructions / Switch button */}
      <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
          💡 Tap the highlighted button to record your punch in 1 tap. Godwin ERP automatically stamps the server timestamp and calculates shift hours.
        </p>
      </div>

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
