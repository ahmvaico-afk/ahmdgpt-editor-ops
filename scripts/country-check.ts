import { countryFromPhone } from "../src/lib/screening";

/**
 * The shapes real applicants actually type, as invented numbers.
 *
 * The awkward ones are deliberate: people drop the trunk zero, add a digit by
 * accident, and write the same country four different ways. India matters as
 * much as the two advertised markets — Indian mobiles collide with both once
 * the zero is gone, so the cases that must come back "other" are the ones
 * worth keeping.
 */
const cases: [string, string, string][] = [
  ["+92 300 1234567", "pk", "PK international"],
  ["00923001234567", "pk", "PK with 00 prefix"],
  ["03001234567", "pk", "PK local"],
  ["0300-123-4567", "pk", "PK local, punctuated"],
  ["3001234567", "pk", "PK, trunk zero dropped"],
  ["3211234567", "pk", "PK, trunk zero dropped"],
  ["32112345678", "pk", "PK, zero dropped and a digit over"],
  ["033012345678", "pk", "PK local with a digit over"],
  ["+92 42 3576 1234", "pk", "PK landline"],
  ["+63 917 123 4567", "ph", "PH international"],
  ["00639171234567", "ph", "PH with 00 prefix"],
  ["09171234567", "ph", "PH local"],
  ["0917-123-4567", "ph", "PH local, punctuated"],
  ["+91 73964 27330", "other", "India international"],
  ["9034123456", "other", "India, 10 digits"],
  ["9990123456", "other", "India, 10 digits"],
  ["9234567890", "other", "India starting 92 — must not read as PK"],
  ["6312345678", "other", "India starting 63 — must not read as PH"],
  ["+60 12 344 5829", "other", "Malaysia"],
  ["+44 7700 900123", "other", "UK"],
  ["+1 415 555 0101", "other", "US"],
  ["", "other", "empty"],
  ["12345", "other", "too short"],
];

let bad = 0;
for (const [input, want, note] of cases) {
  const got = countryFromPhone(input);
  if (got !== want) bad += 1;
  console.log(
    `${got === want ? "ok  " : "FAIL"}  ${input.padEnd(18)} -> ${got.padEnd(5)} ${note}`,
  );
}
console.log(bad === 0 ? "\nall passed" : `\n${bad} FAILED`);
process.exit(bad === 0 ? 0 : 1);
