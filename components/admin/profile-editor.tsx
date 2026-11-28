"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MemberSearch, type MemberHit } from "@/components/admin/member-search";
import { AdminReviewList } from "@/components/admin/review-admin";
import { Price } from "@/components/price";
import { Spinner } from "@/components/ui/spinner";
import { StaffBadge, VerifiedTick } from "@/components/user-badge";
import {
  deleteListingAsStaff,
  loadAdminMember,
  loadMemberListings,
  setMemberSalesCount,
  syncMemberSalesCount,
  type AdminListingRow,
  type AdminMember,
} from "@/lib/admin";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const STATUS_LABELS: Record<string, string> = {
  active: "Yayında",
  sold: "Satıldı",
  hidden: "Gizli",
  expired: "Süresi doldu",
  removed: "Kaldırıldı",
};

/** Kurucuya özel: seçilen kullanıcının profilini düzenler. */
export function ProfileEditor() {
  const supabase = getSupabaseBrowserClient();
  const [member, setMember] = useState<AdminMember | null>(null);
  const [picked, setPicked] = useState<MemberHit | null>(null);
  const [listings, setListings] = useState<AdminListingRow[]>([]);
  const [salesInput, setSalesInput] = useState("0");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [removeListing, setRemoveListing] = useState<AdminListingRow | null>(null);

  const refresh = useCallback(
    async (userId: string) => {
      if (!supabase) return;
      const [profile, rows] = await Promise.all([
        loadAdminMember(supabase, userId),
        loadMemberListings(supabase, userId),
      ]);
      setMember(profile);
      setSalesInput(String(profile?.sales_count ?? 0));
      setListings(rows);
    },
    [supabase],
  );

  async function pick(hit: MemberHit) {
    setPicked(hit);
    setMember(null);
    setListings([]);
    setNotice(null);
    setLoading(true);
    await refresh(hit.id);
    setLoading(false);
  }

  async function saveSalesCount() {
    if (!supabase || !member) return;
    setBusy("sales");
    setNotice(null);
    const result = await setMemberSalesCount(supabase, member.id, Number(salesInput));
    setBusy(null);
    if (result.error) {
      setNotice(result.error);
      return;
    }
    setMember({ ...member, sales_count: result.value });
    setSalesInput(String(result.value));
    setNotice(`Başarılı işlem sayısı ${result.value} olarak kaydedildi.`);
  }

  async function recalcSalesCount() {
    if (!supabase || !member) return;
    setBusy("sync");
    setNotice(null);
    const result = await syncMemberSalesCount(supabase, member.id);
    setBusy(null);
    if (result.error || result.value === null) {
      setNotice(result.error ?? "Sayı hesaplanamadı.");
      return;
    }
    setMember({ ...member, sales_count: result.value });
    setSalesInput(String(result.value));
    setNotice(`Onaylanan satışlara göre ${result.value} olarak güncellendi.`);
  }

  async function removeListingNow() {
    if (!supabase || !removeListing) return;
    setBusy("listing");
    const target = removeListing;
    const result = await deleteListingAsStaff(supabase, target.id);
    setBusy(null);
    setRemoveListing(null);
    if (result.error) {
      setNotice(result.error);
      return;
    }
    setListings((prev) => prev.filter((row) => row.id !== target.id));
    setNotice("İlan kaldırıldı.");
  }

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <h2 className="text-sm font-bold">Profili düzenle</h2>
        <p className="mt-1 text-[0.7rem] leading-relaxed text-muted-2">
          Kullanıcıyı seç; başarılı işlem sayısını düzenle, ilanlarını ve değerlendirmelerini kaldır.
        </p>
        <div className="mt-3">
          <MemberSearch onPick={pick} selectedId={picked?.id} />
        </div>
        {picked && (
          <p className="mt-2 text-[0.7rem] text-accent">Seçili: @{picked.username}</p>
        )}
      </div>

      {loading && (
        <p className="flex items-center gap-2 text-[0.72rem] text-muted-2">
          <Spinner /> Yükleniyor…
        </p>
      )}

      {!loading && picked && !member && (
        <div className="card p-4 text-[0.75rem] text-muted-2">Kullanıcı bulunamadı.</div>
      )}

      {!loading && member && (
        <>
          <div className="card p-4">
            <div className="flex items-center gap-2">
              <p className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm font-bold">
                <span className="truncate">@{member.username}</span>
                {member.verified_seller && <VerifiedTick size={12} />}
                {member.banned && (
                  <span className="badge border border-danger/40 bg-danger/10 text-[0.55rem] text-danger">
                    ASKIDA
                  </span>
                )}
              </p>
              <Link
                href={`/kullanici?id=${member.id}`}
                className="btn btn-ghost ml-auto h-7 shrink-0 px-2 text-[0.65rem]"
              >
                Profili aç
              </Link>
            </div>
            <p className="mt-1 truncate text-[0.7rem] text-muted-2">{member.email ?? "—"}</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <Mini label="Başarılı işlem" value={String(member.sales_count ?? 0)} />
              <Mini
                label="Puan"
                value={
                  (member.review_count ?? 0) > 0
                    ? `${Number(member.rating ?? 0).toFixed(1)} / 5`
                    : "Yok"
                }
              />
              <Mini label="Değerlendirme" value={String(member.review_count ?? 0)} />
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-bold">Başarılı işlem sayısı</h3>
            <div className="mt-2 flex items-center gap-2">
              <input
                className="field flex-1"
                inputMode="numeric"
                value={salesInput}
                onChange={(event) => setSalesInput(event.target.value.replace(/[^0-9]/g, ""))}
                placeholder="0"
              />
              <button
                type="button"
                onClick={saveSalesCount}
                disabled={busy !== null}
                className="btn btn-primary h-10 shrink-0 px-4 text-sm"
              >
                {busy === "sales" ? <Spinner /> : "Kaydet"}
              </button>
            </div>
            <button
              type="button"
              onClick={recalcSalesCount}
              disabled={busy !== null}
              className="btn btn-ghost mt-2 h-9 w-full text-[0.72rem]"
            >
              {busy === "sync" ? <Spinner /> : "Onaylanan satışlardan hesapla"}
            </button>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-bold">İlanları ({listings.length})</h3>
            {listings.length === 0 && (
              <p className="mt-1 text-[0.72rem] text-muted-2">İlanı yok.</p>
            )}
            <div className="mt-1.5">
              {listings.map((listing) => (
                <div
                  key={listing.id}
                  className="flex items-center gap-2 border-b border-line-soft py-1.5 last:border-0"
                >
                  <Link
                    href={`/ilan/goruntule?id=${listing.id}`}
                    className="min-w-0 flex-1 truncate text-[0.75rem] hover:text-accent"
                  >
                    {listing.title}
                  </Link>
                  <span className="shrink-0 text-[0.66rem] text-muted-2">
                    <Price value={Number(listing.price)} iconSize={11} />
                  </span>
                  <span className="shrink-0 text-[0.58rem] text-muted-2">
                    {STATUS_LABELS[listing.status] ?? listing.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRemoveListing(listing)}
                    className="shrink-0 rounded-md border border-danger/40 bg-danger/10 px-2 py-0.5 text-[0.6rem] font-semibold text-[#ffb3bb] hover:bg-danger/20"
                  >
                    Kaldır
                  </button>
                </div>
              ))}
            </div>
          </div>

          <AdminReviewList
            sellerId={member.id}
            canClearAll
            onChanged={(summary) => {
              setMember((prev) =>
                prev
                  ? { ...prev, review_count: summary.remaining, rating: summary.average }
                  : prev,
              );
            }}
          />

          {notice && <p className="text-[0.72rem] text-accent">{notice}</p>}
        </>
      )}

      <ConfirmDialog
        open={Boolean(removeListing)}
        title="İlan kaldırılsın mı?"
        description={removeListing ? `“${removeListing.title}” ilanı kalıcı olarak silinecek.` : undefined}
        confirmLabel="Kaldır"
        danger
        busy={busy === "listing"}
        onConfirm={removeListingNow}
        onCancel={() => setRemoveListing(null)}
      />
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/25 px-1.5 py-1.5">
      <p className="text-[0.58rem] text-muted-2">{label}</p>
      <p className="truncate text-[0.72rem] font-semibold text-text">{value}</p>
    </div>
  );
}
