import Link from "next/link";
import { isAdminFromCookies } from "@/lib/auth";
import { LoginForm } from "@/components/settings/LoginForm";
import { SettingsPanel } from "@/components/settings/SettingsPanel";

export const dynamic = "force-dynamic";

export const metadata = { title: "ethfund · settings" };

export default async function SettingsPage() {
  const admin = await isAdminFromCookies();
  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">
          <h1>ethfund</h1>
          <span className="tag">scanner settings</span>
        </div>
        <div className="nav">
          <Link href="/">← Dashboard</Link>
        </div>
      </div>
      {admin ? <SettingsPanel /> : <LoginForm />}
    </div>
  );
}
