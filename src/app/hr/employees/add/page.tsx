import { getBranches, getDepartments } from "../../actions";
import AddEmployeeForm from "./AddEmployeeForm";

export default async function AddEmployeePage() {
  const branches = await getBranches().catch(() => []);
  const departments = await getDepartments().catch(() => []);

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      <div className="header">
        <div>
          <h1 style={{ color: 'var(--text-main)', marginBottom: '0.25rem' }}>Add New Employee</h1>
          <p>Enter the personal and employment details for the new staff member.</p>
        </div>
      </div>

      <div className="card">
        <AddEmployeeForm branches={branches} departments={departments} />
      </div>
    </div>
  );
}
