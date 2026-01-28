function normalizePartNumber(s) {
  if (!s) return null;
  return String(s)
    .toUpperCase()
    .replace(/[\s\-_.]/g, "")
    .trim();
}
module.exports = { normalizePartNumber };
