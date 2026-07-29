
'use client';

import { useParams } from "next/navigation";
import ProductFormWizard from "../../product-form-wizard";

export default function EditProductPage() {
  const { id } = useParams();
  return <ProductFormWizard productId={id as string} />;
}
