import { getBranches, getDepartments } from "../../actions";
import AddEmployeeForm from "./AddEmployeeForm";

export default async function AddEmployeePage() {
  const branches = await getBranches().catch(() => []);
  const departments = await getDepartments().catch(() => []);

  return (
    <div className="p-6 max-w-4xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Add New Employee</h1>
        <p className="text-muted-foreground mt-1 text-sm text-gray-500">
          Enter the personal and employment details for the new staff member.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <AddEmployeeForm branches={branches} departments={departments} />
      </div>
    </div>
  );
}
