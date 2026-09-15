import { describe, it, expect } from 'vitest';
import { buildCalendlyEmbedUrl, resolveCalendlyUrl, CALL_THEME } from '../lib/calendly';

const VALID = 'https://calendly.com/robinkwee/30min';

describe('resolveCalendlyUrl', () => {
  it('accepts a Calendly scheduling link', () => {
    expect(resolveCalendlyUrl(VALID)).toBe(VALID);
    expect(resolveCalendlyUrl('https://www.calendly.com/robinkwee/30min')).toBe(
      'https://www.calendly.com/robinkwee/30min'
    );
  });

  it('trims surrounding whitespace from a pasted value', () => {
    expect(resolveCalendlyUrl(`  ${VALID}  `)).toBe(VALID);
  });

  it('treats a missing or empty value as unconfigured', () => {
    expect(resolveCalendlyUrl(undefined)).toBeNull();
    expect(resolveCalendlyUrl('')).toBeNull();
    expect(resolveCalendlyUrl('   ')).toBeNull();
  });

  it('rejects any origin other than Calendly', () => {
    // This value decides which origin gets an iframe on the page, so a
    // misconfigured or hostile link must not be able to redirect it.
    expect(resolveCalendlyUrl('https://evil.example.com/robinkwee')).toBeNull();
    expect(resolveCalendlyUrl('https://calendly.com.evil.example.com/x')).toBeNull();
    expect(resolveCalendlyUrl('https://notcalendly.com/x')).toBeNull();
  });

  it('rejects non-https schemes', () => {
    expect(resolveCalendlyUrl('http://calendly.com/robinkwee/30min')).toBeNull();
    expect(resolveCalendlyUrl('javascript:alert(1)')).toBeNull();
    expect(resolveCalendlyUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  it('rejects a value that is not a URL at all', () => {
    expect(resolveCalendlyUrl('calendly.com/robinkwee')).toBeNull();
    expect(resolveCalendlyUrl('my calendly link')).toBeNull();
  });

  it('rejects a bare calendly.com, which schedules nothing', () => {
    expect(resolveCalendlyUrl('https://calendly.com')).toBeNull();
    expect(resolveCalendlyUrl('https://calendly.com/')).toBeNull();
  });

  it('is case-insensitive about the host', () => {
    expect(resolveCalendlyUrl('https://Calendly.COM/robinkwee/30min')).toBe(VALID);
  });

  it('drops a fragment, which the embed cannot use', () => {
    expect(resolveCalendlyUrl(`${VALID}#top`)).toBe(VALID);
  });
});

describe('buildCalendlyEmbedUrl', () => {
  it('applies the site theme and hides the second consent banner', () => {
    const params = new URL(buildCalendlyEmbedUrl(VALID)).searchParams;
    expect(params.get('background_color')).toBe(CALL_THEME.backgroundColor);
    expect(params.get('text_color')).toBe(CALL_THEME.textColor);
    expect(params.get('primary_color')).toBe(CALL_THEME.primaryColor);
    expect(params.get('hide_gdpr_banner')).toBe('1');
  });

  it('passes colours without a leading hash, as Calendly expects', () => {
    const params = new URL(buildCalendlyEmbedUrl(VALID)).searchParams;
    for (const key of ['background_color', 'text_color', 'primary_color']) {
      expect(params.get(key)).not.toContain('#');
    }
  });

  it('keeps query parameters already on the configured link', () => {
    // People paste links carrying prefill values, hidden event details or UTM
    // tags; dropping them would quietly change what the embed does.
    const configured = `${VALID}?hide_event_type_details=1&utm_source=site&name=Jane`;
    const params = new URL(buildCalendlyEmbedUrl(configured)).searchParams;
    expect(params.get('hide_event_type_details')).toBe('1');
    expect(params.get('utm_source')).toBe('site');
    expect(params.get('name')).toBe('Jane');
    expect(params.get('hide_gdpr_banner')).toBe('1');
  });

  it('keeps the path, so the configured event type is the one booked', () => {
    expect(new URL(buildCalendlyEmbedUrl(VALID)).pathname).toBe('/robinkwee/30min');
  });

  it('does not accumulate duplicate parameters when applied twice', () => {
    const once = buildCalendlyEmbedUrl(VALID);
    const twice = buildCalendlyEmbedUrl(once);
    expect(new URL(twice).searchParams.getAll('hide_gdpr_banner')).toEqual(['1']);
    expect(twice).toBe(once);
  });
});
