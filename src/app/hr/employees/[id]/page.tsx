import { getBranches, getDepartments, getEmployeeById } from "../../actions";
import { notFound } from "next/navigation";
import EditEmployeeForm from "./EditEmployeeForm";

export default async function EditEmployeePage({ params }: { params: { id: string } }) {
  const branches = await getBranches().catch(() => []);
  const departments = await getDepartments().catch(() => []);
  const employee = await getEmployeeById(params.id).catch(() => null);

  if (!employee) {
    notFound();
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      <div className="header">
        <div>
          <h1 style={{ color: 'var(--text-main)', marginBottom: '0.25rem' }}>Edit Employee</h1>
          <p>Update the personal and employment details for this staff member.</p>
        </div>
      </div>

      <div className="card">
        <EditEmployeeForm branches={branches} departments={departments} employee={employee} />
      </div>
    </div>
  );
}
