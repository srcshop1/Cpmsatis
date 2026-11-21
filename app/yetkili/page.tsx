"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth/auth-provider";
import {
  BellIcon,
  CheckIcon,
  ClockIcon,
  FlagIcon,
  ShieldIcon,
  StarIcon,
  UsersIcon,
  XIcon,
} from "@/components/icons";
import { Spinner } from "@/components/ui/spinner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { myStaffRole } from "@/lib/social";
import { StaffBadge, VerifiedTick } from "@/components/user-badge";
import { formatPrice } from "@/lib/catalog";

type Tab =
  | "tickets"
  | "applications"
  | "featured"
  | "reports"
  | "listings"
  | "members"
  | "sales"
  | "tags"
  | "roles"
  | "announce"
  | "announcements"
  | "stats";

const TABS: { key: Tab; label: string; ownerOnly?: boolean }[] = [
  { key: "tickets", label: "Destek" },
  { key: "applications", label: "Onaylı Satıcı" },
  { key: "featured", label: "Öne Çıkar" },
  { key: "reports", label: "Bildiriler" },
  { key: "listings", label: "İlanlar" },
  { key: "members", label: "Üyeler" },
  { key: "sales", label: "Satışlar" },
  { key: "tags", label: "Tag Ver" },
  { key: "roles", label: "Moderatör", ownerOnly: true },
  { key: "announce", label: "Duyuru Yaz", ownerOnly: true },
  { key: "announcements", label: "Duyurular" },
  { key: "stats", label: "İstatistik" },
];

type Ticket = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
};

type Application = {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
};

type FeaturedRequest = {
  id: string;
  listing_id: string;
  seller_id: string;
  days: number;
  status: string;
  created_at: string;
};

type Report = {
  id: string;
  reporter_id: string;
  reported_id: string | null;
  conversation_id: string | null;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
};

type ProfileRow = { id: string; username: string; email: string | null; sales_count: number | null };

type ListingRow = {
  id: string;
  title: string;
  price: number;
  status: string;
  featured_until: string | null;
  categories: string[] | null;
  seller_id: string;
  created_at: string;
};

type MemberRow = {
  id: string;
  username: string;
  email: string | null;
  sales_count: number | null;
  verified_seller: boolean | null;
  staff_tag: string | null;
  banned: boolean | null;
  created_at: string;
};

type AnnouncementRow = { id: string; title: string; body: string; created_at: string };

type SaleRow = {
  id: string;
  listing_id: string;
  seller_id: string;
  buyer_id: string;
  status: string;
  created_at: string;
};

export default function AdminPage() {
  const { user } = useAuth();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [role, setRole] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>("tickets");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [featured, setFeatured] = useState<FeaturedRequest[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [salesRows, setSalesRows] = useState<SaleRow[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [tagQuery, setTagQuery] = useState("");
  const [tagChoice, setTagChoice] = useState("vip");
  const [roleQuery, setRoleQuery] = useState("");
  const [roleChoice, setRoleChoice] = useState("moderator");
  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceBody, setAnnounceBody] = useState("");
  const [stats, setStats] = useState<Record<string, number>>({});

  const loadProfiles = useCallback(
    async (ids: string[]) => {
      if (!supabase || ids.length === 0) return;
      const { data } = await supabase
        .from("profiles")
        .select("id, username, email, sales_count")
        .in("id", Array.from(new Set(ids)));
      const map: Record<string, ProfileRow> = {};
      for (const row of (data ?? []) as ProfileRow[]) map[row.id] = row;
      setProfiles((prev) => ({ ...prev, ...map }));
    },
    [supabase],
  );

  useEffect(() => {
    if (!supabase || !user) return;
    void myStaffRole(supabase).then((value) => {
      setRole(value);
      setChecking(false);
    });
  }, [supabase, user]);

  const loadTab = useCallback(async () => {
    if (!supabase) return;

    if (tab === "tickets") {
      const { data } = await supabase
        .from("support_tickets")
        .select("id, user_id, title, description, status, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      const rows = (data ?? []) as Ticket[];
      setTickets(rows);
      await loadProfiles(rows.map((row) => row.user_id));
    }

    if (tab === "applications") {
      const { data } = await supabase
        .from("seller_applications")
        .select("id, user_id, status, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      const rows = (data ?? []) as Application[];
      setApplications(rows);
      await loadProfiles(rows.map((row) => row.user_id));
    }

    if (tab === "featured") {
      const { data } = await supabase
        .from("featured_requests")
        .select("id, listing_id, seller_id, days, status, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      const rows = (data ?? []) as FeaturedRequest[];
      setFeatured(rows);
      await loadProfiles(rows.map((row) => row.seller_id));
    }

    if (tab === "reports") {
      const { data } = await supabase
        .from("reports")
        .select("id, reporter_id, reported_id, conversation_id, reason, details, status, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      const rows = (data ?? []) as Report[];
      setReports(rows);
      await loadProfiles(
        rows.flatMap((row) => [row.reporter_id, row.reported_id].filter(Boolean) as string[]),
      );
    }

    if (tab === "listings") {
      let { data, error } = await supabase
        .from("listings")
        .select("id, title, price, status, featured_until, categories, seller_id, created_at")
        .order("created_at", { ascending: false })
        .limit(40);

      if (error) {
        const retry = await supabase
          .from("listings")
          .select("id, title, price, status, featured_until, category, seller_id, created_at")
          .order("created_at", { ascending: false })
          .limit(40);
        data = retry.data as typeof data;
      }

      const rows = (data ?? []) as unknown as ListingRow[];
      setListings(rows);
      await loadProfiles(rows.map((row) => row.seller_id));
    }

    if (tab === "members") {
      let { data, error } = await supabase
        .from("profiles")
        .select("id, username, email, sales_count, verified_seller, staff_tag, banned, created_at")
        .order("created_at", { ascending: false })
        .limit(80);

      if (error) {
        const retry = await supabase
          .from("profiles")
          .select("id, username, email, sales_count, verified_seller, created_at")
          .order("created_at", { ascending: false })
          .limit(80);
        data = retry.data as typeof data;
      }

      setMembers((data ?? []) as unknown as MemberRow[]);
    }

    if (tab === "sales") {
      const { data } = await supabase
        .from("sales")
        .select("id, listing_id, seller_id, buyer_id, status, created_at")
        .order("created_at", { ascending: false })
        .limit(40);
      const rows = (data ?? []) as SaleRow[];
      setSalesRows(rows);
      await loadProfiles(rows.flatMap((row) => [row.seller_id, row.buyer_id]));
    }

    if (tab === "announcements") {
      const { data } = await supabase
        .from("announcements")
        .select("id, title, body, created_at")
        .order("created_at", { ascending: false })
        .limit(40);
      setAnnouncements((data ?? []) as AnnouncementRow[]);
    }

    if (tab === "stats") {
      const [{ count: userCount }, { count: listingCount }, { count: saleCount }, { count: ticketCount }] =
        await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("listings").select("id", { count: "exact", head: true }),
          supabase.from("sales").select("id", { count: "exact", head: true }),
          supabase.from("support_tickets").select("id", { count: "exact", head: true }),
        ]);
      setStats({
        users: userCount ?? 0,
        listings: listingCount ?? 0,
        sales: saleCount ?? 0,
        tickets: ticketCount ?? 0,
      });
    }
  }, [supabase, tab, loadProfiles]);

  useEffect(() => {
    if (role) void loadTab();
  }, [role, loadTab]);

  async function updateTicket(id: string, status: string) {
    if (!supabase) return;
    setBusy(id);
    await supabase.from("support_tickets").update({ status }).eq("id", id);
    setBusy(null);
    await loadTab();
  }

  async function decideApplication(application: Application, approve: boolean) {
    if (!supabase) return;
    setBusy(application.id);
    await supabase
      .from("seller_applications")
      .update({ status: approve ? "approved" : "rejected" })
      .eq("id", application.id);

    if (approve) {
      await supabase.rpc("admin_set_tag", {
        p_user: application.user_id,
        p_tag: "verified_seller",
        p_remove: false,
      });
    }

    setBusy(null);
    setNotice(approve ? "Başvuru onaylandı, Onaylı Satıcı tag'i verildi." : "Başvuru reddedildi.");
    await loadTab();
  }

  async function decideFeatured(request: FeaturedRequest, approve: boolean) {
    if (!supabase) return;
    setBusy(request.id);
    await supabase
      .from("featured_requests")
      .update({ status: approve ? "approved" : "rejected" })
      .eq("id", request.id);

    if (approve) {
      const until = new Date(Date.now() + request.days * 86400000).toISOString();
      await supabase.from("listings").update({ featured_until: until }).eq("id", request.listing_id);
    }

    setBusy(null);
    setNotice(approve ? "İlan öne çıkarıldı." : "Talep reddedildi.");
    await loadTab();
  }

  async function updateReport(id: string, status: string) {
    if (!supabase) return;
    setBusy(id);
    await supabase.from("reports").update({ status }).eq("id", id);
    setBusy(null);
    await loadTab();
  }

  async function adminListing(
    id: string,
    action: "feature1" | "feature3" | "feature7" | "hide" | "active" | "delete",
  ) {
    if (!supabase) return;
    setBusy(id);
    setNotice(null);

    let message = "İşlem tamam.";
    let errorText: string | null = null;

    if (action === "delete") {
      const { error } = await supabase.from("listings").delete().eq("id", id);
      errorText = error?.message ?? null;
      message = "İlan silindi.";
    } else if (action === "hide" || action === "active") {
      const { error } = await supabase.rpc("admin_set_listing_status", {
        p_listing: id,
        p_status: action === "hide" ? "hidden" : "active",
      });
      errorText = error?.message ?? null;
      message = action === "hide" ? "İlan gizlendi." : "İlan yayına alındı.";
    } else {
      const days = Number(action.replace("feature", ""));
      const { error } = await supabase.rpc("admin_feature_listing", {
        p_listing: id,
        p_days: days,
      });
      errorText = error?.message ?? null;
      message = `İlan ${days} gün öne çıkarıldı.`;
    }

    setBusy(null);
    setNotice(errorText ? `Hata: ${errorText}` : message);
    await loadTab();
  }

  async function adminMember(
    userId: string,
    action: "ban" | "unban" | "delete" | "demote",
  ) {
    if (!supabase) return;
    setBusy(userId);
    setNotice(null);

    let errorText: string | null = null;
    let message = "İşlem tamam.";

    if (action === "delete") {
      if (!window.confirm("Bu hesabı ve tüm ilanlarını silmek istediğine emin misin?")) {
        setBusy(null);
        return;
      }
      const { error } = await supabase.rpc("admin_delete_account", { p_user: userId });
      errorText = error?.message ?? null;
      message = "Hesap silindi.";
    } else if (action === "demote") {
      const { error } = await supabase.rpc("admin_remove_role", { p_user: userId });
      errorText = error?.message ?? null;
      message = "Yetki kaldırıldı.";
    } else {
      const { error } = await supabase.rpc("admin_set_banned", {
        p_user: userId,
        p_banned: action === "ban",
      });
      errorText = error?.message ?? null;
      message = action === "ban" ? "Kullanıcı banlandı." : "Ban kaldırıldı.";
    }

    setBusy(null);
    setNotice(errorText ? `Hata: ${errorText}` : message);
    await loadTab();
  }

  async function tagMember(userId: string, tag: string, remove: boolean) {
    if (!supabase) return;
    setBusy(`${userId}-${tag}`);
    setNotice(null);

    const { error } = await supabase.rpc("admin_set_tag", {
      p_user: userId,
      p_tag: tag,
      p_remove: remove,
    });

    let errorText: string | null = error?.message ?? null;

    // Fonksiyon yoksa doğrudan tabloya yaz (çift kayıt güvenli)
    if (errorText && /could not find the function|schema cache|does not exist/i.test(errorText)) {
      const fallback = remove
        ? await supabase.from("user_tags").delete().eq("user_id", userId).eq("tag", tag)
        : await supabase.from("user_tags").upsert(
            { user_id: userId, tag, granted_by: user?.id ?? null },
            { onConflict: "user_id,tag", ignoreDuplicates: true },
          );
      errorText = fallback.error?.message ?? null;
      if (!errorText && tag === "verified_seller") {
        await supabase
          .from("profiles")
          .update({ verified_seller: !remove })
          .eq("id", userId);
      }
    }

    setBusy(null);
    setNotice(
      errorText
        ? `Hata: ${errorText} — Supabase'de supabase/HEPSI.sql dosyasını çalıştır.`
        : `${remove ? "Kaldırıldı" : "Verildi"}: ${tag}`,
    );
    await loadTab();
  }

  async function setMemberRole(userId: string, role: string) {
    if (!supabase) return;
    setBusy(`${userId}-role`);
    setNotice(null);
    const { error } = await supabase.rpc("admin_set_role", { p_user: userId, p_role: role });
    setBusy(null);
    setNotice(error ? `Hata: ${error.message}` : `Rol verildi: ${role}`);
    await loadTab();
  }

  async function findProfile(query: string) {
    if (!supabase) return null;
    const value = query.trim();
    if (!value) return null;

    const { data } = await supabase
      .from("profiles")
      .select("id, username, email")
      .or(`username.ilike.${value},email.ilike.${value}`)
      .limit(1)
      .maybeSingle();

    return (data as ProfileRow | null) ?? null;
  }

  async function grantTag(remove: boolean) {
    if (!supabase) return;
    setNotice(null);
    const profile = await findProfile(tagQuery);
    if (!profile) {
      setNotice("Kullanıcı bulunamadı.");
      return;
    }
    setBusy("tag");
    const { error } = await supabase.rpc("admin_set_tag", {
      p_user: profile.id,
      p_tag: tagChoice,
      p_remove: remove,
    });

    // Fonksiyon veritabanında yoksa (şema çalıştırılmamış) doğrudan tabloya yaz
    if (error && /could not find the function|schema cache|does not exist/i.test(error.message)) {
      const fallback = remove
        ? await supabase.from("user_tags").delete().eq("user_id", profile.id).eq("tag", tagChoice)
        : await supabase.from("user_tags").upsert(
            { user_id: profile.id, tag: tagChoice, granted_by: user?.id ?? null },
            { onConflict: "user_id,tag", ignoreDuplicates: true },
          );

      setBusy(null);
      if (fallback.error) {
        setNotice(
          `Tag kaydedilemedi. Supabase → SQL Editor'de supabase/onarim.sql dosyasını çalıştır. (${fallback.error.message})`,
        );
        return;
      }
      if (tagChoice === "verified_seller") {
        await supabase
          .from("profiles")
          .update({ verified_seller: !remove })
          .eq("id", profile.id);
      }
      setNotice(
        `${remove ? "Kaldırıldı" : "Verildi"}: @${profile.username} → ${tagChoice} (yedek yol kullanıldı)`,
      );
      return;
    }

    setBusy(null);
    setNotice(
      error
        ? `Hata: ${error.message} — Supabase → SQL Editor'de supabase/onarim.sql çalıştır.`
        : `${remove ? "Kaldırıldı" : "Verildi"}: @${profile.username} → ${tagChoice}`,
    );
  }

  async function assignRole() {
    if (!supabase) return;
    setNotice(null);
    const profile = await findProfile(roleQuery);
    if (!profile) {
      setNotice("Kullanıcı bulunamadı.");
      return;
    }
    setBusy("role");
    const { error } = await supabase.rpc("admin_set_role", {
      p_user: profile.id,
      p_role: roleChoice,
    });
    setBusy(null);
    setNotice(
      error
        ? `Hata: ${error.message} — Supabase → SQL Editor'de supabase/onarim.sql çalıştır.`
        : `@${profile.username} artık ${roleChoice}.`,
    );
  }

  async function publishAnnouncement() {
    if (!supabase) return;
    if (announceTitle.trim().length < 3 || announceBody.trim().length < 5) {
      setNotice("Başlık ve duyuru metni gerekli.");
      return;
    }
    setBusy("announce");
    const { error } = await supabase.from("announcements").insert({
      title: announceTitle.trim(),
      body: announceBody.trim(),
      created_by: user?.id ?? null,
    });
    setBusy(null);
    if (error) {
      setNotice(error.message);
      return;
    }
    setAnnounceTitle("");
    setAnnounceBody("");
    setNotice("Duyuru yayınlandı.");
  }

  if (checking) {
    return (
      <AppShell>
        <p className="text-sm text-muted-2">Yetki kontrol ediliyor…</p>
      </AppShell>
    );
  }

  if (!role) {
    return (
      <AppShell>
        <div className="card mx-auto mt-8 max-w-md px-6 py-12 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-danger/30 bg-danger/10 text-danger">
            <ShieldIcon width={26} height={26} />
          </span>
          <h1 className="mt-4 text-base font-bold">Yetkin yok</h1>
          <p className="mt-1.5 text-sm text-muted-2">
            Bu alan yalnızca kurucu ve moderatörlere açıktır.
          </p>
          <Link href="/diger" className="btn btn-ghost mt-4 h-10 px-4 text-sm">
            Diğer&apos;e dön
          </Link>
        </div>
      </AppShell>
    );
  }

  const visibleTabs = TABS.filter((item) => !item.ownerOnly || role === "owner");

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Yetkili Paneli</h1>
          <p className="mt-1 text-xs text-muted-2 sm:text-sm">
            {role === "owner" ? "Kurucu yetkisi" : "Moderatör yetkisi"} · @{user?.username}
          </p>
        </div>
        <span className="badge border border-accent/30 bg-accent/10 text-accent">
          <ShieldIcon width={12} height={12} /> {role === "owner" ? "KURUCU" : "MODERATÖR"}
        </span>
      </div>

      {notice && (
        <div className="mt-3 rounded-xl border border-line bg-white/4 px-3.5 py-2.5 text-xs text-muted">
          {notice}
        </div>
      )}

      <div className="mt-4 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {visibleTabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`chip whitespace-nowrap ${tab === item.key ? "chip-active" : ""}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {tab === "tickets" && (
          <>
            {tickets.length === 0 && <Empty text="Destek talebi yok." />}
            {tickets.map((ticket) => (
              <div key={ticket.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{ticket.title}</p>
                    <p className="mt-0.5 text-[0.68rem] text-muted-2">
                      @{profiles[ticket.user_id]?.username ?? "kullanıcı"} ·{" "}
                      {new Date(ticket.created_at).toLocaleString("tr-TR")}
                    </p>
                  </div>
                  <span className="badge shrink-0 border border-line bg-white/4 text-[0.6rem] text-muted">
                    {ticket.status}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[0.78rem] leading-relaxed text-muted">
                  {ticket.description}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateTicket(ticket.id, "reviewing")}
                    disabled={busy === ticket.id}
                    className="btn btn-ghost h-8 px-3 text-[0.7rem]"
                  >
                    İnceleniyor
                  </button>
                  <button
                    type="button"
                    onClick={() => updateTicket(ticket.id, "closed")}
                    disabled={busy === ticket.id}
                    className="btn btn-primary h-8 px-3 text-[0.7rem]"
                  >
                    {busy === ticket.id ? <Spinner /> : "Kapat"}
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === "applications" && (
          <>
            {applications.length === 0 && <Empty text="Bekleyen başvuru yok." />}
            {applications.map((application) => (
              <div key={application.id} className="card flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    @{profiles[application.user_id]?.username ?? "kullanıcı"}
                  </p>
                  <p className="text-[0.68rem] text-muted-2">
                    {profiles[application.user_id]?.sales_count ?? 0} başarılı işlem ·{" "}
                    {application.status}
                  </p>
                </div>
                {application.status === "pending" ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => decideApplication(application, false)}
                      disabled={busy === application.id}
                      className="btn btn-ghost h-8 px-3 text-[0.7rem]"
                    >
                      <XIcon width={12} height={12} /> Reddet
                    </button>
                    <button
                      type="button"
                      onClick={() => decideApplication(application, true)}
                      disabled={busy === application.id}
                      className="btn btn-primary h-8 px-3 text-[0.7rem]"
                    >
                      {busy === application.id ? <Spinner /> : <><CheckIcon width={12} height={12} /> Onayla</>}
                    </button>
                  </div>
                ) : (
                  <span className="badge border border-line bg-white/4 text-[0.6rem] text-muted">
                    {application.status}
                  </span>
                )}
              </div>
            ))}
          </>
        )}

        {tab === "featured" && (
          <>
            {featured.length === 0 && <Empty text="Öne çıkarma talebi yok." />}
            {featured.map((request) => (
              <div key={request.id} className="card flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    @{profiles[request.seller_id]?.username ?? "satıcı"} · {request.days} gün
                  </p>
                  <Link
                    href={`/ilan/goruntule?id=${request.listing_id}`}
                    className="text-[0.68rem] text-accent hover:underline"
                  >
                    İlanı görüntüle
                  </Link>
                </div>
                {request.status === "pending" ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => decideFeatured(request, false)}
                      disabled={busy === request.id}
                      className="btn btn-ghost h-8 px-3 text-[0.7rem]"
                    >
                      Reddet
                    </button>
                    <button
                      type="button"
                      onClick={() => decideFeatured(request, true)}
                      disabled={busy === request.id}
                      className="btn btn-primary h-8 px-3 text-[0.7rem]"
                    >
                      {busy === request.id ? <Spinner /> : <><StarIcon width={12} height={12} /> Öne çıkar</>}
                    </button>
                  </div>
                ) : (
                  <span className="badge border border-line bg-white/4 text-[0.6rem] text-muted">
                    {request.status}
                  </span>
                )}
              </div>
            ))}
          </>
        )}

        {tab === "reports" && (
          <>
            {reports.length === 0 && <Empty text="Bildiri yok." />}
            {reports.map((report) => (
              <div key={report.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      <FlagIcon width={14} height={14} className="text-danger" /> {report.reason}
                    </p>
                    <p className="mt-0.5 text-[0.68rem] text-muted-2">
                      Bildiren: @{profiles[report.reporter_id]?.username ?? "?"} · Şikayet edilen:{" "}
                      {report.reported_id
                        ? `@${profiles[report.reported_id]?.username ?? "?"}`
                        : "—"}
                    </p>
                  </div>
                  <span className="badge shrink-0 border border-line bg-white/4 text-[0.6rem] text-muted">
                    {report.status}
                  </span>
                </div>
                {report.details && (
                  <p className="mt-2 whitespace-pre-wrap text-[0.78rem] leading-relaxed text-muted">
                    {report.details}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {report.conversation_id && (
                    <Link
                      href={`/mesajlar/sohbet?id=${report.conversation_id}`}
                      className="btn btn-ghost h-8 px-3 text-[0.7rem]"
                    >
                      Sohbeti incele
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => updateReport(report.id, "reviewed")}
                    disabled={busy === report.id}
                    className="btn btn-ghost h-8 px-3 text-[0.7rem]"
                  >
                    İncelendi
                  </button>
                  <button
                    type="button"
                    onClick={() => updateReport(report.id, "closed")}
                    disabled={busy === report.id}
                    className="btn btn-primary h-8 px-3 text-[0.7rem]"
                  >
                    Kapat
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === "listings" && (
          <>
            {listings.length === 0 && <Empty text="İlan yok." />}
            {listings.map((item) => {
              const featured =
                item.featured_until && new Date(item.featured_until) > new Date();
              return (
                <div key={item.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/ilan/goruntule?id=${item.id}`}
                        className="line-clamp-1 text-sm font-semibold hover:text-accent"
                      >
                        {item.title}
                      </Link>
                      <p className="mt-0.5 text-[0.68rem] text-muted-2">
                        @{profiles[item.seller_id]?.username ?? "satıcı"} ·{" "}
                        {formatPrice(Number(item.price))} ·{" "}
                        {new Date(item.created_at).toLocaleDateString("tr-TR")}
                      </p>
                    </div>
                    <span
                      className={`badge shrink-0 border text-[0.58rem] ${
                        item.status === "active"
                          ? "border-mint/30 bg-mint/10 text-mint"
                          : "border-line bg-white/5 text-muted"
                      }`}
                    >
                      {item.status === "active" ? "yayında" : item.status}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[1, 3, 7].map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() =>
                          adminListing(
                            item.id,
                            day === 1 ? "feature1" : day === 3 ? "feature3" : "feature7",
                          )
                        }
                        disabled={busy === item.id}
                        className="chip px-2 py-1 text-[0.65rem]"
                      >
                        {day} gün öne çıkar
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => adminListing(item.id, item.status === "active" ? "hide" : "active")}
                      disabled={busy === item.id}
                      className="chip px-2 py-1 text-[0.65rem]"
                    >
                      {item.status === "active" ? "Gizle" : "Yayına al"}
                    </button>
                    <button
                      type="button"
                      onClick={() => adminListing(item.id, "delete")}
                      disabled={busy === item.id}
                      className="chip border-danger/40 bg-danger/10 px-2 py-1 text-[0.65rem] text-[#ffb3bb]"
                    >
                      Sil
                    </button>
                    {featured && (
                      <span className="self-center text-[0.6rem] text-accent">
                        öne çıkan · {new Date(item.featured_until!).toLocaleDateString("tr-TR")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {tab === "members" && (
          <>
            <input
              className="field"
              value={memberQuery}
              onChange={(event) => setMemberQuery(event.target.value)}
              placeholder="Üye ara (kullanıcı adı)"
            />
            {members.length === 0 && <Empty text="Üye yok." />}
            {members
              .filter((member) =>
                member.username
                  .toLocaleLowerCase("tr")
                  .includes(memberQuery.trim().toLocaleLowerCase("tr")),
              )
              .map((member) => (
                <div key={member.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                        @{member.username}
                        {member.verified_seller && <VerifiedTick size={13} />}
                        {member.staff_tag && <StaffBadge tag={member.staff_tag} small />}
                        {member.banned && (
                          <span className="badge border border-danger/40 bg-danger/10 text-[0.55rem] text-danger">
                            BANLI
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-[0.68rem] text-muted-2">
                        {member.email ?? "e-posta yok"} · {member.sales_count ?? 0} işlem ·{" "}
                        {new Date(member.created_at).toLocaleDateString("tr-TR")}
                      </p>
                    </div>
                    <Link
                      href={`/ilanlar?q=${encodeURIComponent(member.username)}`}
                      className="shrink-0 text-[0.65rem] text-accent hover:underline"
                    >
                      İlanları
                    </Link>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        tagMember(member.id, "verified_seller", Boolean(member.verified_seller))
                      }
                      disabled={busy === `${member.id}-verified_seller`}
                      className="chip px-2 py-1 text-[0.65rem]"
                    >
                      {member.verified_seller ? "Onaylı satıcıyı kaldır" : "Onaylı Satıcı yap"}
                    </button>
                    <button
                      type="button"
                      onClick={() => tagMember(member.id, "vip", false)}
                      disabled={busy === `${member.id}-vip`}
                      className="chip px-2 py-1 text-[0.65rem]"
                    >
                      VIP ver
                    </button>
                    <button
                      type="button"
                      onClick={() => tagMember(member.id, "premium", false)}
                      disabled={busy === `${member.id}-premium`}
                      className="chip px-2 py-1 text-[0.65rem]"
                    >
                      Premium ver
                    </button>
                    <button
                      type="button"
                      onClick={() => adminMember(member.id, member.banned ? "unban" : "ban")}
                      disabled={busy === member.id}
                      className="chip px-2 py-1 text-[0.65rem]"
                    >
                      {member.banned ? "Banı kaldır" : "Banla"}
                    </button>
                    {role === "owner" && (
                      <>
                        <button
                          type="button"
                          onClick={() => setMemberRole(member.id, "moderator")}
                          disabled={busy === `${member.id}-role`}
                          className="chip px-2 py-1 text-[0.65rem]"
                        >
                          Moderatör yap
                        </button>
                        {member.staff_tag === "moderator" && (
                          <button
                            type="button"
                            onClick={() => adminMember(member.id, "demote")}
                            disabled={busy === member.id}
                            className="chip px-2 py-1 text-[0.65rem]"
                          >
                            Yetkiyi al
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => adminMember(member.id, "delete")}
                          disabled={busy === member.id}
                          className="chip border-danger/40 bg-danger/10 px-2 py-1 text-[0.65rem] text-[#ffb3bb]"
                        >
                          Hesabı sil
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
          </>
        )}

        {tab === "sales" && (
          <>
            {salesRows.length === 0 && <Empty text="Satış kaydı yok." />}
            {salesRows.map((sale) => (
              <div key={sale.id} className="card flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    @{profiles[sale.seller_id]?.username ?? "satıcı"} →{" "}
                    @{profiles[sale.buyer_id]?.username ?? "alıcı"}
                  </p>
                  <p className="text-[0.68rem] text-muted-2">
                    {new Date(sale.created_at).toLocaleString("tr-TR")} · {sale.status}
                  </p>
                </div>
                <Link
                  href={`/ilan/goruntule?id=${sale.listing_id}`}
                  className="text-[0.68rem] text-accent hover:underline"
                >
                  İlan
                </Link>
              </div>
            ))}
          </>
        )}

        {tab === "announcements" && (
          <>
            {announcements.length === 0 && <Empty text="Duyuru yok." />}
            {announcements.map((announcement) => (
              <div key={announcement.id} className="card p-4">
                <p className="flex items-center justify-between gap-2 text-sm font-semibold">
                  <span className="truncate">{announcement.title}</span>
                  <span className="shrink-0 text-[0.62rem] text-muted-2">
                    {new Date(announcement.created_at).toLocaleDateString("tr-TR")}
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-[0.78rem] leading-relaxed text-muted">
                  {announcement.body}
                </p>
              </div>
            ))}
          </>
        )}

        {tab === "tags" && (
          <div className="card p-4">
            <h2 className="text-sm font-bold">Tag Ver / Al</h2>
            <p className="mt-1 text-[0.7rem] text-muted-2">
              Kullanıcı adı veya e-posta yaz, tag seç. Kurucu rolü buradan verilmez.
            </p>
            <input
              className="field mt-3"
              value={tagQuery}
              onChange={(event) => setTagQuery(event.target.value)}
              placeholder="kullanıcı adı veya e-posta"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["vip", "premium", "verified_seller"].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTagChoice(tag)}
                  className={`chip ${tagChoice === tag ? "chip-active" : ""}`}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => grantTag(false)}
                disabled={busy === "tag"}
                className="btn btn-primary h-10 flex-1 text-sm"
              >
                {busy === "tag" ? <Spinner /> : "Tag Ver"}
              </button>
              <button
                type="button"
                onClick={() => grantTag(true)}
                disabled={busy === "tag"}
                className="btn btn-ghost h-10 flex-1 text-sm"
              >
                Tag Kaldır
              </button>
            </div>
          </div>
        )}

        {tab === "roles" && role === "owner" && (
          <div className="card p-4">
            <h2 className="text-sm font-bold">Moderatör Ata</h2>
            <p className="mt-1 text-[0.7rem] text-muted-2">
              Sadece kurucu rol verebilir. Atanan kişi yetkili panelini görebilir.
            </p>
            <input
              className="field mt-3"
              value={roleQuery}
              onChange={(event) => setRoleQuery(event.target.value)}
              placeholder="kullanıcı adı veya e-posta"
            />
            <div className="mt-2 flex gap-1.5">
              {["moderator", "owner"].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRoleChoice(value)}
                  className={`chip ${roleChoice === value ? "chip-active" : ""}`}
                >
                  {value === "owner" ? "Kurucu" : "Moderatör"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={assignRole}
              disabled={busy === "role"}
              className="btn btn-primary mt-3 h-10 w-full text-sm"
            >
              {busy === "role" ? <Spinner /> : "Rolü Ver"}
            </button>
          </div>
        )}

        {tab === "announce" && role === "owner" && (
          <div className="card p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <BellIcon width={15} height={15} className="text-accent" /> Genel Duyuru
            </h2>
            <input
              className="field mt-3"
              value={announceTitle}
              onChange={(event) => setAnnounceTitle(event.target.value)}
              placeholder="Duyuru başlığı"
              maxLength={120}
            />
            <textarea
              className="field mt-2 min-h-24 resize-y"
              value={announceBody}
              onChange={(event) => setAnnounceBody(event.target.value)}
              placeholder="Duyuru metni"
              maxLength={2000}
            />
            <button
              type="button"
              onClick={publishAnnouncement}
              disabled={busy === "announce"}
              className="btn btn-primary mt-3 h-10 w-full text-sm"
            >
              {busy === "announce" ? <Spinner /> : "Duyuruyu Yayınla"}
            </button>
          </div>
        )}

        {tab === "stats" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Kullanıcı", value: stats.users, icon: <UsersIcon width={16} height={16} /> },
              { label: "İlan", value: stats.listings, icon: <StarIcon width={16} height={16} /> },
              { label: "Satış", value: stats.sales, icon: <CheckIcon width={16} height={16} /> },
              { label: "Destek", value: stats.tickets, icon: <ClockIcon width={16} height={16} /> },
            ].map((item) => (
              <div key={item.label} className="card p-4">
                <span className="text-accent">{item.icon}</span>
                <p className="mt-2 text-xl font-extrabold">{item.value ?? 0}</p>
                <p className="text-[0.68rem] text-muted-2">{item.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="card px-5 py-10 text-center text-sm text-muted-2">{text}</div>
  );
}
