import { parseContent } from './parse-content.util';

const cases = [
  'Hello @OmarHassan check #typescript and #nest_js!',
  'No mentions or hashtags here.',
  '@a @verylongusername123456789 should only capture up to 15 chars',
  'Email-like email@domain.com should not create a mention.',
  'Punctuation: (@user), #hash-tag vs #hash_tag',
];

for (const c of cases) {
  console.log('INPUT:', c);
  console.log('OUTPUT:', JSON.stringify(parseContent(c), null, 2));
  console.log('---');
}
