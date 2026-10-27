import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <div className="mx-auto max-w-sm rounded-lg border border-stone-200 bg-white p-6">
      <h1 className="text-lg font-bold">管理登录</h1>
      <p className="mt-1 text-sm text-stone-500">口令在服务器的 .env 里配置（ADMIN_PASSWORD）。</p>
      <div className="mt-4">
        <LoginForm />
      </div>
    </div>
  );
}
