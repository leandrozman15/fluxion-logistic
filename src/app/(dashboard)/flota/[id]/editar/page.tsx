'use client';

import { useParams } from "next/navigation";
import TruckFormWizard from "../../truck-form-wizard";

export default function EditTruckPage() {
  const { id } = useParams();
  return <TruckFormWizard truckId={id as string} />;
}
