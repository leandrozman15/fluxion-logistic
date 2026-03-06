import { redirect } from "next/navigation";

export default function RootPage() {
  // Acesso direto ao Dashboard sem passar pelo login
  redirect("/dashboard");
}
