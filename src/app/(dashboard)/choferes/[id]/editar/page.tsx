
'use client';

import { useParams } from "next/navigation";
import DriverFormWizard from "../../driver-form-wizard";

export default function EditDriverPage() {
  const { id } = useParams();
  return <DriverFormWizard driverId={id as string} />;
}
