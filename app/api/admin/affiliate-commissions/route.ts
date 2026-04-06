import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminUser } from '@/lib/auth/authorization';
import { AppError, ValidationError } from '@/lib/http/errors';
import { fail, internalError, options } from '@/lib/http/responses';
import { asEnum, asString, ensureObject } from '@/lib/validators/common';
import { getCachedValue, invalidateCacheByPrefix } from '@/lib/cache/memory-cache';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const STATUS_VALUES = ['pending', 'paid', 'cancelled'] as const;
const GROUP_VALUES = ['none', 'referral_code', 'influencer_name'] as const;

type CommissionStatus = (typeof STATUS_VALUES)[number];
type GroupBy = (typeof GROUP_VALUES)[number];

type AffiliateCommissionRow = {
  id: number;
  referral_code: string;
  influencer_name: string;
  user_id: string;
  payment_id: string;
  plan: string;
  gross_amount: number;
  commission_pct: number;
  commission_amount: number;
  status: CommissionStatus;
  approved_at: string | null;
  paid_at: string | null;
  payout_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function parseStatus(input: string | null): CommissionStatus {
  if (!input) return 'pending';
  if (STATUS_VALUES.includes(input as CommissionStatus)) return input as CommissionStatus;
  throw new ValidationError('status is invalid');
}

function parseGroup(input: string | null): GroupBy {
  if (!input) return 'none';
  if (GROUP_VALUES.includes(input as GroupBy)) return input as GroupBy;
  throw new ValidationError('groupBy is invalid');
}

function groupCommissions(rows: AffiliateCommissionRow[], groupBy: GroupBy) {
  if (groupBy === 'none') return rows;

  const grouped = new Map<
    string,
    {
      groupBy: Exclude<GroupBy, 'none'>;
      groupValue: string;
      status: CommissionStatus;
      totalGrossAmount: number;
      totalCommissionAmount: number;
      averageCommissionPct: number;
      commissionCount: number;
      latestApprovedAt: string | null;
      latestCreatedAt: string;
    }
  >();

  rows.forEach((row) => {
    const keyValue = groupBy === 'referral_code' ? row.referral_code : row.influencer_name;
    const key = `${groupBy}:${keyValue}:${row.status}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        groupBy,
        groupValue: keyValue,
        status: row.status,
        totalGrossAmount: Number(row.gross_amount || 0),
        totalCommissionAmount: Number(row.commission_amount || 0),
        averageCommissionPct: Number(row.commission_pct || 0),
        commissionCount: 1,
        latestApprovedAt: row.approved_at,
        latestCreatedAt: row.created_at,
      });
      return;
    }

    existing.totalGrossAmount += Number(row.gross_amount || 0);
    existing.totalCommissionAmount += Number(row.commission_amount || 0);
    existing.averageCommissionPct += Number(row.commission_pct || 0);
    existing.commissionCount += 1;
    if (row.approved_at && (!existing.latestApprovedAt || row.approved_at > existing.latestApprovedAt)) {
      existing.latestApprovedAt = row.approved_at;
    }
    if (row.created_at > existing.latestCreatedAt) {
      existing.latestCreatedAt = row.created_at;
    }
  });

  return Array.from(grouped.values())
    .map((item) => ({
      ...item,
      totalGrossAmount: Number(item.totalGrossAmount.toFixed(2)),
      totalCommissionAmount: Number(item.totalCommissionAmount.toFixed(2)),
      averageCommissionPct: Number((item.averageCommissionPct / item.commissionCount).toFixed(2)),
    }))
    .sort((a, b) => (a.latestCreatedAt < b.latestCreatedAt ? 1 : -1));
}

export async function GET(req: Request) {
  const origin = req.headers.get('origin') || undefined;

  try {
    await requireAdminUser(req);
    const { searchParams } = new URL(req.url);
    const status = parseStatus(searchParams.get('status'));
    const groupBy = parseGroup(searchParams.get('groupBy'));

    const cacheKey = `admin:affiliate-commissions:${status}:${groupBy}`;

    const payload = await getCachedValue(cacheKey, 30_000, async () => {
      const { data, error } = await supabase
        .from('affiliate_commissions')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false })
        .limit(2000);

      if (error) throw error;
      const rows = (data || []) as AffiliateCommissionRow[];
      return {
        status,
        groupBy,
        totalRecords: rows.length,
        totals: {
          grossAmount: Number(rows.reduce((sum, row) => sum + Number(row.gross_amount || 0), 0).toFixed(2)),
          commissionAmount: Number(rows.reduce((sum, row) => sum + Number(row.commission_amount || 0), 0).toFixed(2)),
        },
        data: groupCommissions(rows, groupBy),
      };
    });

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof AppError) return fail(error, origin);
    return internalError(origin);
  }
}

export async function PATCH(req: Request) {
  const origin = req.headers.get('origin') || undefined;

  try {
    await requireAdminUser(req);

    const body = ensureObject(await req.json());
    const action = asEnum(body.action, 'action', ['mark_paid', 'cancel'] as const);
    const payoutReference = typeof body.payout_reference === 'undefined' ? null : asString(body.payout_reference, 'payout_reference', 120);
    const notes = typeof body.notes === 'undefined' ? null : asString(body.notes, 'notes', 2000);

    if (!Array.isArray(body.ids) || !body.ids.length) {
      throw new ValidationError('ids must be a non-empty array');
    }

    const ids = body.ids.map((raw) => {
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed <= 0) throw new ValidationError('ids must contain valid numeric ids');
      return parsed;
    });

    if (action === 'mark_paid' && !payoutReference) {
      throw new ValidationError('payout_reference is required for mark_paid');
    }

    const nowIso = new Date().toISOString();
    const patch =
      action === 'mark_paid'
        ? {
            status: 'paid',
            paid_at: nowIso,
            payout_reference: payoutReference,
            notes,
            updated_at: nowIso,
          }
        : {
            status: 'cancelled',
            notes,
            updated_at: nowIso,
          };

    const { error } = await supabase.from('affiliate_commissions').update(patch).in('id', ids).eq('status', 'pending');
    if (error) throw error;

    const { data: updatedRows, error: refetchError } = await supabase
      .from('affiliate_commissions')
      .select('*')
      .in('id', ids)
      .order('id', { ascending: true });

    if (refetchError) throw refetchError;

    invalidateCacheByPrefix('admin:affiliate-commissions:');
    invalidateCacheByPrefix('admin:overview');

    return NextResponse.json({ ok: true, action, data: updatedRows || [] });
  } catch (error) {
    if (error instanceof AppError) return fail(error, origin);
    return internalError(origin);
  }
}

export async function OPTIONS(req: Request) {
  return options(req.headers.get('origin') || undefined);
}
