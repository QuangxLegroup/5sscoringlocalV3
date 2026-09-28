(function (root) {
  "use strict";
  function date(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return "";
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : "";
  }
  function validate(record, previous = null, detectedYear = null) {
    const started = date(record.countermeasureDate);
    const completed = date(record.completedDate);
    if ((record.countermeasureDate && !started) || (record.completedDate && !completed)) return "Ngày thực tế không hợp lệ.";
    if (completed && (!started || completed < started)) return "Ngày hoàn thành thực tế phải từ ngày triển khai đối sách trở đi.";
    const detected = date(`${detectedYear}-${String(record.issueMonth || "").padStart(2, "0")}-${String(record.issueDay || 1).padStart(2, "0")}`);
    if (started && detected && started < detected) return "Ngày triển khai đối sách không được trước ngày phát hiện.";
    const changed = !previous || record.issueStatus !== previous.issueStatus
      || (record.countermeasureDate || "") !== (previous.countermeasureDate || "")
      || (record.completedDate || "") !== (previous.completedDate || "");
    if (changed && ["in_progress", "closed"].includes(record.issueStatus) && !started) return "Vui lòng nhập ngày thực tế triển khai đối sách.";
    if (changed && record.issueStatus === "closed" && !completed) return "Vui lòng nhập ngày hoàn thành thực tế.";
    return "";
  }
  function aggregate(records, year, periodYear) {
    const result = { detected: Array(12).fill(0), implemented: Array(12).fill(0), completed: Array(12).fill(0), carryImplementation: 0, carryCompletion: 0, missingDates: 0 };
    const start = `${year}-01-01`;
    for (const record of records) {
      const weight = Number(record.issueCount) > 0 ? Number(record.issueCount) : 1;
      const detectedYear = Number(periodYear(record.periodId));
      const month = Number(record.issueMonth);
      const implementation = date(record.countermeasureDate);
      const completion = record.issueStatus === "closed" ? date(record.completedDate) : "";
      if (detectedYear === Number(year) && Number.isInteger(month) && month >= 1 && month <= 12) result.detected[month - 1] += weight;
      for (const [value, key] of [[implementation, "implemented"], [completion, "completed"]]) {
        if (value && Number(value.slice(0, 4)) === Number(year)) result[key][Number(value.slice(5, 7)) - 1] += weight;
      }
      if (detectedYear < Number(year)) {
        if (!implementation || implementation >= start) result.carryImplementation += weight;
        if (!completion || completion >= start) result.carryCompletion += weight;
      }
      if (detectedYear <= Number(year) && ((["in_progress", "closed"].includes(record.issueStatus) && !implementation) || (record.issueStatus === "closed" && !completion))) result.missingDates += weight;
    }
    return result;
  }
  const api = { date, validate, aggregate };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SafetyTimeline = api;
})(typeof window === "object" ? window : globalThis);
