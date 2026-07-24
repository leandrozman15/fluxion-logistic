
'use client';

import { useParams } from "next/navigation";
import ClientFormWizard from "../../client-form-wizard";

export default function EditClientPage() {
  const { id } = useParams();
  return <ClientFormWizard clientId={id as string} />;
}
