/**
 * Calendar booking helpers — meetings stay pending until confirmed.
 * Never claim an appointment is booked until confirmMeeting succeeds.
 */

export type MeetingStatus =
  | "pending_confirmation"
  | "scheduled"
  | "confirmed"
  | "completed"
  | "no_show"
  | "cancelled";

export interface ProposeMeetingInput {
  contactId: string;
  companyId?: string | null;
  campaignId?: string | null;
  scheduledAt?: Date;
  durationMin?: number;
  bookingUrl?: string;
  source: string;
  jobId?: string;
}

export interface ProposeMeetingResult {
  meetingId: string;
  status: MeetingStatus;
  bookingUrl: string | null;
}

export interface ConfirmMeetingInput {
  meetingId: string;
  providerEventId?: string;
  meetingUrl?: string;
  scheduledAt?: Date;
}

/** Minimal postgres.js-compatible client */
export type BookingSql = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
  json: (value: unknown) => unknown;
};

export function isMeetingConfirmed(meeting: {
  status: string;
  confirmed_at?: Date | null;
}): boolean {
  return (
    meeting.status === "confirmed" ||
    meeting.status === "scheduled" ||
    meeting.status === "completed" ||
    Boolean(meeting.confirmed_at)
  );
}

export async function proposeMeeting(
  sql: BookingSql,
  input: ProposeMeetingInput,
): Promise<ProposeMeetingResult> {
  const bookingUrl = input.bookingUrl ?? process.env.CALCOM_BOOKING_URL ?? null;
  const scheduledAt = input.scheduledAt ?? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const durationMin = input.durationMin ?? 15;

  const rows = (await sql`
    INSERT INTO meetings (
      contact_id, provider, scheduled_at, duration_min, meeting_url, status, metadata
    ) VALUES (
      ${input.contactId},
      'calcom',
      ${scheduledAt},
      ${durationMin},
      ${bookingUrl},
      'pending_confirmation',
      ${sql.json({
        source: input.source,
        bookingUrl,
        campaignId: input.campaignId ?? null,
        companyId: input.companyId ?? null,
        jobId: input.jobId ?? null,
        confirmed: false,
      })}
    )
    RETURNING id, status
  `) as Array<{ id: string; status: MeetingStatus }>;

  const row = rows[0];
  if (!row) throw new Error("proposeMeeting insert failed");

  await sql`
    INSERT INTO activities (contact_id, company_id, campaign_id, type, agent_id, job_id, body, metadata)
    VALUES (
      ${input.contactId},
      ${input.companyId ?? null},
      ${input.campaignId ?? null},
      'meeting_proposed',
      'calendar',
      ${input.jobId ?? null},
      ${`Booking link proposed — not confirmed yet${bookingUrl ? `: ${bookingUrl}` : ""}`},
      ${sql.json({ meetingId: row.id, bookingUrl, pendingConfirmation: true })}
    )
  `;

  return {
    meetingId: row.id,
    status: row.status,
    bookingUrl,
  };
}

export async function confirmMeeting(
  sql: BookingSql,
  input: ConfirmMeetingInput,
): Promise<{ meetingId: string; status: MeetingStatus }> {
  const rows = (await sql`
    UPDATE meetings SET
      status = 'confirmed',
      confirmed_at = now(),
      provider_event_id = COALESCE(${input.providerEventId ?? null}, provider_event_id),
      meeting_url = COALESCE(${input.meetingUrl ?? null}, meeting_url),
      scheduled_at = COALESCE(${input.scheduledAt ?? null}, scheduled_at),
      metadata = metadata || ${sql.json({ confirmed: true })}
    WHERE id = ${input.meetingId}
    RETURNING id, status, contact_id
  `) as Array<{ id: string; status: MeetingStatus; contact_id: string }>;

  const row = rows[0];
  if (!row) throw new Error(`Meeting not found: ${input.meetingId}`);

  await sql`
    INSERT INTO activities (contact_id, type, agent_id, body, metadata)
    VALUES (
      ${row.contact_id},
      'meeting_booked',
      'calendar',
      ${"Meeting confirmed with calendar provider"},
      ${sql.json({ meetingId: row.id, providerEventId: input.providerEventId ?? null })}
    )
  `;

  await sql`
    UPDATE contacts SET status = 'meeting_booked', updated_at = now()
    WHERE id = ${row.contact_id}
  `;

  return { meetingId: row.id, status: row.status };
}
