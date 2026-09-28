import Link from "next/link";
import { getBranches, getDepartments } from "../../actions";
import AddEmployeeForm from "./AddEmployeeForm";

export const dynamic = 'force-dynamic'

export default async function AddEmployeePage() {
  const [branches, departments] = await Promise.all([
    getBranches().catch(() => []),
    getDepartments().catch(() => []),
  ]);

  return (
    <div className="page-container" style={{ maxWidth: '1080px' }}>
      {/* Breadcrumb & Navigation */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          href="/hr/employees"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: 'var(--text-muted)',
            fontSize: '0.9rem',
            fontWeight: 500,
            textDecoration: 'none',
            marginBottom: '0.75rem',
            transition: 'color 0.15s ease',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back to Employee Directory
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h1
            style={{
              fontSize: 'clamp(1.35rem, 4vw, 1.75rem)',
              fontWeight: 700,
              color: 'var(--text-main)',
              letterSpacing: '-0.025em',
              margin: 0,
            }}
          >
            Add New Employee
          </h1>
          <span
            style={{
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '0.78rem',
              fontWeight: 600,
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              color: 'var(--primary)',
            }}
          >
            Staff Onboarding
          </span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.35rem', marginBottom: 0 }}>
          Create a comprehensive staff profile, assign branch/department, and set shift schedules.
        </p>
      </div>

      {/* Form Card */}
      <AddEmployeeForm branches={branches} departments={departments} />
    </div>
  );
}
