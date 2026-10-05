"use client";

import { useEffect, useState } from "react";
import { Building2, Check, UserRound } from "lucide-react";

export default function WorkspaceSettings({ userName, companyName, onSave }: {
  userName: string;
  companyName: string;
  onSave: (userName: string, companyName: string) => void;
}) {
  const [nameDraft, setNameDraft] = useState(userName);
  const [companyDraft, setCompanyDraft] = useState(companyName);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setNameDraft(userName); setCompanyDraft(companyName); }, [userName, companyName]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = nameDraft.trim();
    const company = companyDraft.trim();
    if (!name || !company) { setError("Enter both your name and company name."); setSaved(false); return; }
    onSave(name, company);
    setNameDraft(name);
    setCompanyDraft(company);
    setError("");
    setSaved(true);
  }

  return <div className="content workspace-settings-content">
    <div className="page-heading"><div><div className="eyebrow">WORKSPACE PREFERENCES</div><h1>Settings</h1><p>Update the name shown on your profile and across your workspace.</p></div></div>
    <form className="workspace-settings-form" onSubmit={submit}>
      <section className="card settings-card">
        <div className="settings-card-heading"><span className="settings-icon"><UserRound size={17}/></span><div><h2>Your profile</h2><p>This name appears beside your activity and account profile.</p></div></div>
        <label className="settings-field">Your name<input autoComplete="name" maxLength={60} value={nameDraft} onChange={event => { setNameDraft(event.target.value); setSaved(false); }} placeholder="Enter your name" /></label>
      </section>
      <section className="card settings-card">
        <div className="settings-card-heading"><span className="settings-icon"><Building2 size={17}/></span><div><h2>Company</h2><p>Your company name appears in the workspace switcher and sales data overview.</p></div></div>
        <label className="settings-field">Company name<input autoComplete="organization" maxLength={100} value={companyDraft} onChange={event => { setCompanyDraft(event.target.value); setSaved(false); }} placeholder="Enter your company name" /></label>
      </section>
      <div className="settings-form-footer">{error ? <span className="settings-error" role="alert">{error}</span> : saved ? <span className="settings-saved" role="status"><Check size={14}/> Changes saved</span> : <span className="settings-storage-note">Saved in this browser for this demo workspace.</span>}<button className="primary-button" type="submit">Save changes</button></div>
    </form>
  </div>;
}
