import Link from "next/link";
import { MaintenanceNotice } from "@/components/MaintenanceNotice";

export default function MaintenancePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">网站维护中</h1>
      <MaintenanceNotice />
      <Link href="/feedback" className="block w-full rounded-md bg-stone-900 px-4 py-3 text-center text-[17px] text-white">
        我想加入 / 联系站长
      </Link>
    </div>
  );
}
