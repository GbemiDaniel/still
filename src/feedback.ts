/**
 * Feedback and contact. The form sends only what someone types (a message, and an email if
 * they choose) to Web3Forms, which emails it on. Nothing is stored. Spam: a hidden honeypot,
 * a short wait after opening, a pause between sends and a cap per visit. Offline is said
 * kindly, and the words stay in the field.
 */
import { COPY } from './content';
import { CONTACT, WEB3FORMS_ACCESS_KEY, feedbackReady } from './contact';

const ENDPOINT = 'https://api.web3forms.com/submit';
const MIN_OPEN_MS = 3000;
const COOLDOWN_MS = 30000;
const MAX_SENDS = 3;
const TIMEOUT_MS = 15000;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
type State = 'idle' | 'sending' | 'ok' | 'error' | 'offline';

export function createFeedback() {
  const F = COPY.feedback;
  const form = $<HTMLFormElement>('feedback-form');
  const msg = $<HTMLTextAreaElement>('fb-message');
  const email = $<HTMLInputElement>('fb-email');
  const trap = $<HTMLInputElement>('fb-botcheck');
  const status = $('fb-status');
  const send = $<HTMLButtonElement>('fb-send');

  // The form shows once a real key is in place (and always in development, to try it).
  const formOn = feedbackReady || import.meta.env.DEV;
  form.hidden = !formOn;
  $('feedback-note').hidden = !formOn;

  $('feedback-title').textContent = formOn ? F.title : F.contactTitle;
  $('feedback-note').textContent = F.note;
  $('fb-message-label').textContent = F.message;
  $('fb-email-label').textContent = F.email;
  $('fb-trap-label').textContent = F.honeypot;
  $('feedback-close').textContent = F.close;
  send.textContent = F.send;

  // "get in touch": only the links that have been filled in, and only safe kinds of address.
  const links: [keyof typeof CONTACT, string][] = [];
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(CONTACT.email)) links.push(['email', `mailto:${CONTACT.email}`]);
  for (const k of ['x', 'linkedin', 'portfolio'] as const) {
    if (/^https:\/\/\S+$/.test(CONTACT[k])) links.push([k, CONTACT[k]]);
  }
  const contact = $('contact');
  contact.hidden = !links.length;
  $('contact-title').textContent = F.contactTitle;
  for (const [k, href] of links) {
    const a = document.createElement('a');
    a.className = 'pill';
    a.href = href;
    a.textContent = F.links[k];
    if (k !== 'email') {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    const li = document.createElement('li');
    li.appendChild(a);
    $('contact-links').appendChild(li);
  }

  let openedAt = 0;
  let lastSent = -Infinity;
  let sends = 0;
  let sending = false;

  function say(state: State, text: string) {
    status.dataset.state = state;
    status.textContent = text;
  }

  function invalid(el: HTMLElement, text: string) {
    el.setAttribute('aria-invalid', 'true');
    say('error', text);
    el.focus();
  }

  for (const el of [msg, email]) el.addEventListener('input', () => el.removeAttribute('aria-invalid'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    const text = msg.value.trim();
    const from = email.value.trim();
    if (!text) return invalid(msg, F.empty);
    if (from && !email.checkValidity()) return invalid(email, F.badEmail);
    // The honeypot is invisible to people; only a script fills it. Look sent, send nothing.
    if (trap.checked) { form.reset(); return say('ok', F.sent); }
    const now = performance.now();
    if (now - openedAt < MIN_OPEN_MS || now - lastSent < COOLDOWN_MS) return say('error', F.tooSoon);
    if (sends >= MAX_SENDS) return say('error', F.limit);
    if (!navigator.onLine) return say('offline', F.offline);

    sending = true;
    send.disabled = true;
    send.textContent = F.sending;
    say('sending', F.sending);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        // Only what they typed, plus a subject line so the email is recognisable.
        body: JSON.stringify({
          access_key: WEB3FORMS_ACCESS_KEY,
          subject: F.subject,
          from_name: 'Still',
          message: text,
          ...(from ? { email: from } : {}),
        }),
        signal: 'timeout' in AbortSignal ? AbortSignal.timeout(TIMEOUT_MS) : undefined,
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean };
      if (res.ok && json.success !== false) {
        sends++;
        lastSent = performance.now();
        form.reset();
        say('ok', F.sent);
      } else {
        say('error', F.failed);
      }
    } catch {
      say(navigator.onLine ? 'error' : 'offline', navigator.onLine ? F.failed : F.offline);
    } finally {
      sending = false;
      send.disabled = false;
      send.textContent = F.send;
    }
  });

  return {
    /** True when the form is shown (a real key is in place, or this is development). */
    form: formOn,
    /** True when there is something to open: the form, or at least one contact link. */
    available: formOn || links.length > 0,
    /** Call as the sheet opens: starts the short wait and clears an old status. */
    opened() {
      openedAt = performance.now();
      if (status.dataset.state !== 'offline' || navigator.onLine) say('idle', '');
    },
    get focusTarget(): HTMLElement { return formOn ? msg : $('feedback-close'); },
  };
}
