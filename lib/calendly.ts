/**
 * Calendly embed configuration.
 *
 * Booking is handled by Calendly, which owns availability, confirmations,
 * calendar invites, the Google Meet link, reminders, and rescheduling.
 *
 * The scheduling link comes from `NEXT_PUBLIC_CALENDLY_URL`. It is never
 * hardcoded: a wrong link renders a Calendly 404 where the booking page should
 * be, which is worse than no embed at all. When the variable is missing or
 * malformed, `/call` falls back to an email call-to-action instead.
 */

/** Only Calendly may be framed into the page. */
const ALLOWED_HOSTS = ['calendly.com', 'www.calendly.com'];

export interface CalendlyTheme {
  /** Hex colours WITHOUT the leading '#', as Calendly's embed params expect. */
  backgroundColor: string;
  textColor: string;
  primaryColor: string;
}

export const CALL_THEME: CalendlyTheme = {
  backgroundColor: '0d0d0d',
  textColor: 'ededed',
  primaryColor: '34d399',
};

/**
 * Validate the configured scheduling link.
 *
 * This is the boundary that decides which origin gets an iframe on the site,
 * so a misconfigured or hostile value must not be able to point it somewhere
 * else. Anything that is not an https Calendly URL is rejected.
 */
export function resolveCalendlyUrl(
  raw: string | undefined = process.env.NEXT_PUBLIC_CALENDLY_URL
): string | null {
  if (!raw?.trim()) return null;

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }

  if (url.protocol !== 'https:') return null;
  if (!ALLOWED_HOSTS.includes(url.hostname.toLowerCase())) return null;
  // A bare "https://calendly.com" schedules nothing.
  if (url.pathname === '/' || url.pathname === '') return null;

  url.hash = '';
  return url.toString();
}

/**
 * Add the embed parameters to a validated scheduling link.
 *
 * Any query string already on the configured URL is preserved — people paste
 * links carrying `hide_event_type_details`, UTM tags or prefill values, and
 * dropping those would quietly change what the embed does. Colour parameters
 * are ignored by Calendly on plans without embed customisation, which is
 * harmless.
 */
export function buildCalendlyEmbedUrl(url: string, theme: CalendlyTheme = CALL_THEME): string {
  const embed = new URL(url);
  const params = embed.searchParams;

  params.set('background_color', theme.backgroundColor);
  params.set('text_color', theme.textColor);
  params.set('primary_color', theme.primaryColor);
  // The site states its own privacy position; a second banner inside the
  // iframe just covers the time slots on a phone.
  params.set('hide_gdpr_banner', '1');

  return embed.toString();
}
