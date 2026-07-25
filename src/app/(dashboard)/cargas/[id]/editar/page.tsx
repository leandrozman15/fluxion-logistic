
'use client';

import { useParams } from "next/navigation";
import LoadFormWizard from "../../load-form-wizard";

export default function EditLoadPage() {
  const { id } = useParams();
  return <LoadFormWizard loadId={id as string} />;
}
