/**
 * Regulatory statements that stay in their original language.
 *
 * FCC/IC/CE/UKCA declarations, safety warnings and disposal notes are legally
 * required to appear in the wording the regulator published, so translating them
 * would be a defect, not a miss. Both the review list and the memory analysis use
 * this test so the two reports agree on what counts as "kept English on purpose".
 */

const LEGAL =
  /(FCC|ICES-?\d|UKCA|CE marking|compliance|interference|radio frequency|exposure|Class [AB]|regulatory|declaration of conformity|EN 5\d{4}|EN 3\d{4}|directive)/i;
const LEGAL_HEADING = /(safety warnings|federal communication|conformity|regulatory|disposal)/i;

/** Wording that is intentionally kept in the source language. */
export function isLegal(segment) {
  const text = String(segment ?? '');
  return LEGAL.test(text) || LEGAL_HEADING.test(text);
}
