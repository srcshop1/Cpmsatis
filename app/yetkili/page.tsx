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
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { MemberDetail } from "@/components/admin/member-detail";
import { MemberSearch, type MemberHit } from "@/components/admin/member-search";
import { deleteAccountAsStaff, purgeOrphanAccounts } from "@/lib/admin";
import { BanDialog } from "@/components/admin/ban-dialog";
import { BADGES, badgeLabel } from "@/lib/badges";
import { currentWeekStart } from "@/lib/showcase";
import { AdminReviewList } from "@/components/admin/review-admin";
import { ProfileEditor } from "@/components/admin/profile-editor";
import { frames as frameList } from "@/lib/frames";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { myStaffRole } from "@/lib/social";
import { StaffBadge, VerifiedTick } from "@/components/user-badge";
import { Price } from "@/components/price";

type Tab =
  | "tickets"
  | "applications"
  | "featured"
  | "reports"
  | "listings"
  | "members"
  | "usersDetails"
  | "reviewRemove"
  | "profileEdit"
  | "frames"
  | "notify"
  | "sales"
  | "tags"
  | "roles"
  | "announce"
  | "stats"
  | "showcase";

const STATUS_LABELS: Record<string, string> = {
  open: "Açık",
  reviewing: "İnceleniyor",
  closed: "Kapandı",
  pending: "Bekliyor",
  approved: "Onaylandı",
  rejected: "Reddedildi",
};

type TabGroup = {
  key: string;
  label: string;
  ownerOnly?: boolean;
  tabs: { key: Tab; label: string; ownerOnly?: boolean }[];
};

/** Az sayıda ana kategori; her birinin içinde alt sekmeler var */
const TAB_GROUPS: TabGroup[] = [
  {
    key: "support",
    label: "Destek & Şikayet",
    tabs: [
      { key: "tickets", label: "Destek" },
      { key: "reports", label: "Şikayetler" },
    ],
  },
  {
    key: "listings",
    label: "İlanlar",
    tabs: [
      { key: "listings", label: "Tüm ilanlar" },
      { key: "featured", label: "Öne çıkan" },
      { key: "showcase", label: "Yetkili vitrini", ownerOnly: true },
    ],
  },
  {
    key: "members",
    label: "Üyeler",
    tabs: [
      { key: "members", label: "Üyeler" },
      { key: "usersDetails", label: "Kullanıcı verileri" },
    ],
  },
  {
    key: "sales",
    label: "Satışlar",
    tabs: [{ key: "sales", label: "Satışlar" }],
  },
  {
    key: "reviews",
    label: "Değerlendirme",
    tabs: [{ key: "reviewRemove", label: "İnceleme & kaldırma" }],
  },
  {
    key: "decor",
    label: "Çerçeve & Rozet",
    ownerOnly: true,
    tabs: [
      { key: "frames", label: "Çerçeve" },
      { key: "tags", label: "Rozet" },
    ],
  },
  {
    key: "applications",
    label: "Onaylı Satıcı",
    tabs: [{ key: "applications", label: "Başvurular" }],
  },
  {
    key: "notify",
    label: "Bildirim",
    tabs: [{ key: "notify", label: "Gönder" }],
  },
  {
    key: "owner",
    label: "Kurucu",
    ownerOnly: true,
    tabs: [
      { key: "stats", label: "İstatistik" },
      { key: "roles", label: "Moderatör" },
      { key: "announce", label: "Duyuru" },
      { key: "profileEdit", label: "Profil düzenle" },
    ],
  },
];

type Ticket = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: string;
  admin_note: string | null;
  created_at: string;
};

type Application = {
  id: string;
  user_id: string;
  status: string;
  note: string | null;
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
  admin_note?: string | null;
  priority?: string | null;
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
  banned_until?: string | null;
  ban_reason?: string | null;
  banned_by?: string | null;
  created_at: string;
};

type SaleRow = {
  id: string;
  listing_id: string;
  seller_id: string;
  buyer_id: string;
  status: string;
  counted?: boolean | null;
  flag_reason?: string | null;
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
  const [memberQuery, setMemberQuery] = useState("");
  const [detailUser, setDetailUser] = useState<string | null>(null);
  const [frameQuery, setFrameQuery] = useState("");
  const [frameChoice, setFrameChoice] = useState("vip");
  const [frameMode, setFrameMode] = useState<"give" | "take">("give");
  const [confirmUser, setConfirmUser] = useState<MemberRow | null>(null);
  const [banTarget, setBanTarget] = useState<MemberRow | null>(null);
  const [banAuthors, setBanAuthors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showcasePick, setShowcasePick] = useState<string[]>([]);
  const [showcaseQuery, setShowcaseQuery] = useState("");
  const [showcaseBusy, setShowcaseBusy] = useState(false);

  const [tagQuery, setTagQuery] = useState("");
  const [tagChoice, setTagChoice] = useState("vip");
  const [customTag, setCustomTag] = useState("");
  const [roleQuery, setRoleQuery] = useState("");
  const [roleChoice, setRoleChoice] = useState("moderator");
  const [announceBody, setAnnounceBody] = useState("");
  const [currentAnnouncement, setCurrentAnnouncement] = useState<{
    id: string;
    body: string;
    created_at: string;
  } | null>(null);
  const [confirmAnnouncement, setConfirmAnnouncement] = useState(false);
  const [closeTicketTarget, setCloseTicketTarget] = useState<Ticket | null>(null);
  const [closeApplicationTarget, setCloseApplicationTarget] = useState<Application | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: "ticket" | "application";
    id: string;
    label: string;
  } | null>(null);
  const [notifyQuery, setNotifyQuery] = useState("");
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyBody, setNotifyBody] = useState("");
  const [notifyTarget, setNotifyTarget] = useState<{ id: string; username: string } | null>(null);
  const [featureQuery, setFeatureQuery] = useState("");
  const [featureDays, setFeatureDays] = useState("3");
  const [featurePick, setFeaturePick] = useState<ListingRow | null>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [summary, setSummary] = useState<{
    newListings: number;
    newUsers: number;
    openTickets: number;
    openReports: number;
    pendingReviews: number;
    suspectSales: number;
  } | null>(null);
  const [reviewMember, setReviewMember] = useState<MemberHit | null>(null);
  const [closeReportTarget, setCloseReportTarget] = useState<Report | null>(null);
  const [selectedListings, setSelectedListings] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

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
        .select("id, user_id, title, description, status, admin_note, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      const rows = (data ?? []) as Ticket[];
      setTickets(rows);
      await loadProfiles(rows.map((row) => row.user_id));
    }

    if (tab === "applications") {
      const { data } = await supabase
        .from("seller_applications")
        .select("id, user_id, status, note, created_at")
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
      const columns =
        "id, reporter_id, reported_id, conversation_id, reason, details, status, admin_note, created_at";
      let { data, error } = await supabase
        .from("reports")
        .select(columns)
        .order("created_at", { ascending: false })
        .limit(50);

      // admin_note kolonu yoksa onsuz devam et
      if (error) {
        const retry = await supabase
          .from("reports")
          .select("id, reporter_id, reported_id, conversation_id, reason, details, status, created_at")
          .order("created_at", { ascending: false })
          .limit(50);
        data = retry.data as typeof data;
      }

      const rows = (data ?? []) as Report[];
      setReports(rows);
      await loadProfiles(
        rows.flatMap((row) => [row.reporter_id, row.reported_id].filter(Boolean) as string[]),
      );
    }

    if (tab === "showcase") {
      const { data } = await supabase
        .from("staff_showcase")
        .select("listing_id, position, week_start")
        .eq("week_start", currentWeekStart())
        .order("position", { ascending: true });
      setShowcasePick(((data ?? []) as { listing_id: string }[]).map((row) => row.listing_id));
    }

    if (tab === "listings" || tab === "featured" || tab === "showcase") {
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

    if (tab === "members" || tab === "usersDetails") {
      // Süresi dolmuş askıları kapat
      await supabase.rpc("expire_bans");

      let { data, error } = await supabase
        .from("profiles")
        .select(
          "id, username, email, sales_count, verified_seller, staff_tag, banned, banned_until, ban_reason, banned_by, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(80);

      if (error) {
        const retry = await supabase
          .from("profiles")
          .select("id, username, email, sales_count, verified_seller, staff_tag, banned, created_at")
          .order("created_at", { ascending: false })
          .limit(80);
        data = retry.data as typeof data;
      }

      if (!data) {
        const basic = await supabase
          .from("profiles")
          .select("id, username, email, sales_count, verified_seller, created_at")
          .order("created_at", { ascending: false })
          .limit(80);
        data = basic.data as typeof data;
      }

      const rows = (data ?? []) as unknown as MemberRow[];
      setMembers(rows);

      // Askıya alan yetkililerin adları
      const authorIds = Array.from(
        new Set(rows.map((row) => row.banned_by).filter((id): id is string => Boolean(id))),
      );
      if (authorIds.length > 0) {
        const authors = await supabase.from("profiles").select("id, username").in("id", authorIds);
        const map: Record<string, string> = {};
        for (const row of (authors.data ?? []) as { id: string; username: string }[]) {
          map[row.id] = row.username;
        }
        setBanAuthors(map);
      } else {
        setBanAuthors({});
      }
    }

    if (tab === "sales") {
      let { data, error } = await supabase
        .from("sales")
        .select("id, listing_id, seller_id, buyer_id, status, counted, flag_reason, created_at")
        .order("created_at", { ascending: false })
        .limit(40);

      if (error) {
        const retry = await supabase
          .from("sales")
          .select("id, listing_id, seller_id, buyer_id, status, created_at")
          .order("created_at", { ascending: false })
          .limit(40);
        data = retry.data as typeof data;
      }

      const rows = (data ?? []) as unknown as SaleRow[];
      setSalesRows(rows);
      await loadProfiles(rows.flatMap((row) => [row.seller_id, row.buyer_id]));
    }

    if (tab === "announce") {
      const { data } = await supabase
        .from("announcements")
        .select("id, body, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setCurrentAnnouncement(
        data ? (data as { id: string; body: string; created_at: string }) : null,
      );
    }

    if (tab === "stats") {
      const dayAgo = new Date(Date.now() - 86400000).toISOString();
      const [
        { count: userCount },
        { count: listingCount },
        { count: saleCount },
        { count: ticketCount },
        { count: openTickets },
        { count: openReports },
        { count: activeListings },
        { count: newUsers },
        { count: newListings },
        { count: pendingReviews },
        { count: suspectSales },
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("listings").select("id", { count: "exact", head: true }),
        supabase.from("sales").select("id", { count: "exact", head: true }),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }),
        supabase
          .from("support_tickets")
          .select("id", { count: "exact", head: true })
          .neq("status", "closed"),
        supabase.from("reports").select("id", { count: "exact", head: true }).neq("status", "closed"),
        supabase
          .from("listings")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gte("created_at", dayAgo),
        supabase
          .from("listings")
          .select("id", { count: "exact", head: true })
          .gte("created_at", dayAgo),
        supabase
          .from("reviews")
          .select("id", { count: "exact", head: true })
          .neq("status", "approved"),
        supabase
          .from("sales")
          .select("id", { count: "exact", head: true })
          .eq("status", "approved")
          .eq("counted", false),
      ]);
      setStats({
        users: userCount ?? 0,
        listings: listingCount ?? 0,
        sales: saleCount ?? 0,
        tickets: ticketCount ?? 0,
        openTickets: openTickets ?? 0,
        openReports: openReports ?? 0,
        activeListings: activeListings ?? 0,
        newUsers: newUsers ?? 0,
        newListings: newListings ?? 0,
        pendingReviews: pendingReviews ?? 0,
        suspectSales: suspectSales ?? 0,
      });
    }
  }, [supabase, tab, loadProfiles]);

  useEffect(() => {
    if (role) void loadTab();
  }, [role, loadTab]);

  // Günün özeti: panel açılır açılmaz tek bakışta durum
  useEffect(() => {
    if (!supabase || !role) return;
    let cancelled = false;
    const dayAgo = new Date(Date.now() - 86400000).toISOString();

    void (async () => {
      const [newListings, newUsers, openTickets, openReports, pendingReviews, suspectSales] =
        await Promise.all([
          supabase
            .from("listings")
            .select("id", { count: "exact", head: true })
            .gte("created_at", dayAgo),
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .gte("created_at", dayAgo),
          supabase
            .from("support_tickets")
            .select("id", { count: "exact", head: true })
            .neq("status", "closed"),
          supabase.from("reports").select("id", { count: "exact", head: true }).neq("status", "closed"),
          supabase
            .from("reviews")
            .select("id", { count: "exact", head: true })
            .neq("status", "approved"),
          supabase
            .from("sales")
            .select("id", { count: "exact", head: true })
            .eq("status", "approved")
            .eq("counted", false),
        ]);

      if (cancelled) return;
      setSummary({
        newListings: newListings.count ?? 0,
        newUsers: newUsers.count ?? 0,
        openTickets: openTickets.count ?? 0,
        openReports: openReports.count ?? 0,
        pendingReviews: pendingReviews.count ?? 0,
        suspectSales: suspectSales.count ?? 0,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, role]);

  /** Kişinin bildirim kutusuna site içi bildirim bırakır */
  async function sendNotification(
    userId: string,
    title: string,
    body: string,
    link: string | null = null,
    kind = "staff",
  ) {
    if (!supabase) return false;
    const { error } = await supabase.rpc("admin_notify", {
      p_user: userId,
      p_title: title,
      p_body: body,
      p_link: link,
      p_kind: kind,
    });
    if (!error) return true;

    const fallback = await supabase
      .from("notifications")
      .insert({ user_id: userId, kind, title, body, link });
    return !fallback.error;
  }

  async function reviewTicket(ticket: Ticket) {
    if (!supabase) return;
    setBusy(ticket.id);
    setNotice(null);
    const { error } = await supabase
      .from("support_tickets")
      .update({ status: "reviewing" })
      .eq("id", ticket.id);
    let message = error ? "Durum güncellenemedi." : "Talep incelemeye alındı.";
    if (!error) {
      await sendNotification(
        ticket.user_id,
        "Talebiniz İnceleniyor",
        "Destek talebiniz yetkili tarafından incelemeye alındı. Sonuç bildirilecek.",
        "/diger/destek",
      );
      message = "Talep incelemeye alındı, kişiye bildirim gönderildi.";
    }
    setBusy(null);
    setNotice(message);
    await loadTab();
  }

  async function closeTicket(ticket: Ticket, note: string) {
    if (!supabase) return;
    setBusy(ticket.id);
    setNotice(null);
    const { error } = await supabase
      .from("support_tickets")
      .update({ status: "closed", admin_note: note || null })
      .eq("id", ticket.id);
    if (error) {
      setBusy(null);
      setNotice("Talep kapatılamadı. Lütfen tekrar dene.");
      return;
    }
    const notified = await sendNotification(
      ticket.user_id,
      "Talebiniz Kapatıldı; İşte Sonuçlar",
      note ? `Yetkili mesajı:\n${note}` : "Yetkili mesajı:\nTalebiniz incelendi ve kapatıldı.",
      "/diger/destek",
      "support",
    );
    setBusy(null);
    setCloseTicketTarget(null);
    setNotice(notified ? "Talep kapatıldı, kişiye bildirim gönderildi." : "Talep kapatıldı.");
    await loadTab();
  }

  async function reviewApplication(application: Application) {
    if (!supabase) return;
    setBusy(application.id);
    setNotice(null);
    await sendNotification(
      application.user_id,
      "Başvurunuz İnceleniyor",
      "Onaylı satıcı başvurunuz yetkili tarafından incelemeye alındı. Sonuç bildirilecek.",
      "/diger/onayli-satici",
      "application",
    );
    setBusy(null);
    setNotice("Kişiye \"başvurunuz inceleniyor\" bildirimi gönderildi.");
  }

  async function closeApplication(application: Application, approve: boolean, note: string) {
    if (!supabase) return;
    setBusy(application.id);
    setNotice(null);
    const { error } = await supabase
      .from("seller_applications")
      .update({ status: approve ? "approved" : "rejected", note: note || null })
      .eq("id", application.id);

    if (error) {
      setBusy(null);
      setNotice("Başvuru sonuçlandırılamadı. Lütfen tekrar dene.");
      return;
    }

    if (approve) {
      await supabase.rpc("admin_set_tag", {
        p_user: application.user_id,
        p_tag: "verified_seller",
        p_remove: false,
      });
    }

    const notified = await sendNotification(
      application.user_id,
      `Başvurunuz Sonuçlandı; ${approve ? "Kabul edildiniz" : "Reddedildiniz"}`,
      note
        ? `Yetkili notu:\n${note}`
        : `Yetkili notu:\nBaşvurunuz ${approve ? "kabul edildi" : "reddedildi"}.`,
      "/diger/onayli-satici",
      "application",
    );

    setBusy(null);
    setCloseApplicationTarget(null);
    setNotice(
      approve
        ? `Başvuru onaylandı, Onaylı Satıcı tag'i verildi.${notified ? " Kişiye bildirim gönderildi." : ""}`
        : `Başvuru reddedildi.${notified ? " Kişiye bildirim gönderildi." : ""}`,
    );
    await loadTab();
  }

  async function removeTicketOrApplication() {
    if (!supabase || !deleteTarget) return;
    setBusy(deleteTarget.id);
    setNotice(null);
    const table = deleteTarget.kind === "ticket" ? "support_tickets" : "seller_applications";
    const { error } = await supabase.from(table).delete().eq("id", deleteTarget.id);
    setBusy(null);
    setDeleteTarget(null);
    setNotice(error ? "Kayıt silinemedi. Lütfen tekrar dene." : "Kayıt silindi.");
    await loadTab();
  }

  async function sendManualNotification() {
    if (!supabase) return;
    setNotice(null);
    const profile = await findProfile(notifyQuery);
    if (!profile) {
      setNotice("Kullanıcı bulunamadı. Kullanıcı adı veya e-posta ile ara.");
      return;
    }
    const title = notifyTitle.trim();
    const body = notifyBody.trim();
    if (title.length < 2) {
      setNotice("Bildirim başlığı yaz.");
      return;
    }
    setBusy("notify");
    const ok = await sendNotification(profile.id, title, body, null, "staff");
    setBusy(null);
    if (!ok) {
      setNotice("Bildirim gönderilemedi. Lütfen tekrar dene.");
      return;
    }
    setNotifyTarget({ id: profile.id, username: profile.username });
    setNotifyTitle("");
    setNotifyBody("");
    setNotice(`Bildirim gönderildi: @${profile.username}`);
  }

  async function featureListingNow() {
    if (!supabase || !featurePick) return;
    const days = Math.max(1, Math.min(30, Number(featureDays) || 0));
    setBusy("feature");
    setNotice(null);
    const { error } = await supabase.rpc("admin_feature_listing", {
      p_listing: featurePick.id,
      p_days: days,
    });
    setBusy(null);
    if (error) {
      setNotice("İlan öne çıkarılamadı. Lütfen tekrar dene.");
      return;
    }
    setNotice(`Öne çıkarıldı: ${featurePick.title} · ${days} gün`);
    setFeaturePick(null);
    setFeatureQuery("");
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

  /** Bu haftanın yetkili vitrinini kaydeder (boş dizi = vitrin kapalı) */
  async function saveShowcase(ids: string[]) {
    if (!supabase) return;
    setShowcaseBusy(true);
    setNotice(null);

    const { data, error } = await supabase.rpc("admin_set_showcase", { p_listing_ids: ids });

    setShowcaseBusy(false);
    if (error) {
      console.error("[vitrin]", error.message);
      setNotice(
        /could not find the function|does not exist|schema cache/i.test(error.message)
          ? "Vitrin tablosu yok. SQL güncellemesini (5af) çalıştır."
          : error.message,
      );
      return;
    }

    setShowcasePick(ids);
    setNotice(
      Number(data ?? ids.length) > 0
        ? "Vitrin kaydedildi. Bu hafta ana sayfada görünecek."
        : "Bu hafta vitrin kapalı. Ana sayfada görünmeyecek.",
    );
  }

  /** Bildiriyi yetkili notuyla kapatır ve bildirene sonuç bildirimi gönderir */
  async function closeReport(report: Report, note: string) {
    if (!supabase) return;
    setBusy(report.id);
    setNotice(null);

    let { error } = await supabase
      .from("reports")
      .update({ status: "closed", admin_note: note || null })
      .eq("id", report.id);

    // admin_note kolonu yoksa sadece durumu kapat
    if (error) {
      const retry = await supabase
        .from("reports")
        .update({ status: "closed" })
        .eq("id", report.id);
      error = retry.error;
    }

    if (error) {
      setBusy(null);
      setCloseReportTarget(null);
      setNotice("Bildiri kapatılamadı. Lütfen tekrar dene.");
      return;
    }

    const notified = await sendNotification(
      report.reporter_id,
      "Bildiriniz Sonuçlandı; İşte Sonuçlar",
      note
        ? `Yetkili mesajı:\n${note}`
        : "Yetkili mesajı:\nBildiriniz incelendi ve kapatıldı.",
      "/bildirimler",
      "report",
    );

    setBusy(null);
    setCloseReportTarget(null);
    setNotice(
      notified
        ? "Bildiri kapatıldı, bildirene sonuç bildirimi gönderildi."
        : "Bildiri kapatıldı.",
    );
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

  async function hideSelectedListings() {
    if (!supabase || selectedListings.length === 0) return;
    setBulkBusy(true);
    setNotice(null);
    const { error } = await supabase
      .from("listings")
      .update({ status: "hidden" })
      .in("id", selectedListings);
    setBulkBusy(false);
    if (error) {
      setNotice(`Hata: ${error.message}`);
      return;
    }
    setNotice(`${selectedListings.length} ilan gizlendi.`);
    setSelectedListings([]);
    await loadTab();
  }

  async function toggleSaleCounted(sale: SaleRow) {
    if (!supabase) return;
    setBusy(sale.id);
    setNotice(null);
    const next = !(sale.counted ?? true);
    const { error } = await supabase.rpc("admin_set_sale_counted", {
      p_sale: sale.id,
      p_counted: next,
    });
    setBusy(null);
    if (error) {
      setNotice("İşlem güncellenemedi.");
      return;
    }
    setSalesRows((prev) =>
      prev.map((row) =>
        row.id === sale.id
          ? { ...row, counted: next, flag_reason: next ? null : row.flag_reason ?? "yetkili kararı" }
          : row,
      ),
    );
    setNotice(next ? "İşlem başarılı sayıldı." : "İşlem sayılmıyor.");
  }

  async function setReportPriority(report: Report, priority: "high" | "normal") {
    if (!supabase) return;
    setBusy(report.id);
    const { error } = await supabase
      .from("reports")
      .update({ priority })
      .eq("id", report.id);
    setBusy(null);
    if (error) {
      setNotice("Öncelik kaydedilemedi.");
      return;
    }
    setReports((prev) => prev.map((row) => (row.id === report.id ? { ...row, priority } : row)));
    setNotice(priority === "high" ? "Bildiri öncelikli." : "Öncelik kaldırıldı.");
  }

  async function adminMember(
    userId: string,
    action: "ban" | "unban" | "delete" | "demote",
    days: number | null = null,
    reason: string | null = null,
  ) {
    if (!supabase) return;
    setBusy(userId);
    setNotice(null);

    let errorText: string | null = null;
    let message = "İşlem tamam.";

    if (action === "delete") {
      setBusy(userId);
      const result = await deleteAccountAsStaff(supabase, userId);
      errorText = result.error;
      message = result.partial
        ? "Hesap silindi. Kalan giriş kaydı için temizlik yapabilirsin."
        : "Hesap silindi.";
    } else if (action === "demote") {
      const { error } = await supabase.rpc("admin_remove_role", { p_user: userId });
      errorText = error?.message ?? null;
      message = "Yetki kaldırıldı.";
    } else {
      const banned = action === "ban";
      const until =
        banned && days && days > 0
          ? new Date(Date.now() + days * 86400000).toISOString()
          : null;

      let { error } = await supabase.rpc("admin_set_banned", {
        p_user: userId,
        p_banned: banned,
        p_days: banned ? days : null,
        p_reason: reason,
      });

      // Eski fonksiyon (sebep parametresi yok) varsa onsuz dene
      if (error && /could not find the function|schema cache|does not exist/i.test(error.message)) {
        const retry = await supabase.rpc("admin_set_banned", {
          p_user: userId,
          p_banned: banned,
          p_days: banned ? days : null,
        });
        error = retry.error;
      }

      // Fonksiyon eski sürümse "kim askıya aldı" alanını elle yaz
      if (!error) {
        const me = (await supabase.auth.getUser()).data.user?.id ?? null;
        if (banned && me) {
          await supabase.from("profiles").update({ banned_by: me }).eq("id", userId);
        } else if (!banned) {
          await supabase.from("profiles").update({ banned_by: null }).eq("id", userId);
        }
      }

      // Fonksiyon hiç yoksa doğrudan tabloya yaz (yetkili politikası gerekir)
      if (error) {
        const me = (await supabase.auth.getUser()).data.user?.id ?? null;
        const direct = await supabase
          .from("profiles")
          .update({ banned, banned_until: until, ban_reason: reason, banned_by: banned ? me : null })
          .eq("id", userId)
          .select("id");

        if (direct.error) {
          errorText = `${error.message} · ${direct.error.message}`;
        } else if ((direct.data ?? []).length === 0) {
          errorText = "Yetki yok: askı işlemi için 5ah SQL bloğunu çalıştır.";
        } else {
          errorText = null;
          if (banned) {
            await supabase
              .from("listings")
              .update({ status: "hidden" })
              .eq("seller_id", userId)
              .eq("status", "active");
          }
        }
      }

      if (!errorText) {
        message =
          action === "unban"
            ? "Askı kaldırıldı. İlanlarını yeniden yayınlayabilir."
            : days && days > 0
              ? `Kullanıcı ${days} gün askıya alındı.`
              : "Kullanıcı kalıcı olarak askıya alındı.";
      }
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
        ? `Etiket işlemi başarısız: ${errorText}`
        : `${remove ? "Kaldırıldı" : "Verildi"}: ${tag}`,
    );
    await loadTab();
  }

  async function setMemberRole(userId: string, role: string) {
    if (!supabase) return;
    setBusy(`${userId}-role`);
    setNotice(null);
    const { error } = await supabase.rpc("admin_set_role", { p_user: userId, p_role: role });

    let errorText = error?.message ?? null;
    if (errorText && /could not find the function|schema cache|does not exist/i.test(errorText)) {
      const direct = await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role, granted_by: user?.id ?? null }, { onConflict: "user_id" });
      errorText = direct.error?.message ?? null;
      if (!errorText) {
        await supabase.from("profiles").update({ staff_tag: role }).eq("id", userId);
      }
    }

    setBusy(null);
    setNotice(errorText ? `Rol verilemedi: ${errorText}` : `Rol verildi: ${role}`);
    await loadTab();
  }

  async function grantFrame(remove: boolean) {
    if (!supabase) return;
    setNotice(null);
    const profile = await findProfile(frameQuery);
    if (!profile) {
      setNotice("Kullanıcı bulunamadı. Kullanıcı adını veya e-postayı tam yaz.");
      return;
    }
    setBusy("frame");

    let { error } = await supabase.rpc("admin_set_frame", {
      p_user: profile.id,
      p_frame: frameChoice,
      p_remove: remove,
    });

    // Fonksiyon veritabanında eski/yoksa doğrudan tabloya yaz
    if (error && /could not find the function|schema cache|does not exist/i.test(error.message)) {
      const fallback = remove
        ? await supabase
            .from("user_frames")
            .delete()
            .eq("user_id", profile.id)
            .eq("frame", frameChoice)
        : await supabase.from("user_frames").upsert(
            { user_id: profile.id, frame: frameChoice, granted_by: user?.id ?? null },
            { onConflict: "user_id,frame", ignoreDuplicates: true },
          );

      error = fallback.error;
      if (remove) {
        await supabase
          .from("profiles")
          .update({ equipped_frame: "member" })
          .eq("id", profile.id)
          .eq("equipped_frame", frameChoice);
      }
    }

    setBusy(null);
    if (error) {
      console.error("[cerceve]", error.message);
      const text = error.message ?? "";
      if (/check constraint/i.test(text)) {
        setNotice("Bu çerçeve türü veritabanında henüz açık değil. SQL güncellemesini çalıştır.");
      } else if (/[çğıöşüÇĞİÖŞÜ]/.test(text)) {
        setNotice(text);
      } else {
        setNotice("Çerçeve kaydedilemedi. Lütfen tekrar dene.");
      }
      return;
    }
    setNotice(
      `${remove ? "Alındı" : "Verildi"}: @${profile.username} → ${
        frameList.find((frame) => frame.slug === frameChoice)?.name ?? frameChoice
      }`,
    );
  }

  async function findProfile(query: string) {
    if (!supabase) return null;
    const value = query.trim().replace(/^@/, "");
    if (!value) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, email")
      .or(`username.ilike.%${value}%,email.ilike.${value}`)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[uye-ara]", error.message);
      return null;
    }

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
        setNotice(`Etiket kaydedilemedi: ${fallback.error.message}`);
        return;
      }
      if (tagChoice === "verified_seller") {
        await supabase
          .from("profiles")
          .update({ verified_seller: !remove })
          .eq("id", profile.id);
      }
      setNotice(
        `${remove ? "Kaldırıldı" : "Verildi"}: @${profile.username} → ${badgeLabel(tagChoice)}`,
      );
      return;
    }

    setBusy(null);
    setNotice(
      error
        ? `Etiket işlemi başarısız: ${error.message}`
        : `${remove ? "Kaldırıldı" : "Verildi"}: @${profile.username} → ${badgeLabel(tagChoice)}`,
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
      error ? `Rol verilemedi: ${error.message}` : `@${profile.username} artık ${roleChoice}.`,
    );
  }

  async function removeAnnouncement() {
    if (!supabase || !currentAnnouncement) return;
    setConfirmAnnouncement(false);
    setBusy("announce");
    const { error } = await supabase
      .from("announcements")
      .delete()
      .eq("id", currentAnnouncement.id);
    setBusy(null);
    if (error) {
      console.error("[duyuru-sil]", error.message);
      setNotice("Duyuru kaldırılamadı. Lütfen tekrar dene.");
      return;
    }
    setCurrentAnnouncement(null);
    setNotice("Duyuru kaldırıldı.");
    await loadTab();
  }

  async function publishAnnouncement() {
    if (!supabase) return;
    const body = announceBody.trim();
    if (body.length < 5) {
      setNotice("Duyuru mesajı en az 5 karakter olmalı.");
      return;
    }
    setBusy("announce");
    const { error } = await supabase.from("announcements").insert({
      title: "Duyuru",
      body,
      created_by: user?.id ?? null,
    });
    setBusy(null);
    if (error) {
      console.error("[duyuru]", error.message);
      setNotice("Duyuru yayınlanamadı. Lütfen tekrar dene.");
      return;
    }
    setAnnounceBody("");
    setNotice("Duyuru yayınlandı, sitenin üstünde görünüyor.");
    await loadTab();
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

  const canSee = (item: { ownerOnly?: boolean }) => !item.ownerOnly || role === "owner";
  const visibleGroups = TAB_GROUPS.filter((group) => !group.ownerOnly || role === "owner")
    .map((group) => ({ ...group, tabs: group.tabs.filter(canSee) }))
    .filter((group) => group.tabs.length > 0);
  const activeGroup = visibleGroups.find((group) => group.tabs.some((item) => item.key === tab));

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Yetkili paneli</h1>
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

      {summary && (
        <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          {[
            { label: "Bugün ilan", value: summary.newListings, tab: "listings" as Tab },
            { label: "Bugün üye", value: summary.newUsers, tab: "members" as Tab },
            { label: "Destek", value: summary.openTickets, tab: "tickets" as Tab },
            { label: "Bildiri", value: summary.openReports, tab: "reports" as Tab },
            { label: "İncelemede", value: summary.pendingReviews, tab: "reviewRemove" as Tab },
            { label: "Sayılmayan", value: summary.suspectSales, tab: "sales" as Tab },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setTab(item.tab)}
              className={`rounded-xl border px-2 py-2 text-left transition ${
                item.value > 0
                  ? "border-accent/35 bg-accent/8 hover:bg-accent/12"
                  : "border-line bg-white/3 hover:bg-white/6"
              }`}
            >
              <span className="block text-[0.85rem] font-extrabold leading-none">{item.value}</span>
              <span className="mt-1 block text-[0.58rem] leading-tight text-muted-2">{item.label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {visibleGroups.map((group) => (
          <button
            key={group.key}
            type="button"
            onClick={() => setTab(group.tabs[0].key)}
            className={`chip whitespace-nowrap ${
              activeGroup?.key === group.key ? "chip-active" : ""
            }`}
          >
            {group.label}
          </button>
        ))}
      </div>

      {activeGroup && activeGroup.tabs.length > 1 && (
        <div className="mt-2 flex gap-1.5 rounded-xl border border-line-soft bg-white/3 p-1">
          {activeGroup.tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`flex-1 rounded-lg px-2 py-1.5 text-[0.68rem] font-semibold transition ${
                tab === item.key ? "bg-accent/15 text-accent" : "text-muted hover:text-text"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {tab === "tickets" && (
          <>
            {tickets.length === 0 && <Empty text="Destek talebi yok." />}
            {tickets.map((ticket) => (
              <div key={ticket.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="selectable text-sm font-semibold">{ticket.title}</p>
                    <p className="mt-0.5 text-[0.68rem] text-muted-2">
                      @{profiles[ticket.user_id]?.username ?? "kullanıcı"} ·{" "}
                      {new Date(ticket.created_at).toLocaleString("tr-TR")}
                    </p>
                  </div>
                  <span className="badge shrink-0 border border-line bg-white/4 text-[0.6rem] text-muted">
                    {STATUS_LABELS[ticket.status] ?? ticket.status}
                  </span>
                </div>
                <p className="selectable mt-2 whitespace-pre-wrap text-[0.78rem] leading-relaxed text-muted">
                  {ticket.description}
                </p>
                {ticket.admin_note && (
                  <p className="selectable mt-2 whitespace-pre-wrap rounded-lg border border-line-soft bg-white/4 px-3 py-2 text-[0.72rem] leading-relaxed text-muted-2">
                    <span className="font-semibold text-text">Yetkili mesajı: </span>
                    {ticket.admin_note}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {ticket.status !== "closed" && (
                    <>
                      <button
                        type="button"
                        onClick={() => reviewTicket(ticket)}
                        disabled={busy === ticket.id || ticket.status === "reviewing"}
                        className="btn btn-ghost h-8 px-3 text-[0.7rem]"
                      >
                        {busy === ticket.id ? <Spinner /> : "İnceleniyor"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCloseTicketTarget(ticket)}
                        disabled={busy === ticket.id}
                        className="btn btn-primary h-8 px-3 text-[0.7rem]"
                      >
                        Kapat
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteTarget({
                        kind: "ticket",
                        id: ticket.id,
                        label: `@${profiles[ticket.user_id]?.username ?? "kullanıcı"} · ${ticket.title}`,
                      })
                    }
                    disabled={busy === ticket.id}
                    className="btn btn-ghost h-8 px-3 text-[0.7rem] text-danger"
                  >
                    <XIcon width={12} height={12} /> Sil
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
              <div key={application.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      @{profiles[application.user_id]?.username ?? "kullanıcı"}
                    </p>
                    <p className="mt-0.5 text-[0.68rem] text-muted-2">
                      {profiles[application.user_id]?.sales_count ?? 0} başarılı işlem ·{" "}
                      {new Date(application.created_at).toLocaleString("tr-TR")}
                    </p>
                  </div>
                  <span className="badge shrink-0 border border-line bg-white/4 text-[0.6rem] text-muted">
                    {STATUS_LABELS[application.status] ?? application.status}
                  </span>
                </div>
                {application.note && (
                  <p className="selectable mt-2 whitespace-pre-wrap rounded-lg border border-line-soft bg-white/4 px-3 py-2 text-[0.72rem] leading-relaxed text-muted-2">
                    <span className="font-semibold text-text">Yetkili notu: </span>
                    {application.note}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {application.status === "pending" && (
                    <>
                      <button
                        type="button"
                        onClick={() => reviewApplication(application)}
                        disabled={busy === application.id}
                        className="btn btn-ghost h-8 px-3 text-[0.7rem]"
                      >
                        {busy === application.id ? <Spinner /> : "İncelemeye Al"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCloseApplicationTarget(application)}
                        disabled={busy === application.id}
                        className="btn btn-primary h-8 px-3 text-[0.7rem]"
                      >
                        <CheckIcon width={12} height={12} /> Kapat
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteTarget({
                        kind: "application",
                        id: application.id,
                        label: `@${profiles[application.user_id]?.username ?? "kullanıcı"} · Onaylı satıcı başvurusu`,
                      })
                    }
                    disabled={busy === application.id}
                    className="btn btn-ghost h-8 px-3 text-[0.7rem] text-danger"
                  >
                    <XIcon width={12} height={12} /> Sil
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === "showcase" && role === "owner" && (
          <div className="card p-4">
            <h2 className="text-sm font-bold">Yetkili Vitrini</h2>
            <p className="mt-1 text-[0.7rem] leading-relaxed text-muted-2">
              Her hafta en fazla 3 ilan seç. Seçim yapmazsan vitrin ana sayfada hiç görünmez.
              Seçim sadece o hafta geçerli; hafta bitince yeniden seçmen gerekir.
            </p>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {[0, 1, 2].map((slot) => {
                const pickedId = showcasePick[slot];
                const picked = listings.find((listing) => listing.id === pickedId);
                return (
                  <div
                    key={slot}
                    className={`rounded-xl border px-3 py-2 ${
                      picked
                        ? "border-accent/50 bg-accent/10"
                        : "border-dashed border-line bg-white/2"
                    }`}
                  >
                    <p className="text-[0.58rem] font-semibold uppercase tracking-wider text-muted-2">
                      {slot + 1}. sıra
                    </p>
                    {picked ? (
                      <div className="mt-1 flex items-start gap-1.5">
                        <span className="min-w-0 flex-1 text-[0.72rem] font-semibold leading-snug">
                          {picked.title}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setShowcasePick((prev) => prev.filter((id) => id !== pickedId))
                          }
                          className="shrink-0 text-muted-2 hover:text-danger"
                          aria-label="Seçimi kaldır"
                        >
                          <XIcon width={12} height={12} />
                        </button>
                      </div>
                    ) : (
                      <p className="mt-1 text-[0.7rem] text-muted-2">boş</p>
                    )}
                  </div>
                );
              })}
            </div>

            <input
              className="field mt-3"
              value={showcaseQuery}
              onChange={(event) => setShowcaseQuery(event.target.value)}
              placeholder="ilan başlığı veya @satıcı ile ara"
            />

            <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
              {(() => {
                const needle = showcaseQuery.trim().toLocaleLowerCase("tr").replace("@", "");
                const rows = listings
                  .filter((listing) => listing.status === "active")
                  .filter((listing) => {
                    if (!needle) return true;
                    return (
                      listing.title.toLocaleLowerCase("tr").includes(needle) ||
                      (profiles[listing.seller_id]?.username ?? "")
                        .toLocaleLowerCase("tr")
                        .includes(needle)
                    );
                  })
                  .slice(0, 40);

                if (rows.length === 0) {
                  return (
                    <p className="px-1 py-2 text-[0.72rem] text-muted-2">
                      Uygun yayında ilan bulunamadı.
                    </p>
                  );
                }

                return rows.map((listing) => {
                  const selected = showcasePick.includes(listing.id);
                  const full = showcasePick.length >= 3 && !selected;
                  return (
                    <button
                      key={listing.id}
                      type="button"
                      disabled={full}
                      onClick={() =>
                        setShowcasePick((prev) =>
                          prev.includes(listing.id)
                            ? prev.filter((id) => id !== listing.id)
                            : prev.length >= 3
                              ? prev
                              : [...prev, listing.id],
                        )
                      }
                      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition disabled:opacity-40 ${
                        selected
                          ? "border-accent/60 bg-accent/15"
                          : "border-line bg-white/4 hover:border-line-soft"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.78rem] font-semibold">
                          {listing.title}
                        </span>
                        <span className="block truncate text-[0.66rem] text-muted-2">
                          @{profiles[listing.seller_id]?.username ?? "satıcı"} ·{" "}
                          <Price value={listing.price} iconSize={11} />
                        </span>
                      </span>
                      {selected && <CheckIcon width={14} height={14} className="shrink-0 text-accent" />}
                    </button>
                  );
                });
              })()}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => void saveShowcase(showcasePick)}
                disabled={showcaseBusy}
                className="btn btn-primary h-10 flex-1 text-[0.78rem]"
              >
                {showcaseBusy ? <Spinner /> : `Vitrini kaydet (${showcasePick.length}/3)`}
              </button>
              <button
                type="button"
                onClick={() => void saveShowcase([])}
                disabled={showcaseBusy || showcasePick.length === 0}
                className="btn h-10 border border-line bg-white/4 px-3 text-[0.78rem] text-muted"
              >
                Haftayı kapat
              </button>
            </div>
          </div>
        )}

        {tab === "featured" && (
          <>
            <div className="card p-4">
              <h2 className="text-sm font-bold">İlanı öne çıkar</h2>
              <p className="mt-1 text-[0.7rem] text-muted-2">
                İlan başlığı veya satıcı adıyla ara, ilanı seç, süreyi yaz. Talep beklemeden
                doğrudan öne çıkarılır.
              </p>
              <input
                className="field mt-3"
                value={featureQuery}
                onChange={(event) => {
                  setFeatureQuery(event.target.value);
                  setFeaturePick(null);
                }}
                placeholder="ilan başlığı veya @satıcı"
              />
              <div className="mt-2 max-h-52 space-y-1.5 overflow-y-auto">
                {listings
                  .filter((listing) => {
                    const needle = featureQuery.trim().toLocaleLowerCase("tr");
                    if (!needle) return false;
                    return (
                      listing.title.toLocaleLowerCase("tr").includes(needle) ||
                      (profiles[listing.seller_id]?.username ?? "")
                        .toLocaleLowerCase("tr")
                        .includes(needle.replace("@", ""))
                    );
                  })
                  .slice(0, 12)
                  .map((listing) => (
                    <button
                      key={listing.id}
                      type="button"
                      onClick={() => setFeaturePick(listing)}
                      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
                        featurePick?.id === listing.id
                          ? "border-accent/60 bg-accent/15"
                          : "border-line bg-white/4 hover:border-line-soft"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.78rem] font-semibold">
                          {listing.title}
                        </span>
                        <span className="block truncate text-[0.66rem] text-muted-2">
                          @{profiles[listing.seller_id]?.username ?? "satıcı"} ·{" "}
                          <Price value={listing.price} iconSize={11} />
                          {listing.featured_until
                            ? ` · öne çıkan: ${new Date(listing.featured_until).toLocaleDateString("tr-TR")}`
                            : ""}
                        </span>
                      </span>
                      {featurePick?.id === listing.id && (
                        <CheckIcon width={14} height={14} className="shrink-0 text-accent" />
                      )}
                    </button>
                  ))}
                {featureQuery.trim().length > 0 &&
                  listings.filter((listing) => {
                    const needle = featureQuery.trim().toLocaleLowerCase("tr");
                    return (
                      listing.title.toLocaleLowerCase("tr").includes(needle) ||
                      (profiles[listing.seller_id]?.username ?? "")
                        .toLocaleLowerCase("tr")
                        .includes(needle.replace("@", ""))
                    );
                  }).length === 0 && (
                    <p className="px-1 py-2 text-[0.72rem] text-muted-2">İlan bulunamadı.</p>
                  )}
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {["1", "3", "7", "15", "30"].map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setFeatureDays(day)}
                    className={`chip ${featureDays === day ? "chip-active" : ""}`}
                  >
                    {day} gün
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  className="field h-10 w-24 text-center text-sm"
                  value={featureDays}
                  onChange={(event) => setFeatureDays(event.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                  placeholder="gün"
                />
                <span className="text-[0.72rem] text-muted-2">gün (1–30)</span>
              </div>

              <button
                type="button"
                onClick={featureListingNow}
                disabled={!featurePick || busy === "feature"}
                className="btn btn-primary mt-3 h-10 w-full text-sm"
              >
                {busy === "feature" ? <Spinner /> : <><StarIcon width={13} height={13} /> Seçili ilanı öne çıkar</>}
              </button>
              {featurePick && (
                <p className="mt-2 truncate text-[0.7rem] text-accent">Seçili: {featurePick.title}</p>
              )}
            </div>

            <h2 className="pt-1 text-[0.72rem] font-bold uppercase tracking-wide text-muted-2">
              Gelen talepler
            </h2>
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
            {[...reports]
              .sort(
                (a, b) =>
                  (b.priority === "high" ? 1 : 0) - (a.priority === "high" ? 1 : 0) ||
                  new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
              )
              .map((report) => (
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
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="badge border border-line bg-white/4 text-[0.6rem] text-muted">
                      {STATUS_LABELS[report.status] ?? report.status}
                    </span>
                    {report.priority === "high" && (
                      <span className="badge border border-danger/40 bg-danger/10 text-[0.55rem] font-bold text-danger">
                        ÖNCELİKLİ
                      </span>
                    )}
                  </div>
                </div>
                {report.details && (
                  <p className="mt-2 whitespace-pre-wrap text-[0.78rem] leading-relaxed text-muted">
                    {report.details}
                  </p>
                )}
                {report.admin_note && (
                  <p className="selectable mt-2 whitespace-pre-wrap rounded-lg border border-line-soft bg-white/4 px-3 py-2 text-[0.72rem] leading-relaxed text-muted-2">
                    <span className="font-semibold text-text">Yetkili mesajı: </span>
                    {report.admin_note}
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
                  {report.status !== "closed" && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          void setReportPriority(
                            report,
                            report.priority === "high" ? "normal" : "high",
                          )
                        }
                        disabled={busy === report.id}
                        className="btn btn-ghost h-8 px-3 text-[0.7rem]"
                      >
                        {report.priority === "high" ? "Önceliği kaldır" : "Öncelikli yap"}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateReport(report.id, "reviewed")}
                        disabled={busy === report.id || report.status === "reviewed"}
                        className="btn btn-ghost h-8 px-3 text-[0.7rem]"
                      >
                        {busy === report.id ? <Spinner /> : "İncelendi"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCloseReportTarget(report)}
                        disabled={busy === report.id}
                        className="btn btn-primary h-8 px-3 text-[0.7rem]"
                      >
                        Kapat
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </>
        )}

        {tab === "listings" && (
          <>
            {listings.length === 0 && <Empty text="İlan yok." />}

            {listings.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line-soft bg-white/3 px-3 py-2">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedListings((prev) =>
                      prev.length === listings.length ? [] : listings.map((item) => item.id),
                    )
                  }
                  className="chip px-2 py-1 text-[0.65rem]"
                >
                  {selectedListings.length === listings.length ? "Seçimi kaldır" : "Tümünü seç"}
                </button>
                <span className="text-[0.65rem] text-muted-2">{selectedListings.length} seçili</span>
                <button
                  type="button"
                  onClick={() => void hideSelectedListings()}
                  disabled={selectedListings.length === 0 || bulkBusy}
                  className="ml-auto chip border-danger/40 bg-danger/10 px-2 py-1 text-[0.65rem] text-[#ffb3bb] disabled:opacity-50"
                >
                  {bulkBusy ? "Gizleniyor…" : "Seçilenleri gizle"}
                </button>
              </div>
            )}
            {listings.map((item) => {
              const featured =
                item.featured_until && new Date(item.featured_until) > new Date();
              return (
                <div key={item.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <input
                      type="checkbox"
                      checked={selectedListings.includes(item.id)}
                      onChange={(event) =>
                        setSelectedListings((prev) =>
                          event.target.checked
                            ? [...prev, item.id]
                            : prev.filter((id) => id !== item.id),
                        )
                      }
                      className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                      aria-label={`${item.title} ilanını seç`}
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/ilan/goruntule?id=${item.id}`}
                        className="line-clamp-1 text-sm font-semibold hover:text-accent"
                      >
                        {item.title}
                      </Link>
                      <p className="mt-0.5 text-[0.68rem] text-muted-2">
                        @{profiles[item.seller_id]?.username ?? "satıcı"} ·{" "}
                        <Price value={Number(item.price)} iconSize={11} /> ·{" "}
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

            {role === "owner" && (
              <button
                type="button"
                onClick={async () => {
                  if (!supabase) return;
                  setBusy("purge");
                  setNotice(null);
                  const removed = await purgeOrphanAccounts(supabase);
                  setBusy(null);
                  setNotice(
                    removed === null
                      ? "Temizlik yapılamadı."
                      : removed > 0
                        ? `${removed} eksik giriş kaydı temizlendi.`
                        : "Temizlenecek kayıt yok.",
                  );
                  await loadTab();
                }}
                disabled={busy === "purge"}
                className="chip px-2.5 py-1.5 text-[0.66rem]"
              >
                {busy === "purge" ? "Temizleniyor…" : "Silinmiş hesapların giriş kayıtlarını temizle"}
              </button>
            )}
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
                            {member.banned_until
                              ? `ASKI · ${Math.max(
                                  1,
                                  Math.ceil(
                                    (new Date(member.banned_until).getTime() - Date.now()) / 86400000,
                                  ),
                                )} gün`
                              : "KALICI ASKI"}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-[0.68rem] text-muted-2">
                        {member.email ?? "e-posta yok"} · {member.sales_count ?? 0} işlem ·{" "}
                        {new Date(member.created_at).toLocaleDateString("tr-TR")}
                      </p>
                      {member.banned && (
                        <p className="mt-1 text-[0.66rem] leading-relaxed text-[#ffb3bb]">
                          {member.banned_until
                            ? `${new Date(member.banned_until).toLocaleDateString("tr-TR")} tarihine kadar`
                            : "Süresiz"}{" "}
                          askıda
                          {member.ban_reason ? ` · ${member.ban_reason}` : ""}
                          {member.banned_by
                            ? ` · askıya alan: @${banAuthors[member.banned_by] ?? "yetkili"}`
                            : ""}
                        </p>
                      )}
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
                      onClick={() => setBanTarget(member)}
                      disabled={busy === member.id || Boolean(member.banned)}
                      className={`chip px-2 py-1 text-[0.65rem] ${
                        member.banned ? "opacity-40" : ""
                      }`}
                      title={member.banned ? "Kullanıcı zaten askıda" : "Askıya al"}
                    >
                      Askıya al
                    </button>
                    <button
                      type="button"
                      onClick={() => void adminMember(member.id, "unban")}
                      disabled={busy === member.id || !member.banned}
                      className={`chip px-2 py-1 text-[0.65rem] ${
                        member.banned ? "" : "opacity-40"
                      }`}
                      title={member.banned ? "Askıyı kaldır" : "Kullanıcı askıda değil"}
                    >
                      Askıdan kaldır
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
                      </>
                    )}
                    {member.id !== user?.id && member.staff_tag !== "owner" && (
                      <button
                        type="button"
                        onClick={() => setConfirmUser(member)}
                        disabled={busy === member.id}
                        className="chip border-danger/40 bg-danger/10 px-2 py-1 text-[0.65rem] text-[#ffb3bb]"
                      >
                        Hesabı sil
                      </button>
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
                {(sale.counted ?? true) === false && (
                  <span className="badge border border-danger/40 bg-danger/10 text-[0.55rem] font-bold text-danger">
                    SAYILMIYOR
                  </span>
                )}
                {(sale.counted ?? true) === false && sale.flag_reason && (
                  <span className="text-[0.6rem] text-[#ffd166]">şüphe: {sale.flag_reason}</span>
                )}
                <button
                  type="button"
                  onClick={() => void toggleSaleCounted(sale)}
                  disabled={busy === sale.id}
                  className="chip px-2 py-1 text-[0.62rem]"
                >
                  {(sale.counted ?? true) ? "Sayma" : "Başarılı say"}
                </button>
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

        {tab === "usersDetails" && (
          <>
            <input
              className="field"
              value={memberQuery}
              onChange={(event) => setMemberQuery(event.target.value)}
              placeholder="İsim veya e-posta ara"
            />
            {members.length === 0 && <Empty text="Kullanıcı yok." />}
            {members
              .filter((member) => {
                const needle = memberQuery.trim().toLocaleLowerCase("tr");
                if (!needle) return true;
                return (
                  member.username.toLocaleLowerCase("tr").includes(needle) ||
                  (member.email ?? "").toLocaleLowerCase("tr").includes(needle)
                );
              })
              .map((member) => (
                <div key={member.id} className="card flex items-center gap-3 p-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                      @{member.username}
                      {member.verified_seller && <VerifiedTick size={12} />}
                      {member.staff_tag && <StaffBadge tag={member.staff_tag} small />}
                    </p>
                    <p className="truncate text-[0.7rem] text-muted-2">{member.email ?? "—"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailUser(member.id)}
                    className="btn btn-ghost h-8 shrink-0 px-3 text-[0.7rem]"
                  >
                    İncele
                  </button>
                </div>
              ))}
          </>
        )}

        {tab === "reviewRemove" && (
          <>
            <div className="card p-4">
              <h2 className="text-sm font-bold">Değerlendirmeyi kaldır</h2>
              <p className="mt-1 text-[0.7rem] leading-relaxed text-muted-2">
                Kullanıcıyı seç, profilindeki değerlendirmelerden kaldırmak istediğine bas.
              </p>
              <div className="mt-3">
                <MemberSearch onPick={setReviewMember} selectedId={reviewMember?.id} />
              </div>
              {reviewMember && (
                <p className="mt-2 text-[0.7rem] text-accent">Seçili: @{reviewMember.username}</p>
              )}
            </div>
            {reviewMember ? (
              <AdminReviewList sellerId={reviewMember.id} />
            ) : (
              <Empty text="Önce bir kullanıcı seç." />
            )}
          </>
        )}

        {tab === "profileEdit" && role === "owner" && <ProfileEditor />}

        {tab === "frames" && role === "owner" && (
          <div className="card p-4">
            <h2 className="text-sm font-bold">Çerçeve</h2>
            <p className="mt-1 text-[0.7rem] text-muted-2">
              Kullanıcı adı veya e-posta yaz, çerçeve seç. Verirsen kişi o çerçeveyi takabilir,
              alırsan kişiden kalkar.
            </p>

            <div className="mt-3 flex gap-1.5 rounded-xl border border-line-soft bg-white/3 p-1">
              {[
                { key: "give" as const, label: "Çerçeve Ver" },
                { key: "take" as const, label: "Çerçeve Al" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFrameMode(item.key)}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-[0.7rem] font-semibold transition ${
                    frameMode === item.key ? "bg-accent/15 text-accent" : "text-muted hover:text-text"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <input
              className="field mt-3"
              value={frameQuery}
              onChange={(event) => setFrameQuery(event.target.value)}
              placeholder="kullanıcı adı veya e-posta"
            />

            <p className="mt-3 text-[0.62rem] font-semibold uppercase tracking-wide text-muted-2">
              Tag çerçeveleri
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {frameList
                .filter((frame) => frame.category === "tag")
                .map((frame) => (
                  <button
                    key={frame.slug}
                    type="button"
                    onClick={() => setFrameChoice(frame.slug)}
                    className={`chip ${frameChoice === frame.slug ? "chip-active" : ""}`}
                  >
                    {frame.name}
                  </button>
                ))}
            </div>

            <p className="mt-3 text-[0.62rem] font-semibold uppercase tracking-wide text-muted-2">
              Başarı çerçeveleri
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {frameList
                .filter((frame) => frame.category === "achievement")
                .map((frame) => (
                  <button
                    key={frame.slug}
                    type="button"
                    onClick={() => setFrameChoice(frame.slug)}
                    className={`chip ${frameChoice === frame.slug ? "chip-active" : ""}`}
                  >
                    {frame.name}
                  </button>
                ))}
            </div>

            <button
              type="button"
              onClick={() => grantFrame(frameMode === "take")}
              disabled={busy === "frame"}
              className={`mt-4 h-10 w-full rounded-xl text-sm font-semibold transition disabled:opacity-60 ${
                frameMode === "take"
                  ? "border border-danger/35 bg-danger/10 text-[#ffb3bb] hover:bg-danger/18"
                  : "btn btn-primary"
              }`}
            >
              {busy === "frame" ? <Spinner /> : frameMode === "take" ? "Çerçeveyi Al" : "Çerçeve Ver"}
            </button>
          </div>
        )}

        {tab === "notify" && (
          <div className="card p-4">
            <h2 className="text-sm font-bold">Bildirim gönder</h2>
            <p className="mt-1 text-[0.7rem] text-muted-2">
              Kullanıcı adı veya e-posta yaz, başlık ve mesajı gir. Bildirim kişinin bildirim
              kutusuna düşer.
            </p>
            <input
              className="field mt-3"
              value={notifyQuery}
              onChange={(event) => setNotifyQuery(event.target.value)}
              placeholder="kullanıcı adı veya e-posta"
            />
            <input
              className="field mt-2"
              value={notifyTitle}
              onChange={(event) => setNotifyTitle(event.target.value)}
              maxLength={120}
              placeholder="Bildirim başlığı"
            />
            <textarea
              className="field mt-2 resize-none text-[0.8rem] leading-relaxed"
              value={notifyBody}
              onChange={(event) => setNotifyBody(event.target.value)}
              rows={5}
              maxLength={500}
              placeholder="Bildirim mesajı (istersen boş bırak)"
            />
            <p className="mt-1 text-right text-[0.62rem] text-muted-2">{notifyBody.length}/500</p>
            <button
              type="button"
              onClick={sendManualNotification}
              disabled={busy === "notify"}
              className="btn btn-primary mt-2 h-10 w-full text-sm"
            >
              {busy === "notify" ? <Spinner /> : <><BellIcon width={14} height={14} /> Bildirim gönder</>}
            </button>
            {notifyTarget && (
              <p className="mt-2 text-[0.7rem] text-accent">
                Son gönderilen: @{notifyTarget.username}
              </p>
            )}
          </div>
        )}

        {tab === "tags" && (
          <div className="card p-4">
            <h2 className="text-sm font-bold">Rozet ver / al</h2>
            <p className="mt-1 text-[0.7rem] text-muted-2">
              Kullanıcı adı veya e-posta yaz, rozeti seç. Rozet profilde ve ilanlarında görünür.
            </p>
            <input
              className="field mt-3"
              value={tagQuery}
              onChange={(event) => setTagQuery(event.target.value)}
              placeholder="kullanıcı adı veya e-posta"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {BADGES.map((badge) => (
                <button
                  key={badge.key}
                  type="button"
                  onClick={() => setTagChoice(badge.key)}
                  className={`chip px-2.5 py-1 text-[0.7rem] ${
                    tagChoice === badge.key ? "chip-active" : ""
                  }`}
                >
                  {badge.label}
                </button>
              ))}
            </div>

            <div className="mt-2 flex gap-1.5">
              <input
                className="field h-9 text-[0.72rem]"
                value={customTag}
                onChange={(event) => setCustomTag(event.target.value)}
                maxLength={24}
                placeholder="Özel rozet yaz (ör. Efsane Satıcı)"
              />
              <button
                type="button"
                onClick={() => {
                  const value = customTag.trim();
                  if (value.length < 2) return;
                  setTagChoice(value);
                }}
                className="shrink-0 rounded-lg border border-line bg-white/4 px-3 text-[0.7rem] font-semibold text-muted"
              >
                Seç
              </button>
            </div>

            <p className="mt-2 text-[0.66rem] text-muted-2">
              Seçili rozet: <span className="font-semibold text-accent">{badgeLabel(tagChoice)}</span>
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => grantTag(false)}
                disabled={busy === "tag"}
                className="btn btn-primary h-10 flex-1 text-sm"
              >
                {busy === "tag" ? <Spinner /> : "Etiket ver"}
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
            <h2 className="text-sm font-bold">Moderatör ata</h2>
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
              {busy === "role" ? <Spinner /> : "Rolü ver"}
            </button>
          </div>
        )}

        {tab === "announce" && role === "owner" && (
          <div className="card p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <BellIcon width={15} height={15} className="text-accent" /> Duyuru
            </h2>
            <p className="mt-1 text-[0.7rem] text-muted-2">
              Yazdığın mesaj sitenin üstünde altın renkli ince bir şerit olarak herkese görünür.
            </p>

            {currentAnnouncement && (
              <div className="mt-3 rounded-xl border border-[#ffd166]/30 bg-[#ffd166]/8 p-3">
                <p className="flex items-center justify-between gap-2 text-[0.62rem] font-semibold uppercase tracking-wider text-[#ffd166]">
                  Yayındaki duyuru
                  <span className="shrink-0 text-[0.58rem] font-normal text-muted-2">
                    {new Date(currentAnnouncement.created_at).toLocaleDateString("tr-TR")}
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-[0.8rem] leading-relaxed text-text">
                  {currentAnnouncement.body}
                </p>
                <button
                  type="button"
                  onClick={() => setConfirmAnnouncement(true)}
                  disabled={busy === "announce"}
                  className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 px-3 text-[0.7rem] font-semibold text-[#ffb3bb] transition hover:bg-danger/15 disabled:opacity-60"
                >
                  <XIcon width={12} height={12} /> Duyuruyu Kaldır
                </button>
              </div>
            )}

            <textarea
              className="field mt-3 min-h-28 resize-y"
              value={announceBody}
              onChange={(event) => setAnnounceBody(event.target.value)}
              placeholder="Duyuru mesajını yaz…"
              maxLength={300}
            />
            <div className="mt-1 flex items-center justify-between text-[0.65rem] text-muted-2">
              <span>En fazla 300 karakter</span>
              <span>{announceBody.length}/300</span>
            </div>
            <button
              type="button"
              onClick={publishAnnouncement}
              disabled={busy === "announce"}
              className="btn btn-primary mt-3 h-10 w-full text-sm"
            >
              {busy === "announce" ? <Spinner /> : "Yayınla"}
            </button>
          </div>
        )}

        {tab === "stats" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Kullanıcı", value: stats.users, icon: <UsersIcon width={16} height={16} /> },
              { label: "Son 24 saat üye", value: stats.newUsers, icon: <UsersIcon width={16} height={16} /> },
              { label: "Yayında ilan", value: stats.activeListings, icon: <StarIcon width={16} height={16} /> },
              { label: "Son 24 saat ilan", value: stats.newListings, icon: <StarIcon width={16} height={16} /> },
              { label: "Toplam ilan", value: stats.listings, icon: <StarIcon width={16} height={16} /> },
              { label: "Satış", value: stats.sales, icon: <CheckIcon width={16} height={16} /> },
              { label: "Açık destek", value: stats.openTickets, icon: <ClockIcon width={16} height={16} /> },
              { label: "Açık bildiri", value: stats.openReports, icon: <FlagIcon width={16} height={16} /> },
              { label: "İncelemede değerlendirme", value: stats.pendingReviews, icon: <StarIcon width={16} height={16} /> },
              { label: "Sayılmayan işlem", value: stats.suspectSales, icon: <ShieldIcon width={16} height={16} /> },
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
      {detailUser && (
        <MemberDetail
          userId={detailUser}
          onClose={() => setDetailUser(null)}
          onDeleted={() => {
            setDetailUser(null);
            setNotice("Hesap silindi.");
            void loadTab();
          }}
        />
      )}

      <ReasonDialog
        open={Boolean(closeTicketTarget)}
        title="Talebi kapat"
        description={
          closeTicketTarget
            ? `@${profiles[closeTicketTarget.user_id]?.username ?? "kullanıcı"} kişisine "Talebiniz Kapatıldı; İşte Sonuçlar" bildirimi gidecek.`
            : undefined
        }
        confirmLabel="Kapat ve Gönder"
        required
        busy={Boolean(closeTicketTarget && busy === closeTicketTarget.id)}
        onSubmit={({ note }) => {
          const target = closeTicketTarget;
          if (target) void closeTicket(target, note);
        }}
        onCancel={() => setCloseTicketTarget(null)}
      />

      <ReasonDialog
        open={Boolean(closeApplicationTarget)}
        title="Başvuruyu sonuçlandır"
        description={
          closeApplicationTarget
            ? `@${profiles[closeApplicationTarget.user_id]?.username ?? "kullanıcı"} kişisine sonuç bildirimi gidecek.`
            : undefined
        }
        options={[
          { key: "approved", label: "Geçti" },
          { key: "rejected", label: "Kaldı" },
        ]}
        confirmLabel="Sonuçlandır ve Gönder"
        busy={Boolean(closeApplicationTarget && busy === closeApplicationTarget.id)}
        onSubmit={({ note, choice }) => {
          const target = closeApplicationTarget;
          if (target) void closeApplication(target, choice === "approved", note);
        }}
        onCancel={() => setCloseApplicationTarget(null)}
      />

      <ReasonDialog
        open={Boolean(closeReportTarget)}
        title="Bildiriyi kapat"
        description={
          closeReportTarget
            ? `@${profiles[closeReportTarget.reporter_id]?.username ?? "kullanıcı"} kişisine "Bildiriniz Sonuçlandı; İşte Sonuçlar" bildirimi gidecek.`
            : undefined
        }
        confirmLabel="Kapat ve Gönder"
        required
        busy={Boolean(closeReportTarget && busy === closeReportTarget.id)}
        onSubmit={({ note }) => {
          const target = closeReportTarget;
          if (target) void closeReport(target, note);
        }}
        onCancel={() => setCloseReportTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Kayıt silinsin mi?"
        description={
          deleteTarget
            ? `${deleteTarget.label} kalıcı olarak silinecek. Bu işlem geri alınamaz.`
            : undefined
        }
        confirmLabel="Sil"
        danger
        busy={Boolean(deleteTarget && busy === deleteTarget.id)}
        onConfirm={() => void removeTicketOrApplication()}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={confirmAnnouncement}
        title="Duyuru kaldırılsın mı?"
        description="Duyuru sitenin üstünden kalkar. Bu işlem geri alınamaz."
        confirmLabel="Kaldır"
        danger
        busy={busy === "announce"}
        onConfirm={removeAnnouncement}
        onCancel={() => setConfirmAnnouncement(false)}
      />

      <BanDialog
        open={Boolean(banTarget)}
        username={banTarget?.username ?? null}
        busy={Boolean(banTarget && busy === banTarget.id)}
        onConfirm={(days, reason) => {
          const target = banTarget;
          setBanTarget(null);
          if (target) void adminMember(target.id, "ban", days, reason);
        }}
        onCancel={() => setBanTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(confirmUser)}
        title="Hesap silinsin mi?"
        description={
          confirmUser
            ? `@${confirmUser.username} hesabı, ilanları, mesajları ve tüm kayıtları kalıcı olarak silinecek. Bu işlem geri alınamaz.`
            : undefined
        }
        confirmLabel="Hesabı sil"
        danger
        busy={Boolean(confirmUser && busy === confirmUser.id)}
        onConfirm={() => {
          const target = confirmUser;
          setConfirmUser(null);
          if (target) void adminMember(target.id, "delete");
        }}
        onCancel={() => setConfirmUser(null)}
      />
    </AppShell>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="card px-5 py-10 text-center text-sm text-muted-2">{text}</div>
  );
}
