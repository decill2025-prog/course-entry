import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Gate } from "@/components/nexus/Gate";
import { Hub } from "@/components/nexus/Hub";
import { registerNexusSW } from "@/lib/register-sw";
import type { Level } from "@/lib/nexus-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FUTES Nexus — Student gate & study digest" },
      { name: "description", content: "Pick your level and course to enter your FUTES study digest, jobs board, timetable and Jarvis assistant — works offline." },
      { property: "og:title", content: "FUTES Nexus — Student gate & study digest" },
      { property: "og:description", content: "A premium offline-ready student hub for FUTES Iyin-Ekiti. Built by MWW Studio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Profile = { level: Level; course: string; faculty: string };
const KEY = "nexus.profile";

function Index() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { const p = localStorage.getItem(KEY); if (p) setProfile(JSON.parse(p)); } catch { /* ignore */ }
    setReady(true);
    registerNexusSW();
  }, []);
  if (!ready) return <div className="min-h-dvh bg-canvas" />;
  if (!profile) return <Gate onEnter={(p) => { localStorage.setItem(KEY, JSON.stringify(p)); setProfile(p); }} />;
  return <Hub profile={profile} onExit={() => { localStorage.removeItem(KEY); setProfile(null); }} />;
}
