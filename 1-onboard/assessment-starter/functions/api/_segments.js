// Optional: auto-tag known stakeholders when they submit.
// Server-side only. Pages never serves files from functions/, so respondents
// can't see who carries which weight. Anyone not listed can be tagged by hand
// in the dashboard.
//
// Format (lowercase emails):
//   "pat@client.com": "veto",
//   "sam@client.com": "vote",
//   "lee@client.com": "voice",
//
// Never commit a real client's list to a shared or public repo.

export const SEGMENTS = {};
