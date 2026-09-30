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
  isDoubleDuty?: boolean;
  doubleDutyIn?: string | null;
  doubleDutyOut?: string | null;
  doubleDutyShift?: string | null;
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
  const [isDoubleDuty, setIsDoubleDuty] = useState(!!employee.isDoubleDuty);
  const [doubleDutyIn, setDoubleDutyIn] = useState<string | null>(employee.doubleDutyIn || null);
  const [doubleDutyOut, setDoubleDutyOut] = useState<string | null>(employee.doubleDutyOut || null);
  const [doubleDutyShift, setDoubleDutyShift] = useState<string | null>(employee.doubleDutyShift || null);

  const [processing, setProcessing] = useState(false);
  const [punchSuccess, setPunchSuccess] = useState<string | null>(null);
  const [punchLateNotice, setPunchLateNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(autoResetSeconds);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [geoLocating, setGeoLocating] = useState(false);
  // Proactive GPS status: 'unknown' | 'granted' | 'denied' | 'off'
  const [gpsStatus, setGpsStatus] = useState<'unknown' | 'granted' | 'denied' | 'off'>('unknown');
  const [gpsWarningDismissed, setGpsWarningDismissed] = useState(false);

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

  // Proactive GPS permission check on mount (only for MOBILE_GEOFENCE / self-service mode)
  useEffect(() => {
    if (punchMode !== 'MOBILE_GEOFENCE') return;
    // Check if employee is exempt (security / admin) — skip GPS check for them
    const empAny = employee as any;
    const empRole = String(empAny.role || '').toLowerCase();
    const empDesig = String(employee.designation || '').toLowerCase();
    const empDept = typeof employee.department === 'string'
      ? employee.department.toLowerCase()
      : String(empAny.department?.name || '').toLowerCase();
    const isExemptEmp =
      empRole.includes('security') || empRole.includes('admin') || empRole.includes('manager') ||
      empDesig.includes('guard') || empDesig.includes('security') ||
      empDept.includes('security') ||
      empAny.departmentId === 'dept-4' || empAny.departmentId === 'dept-11';
    if (isExemptEmp) { setGpsStatus('granted'); return; }

    if (typeof navigator === 'undefined') return;
    // Use Permissions API if available (Chrome/Android)
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then(result => {
        if (result.state === 'granted') {
          setGpsStatus('granted');
        } else if (result.state === 'denied') {
          setGpsStatus('denied');
        } else {
          // 'prompt' — permission not yet decided, don't warn yet
          setGpsStatus('unknown');
        }
        // Listen for changes (e.g. user enables GPS after seeing the banner)
        result.onchange = () => {
          if (result.state === 'granted') setGpsStatus('granted');
          else if (result.state === 'denied') setGpsStatus('denied');
          else setGpsStatus('unknown');
        };
      }).catch(() => setGpsStatus('unknown'));
    } else if (!navigator.geolocation) {
      setGpsStatus('off');
    }
  }, [punchMode, employee]);

  // Dynamic Time-of-day greeting (☀️ Good Morning / 🌤️ Good Afternoon / 🌆 Good Evening / 🌙 Good Night)
  const timeGreeting = useMemo(() => {
    const hr = currentTime.getHours();
    if (hr >= 4 && hr < 12) return { text: 'Good Morning', icon: '☀️', hindi: 'शुभ प्रभात' };
    if (hr >= 12 && hr < 17) return { text: 'Good Afternoon', icon: '🌤️', hindi: 'शुभ दोपहर' };
    if (hr >= 17 && hr < 22) return { text: 'Good Evening', icon: '🌆', hindi: 'शुभ संध्या' };
    return { text: 'Good Night', icon: '🌙', hindi: 'शुभ रात्रि' };
  }, [currentTime]);

  // Dynamic Live Duty Duration Elapsed Counter (supports cross-midnight ISO timestamps & HH:mm)
  const dutyElapsed = useMemo(() => {
    if (!checkedIn || checkedOut || !punchInTime) return null;
    try {
      const trimmed = punchInTime.trim();
      const parsedIso = new Date(trimmed);
      if (!isNaN(parsedIso.getTime())) {
        const diffMs = Math.max(0, currentTime.getTime() - parsedIso.getTime());
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        return `${diffHrs}h ${diffMins}m on duty`;
      }
      const parts = trimmed.split(':');
      if (parts.length >= 2) {
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (!isNaN(h) && !isNaN(m)) {
          const inDate = new Date(currentTime);
          inDate.setHours(h, m, 0, 0);
          if (inDate.getTime() > currentTime.getTime()) {
            inDate.setDate(inDate.getDate() - 1);
          }
          const diffMs = Math.max(0, currentTime.getTime() - inDate.getTime());
          const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
          const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          return `${diffHrs}h ${diffMins}m on duty`;
        }
      }
    } catch {}
    return null;
  }, [checkedIn, checkedOut, punchInTime, currentTime]);

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
      const emailParam = (employee as any).email ? `&email=${encodeURIComponent((employee as any).email)}` : '';
      const res = await fetch(`/api/kiosk/punch?employeeId=${encodeURIComponent(employee.id || employee.employeeId)}${emailParam}`);
      if (res.ok) {
        const data = await res.json();
        setCheckedIn(!!data.checkedIn);
        setCheckedOut(!!data.checkedOut);
        setPunchInTime(data.punchInTime);
        setPunchOutTime(data.punchOutTime);
        setPunchInMode(data.punchInMode || null);
        setPunchOutMode(data.punchOutMode || null);
        setIsDoubleDuty(!!data.isDoubleDuty);
        setDoubleDutyIn(data.doubleDutyIn || null);
        setDoubleDutyOut(data.doubleDutyOut || null);
        setDoubleDutyShift(data.doubleDutyShift || null);
      } else {
        setCheckedIn(!!employee.checkedIn);
        setCheckedOut(!!employee.checkedOut);
        setPunchInTime(employee.punchInTime || null);
        setPunchOutTime(employee.punchOutTime || null);
        setPunchInMode(employee.punchInMode || null);
        setPunchOutMode(employee.punchOutMode || null);
        setIsDoubleDuty(!!employee.isDoubleDuty);
        setDoubleDutyIn(employee.doubleDutyIn || null);
        setDoubleDutyOut(employee.doubleDutyOut || null);
        setDoubleDutyShift(employee.doubleDutyShift || null);
      }
    } catch {
      setCheckedIn(!!employee.checkedIn);
      setCheckedOut(!!employee.checkedOut);
      setPunchInTime(employee.punchInTime || null);
      setPunchOutTime(employee.punchOutTime || null);
      setPunchInMode(employee.punchInMode || null);
      setPunchOutMode(employee.punchOutMode || null);
      setIsDoubleDuty(!!employee.isDoubleDuty);
      setDoubleDutyIn(employee.doubleDutyIn || null);
      setDoubleDutyOut(employee.doubleDutyOut || null);
      setDoubleDutyShift(employee.doubleDutyShift || null);
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
    if (action === 'IN') {
      if (checkedIn && !checkedOut) {
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
      if (checkedIn && checkedOut && doubleDutyIn) {
        setErrorMsg(`Aapki Double Duty ka Punch-In already ${formatTimeStr(doubleDutyIn)} par record ho chuka hai.`);
        setProcessing(false);
        return;
      }
    }

    if (action === 'OUT') {
      if (checkedOut && doubleDutyOut) {
        const whoOut = (punchOutMode === 'SECURITY' || punchOutMode === 'KIOSK')
          ? 'Security Guard'
          : punchOutMode === 'ADMIN'
          ? 'Admin'
          : punchOutMode
          ? `Employee (${punchOutMode})`
          : 'Staff / Security';
        setErrorMsg(`Aapka Check-Out already ${whoOut} dwara ${formatTimeStr(punchOutTime)} par record kiya ja chuka hai.`);
        setProcessing(false);
        return;
      }
      if (checkedOut && !doubleDutyIn) {
        setErrorMsg(`Aapka Regular Shift Check-Out already ho chuka hai. Agar double duty karni hai to Double Duty Punch-In karein.`);
        setProcessing(false);
        return;
      }
    }

    let lat: number | undefined;
    let lng: number | undefined;
    let accuracy: number | undefined;

    const empAny = employee as any;
    const empRole = String(empAny.role || '').toLowerCase();
    const empDesig = String(employee.designation || '').toLowerCase();
    const empDept = typeof employee.department === 'string'
      ? employee.department.toLowerCase()
      : String(empAny.department?.name || '').toLowerCase();

    const isSecurityGuard =
      punchedBy === 'SECURITY' ||
      empRole.includes('security') ||
      empDesig.includes('guard') ||
      empDesig.includes('security') ||
      empDept.includes('security') ||
      empAny.departmentId === 'dept-4' ||
      empAny.departmentId === 'dept-11';

    const isAdmin =
      punchedBy === 'ADMIN' ||
      empRole.includes('admin') ||
      empRole.includes('manager') ||
      empDesig.includes('admin') ||
      empDesig.includes('manager') ||
      empAny.loginRole === 'security';

    // Also exempt if already punched in by security (employee is physically present — no need for GPS re-check)
    const alreadyPunchedBySecurity =
      action === 'OUT' &&
      checkedIn &&
      (punchInMode === 'SECURITY' || punchInMode === 'KIOSK');

    const isExempt = isSecurityGuard || isAdmin || alreadyPunchedBySecurity;

    // GPS boundary acquisition is STRICTLY MANDATORY for all employees (except Admin, Security, and already-verified punches)
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
        if (checkedOut || data.isDoubleDuty) {
          setIsDoubleDuty(true);
          setDoubleDutyIn(serverPunchInIso || new Date().toISOString());
          setDoubleDutyShift(data.shiftName || 'Double Duty');
          setPunchSuccess(`⚡ Double Duty Punch-In Recorded at ${timeFormatted} • 🟢 2nd Shift Started${geoNote}`);
        } else {
          setCheckedIn(true);
          setPunchInTime(serverPunchInIso || new Date().toISOString());
          setPunchInMode(effectivePunchedBy);
          setPunchLateNotice(lateNoticeHindi);
          if (isLatePunch) {
            setPunchSuccess(`Check-In Recorded at ${timeFormatted} • ⚠️ Marked Late${geoNote}`);
          } else {
            setPunchSuccess(`Check-In Recorded at ${timeFormatted} • 🟢 On-Time / Present${geoNote}`);
          }
        }
      } else {
        if (checkedOut || (doubleDutyIn && !doubleDutyOut) || data.doubleDutyCompleted) {
          setDoubleDutyOut(serverPunchOutIso || new Date().toISOString());
          setPunchSuccess(`⚡ Double Duty Check-Out Recorded at ${timeFormatted} • 🟢 All Duties Completed for Today!${geoNote}`);
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

  const [historyMonth, setHistoryMonth] = useState<string>(() => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()).slice(0, 7);
    } catch {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
  });

  const handleFetchHistory = async (targetMonth?: string | React.MouseEvent) => {
    setShowHistoryModal(true);
    setLoadingHistory(true);
    const m = typeof targetMonth === 'string' ? targetMonth : historyMonth;
    if (typeof targetMonth === 'string' && targetMonth !== historyMonth) {
      setHistoryMonth(targetMonth);
    }
    try {
      const empCode = employee.employeeId || employee.id;
      const empId = employee.id || '';
      const email = (employee as any).email || '';
      const res = await fetch(`/api/kiosk/attendance?employeeId=${encodeURIComponent(empCode)}&id=${encodeURIComponent(empId)}&email=${encodeURIComponent(email)}&month=${encodeURIComponent(m)}`);
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

  const changeHistoryMonth = (delta: number) => {
    const [yStr, mStr] = historyMonth.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) + delta;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    const nextMonth = `${y}-${String(m).padStart(2, '0')}`;
    setHistoryMonth(nextMonth);
    handleFetchHistory(nextMonth);
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
  // 3. Checked out & not started Double Duty -> 'DOUBLE_IN' (Start Double Duty / Second Shift)
  // 4. In Double Duty & not checked out -> 'DOUBLE_OUT' (End Double Duty)
  // 5. Both completed -> 'DONE'
  const currentAction: 'IN' | 'OUT' | 'DOUBLE_IN' | 'DOUBLE_OUT' | 'DONE' = !checkedIn
    ? 'IN'
    : !checkedOut
    ? 'OUT'
    : !doubleDutyIn
    ? 'DOUBLE_IN'
    : !doubleDutyOut
    ? 'DOUBLE_OUT'
    : 'DONE';

  return (
    <div className="ot-container">
      {/* Top Header Navigation Bar - Only for Kiosk mode to switch employee */}
      {!showLeaveAndHistory && (
        <div className="ot-kiosk-nav">
          <button
            type="button"
            onClick={onBack}
            className="ot-back-btn"
            style={{
              border: isLight ? '1px solid #cbd5e1' : '1px solid #334155',
              color: isLight ? '#334155' : '#cbd5e1',
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
        <div className="ot-alert-error">
          <span style={{ fontSize: '1.05rem', flexShrink: 0 }}>⚠️</span>
          <span style={{ flex: 1 }}>{errorMsg}</span>
        </div>
      )}

      {/* Proactive GPS Warning Banner */}
      {punchMode === 'MOBILE_GEOFENCE' && !gpsWarningDismissed && (gpsStatus === 'denied' || gpsStatus === 'off') && !errorMsg && (
        <div
          className="ot-gps-banner"
          style={{
            backgroundColor: 'rgba(251, 191, 36, 0.12)',
            color: isLight ? '#92400e' : '#fbbf24',
            border: '1px solid rgba(251, 191, 36, 0.4)',
          }}
        >
          <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: '1px' }}>📍</span>
          <span style={{ flex: 1, lineHeight: 1.4 }}>
            GPS Location is OFF or disabled! Please turn ON GPS / Location on your device to punch within 80m of hotel premises.
            {gpsStatus === 'denied' && (
              <span style={{ display: 'block', marginTop: '2px', fontWeight: 500, fontSize: '0.75rem', opacity: 0.85 }}>
                Tap the 🔒 icon in your browser address bar → Permissions → Allow Location.
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => setGpsWarningDismissed(true)}
            title="Dismiss"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: '0.95rem',
              padding: '0 2px',
              flexShrink: 0,
              opacity: 0.7,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Success Celebration Alert / Late Arrival Alert */}
      {punchSuccess && (
        <div
          className="ot-success-card"
          style={{
            backgroundColor: punchLateNotice ? (isLight ? '#fffbeb' : 'rgba(245, 158, 11, 0.12)') : (isLight ? '#f0fdf4' : 'rgba(16, 185, 129, 0.12)'),
            color: punchLateNotice ? (isLight ? '#92400e' : '#fbbf24') : 'var(--success)',
            border: punchLateNotice ? '1.5px solid #f59e0b' : '1.5px solid var(--success)',
            boxShadow: punchLateNotice ? '0 6px 20px rgba(245, 158, 11, 0.2)' : '0 6px 20px rgba(16, 185, 129, 0.2)',
          }}
        >
          <div style={{ fontSize: '1.65rem', lineHeight: 1 }}>{punchLateNotice ? '⚠️' : '🎉'}</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 800, lineHeight: 1.35 }}>{punchSuccess}</div>

          {punchLateNotice && (
            <div
              style={{
                width: '100%',
                backgroundColor: isLight ? '#fef3c7' : 'rgba(245, 158, 11, 0.22)',
                border: '1px solid rgba(245, 158, 11, 0.45)',
                borderRadius: '8px',
                padding: '0.55rem 0.75rem',
                fontSize: '0.84rem',
                fontWeight: 700,
                color: isLight ? '#78350f' : '#fef08a',
                lineHeight: 1.35,
              }}
            >
              📢 {punchLateNotice}
            </div>
          )}

          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {showLeaveAndHistory
              ? 'Attendance logged in Godwin ERP • Session active for 30 days'
              : <>Attendance logged in Godwin ERP • Auto-resetting in <strong>{countdown}s</strong></>}
          </p>
          <button
            type="button"
            onClick={() => {
              setPunchSuccess(null);
              setPunchLateNotice(null);
              if (!showLeaveAndHistory) onBack();
            }}
            style={{
              marginTop: '0.2rem',
              padding: '0.42rem 1.1rem',
              borderRadius: '8px',
              border: 'none',
              background: punchLateNotice ? '#f59e0b' : 'var(--success)',
              color: 'white',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            {showLeaveAndHistory ? '✓ Great, Continue' : 'Done (Clock Next Person)'}
          </button>
        </div>
      )}

      {/* Employee Identity & Attendance Card */}
      <div
        className="ot-profile-card"
        style={{
          background: isLight ? '#ffffff' : '#1e293b',
          border: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
        }}
      >
        {/* Top Accent Strip */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: checkedIn
              ? (checkedOut ? '#64748b' : 'linear-gradient(90deg, #10b981, #059669)')
              : 'linear-gradient(90deg, #3b82f6, #6366f1)',
          }}
        />

        {/* Top Bar: Greeting & Status Badge */}
        <div className="ot-card-top-row">
          {showLeaveAndHistory ? (
            <div
              className="ot-greeting-pill"
              style={{
                color: isLight ? '#1d4ed8' : '#93c5fd',
                background: isLight ? 'rgba(37, 99, 235, 0.08)' : 'rgba(37, 99, 235, 0.18)',
                border: isLight ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid rgba(37, 99, 235, 0.35)',
              }}
            >
              <span>{timeGreeting.icon}</span>
              <span>{timeGreeting.text} ({timeGreeting.hindi})</span>
            </div>
          ) : (
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Staff Attendance Terminal
            </div>
          )}

          <span
            className="ot-status-pill"
            style={{
              backgroundColor: checkedOut ? '#64748b' : checkedIn ? '#10b981' : '#3b82f6',
              color: '#ffffff',
            }}
          >
            {checkedOut ? 'COMPLETED' : checkedIn ? 'ON SHIFT' : 'READY'}
          </span>
        </div>

        {/* Compact Horizontal Profile Row */}
        <div className="ot-identity-row">
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {employee.photo ? (
              <img
                src={employee.photo}
                alt={`${employee.firstName} ${employee.lastName}`}
                className="ot-avatar"
                style={{
                  border: checkedIn && !checkedOut ? '2.5px solid #10b981' : '2.5px solid #3b82f6',
                }}
              />
            ) : (
              <div
                className="ot-avatar ot-avatar-initials"
                style={{
                  background: checkedIn && !checkedOut
                    ? 'linear-gradient(135deg, #10b981 0%, #047857 100%)'
                    : 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                  border: checkedIn && !checkedOut ? '2.5px solid #34d399' : '2.5px solid rgba(255,255,255,0.35)',
                }}
              >
                {getInitials(employee.firstName, employee.lastName)}
              </div>
            )}

            <div
              title={checkedIn && !checkedOut ? 'Currently On Shift' : 'Off Shift'}
              className="ot-avatar-dot"
              style={{
                backgroundColor: checkedIn && !checkedOut ? '#10b981' : (checkedOut ? '#64748b' : '#94a3b8'),
                border: `2px solid ${isLight ? '#ffffff' : '#1e293b'}`,
              }}
            >
              {checkedIn && !checkedOut ? '✓' : (checkedOut ? '✕' : '•')}
            </div>
          </div>

          <div className="ot-identity-info">
            <h2
              className="ot-emp-name"
              style={{ color: isLight ? '#0f172a' : '#f8fafc' }}
            >
              {employee.firstName} {employee.lastName}
            </h2>

            <div className="ot-emp-meta">
              <span
                className="ot-dept-chip"
                style={{
                  backgroundColor: isLight ? '#eff6ff' : 'rgba(37, 99, 235, 0.22)',
                  color: isLight ? '#1d4ed8' : '#93c5fd',
                }}
              >
                {employee.department || 'Hotel Staff'}
              </span>
              {employee.designation && (
                <span style={{ color: isLight ? '#475569' : '#cbd5e1', fontSize: '0.75rem', fontWeight: 600 }}>
                  {employee.designation}
                </span>
              )}
              <span
                className="ot-id-chip"
                style={{
                  backgroundColor: isLight ? '#f1f5f9' : '#0f172a',
                  color: isLight ? '#334155' : '#cbd5e1',
                }}
              >
                {employee.employeeId}
              </span>
            </div>
          </div>
        </div>

        {/* Shift Schedule Bar */}
        {(employee.morningTime || employee.eveningTime || employee.shiftDisplay) && (() => {
          const mTime = employee.morningTime || '09:00';
          const eTime = employee.eveningTime || '18:00';
          const isNight = employee.isNightShift === true ||
            (employee.shiftName && employee.shiftName.toLowerCase().includes('night')) ||
            employee.employeeId === 'GG-1015' ||
            employee.employeeId === 'IG-1003' ||
            (employee.firstName === 'Pawan' && employee.lastName === 'Pawan') ||
            (employee.firstName === 'Lalit') ||
            ((mTime === '20:00' || mTime === '19:00' || mTime.startsWith('2') || mTime.startsWith('19')) && (eTime === '08:00' || eTime === '07:00' || eTime.includes('am') || !eTime));

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

          const timingText = `${format12H(mTime)} – ${format12H(eTime)}`;
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
              className="ot-shift-bar"
              style={{
                backgroundColor: isNight
                  ? (isLight ? '#ede9fe' : 'rgba(139, 92, 246, 0.18)')
                  : (isLight ? '#f0f9ff' : 'rgba(14, 165, 233, 0.14)'),
                color: isNight
                  ? (isLight ? '#6d28d9' : '#c084fc')
                  : (isLight ? '#0369a1' : '#38bdf8'),
                border: isNight
                  ? (isLight ? '1px solid #c4b5fd' : '1px solid rgba(139, 92, 246, 0.35)')
                  : (isLight ? '1px solid #bae6fd' : '1px solid rgba(14, 165, 233, 0.3)'),
              }}
            >
              <span>{isNight ? '🌙' : '⏰'}</span>
              <span>
                <strong>{shiftLabel}:</strong> {timingText}
              </span>
              <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', opacity: 0.75 }}>
                ({mTime}–{eTime})
              </span>
            </div>
          );
        })()}

        {/* Roster Shift Swap Notice */}
        {(employee.shiftInstruction || employee.shiftChangeNotice || employee.isShiftSwapped || employee.morningTime === '20:00' || employee.morningTime === '19:00') && (
          <div
            className="ot-roster-notice"
            style={{
              backgroundColor: isLight ? '#f5f3ff' : 'rgba(139, 92, 246, 0.14)',
              border: isLight ? '1px solid #c4b5fd' : '1px solid rgba(139, 92, 246, 0.4)',
              color: isLight ? '#5b21b6' : '#d8b4fe',
            }}
          >
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>📢</span>
            <div style={{ flex: 1, textAlign: 'left', fontSize: '0.76rem', lineHeight: 1.35 }}>
              <strong style={{ display: 'block', color: isLight ? '#4c1d95' : '#e9d5ff', marginBottom: '1px' }}>
                Duty Roster Shift Notice
              </strong>
              {employee.shiftInstruction || employee.shiftChangeNotice || (employee.morningTime === '19:00' ? 'Night Shift assigned: 7:00 PM – 7:00 AM (Morning Check-Out)' : employee.morningTime === '20:00' ? 'Night Shift assigned: 8:00 PM – 8:00 AM (Morning Check-Out)' : 'Shift timings updated as per duty roster.')}
            </div>
          </div>
        )}

        {/* Today's Live Punch Summary Box */}
        <div
          className="ot-live-status-box"
          style={{
            backgroundColor: checkedOut
              ? (isLight ? '#f8fafc' : 'rgba(30, 41, 59, 0.6)')
              : checkedIn
              ? (isLight ? '#ecfdf5' : 'rgba(16, 185, 129, 0.12)')
              : (isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.65)'),
            border: checkedOut
              ? (isLight ? '1px solid #cbd5e1' : '1px solid rgba(148, 163, 184, 0.25)')
              : checkedIn
              ? (isLight ? '1px solid #a7f3d0' : '1px solid rgba(16, 185, 129, 0.35)')
              : (isLight ? '1px solid #e2e8f0' : '1px solid #334155'),
          }}
        >
          <div className="ot-time-grid">
            <div className="ot-time-cell">
              <span className="ot-time-label" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
                PUNCH IN
              </span>
              <span className="ot-time-val" style={{ color: punchInTime ? '#10b981' : (isLight ? '#94a3b8' : '#64748b') }}>
                {punchInTime ? formatTimeStr(punchInTime) : '--:--'}
              </span>
              {punchInTime && (punchInMode === 'SECURITY' || punchInMode === 'KIOSK') && (
                <span className="ot-mode-tag" style={{ color: '#10b981' }}>🛡️ Guard</span>
              )}
            </div>

            <div className="ot-time-divider" style={{ background: isLight ? '#e2e8f0' : '#334155' }} />

            <div className="ot-time-cell">
              <span className="ot-time-label" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
                PUNCH OUT
              </span>
              <span className="ot-time-val" style={{ color: punchOutTime ? '#ef4444' : (isLight ? '#94a3b8' : '#64748b') }}>
                {punchOutTime ? formatTimeStr(punchOutTime) : '--:--'}
              </span>
              {punchOutTime && (punchOutMode === 'SECURITY' || punchOutMode === 'KIOSK') && (
                <span className="ot-mode-tag" style={{ color: '#ef4444' }}>🛡️ Guard</span>
              )}
            </div>

            <div className="ot-time-divider" style={{ background: isLight ? '#e2e8f0' : '#334155' }} />

            <div className="ot-time-cell">
              <span className="ot-time-label" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
                STATUS
              </span>
              <span
                className="ot-time-val"
                style={{
                  fontSize: '0.8rem',
                  color: checkedOut
                    ? (isLight ? '#475569' : '#cbd5e1')
                    : checkedIn
                    ? '#10b981'
                    : '#3b82f6',
                }}
              >
                {loadingStatus
                  ? 'Checking...'
                  : checkedOut
                  ? 'Done'
                  : checkedIn
                  ? (dutyElapsed ? dutyElapsed.replace(' on duty', '') : 'Active')
                  : 'Pending'}
              </span>
            </div>
          </div>

          {checkedIn && !checkedOut && (punchInMode === 'SECURITY' || punchInMode === 'KIOSK') && (
            <div
              style={{
                marginTop: '0.4rem',
                paddingTop: '0.4rem',
                borderTop: isLight ? '1px dashed #a7f3d0' : '1px dashed rgba(16, 185, 129, 0.28)',
                fontSize: '0.72rem',
                color: isLight ? '#166534' : '#86efac',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                textAlign: 'left',
              }}
            >
              <span>🛡️</span>
              <span>Security Guard dwara Check-In record hua hai. Shift complete hone par Check-Out karein.</span>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* COMPACT ONE-TAP PUNCH BUTTON INSIDE CARD                                  */}
        {/* ========================================================================= */}
        {currentAction !== 'DONE' ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.15rem' }}>
            <button
              type="button"
              onClick={() => {
                if (currentAction === 'IN' || currentAction === 'DOUBLE_IN') handlePunch('IN');
                else if (currentAction === 'OUT' || currentAction === 'DOUBLE_OUT') handlePunch('OUT');
              }}
              disabled={processing || loadingStatus}
              className="ot-punch-btn"
              style={{
                border: currentAction === 'IN'
                  ? '2px solid #34d399'
                  : currentAction === 'DOUBLE_IN'
                  ? '2px solid #c084fc'
                  : currentAction === 'DOUBLE_OUT'
                  ? '2px solid #fb7185'
                  : '2px solid #f87171',
                background: currentAction === 'IN'
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : currentAction === 'DOUBLE_IN'
                  ? 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)'
                  : currentAction === 'DOUBLE_OUT'
                  ? 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)'
                  : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                boxShadow: currentAction === 'IN' && !processing
                  ? '0 6px 18px rgba(16, 185, 129, 0.35)'
                  : currentAction === 'DOUBLE_IN' && !processing
                  ? '0 6px 18px rgba(147, 51, 234, 0.35)'
                  : '0 6px 18px rgba(239, 68, 68, 0.35)',
                opacity: processing || loadingStatus ? 0.7 : 1,
                cursor: processing || loadingStatus ? 'not-allowed' : 'pointer',
              }}
            >
              <div className="ot-punch-icon">
                {processing || geoLocating ? '⏳' : currentAction === 'IN' ? '🟢' : currentAction === 'DOUBLE_IN' ? '⚡' : '🔴'}
              </div>

              <div className="ot-punch-text">
                <div className="ot-punch-title">
                  {processing
                    ? (geoLocating ? 'Verifying GPS Location...' : 'Recording Attendance...')
                    : currentAction === 'IN'
                    ? 'Punch In (Arrival)'
                    : currentAction === 'DOUBLE_IN'
                    ? 'Start Double Duty (2nd Shift)'
                    : currentAction === 'DOUBLE_OUT'
                    ? 'End Double Duty (Check-Out)'
                    : 'Punch Out (Departure)'}
                </div>
                <div className="ot-punch-sub">
                  {currentAction === 'IN'
                    ? 'One-Tap Arrival • Tap to Clock In'
                    : currentAction === 'DOUBLE_IN'
                    ? '1st Shift Done • Tap to Start 2nd Shift'
                    : currentAction === 'DOUBLE_OUT'
                    ? `2nd Shift In: ${formatTimeStr(doubleDutyIn)} • Tap to Check Out`
                    : `Checked In: ${formatTimeStr(punchInTime)} • Tap to Clock Out`}
                </div>
              </div>

              <div className="ot-punch-arrow">
                TAP →
              </div>
            </button>

            {currentAction === 'DOUBLE_IN' && !showLeaveAndHistory && (
              <button
                type="button"
                onClick={onBack}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.76rem',
                }}
              >
                ← Back to Staff List (No Double Duty today)
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '0.4rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981' }}>
              🎉 All Shifts Completed for Today!
            </div>
            {!showLeaveAndHistory && (
              <button
                type="button"
                onClick={onBack}
                style={{
                  padding: '0.5rem 1.15rem',
                  borderRadius: '9px',
                  border: isLight ? '1px solid #cbd5e1' : '1px solid #334155',
                  background: isLight ? '#ffffff' : '#0f172a',
                  color: isLight ? '#0f172a' : '#f8fafc',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                }}
              >
                ← Back to Staff List
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quick Self-Service Actions (Request Leave, My Attendance, Log Out) */}
      {showLeaveAndHistory && (
        <div className="ot-quick-actions">
          <button
            type="button"
            onClick={openLeaveModal}
            className="ot-action-card"
            style={{
              border: isLight ? '1px solid #cbd5e1' : '1px solid #334155',
              background: isLight ? '#ffffff' : '#1e293b',
              color: isLight ? '#0f172a' : '#f8fafc',
            }}
          >
            <span className="ot-action-emoji">🌴</span>
            <span className="ot-action-label">Request Leave</span>
          </button>

          <button
            type="button"
            onClick={handleFetchHistory}
            className="ot-action-card"
            style={{
              border: isLight ? '1px solid #cbd5e1' : '1px solid #334155',
              background: isLight ? '#ffffff' : '#1e293b',
              color: isLight ? '#0f172a' : '#f8fafc',
            }}
          >
            <span className="ot-action-emoji">📅</span>
            <span className="ot-action-label">My Attendance</span>
          </button>

          <button
            type="button"
            onClick={onBack}
            className="ot-action-card ot-action-logout"
            style={{
              border: '1px solid rgba(239, 68, 68, 0.35)',
              background: isLight ? '#fef2f2' : 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
            }}
            title="Sign out of your account"
          >
            <span className="ot-action-emoji">🚪</span>
            <span className="ot-action-label">Log Out</span>
          </button>
        </div>
      )}

      {/* Compact Footer Hint */}
      {!checkedOut && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: isLight ? '#64748b' : '#94a3b8', fontSize: '0.73rem', fontWeight: 500, margin: 0, lineHeight: 1.4 }}>
            💡 Tap the button above to record attendance. Server time &amp; shift hours are calculated automatically.
          </p>
        </div>
      )}

      {/* ============================================================ */}
      {/* LEAVE REQUEST MODAL (COMPACT & MOBILE-RESPONSIVE)            */}
      {/* ============================================================ */}
      {showLeaveAndHistory && showLeaveModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLeaveModal(false);
          }}
          className="ot-modal-backdrop"
        >
          <div
            className="ot-modal-card"
            style={{
              background: isLight ? '#ffffff' : '#1e293b',
              border: isLight ? '1px solid #cbd5e1' : '1px solid #475569',
            }}
          >
            {/* Modal Header */}
            <div
              className="ot-modal-header"
              style={{
                borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
                background: isLight ? '#f8fafc' : '#0f172a',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.1rem',
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
                      fontSize: '1rem',
                      fontWeight: 800,
                      lineHeight: 1.2,
                    }}
                  >
                    Request Leave
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {employee.firstName} {employee.lastName} • {employee.employeeId}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                title="Close"
                className="ot-modal-close"
                style={{
                  border: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
                  background: isLight ? '#ffffff' : '#1e293b',
                  color: 'var(--text-muted)',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="ot-modal-body">
              {leaveMsg && (
                <div
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '10px',
                    background: leaveMsg.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    color: leaveMsg.type === 'success' ? '#10b981' : '#ef4444',
                    border: leaveMsg.type === 'success' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                  }}
                >
                  <span>{leaveMsg.type === 'success' ? '✅' : '⚠️'}</span>
                  <span>{leaveMsg.text}</span>
                </div>
              )}

              <form id="leave-request-form" onSubmit={handleSubmitLeave} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', width: '100%' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.76rem', fontWeight: 700, color: isLight ? '#334155' : '#cbd5e1' }}>
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
                      height: '42px',
                      padding: '0 10px',
                      borderRadius: '9px',
                      border: isLight ? '1px solid #cbd5e1' : '1px solid #475569',
                      background: isLight ? '#f8fafc' : '#0f172a',
                      color: isLight ? '#0f172a' : '#f8fafc',
                      fontSize: '16px',
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

                <div className="ot-date-grid">
                  <div style={{ minWidth: 0 }}>
                    <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.76rem', fontWeight: 700, color: isLight ? '#334155' : '#cbd5e1' }}>
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
                        height: '42px',
                        padding: '0 8px',
                        borderRadius: '9px',
                        border: isLight ? '1px solid #cbd5e1' : '1px solid #475569',
                        background: isLight ? '#f8fafc' : '#0f172a',
                        color: isLight ? '#0f172a' : '#f8fafc',
                        fontSize: '16px',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.76rem', fontWeight: 700, color: isLight ? '#334155' : '#cbd5e1' }}>
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
                        height: '42px',
                        padding: '0 8px',
                        borderRadius: '9px',
                        border: isLight ? '1px solid #cbd5e1' : '1px solid #475569',
                        background: isLight ? '#f8fafc' : '#0f172a',
                        color: isLight ? '#0f172a' : '#f8fafc',
                        fontSize: '16px',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {calculatedDays > 0 && (
                  <div
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      background: 'rgba(37, 99, 235, 0.08)',
                      border: '1px solid rgba(37, 99, 235, 0.25)',
                      color: 'var(--primary)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>📅 Total Leave Duration:</span>
                    <span>{calculatedDays} {calculatedDays === 1 ? 'Day' : 'Days'}</span>
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.76rem', fontWeight: 700, color: isLight ? '#334155' : '#cbd5e1' }}>
                    Reason / Purpose *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={leaveForm.reason}
                    onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    placeholder="Enter reason for leave..."
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '9px',
                      border: isLight ? '1px solid #cbd5e1' : '1px solid #475569',
                      background: isLight ? '#f8fafc' : '#0f172a',
                      color: isLight ? '#0f172a' : '#f8fafc',
                      fontSize: '16px',
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
              className="ot-modal-footer"
              style={{
                borderTop: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
                background: isLight ? '#f8fafc' : '#0f172a',
              }}
            >
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                style={{
                  flex: 1,
                  height: '40px',
                  background: isLight ? '#ffffff' : '#1e293b',
                  border: isLight ? '1px solid #cbd5e1' : '1px solid #475569',
                  color: isLight ? '#0f172a' : '#f8fafc',
                  borderRadius: '9px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.82rem',
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
                  height: '40px',
                  background: 'var(--primary)',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '9px',
                  cursor: submittingLeave ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  fontSize: '0.82rem',
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
      {/* ATTENDANCE HISTORY MODAL (COMPACT & MOBILE-FITTED)           */}
      {/* ============================================================ */}
      {showLeaveAndHistory && showHistoryModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowHistoryModal(false);
          }}
          className="ot-modal-backdrop"
        >
          <div
            className="ot-modal-card"
            style={{
              background: isLight ? '#ffffff' : '#1e293b',
              border: isLight ? '1px solid #cbd5e1' : '1px solid #475569',
            }}
          >
            {/* Header */}
            <div
              className="ot-modal-header"
              style={{
                borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
                background: isLight ? '#f8fafc' : '#0f172a',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                <span style={{ fontSize: '1.25rem' }}>📅</span>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: 0, color: isLight ? '#0f172a' : '#f8fafc', fontSize: '0.98rem', fontWeight: 800 }}>
                    My Attendance
                  </h3>
                  <p style={{ margin: '1px 0 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {employee.firstName} {employee.lastName} ({employee.employeeId})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                title="Close"
                className="ot-modal-close"
                style={{
                  border: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
                  background: isLight ? '#ffffff' : '#1e293b',
                  color: 'var(--text-muted)',
                }}
              >
                ✕
              </button>
            </div>

            {/* Month Navigator Toolbar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem 0.9rem',
                background: isLight ? '#f1f5f9' : '#1e293b',
                borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
                flexShrink: 0,
                gap: '0.5rem',
              }}
            >
              <button
                type="button"
                onClick={() => changeHistoryMonth(-1)}
                style={{
                  padding: '0.3rem 0.65rem',
                  borderRadius: '7px',
                  border: isLight ? '1px solid #cbd5e1' : '1px solid #475569',
                  background: isLight ? '#ffffff' : '#0f172a',
                  color: isLight ? '#0f172a' : '#f8fafc',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ◀ Prev
              </button>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: isLight ? '#0f172a' : '#f8fafc', textAlign: 'center' }}>
                {(() => {
                  try {
                    return new Date(`${historyMonth}-01T12:00:00+05:30`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
                  } catch {
                    return historyMonth;
                  }
                })()}
              </div>
              <button
                type="button"
                onClick={() => changeHistoryMonth(1)}
                style={{
                  padding: '0.3rem 0.65rem',
                  borderRadius: '7px',
                  border: isLight ? '1px solid #cbd5e1' : '1px solid #475569',
                  background: isLight ? '#ffffff' : '#0f172a',
                  color: isLight ? '#0f172a' : '#f8fafc',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Next ▶
              </button>
            </div>

            {/* Quick Summary Stats Bar */}
            {!loadingHistory && historyLogs.length > 0 && (() => {
              const presentCount = historyLogs.filter(l => l.punchIn || l.status === 'PRESENT' || l.status === 'LATE' || l.status === 'HALF_DAY').length;
              const lateCount = historyLogs.filter(l => l.status === 'LATE' || l.isLate).length;
              const offOrLeaveCount = historyLogs.filter(l => l.status === 'WEEKLY_OFF' || l.status === 'OFF' || (l.status && l.status.includes('LEAVE'))).length;
              const absentCount = historyLogs.filter(l => l.status === 'ABSENT').length;
              return (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '0.35rem',
                    padding: '0.5rem 0.75rem',
                    borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
                    background: isLight ? '#ffffff' : '#0f172a',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ textAlign: 'center', padding: '0.3rem 0.2rem', borderRadius: '7px', background: 'rgba(16, 185, 129, 0.1)' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#10b981', lineHeight: 1.1 }}>{presentCount}</div>
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: isLight ? '#475569' : '#94a3b8', textTransform: 'uppercase' }}>Present</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '0.3rem 0.2rem', borderRadius: '7px', background: 'rgba(245, 158, 11, 0.1)' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f59e0b', lineHeight: 1.1 }}>{lateCount}</div>
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: isLight ? '#475569' : '#94a3b8', textTransform: 'uppercase' }}>Late</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '0.3rem 0.2rem', borderRadius: '7px', background: 'rgba(59, 130, 246, 0.1)' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#3b82f6', lineHeight: 1.1 }}>{offOrLeaveCount}</div>
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: isLight ? '#475569' : '#94a3b8', textTransform: 'uppercase' }}>Off/Leave</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '0.3rem 0.2rem', borderRadius: '7px', background: 'rgba(239, 68, 68, 0.1)' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ef4444', lineHeight: 1.1 }}>{absentCount}</div>
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: isLight ? '#475569' : '#94a3b8', textTransform: 'uppercase' }}>Absent</div>
                  </div>
                </div>
              );
            })()}

            {/* Attendance Records List (Mobile-Fitted Table) */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '0.5rem 0.75rem', boxSizing: 'border-box' }}>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '2.25rem 1rem', color: isLight ? '#475569' : '#cbd5e1', fontSize: '0.84rem' }}>
                  <div style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>⏳</div>
                  <div>Loading attendance records...</div>
                </div>
              ) : historyLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.25rem 1rem', color: isLight ? '#475569' : '#cbd5e1', fontSize: '0.84rem' }}>
                  <div style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>📋</div>
                  <div>No attendance records found for this month.</div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ borderBottom: isLight ? '1.5px solid #e2e8f0' : '1.5px solid #334155', color: isLight ? '#64748b' : '#94a3b8', textAlign: 'left', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      <th style={{ padding: '0.45rem 0.3rem' }}>Date</th>
                      <th style={{ padding: '0.45rem 0.3rem' }}>In</th>
                      <th style={{ padding: '0.45rem 0.3rem' }}>Out</th>
                      <th style={{ padding: '0.45rem 0.3rem', textAlign: 'right' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyLogs.map((log, idx) => {
                      const isLate = log.status === 'LATE' || log.isLate;
                      const isAbsent = log.status === 'ABSENT';
                      const isOff = log.status === 'WEEKLY_OFF' || log.status === 'OFF';
                      const isLeave = log.status && (log.status.includes('LEAVE') || log.status === 'PAID_LEAVE' || log.status === 'UNPAID_LEAVE');
                      const isHalf = log.status === 'HALF_DAY';
                      const isPending = log.status === 'PENDING';
                      const isScheduled = log.status === 'SCHEDULED';

                      const badgeColor = isLate ? '#f59e0b' : isAbsent ? '#ef4444' : isOff ? '#64748b' : isLeave ? '#2563eb' : isHalf ? '#8b5cf6' : isPending ? '#eab308' : isScheduled ? '#0ea5e9' : '#10b981';
                      const badgeBg = isLate ? 'rgba(245, 158, 11, 0.15)' : isAbsent ? 'rgba(239, 68, 68, 0.15)' : isOff ? 'rgba(100, 116, 139, 0.15)' : isLeave ? 'rgba(37, 99, 235, 0.15)' : isHalf ? 'rgba(139, 92, 246, 0.15)' : isPending ? 'rgba(234, 179, 8, 0.15)' : isScheduled ? 'rgba(14, 165, 233, 0.15)' : 'rgba(16, 185, 129, 0.15)';
                      const badgeText = isLate ? 'Late' : isAbsent ? 'Absent' : isOff ? 'Off' : isLeave ? 'Leave' : isHalf ? 'Half Day' : isPending ? 'Pending' : isScheduled ? 'Roster' : 'Present';

                      let displayDate = log.date || '';
                      try {
                        displayDate = new Date(log.date + (String(log.date).includes('T') ? '' : 'T12:00:00+05:30')).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short' });
                      } catch {}

                      return (
                        <tr key={idx} style={{ borderBottom: isLight ? '1px solid #f1f5f9' : '1px solid rgba(51, 65, 85, 0.6)', color: isLight ? '#0f172a' : '#f8fafc' }}>
                          <td style={{ padding: '0.5rem 0.3rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {displayDate}
                          </td>
                          <td style={{ padding: '0.5rem 0.3rem', color: log.punchIn ? '#10b981' : 'var(--text-muted)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {log.punchIn ? new Date(log.punchIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : (log.remarks && isScheduled ? log.remarks : '—')}
                          </td>
                          <td style={{ padding: '0.5rem 0.3rem', color: log.punchOut ? '#ef4444' : 'var(--text-muted)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {log.punchOut ? new Date(log.punchOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}
                          </td>
                          <td style={{ padding: '0.5rem 0.3rem', textAlign: 'right' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 7px',
                                borderRadius: '99px',
                                fontSize: '0.66rem',
                                fontWeight: 700,
                                backgroundColor: badgeBg,
                                color: badgeColor,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {badgeText}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div
              className="ot-modal-footer"
              style={{
                borderTop: isLight ? '1px solid #e2e8f0' : '1px solid #334155',
                background: isLight ? '#f8fafc' : '#0f172a',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                style={{
                  padding: '0.42rem 1.15rem',
                  background: 'var(--primary)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .ot-container {
          width: 100%;
          max-width: 460px;
          margin: 0 auto;
          padding: 0.5rem 0.65rem;
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          box-sizing: border-box;
        }
        .ot-kiosk-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 0.35rem;
        }
        .ot-back-btn {
          background: transparent;
          padding: 0.35rem 0.7rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.78rem;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
        }
        .ot-alert-error {
          padding: 0.65rem 0.85rem;
          background-color: rgba(239, 68, 68, 0.12);
          color: #ef4444;
          border-radius: 10px;
          border: 1px solid rgba(239, 68, 68, 0.35);
          display: flex;
          align-items: flex-start;
          gap: 0.55rem;
          font-size: 0.8rem;
          font-weight: 600;
          line-height: 1.4;
        }
        .ot-gps-banner {
          padding: 0.6rem 0.8rem;
          border-radius: 10px;
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          font-size: 0.78rem;
          font-weight: 600;
        }
        .ot-success-card {
          padding: 0.9rem 1rem;
          border-radius: 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.35rem;
          text-align: center;
          animation: scaleUp 0.18s ease-out;
        }
        .ot-profile-card {
          border-radius: 16px;
          padding: 1rem;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          position: relative;
          overflow: hidden;
        }
        .ot-card-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .ot-greeting-pill {
          font-size: 0.72rem;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 2px 9px;
          border-radius: 99px;
        }
        .ot-status-pill {
          font-size: 0.65rem;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 99px;
          letter-spacing: 0.04em;
        }
        .ot-identity-row {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          text-align: left;
        }
        .ot-avatar {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          object-fit: cover;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ot-avatar-initials {
          color: #ffffff;
          font-size: 1.3rem;
          font-weight: 800;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }
        .ot-avatar-dot {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.55rem;
          color: #ffffff;
        }
        .ot-identity-info {
          flex: 1;
          min-width: 0;
        }
        .ot-emp-name {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 800;
          line-height: 1.25;
          letter-spacing: -0.01em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ot-emp-meta {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          flex-wrap: wrap;
          margin-top: 0.25rem;
        }
        .ot-dept-chip {
          padding: 2px 7px;
          border-radius: 99px;
          font-size: 0.7rem;
          font-weight: 700;
        }
        .ot-id-chip {
          font-family: monospace;
          padding: 1px 6px;
          border-radius: 5px;
          font-size: 0.7rem;
          font-weight: 700;
        }
        .ot-shift-bar {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          padding: 0.38rem 0.65rem;
          border-radius: 9px;
          font-size: 0.76rem;
          font-weight: 600;
          flex-wrap: wrap;
        }
        .ot-roster-notice {
          padding: 0.5rem 0.7rem;
          border-radius: 9px;
          display: flex;
          align-items: flex-start;
          gap: 0.45rem;
        }
        .ot-live-status-box {
          padding: 0.55rem 0.65rem;
          border-radius: 11px;
        }
        .ot-time-grid {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.35rem;
        }
        .ot-time-cell {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          min-width: 0;
        }
        .ot-time-label {
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 0.04em;
        }
        .ot-time-val {
          font-size: 0.86rem;
          font-weight: 800;
          margin-top: 1px;
          white-space: nowrap;
        }
        .ot-mode-tag {
          font-size: 0.6rem;
          font-weight: 700;
        }
        .ot-time-divider {
          width: 1px;
          height: 26px;
          flex-shrink: 0;
        }
        .ot-punch-btn {
          width: 100%;
          padding: 0.75rem 0.95rem;
          border-radius: 13px;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.7rem;
          text-align: left;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          touch-action: manipulation;
        }
        .ot-punch-btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }
        .ot-punch-btn:active:not(:disabled) {
          transform: scale(0.98);
        }
        .ot-punch-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.18);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
          flex-shrink: 0;
        }
        .ot-punch-text {
          flex: 1;
          min-width: 0;
        }
        .ot-punch-title {
          font-size: 0.98rem;
          font-weight: 800;
          line-height: 1.2;
        }
        .ot-punch-sub {
          font-size: 0.72rem;
          font-weight: 500;
          opacity: 0.92;
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ot-punch-arrow {
          background: rgba(0, 0, 0, 0.22);
          padding: 0.3rem 0.55rem;
          border-radius: 7px;
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.04em;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .ot-quick-actions {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.45rem;
          width: 100%;
        }
        .ot-action-card {
          padding: 0.55rem 0.4rem;
          border-radius: 11px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.2rem;
          cursor: pointer;
          font-weight: 700;
          font-size: 0.74rem;
          transition: all 0.15s ease;
          touch-action: manipulation;
        }
        .ot-action-card:active {
          transform: scale(0.97);
        }
        .ot-action-emoji {
          font-size: 1.05rem;
          line-height: 1;
        }
        .ot-action-label {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }
        .ot-modal-backdrop {
          position: fixed;
          inset: 0;
          background-color: rgba(0, 0, 0, 0.72);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 0.75rem;
          box-sizing: border-box;
        }
        .ot-modal-card {
          border-radius: 16px;
          width: 100%;
          max-width: 460px;
          max-height: calc(100dvh - 1.5rem);
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.5);
          overflow: hidden;
          animation: scaleUp 0.16s ease-out;
        }
        .ot-modal-header {
          padding: 0.85rem 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          flex-shrink: 0;
        }
        .ot-modal-close {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          font-size: 0.95rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        .ot-modal-body {
          padding: 0.9rem 1rem;
          overflow-y: auto;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
        }
        .ot-date-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.6rem;
        }
        .ot-modal-footer {
          padding: 0.75rem 1rem;
          display: flex;
          gap: 0.6rem;
          flex-shrink: 0;
        }
        @keyframes scaleUp {
          from { transform: scale(0.96); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @media (max-width: 420px) {
          .ot-container {
            padding: 0.35rem 0.4rem;
            gap: 0.5rem;
          }
          .ot-profile-card {
            padding: 0.85rem 0.75rem;
            gap: 0.55rem;
            border-radius: 14px;
          }
          .ot-avatar {
            width: 48px;
            height: 48px;
          }
          .ot-avatar-initials {
            font-size: 1.1rem;
          }
          .ot-emp-name {
            font-size: 1rem;
          }
          .ot-punch-btn {
            padding: 0.65rem 0.75rem;
          }
          .ot-punch-title {
            font-size: 0.9rem;
          }
          .ot-punch-arrow {
            display: none;
          }
          .ot-date-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
