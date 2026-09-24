/**
 * Shared employee helper used by all HR API routes.
 * Single source of truth: Prisma DB first, JSON files merged/fallback.
 * Integrated with indestructible persistentVault.
 * Deleted employees are always excluded.
 */
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import {
  getAllDataDirs,
  safeReadJsonFile,
  safeWriteJsonFile,
  writeToAllTiers,
  ensureDirExists
} from './persistentVault'

const prisma = new PrismaClient()

export function getDeletedEmployeeKeys(): string[] {
  const allDirs = getAllDataDirs()
  const keysSet = new Set<string>()

  for (const dir of allDirs) {
    const filePath = path.join(dir, 'deleted_employees.json')
    const list = safeReadJsonFile<any[]>(filePath, [])
    if (Array.isArray(list)) {
      list.forEach(k => keysSet.add(String(k).toLowerCase().trim()))
    }
  }

  return Array.from(keysSet)
}

export function isEmployeeDeleted(emp: any, deletedKeys: string[]): boolean {
  const id = (emp.id || '').toLowerCase().trim()
  const empId = (emp.employeeId || '').toLowerCase().trim()
  const email = (emp.email || '').toLowerCase().trim()
  return (
    (id !== '' && deletedKeys.includes(id)) ||
    (empId !== '' && deletedKeys.includes(empId)) ||
    (email !== '' && deletedKeys.includes(email))
  )
}

export function unmarkEmployeeDeleted(keys: string[]): void {
  try {
    const existing = getDeletedEmployeeKeys()
    const toRemove = new Set(keys.map(k => String(k).toLowerCase().trim()).filter(Boolean))
    const filtered = existing.filter(k => !toRemove.has(k))
    writeToAllTiers('deleted_employees.json', filtered)
  } catch {}
}

/**
 * Returns ALL active employees, normalized and unified across Prisma DB,
 * permanent external vault, historical build folders, and local data files.
 * - Queries Prisma DB (if reachable).
 * - Merges with all JSON files across all tiers so no employee is ever missed.
 * - Always excludes employees in deleted_employees.json.
 */
export async function getAllEmployees(): Promise<any[]> {
  const deletedKeys = getDeletedEmployeeKeys()
  const map = new Map<string, any>()

  // 1. Prisma DB (production source of truth when configured)
  try {
    const dbEmployees = await prisma.employee.findMany({
      include: { branch: true, department: true },
      orderBy: { firstName: 'asc' },
    })
    if (dbEmployees && dbEmployees.length > 0) {
      for (const e of dbEmployees) {
        if (isEmployeeDeleted(e, deletedKeys)) continue
        const key = (e.employeeId || e.id || '').toUpperCase().trim()
        if (key) {
          map.set(key, {
            id: e.id,
            employeeId: e.employeeId || e.id,
            firstName: e.firstName,
            lastName: e.lastName,
            email: (e as any).email || '',
            password: (e as any).password || '',
            contactNo: e.contactNo || '',
            gender: (e as any).gender || 'Other',
            employmentType: (e as any).employmentType || 'PERMANENT',
            designation: e.designation || 'Staff',
            department: e.department || null,
            departmentId: e.departmentId || null,
            branch: e.branch || null,
            branchId: e.branchId || null,
            morningTime: e.morningTime || '09:00',
            eveningTime: e.eveningTime || '18:00',
            dayShiftStart: (e as any).dayShiftStart || e.morningTime || '09:00',
            dayShiftEnd: (e as any).dayShiftEnd || e.eveningTime || '18:00',
            nightShiftStart: (e as any).nightShiftStart || '20:00',
            nightShiftEnd: (e as any).nightShiftEnd || '08:00',
            swapShiftEligible: (e as any).swapShiftEligible === true,
            isNightShift: (e as any).isNightShift === true || ((e.morningTime || '').startsWith('2') || (e.eveningTime || '') === '08:00'),
            shiftName: (e as any).shiftName || (((e.morningTime || '').startsWith('2') || (e.eveningTime || '') === '08:00') ? 'Night Shift' : 'Morning Shift'),
            shiftType: (e as any).shiftType || (((e as any).isNightShift || (e.morningTime || '').startsWith('2')) ? 'NIGHT' : undefined),
            selectedShift: (e as any).selectedShift || (((e as any).isNightShift || (e.morningTime || '').startsWith('2')) ? 'NIGHT' : undefined),
            status: e.status || 'ACTIVE',
            role: (e as any).role || 'Employee',
            baseSalary: (e as any).baseSalary || 0,
            doj: (e as any).doj || new Date(),
            photo: (e as any).photo || null,
            address: (e as any).address || '',
            emergencyContact: (e as any).emergencyContact || '',
            offDays: (e as any).offDays || [],
          })
        }
      }
    }
  } catch {
    // Prisma unavailable — fall through to indestructible persistent storage
  }

  // 2. Indestructible JSON multi-tier merge (reads permanent external vault, sibling versions, and local)
  const allDirs = getAllDataDirs()
  for (const dir of allDirs) {
    for (const filename of ['hr_employees.json', 'hr_employees_backup.json']) {
      const f = path.join(dir, filename)
      const list = safeReadJsonFile<any[]>(f, [])
      if (Array.isArray(list)) {
        for (const emp of list) {
          const key = (emp.employeeId || emp.id || '').toUpperCase().trim()
          if (!key || isEmployeeDeleted(emp, deletedKeys)) continue
          if (!map.has(key)) {
            const mTime = (emp.morningTime || '').trim()
            const eTime = (emp.eveningTime || '').trim()
            const isNight = emp.isNightShift === true ||
              (emp.shiftName && String(emp.shiftName).toLowerCase().includes('night')) ||
              emp.selectedShift === 'NIGHT' ||
              mTime.startsWith('2') || mTime.startsWith('19') || mTime.startsWith('18') ||
              mTime.toLowerCase().includes('pm') ||
              eTime === '08:00' || eTime === '07:00'

            map.set(key, {
              ...emp,
              id: emp.id || key,
              employeeId: emp.employeeId || key,
              morningTime: emp.morningTime || (isNight ? (emp.nightShiftStart || '20:00') : '09:00'),
              eveningTime: emp.eveningTime || (isNight ? (emp.nightShiftEnd || '08:00') : '18:00'),
              dayShiftStart: emp.dayShiftStart || (isNight ? '09:00' : (emp.morningTime || '09:00')),
              dayShiftEnd: emp.dayShiftEnd || (isNight ? '18:00' : (emp.eveningTime || '18:00')),
              nightShiftStart: emp.nightShiftStart || (isNight ? (emp.morningTime || '20:00') : '20:00'),
              nightShiftEnd: emp.nightShiftEnd || (isNight ? (emp.eveningTime || '08:00') : '08:00'),
              swapShiftEligible: emp.swapShiftEligible === true,
              isNightShift: isNight,
              shiftName: emp.shiftName || (isNight ? 'Night Shift' : 'Morning Shift'),
              shiftType: emp.shiftType || (isNight ? 'NIGHT' : 'FIXED'),
              selectedShift: emp.selectedShift || (isNight ? 'NIGHT' : 'MORNING'),
              status: emp.status || 'ACTIVE',
              offDays: emp.offDays || [],
            })
          }
        }
      }
    }
  }

  const result = Array.from(map.values())

  // Self-heal: ensure all directories have the complete list
  if (result.length > 0) {
    try {
      const localPrimary = path.join(process.cwd(), 'data', 'hr_employees.json')
      const currentOnDisk = safeReadJsonFile<any[]>(localPrimary, [])
      if (currentOnDisk.length !== result.length) {
        writeToAllTiers('hr_employees.json', result)
      }
    } catch {}
  }

  return result
}
