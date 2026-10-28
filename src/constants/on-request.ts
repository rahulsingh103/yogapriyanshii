/**
 * The owner's line for classes that aren't on the timetable (2026-10-26), verbatim. Its own tiny module
 * so the class pages and an on-request article (`action: ask`) share it without the article chunk
 * loading the class page copy. Pure, like class-pages.ts. Never on the homepage.
 */
export const CLASS_PAGE_ON_REQUEST_LINE =
  'Not on the timetable yet. Send a message and Priyanshi will find a time with you. In person in Dubai or live online.';
