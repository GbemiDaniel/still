/**
 * Your details for the feedback form and the "get in touch" links. Fill these in.
 *
 * The feedback form sends through Web3Forms (https://web3forms.com), which emails each message
 * to you. Its access key is meant to be public (it can only send messages to your address), so
 * it is fine for it to live here in the repo. Until a real key is pasted in, the form stays
 * hidden on the live site so no visitor ever meets a form that cannot send.
 */
export const WEB3FORMS_ACCESS_KEY: string =
  import.meta.env.VITE_WEB3FORMS_KEY || 'PASTE_YOUR_WEB3FORMS_ACCESS_KEY_HERE';

/**
 * Links shown under "get in touch". Leave any of them empty and it is simply not shown.
 * Use full addresses for the web links (starting with https://).
 */
export const CONTACT = {
  email: '', // [MY EMAIL], for example 'name@example.com' (shown as a mailto link)
  x: '', // [X], for example 'https://x.com/yourname'
  linkedin: '', // [LINKEDIN], for example 'https://www.linkedin.com/in/yourname'
  portfolio: '', // [PORTFOLIO], for example 'https://yourname.com'
};

export const feedbackReady = !!WEB3FORMS_ACCESS_KEY && !WEB3FORMS_ACCESS_KEY.startsWith('PASTE_');
