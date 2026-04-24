// ============================================================
// LGK Scan Referral — client-side logic
// ============================================================

// Your deployed Apps Script Web App URL
const API_URL = "https://script.google.com/macros/s/AKfycbx_8guVY3ZfgGQ6MyLcNB27xKFReICy9Uo9RUNDjZZqe1km6z5Zis5h6IwrN6XWwZ9N/exec";

// Clinic info (used in patient WhatsApp message & PDF)
const CLINIC = {
  name: "Dr. L.G. Krishna Ultrasound Clinic",
  doctor: "Dr. Satish B., MBBS, DMRD",
  regNo: "KMC Reg. 69786",
  pcpndt: "PCPNDT Reg. No. 115 (Uttara Kannada)",
  address: "Sirsi, Uttara Kannada, Karnataka",
  phone: "7204764969",
  email: "drlgkscan@gmail.com",
  mapUrl: "https://maps.app.goo.gl/AgdDpqE4xxgwSymm6",
  bookingUrl: "https://drlgkscan.github.io/lgk-booking/booking.html",
  timings: "Mon–Sat: 9:30 AM – 5:30 PM",
  timingsNote: "Other timings available on request — please call 7204764969 in advance.",
  emergencyNote: "Emergency scans: call 7204764969 anytime, we will accommodate.",
  advanceBooking: "To guarantee your slot, you can book an advance token via the link below (small booking fee applies)."
};

// Scan type definitions: label + prep instructions
// Prep text is warm, patient-friendly — patients are often anxious
const PREG_PREP = "No preparation needed. You can eat normally and come calmly — nothing to worry about.";
const FAST_PREP = "Empty stomach for 3 hours is enough. Plain water is allowed.";
const BLADDER_PREP = "Full bladder needed — drink 4–5 glasses of water 1 hour before and do not urinate until the scan.";
const NT_PREP = "Full bladder preferred — 3–4 glasses of water 1 hour before. Food is fine, come calmly.";
const NOPREP = "No preparation needed.";
const AP_PREP = "3 hours empty stomach AND full bladder at time of scan.";

const SCAN_DB = {
  EP:             { label: "Early Pregnancy Scan",         prep: PREG_PREP },
  NT:             { label: "NT Scan (11–14 weeks)",        prep: NT_PREP },
  GROWTH:         { label: "Growth Scan",                  prep: PREG_PREP },
  GROWTH_DOPPLER: { label: "Growth Scan + Doppler",        prep: PREG_PREP },
  ANOMALY:        { label: "Anomaly Scan",                 prep: PREG_PREP + " Allow 45 minutes for the scan." },
  FETAL_ECHO:     { label: "Fetal Echo",                   prep: PREG_PREP },
  ANOMALY_ECHO:   { label: "Anomaly + Fetal Echo",         prep: PREG_PREP + " Allow 60 minutes." },
  FETAL_NEURO:    { label: "Fetal Neurosonogram",          prep: PREG_PREP },
  FOLLICULAR:     { label: "Follicular Study",             prep: BLADDER_PREP },
  ABDOMEN:        { label: "Abdomen Ultrasound",           prep: FAST_PREP },
  PELVIS:         { label: "Pelvis Ultrasound",            prep: BLADDER_PREP },
  AP:             { label: "Abdomen + Pelvis",             prep: AP_PREP },
  KUB:            { label: "KUB (Kidney-Ureter-Bladder)",  prep: BLADDER_PREP },
  THYROID:        { label: "Neck / Thyroid Ultrasound",    prep: NOPREP },
  BREAST1:        { label: "Breast Ultrasound (unilateral)", prep: NOPREP },
  BREAST2:        { label: "Breast Ultrasound (bilateral)", prep: NOPREP },
  MSK:            { label: "Musculoskeletal Ultrasound",   prep: NOPREP },
  SCROTUM:        { label: "Scrotum Ultrasound",           prep: NOPREP },
  EYE:            { label: "Eye / Orbit Ultrasound",       prep: NOPREP },
  CHEST:          { label: "Chest Ultrasound",             prep: NOPREP },
  ADS:            { label: "Arterial Doppler — Single limb", prep: NOPREP },
  VDS:            { label: "Venous Doppler — Single limb", prep: NOPREP },
  ADB:            { label: "Arterial Doppler — Both limbs", prep: NOPREP },
  VDB:            { label: "Venous Doppler — Both limbs",  prep: NOPREP },
  AVS:            { label: "Arterio-Venous Doppler — Single limb", prep: NOPREP },
  ADA:            { label: "Arterial Doppler — All limbs", prep: NOPREP },
  AVB:            { label: "Arterio-Venous Doppler — Both limbs", prep: NOPREP },
  CVD:            { label: "Carotid / Vertebral Doppler",  prep: NOPREP },
  RAD:            { label: "Renal Artery Doppler",         prep: FAST_PREP },
  PVD:            { label: "Portal Venous Doppler",        prep: FAST_PREP },
  PENILE:         { label: "Penile Doppler",               prep: NOPREP }
};

// ============================================================
// Storage helpers
// ============================================================
const STORE = {
  get: (k) => {
    try { return JSON.parse(localStorage.getItem(k)); }
    catch { return null; }
  },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  del: (k) => localStorage.removeItem(k)
};

const DEVICE_KEY = "lgk_referral_device";

// ============================================================
// UI helpers
// ============================================================
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}
function loading(on, msg) {
  const el = document.getElementById('loading');
  document.getElementById('loading-msg').textContent = msg || 'Please wait…';
  el.classList.toggle('hidden', !on);
}
function toast(msg, type) {
  const t = document.getElementById('toast');
  t.className = 'toast ' + (type || '');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3500);
}

// ============================================================
// Backend call helper
// ============================================================
async function api(action, payload) {
  const body = JSON.stringify({ action, ...payload });
  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body
  });
  if (!resp.ok) throw new Error('Network error: ' + resp.status);
  const data = await resp.json();
  if (!data.ok) throw new Error(data.error || 'Unknown error');
  return data;
}

// ============================================================
// Phone normalization
// ============================================================
function cleanPhone(raw) {
  if (!raw) return '';
  let p = String(raw).replace(/\D/g, '');
  if (p.startsWith('91') && p.length === 12) p = p.slice(2);
  if (p.startsWith('0') && p.length === 11) p = p.slice(1);
  return p;
}
function validPhone(p) { return /^[6-9]\d{9}$/.test(p); }

// ============================================================
// SETUP / OTP flow
// ============================================================
document.getElementById('btn-send-otp').addEventListener('click', async () => {
  const phone = cleanPhone(document.getElementById('setup-phone').value);
  if (!validPhone(phone)) {
    toast('Enter a valid 10-digit phone number', 'error'); return;
  }
  loading(true, 'Sending OTP…');
  try {
    await api('request_otp', { phone });
    document.getElementById('otp-block').classList.remove('hidden');
    toast('OTP sent via Telegram', 'success');
  } catch (e) {
    toast(e.message, 'error');
  } finally { loading(false); }
});

document.getElementById('btn-verify-otp').addEventListener('click', async () => {
  const phone = cleanPhone(document.getElementById('setup-phone').value);
  const otp = document.getElementById('setup-otp').value.trim();
  if (otp.length !== 6) {
    toast('Enter the 6-digit OTP', 'error'); return;
  }
  loading(true, 'Verifying…');
  try {
    let deviceId = STORE.get('lgk_device_id');
    if (!deviceId) {
      deviceId = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      STORE.set('lgk_device_id', deviceId);
    }
    const data = await api('verify_otp', { phone, otp, device_id: deviceId });
    const device = {
      device_token: data.device_token,
      doctor_id: data.doctor.id,
      doctor_name: data.doctor.name,
      doctor_qualification: data.doctor.qualification,
      doctor_reg_no: data.doctor.reg_no,
      doctor_clinic: data.doctor.clinic,
      doctor_address: data.doctor.address,
      doctor_phone: data.doctor.phone,
      bound_at: new Date().toISOString()
    };
    STORE.set(DEVICE_KEY, device);
    toast('Device bound successfully', 'success');
    enterMain();
  } catch (e) {
    toast(e.message, 'error');
  } finally { loading(false); }
});

// ============================================================
// MAIN screen
// ============================================================
function enterMain() {
  const dev = STORE.get(DEVICE_KEY);
  if (!dev) { show('setup-screen'); return; }
  document.getElementById('doctor-name-display').textContent = dev.doctor_name;
  document.getElementById('doctor-reg-display').textContent =
    [dev.doctor_qualification, dev.doctor_reg_no].filter(Boolean).join(' · ');
  show('main-screen');
}

document.getElementById('btn-logout').addEventListener('click', () => {
  if (!confirm('Sign out and unbind this device?')) return;
  STORE.del(DEVICE_KEY);
  show('setup-screen');
});

document.getElementById('btn-reset-form').addEventListener('click', () => {
  ['patient-name','patient-phone','history'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('scan-type').value = '';
});

// ============================================================
// Referral generation
// ============================================================
let lastPdfDataUrl = null;
let lastContext = null;

document.getElementById('btn-generate').addEventListener('click', async () => {
  const dev = STORE.get(DEVICE_KEY);
  if (!dev) { show('setup-screen'); return; }

  const patientName = document.getElementById('patient-name').value.trim();
  const patientPhone = cleanPhone(document.getElementById('patient-phone').value);
  const scanKey = document.getElementById('scan-type').value;
  const history = document.getElementById('history').value.trim();

  if (!patientName) { toast('Enter patient name', 'error'); return; }
  if (!validPhone(patientPhone)) { toast('Enter a valid 10-digit patient phone', 'error'); return; }
  if (!scanKey) { toast('Select scan type', 'error'); return; }

  const scan = SCAN_DB[scanKey];
  const refNo = generateRefNo();
  const dateStr = formatDate(new Date());

  const ctx = { dev, patientName, patientPhone, scanKey, scan, history, refNo, dateStr };
  lastContext = ctx;

  loading(true, 'Generating referral PDF…');
  try {
    lastPdfDataUrl = buildPdf(ctx);
  } catch (e) {
    loading(false);
    toast('PDF generation failed: ' + e.message, 'error');
    return;
  }

  // Extract base64 portion only (drop "data:application/pdf;base64," prefix)
  const pdfBase64 = lastPdfDataUrl.split(',')[1];

  // Send to backend — uploads PDF to Drive, logs to Sheet, alerts Satish
  loading(true, 'Uploading & notifying…');
  let pdfShareUrl = null;
  try {
    const resp = await api('submit_referral', {
      device_token: dev.device_token,
      patient_name: patientName,
      patient_phone: patientPhone,
      scan_key: scanKey,
      scan_label: scan.label,
      history: history,
      ref_no: refNo,
      pdf_base64: pdfBase64
    });
    pdfShareUrl = resp.pdf_url || null;
  } catch (e) {
    console.warn('Backend submit failed:', e.message);
    toast('Upload failed — patient will receive text only', 'error');
  }

  loading(false);

  // Doctor keeps a local copy
  triggerPdfDownload(lastPdfDataUrl, `Referral_${refNo}.pdf`);

  // Build WhatsApp message — with PDF link if upload succeeded
  const waMsg = buildPatientMessage(ctx, pdfShareUrl);
  const waUrl = `https://wa.me/91${patientPhone}?text=${encodeURIComponent(waMsg)}`;
  window.open(waUrl, '_blank');

  document.getElementById('success-message').textContent =
    `Referral ${refNo} sent. PDF downloaded. WhatsApp opened for ${patientName}.` +
    (pdfShareUrl ? '' : ' (Note: PDF link unavailable — send PDF manually.)');
  show('success-screen');
});

document.getElementById('btn-new-referral').addEventListener('click', () => {
  document.getElementById('btn-reset-form').click();
  enterMain();
});
document.getElementById('btn-redownload-pdf').addEventListener('click', () => {
  if (lastPdfDataUrl && lastContext)
    triggerPdfDownload(lastPdfDataUrl, `Referral_${lastContext.refNo}.pdf`);
});

// ============================================================
// Helpers: ref no, date, message
// ============================================================
function generateRefNo() {
  const d = new Date();
  const y = String(d.getFullYear()).slice(-2);
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `R${y}${m}${day}-${rand}`;
}
function formatDate(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function buildPatientMessage(ctx, pdfUrl) {
  const { patientName, scan, dev, refNo } = ctx;
  const refName = /^dr\.?\s/i.test(dev.doctor_name) ? dev.doctor_name : ('Dr. ' + dev.doctor_name);
  const pdfLine = pdfUrl ? `\n📄 *Your referral slip:* ${pdfUrl}\n` : '';
  return `Namaskara ${patientName},

${refName} has referred you for *${scan.label}* at:

🏥 ${CLINIC.name}
📍 ${CLINIC.address}
📞 ${CLINIC.phone}

🕐 *Timings:* ${CLINIC.timings}
${CLINIC.timingsNote}

🚨 ${CLINIC.emergencyNote}

⚠ *Preparation:* ${scan.prep}

📌 *Please bring:*
• Aadhaar card
• All previous scan reports / prescriptions
${pdfLine}
🗺 *Directions:* ${CLINIC.mapUrl}

📅 *Advance Booking:* ${CLINIC.bookingUrl}
${CLINIC.advanceBooking}

Ref: ${refNo}

— ${CLINIC.name}`;
}

// ============================================================
// PDF builder (jsPDF) — LGK clinic is the header; referring doctor credited at bottom
// ============================================================
function buildPdf(ctx) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const TEAL = [26, 122, 94];
  const TEAL_LIGHT = [232, 244, 240];
  const DARK = [40, 40, 40];
  const GREY = [110, 110, 110];
  const LIGHTGREY = [180, 180, 180];
  const page_w = 210;
  const margin = 18;

  // ───────────────────────────────────────────
  // HEADER — LGK Clinic (teal band)
  // ───────────────────────────────────────────
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, page_w, 34, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica','bold'); doc.setFontSize(18);
  doc.text(CLINIC.name, page_w/2, 12, { align: 'center' });

  doc.setFont('helvetica','normal'); doc.setFontSize(10);
  doc.text(`${CLINIC.doctor} · ${CLINIC.regNo}`, page_w/2, 19, { align: 'center' });
  doc.setFontSize(9);
  doc.text(`${CLINIC.pcpndt}`, page_w/2, 24, { align: 'center' });
  doc.text(`${CLINIC.address} · Ph: ${CLINIC.phone} · ${CLINIC.email}`, page_w/2, 29, { align: 'center' });

  // ───────────────────────────────────────────
  // TITLE BAR
  // ───────────────────────────────────────────
  let y = 44;
  doc.setDrawColor(...TEAL); doc.setLineWidth(0.6);
  doc.line(margin, y, page_w - margin, y);
  y += 7;
  doc.setTextColor(...TEAL); doc.setFont('helvetica','bold'); doc.setFontSize(14);
  doc.text('ULTRASOUND REFERRAL SLIP', page_w/2, y, { align: 'center' });
  y += 3;
  doc.line(margin, y, page_w - margin, y);

  // Ref / Date
  y += 8;
  doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(...GREY);
  doc.text('Ref No: ' + ctx.refNo, margin, y);
  doc.text('Date: ' + ctx.dateStr, page_w - margin, y, { align: 'right' });

  // ───────────────────────────────────────────
  // REFERRED TO (short — clinic is header so brief)
  // ───────────────────────────────────────────
  y += 10;
  doc.setFillColor(...TEAL_LIGHT);
  doc.roundedRect(margin, y, page_w - 2*margin, 14, 2, 2, 'F');
  doc.setTextColor(...TEAL); doc.setFont('helvetica','bold'); doc.setFontSize(10);
  doc.text('REFERRED TO:', margin + 4, y + 5.5);
  doc.setTextColor(...DARK); doc.setFont('helvetica','bold'); doc.setFontSize(12);
  doc.text(`${CLINIC.doctor} — Consultant Radiologist`, margin + 4, y + 11);
  y += 22;

  // ───────────────────────────────────────────
  // PATIENT DETAILS
  // ───────────────────────────────────────────
  doc.setTextColor(...TEAL); doc.setFont('helvetica','bold'); doc.setFontSize(11);
  doc.text('PATIENT DETAILS', margin, y);
  y += 2; doc.setDrawColor(...TEAL); doc.line(margin, y, page_w - margin, y);
  y += 7;

  doc.setTextColor(...DARK); doc.setFont('helvetica','bold'); doc.setFontSize(11);
  doc.text('Name:', margin, y);
  doc.setFont('helvetica','normal');
  doc.text(ctx.patientName, margin + 24, y);
  y += 7;
  doc.setFont('helvetica','bold'); doc.text('Phone:', margin, y);
  doc.setFont('helvetica','normal'); doc.text('+91 ' + ctx.patientPhone, margin + 24, y);
  y += 12;

  // ───────────────────────────────────────────
  // SCAN REQUESTED
  // ───────────────────────────────────────────
  doc.setTextColor(...TEAL); doc.setFont('helvetica','bold'); doc.setFontSize(11);
  doc.text('SCAN REQUESTED', margin, y);
  y += 2; doc.line(margin, y, page_w - margin, y);
  y += 7;
  doc.setTextColor(...DARK); doc.setFont('helvetica','bold'); doc.setFontSize(13);
  doc.text('• ' + ctx.scan.label, margin, y);
  y += 10;

  // ───────────────────────────────────────────
  // CLINICAL HISTORY
  // ───────────────────────────────────────────
  doc.setTextColor(...TEAL); doc.setFont('helvetica','bold'); doc.setFontSize(11);
  doc.text('CLINICAL HISTORY / INDICATION', margin, y);
  y += 2; doc.line(margin, y, page_w - margin, y);
  y += 7;

  doc.setTextColor(...DARK); doc.setFont('helvetica','normal'); doc.setFontSize(11);
  const historyText = ctx.history || '(Not provided)';
  const wrapped = doc.splitTextToSize(historyText, page_w - 2*margin);
  doc.text(wrapped, margin, y);
  y += wrapped.length * 5 + 5;

  // ───────────────────────────────────────────
  // PATIENT PREPARATION (highlight box)
  // ───────────────────────────────────────────
  if (y > 220) { doc.addPage(); y = 20; }
  const prepWrapped = doc.splitTextToSize(ctx.scan.prep, page_w - 2*margin - 8);
  const prepBoxH = 10 + prepWrapped.length * 5;
  doc.setFillColor(254, 252, 232);
  doc.roundedRect(margin, y, page_w - 2*margin, prepBoxH, 2, 2, 'F');
  doc.setTextColor(180, 100, 10); doc.setFont('helvetica','bold'); doc.setFontSize(10);
  doc.text('PATIENT PREPARATION:', margin + 4, y + 6);
  doc.setTextColor(...DARK); doc.setFont('helvetica','normal'); doc.setFontSize(10);
  doc.text(prepWrapped, margin + 4, y + 12);
  y += prepBoxH + 8;

  // ───────────────────────────────────────────
  // REFERRAL BY (bottom — referring doctor credit)
  // ───────────────────────────────────────────
  if (y < 235) y = 235;

  // Horizontal separator
  doc.setDrawColor(...TEAL); doc.setLineWidth(0.3);
  doc.line(margin, y, page_w - margin, y);
  y += 6;

  doc.setTextColor(...TEAL); doc.setFont('helvetica','bold'); doc.setFontSize(10);
  doc.text('REFERRAL BY:', margin, y);
  y += 6;

  const refName = /^dr\.?\s/i.test(ctx.dev.doctor_name) ? ctx.dev.doctor_name : ('Dr. ' + ctx.dev.doctor_name);
  doc.setTextColor(...DARK); doc.setFont('helvetica','bold'); doc.setFontSize(12);
  doc.text(refName, margin, y);
  y += 5;

  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...GREY);
  const credLine = [ctx.dev.doctor_qualification, ctx.dev.doctor_reg_no].filter(Boolean).join(' · ');
  if (credLine) { doc.text(credLine, margin, y); y += 4; }
  if (ctx.dev.doctor_clinic) { doc.text(ctx.dev.doctor_clinic, margin, y); y += 4; }
  if (ctx.dev.doctor_phone) { doc.text('Ph: ' + ctx.dev.doctor_phone, margin, y); y += 4; }

  // ───────────────────────────────────────────
  // DIGITAL AUTHENTICATION STAMP (right side, same block)
  // ───────────────────────────────────────────
  const stampY = Math.max(y - 14, 248);
  const stampX = page_w - margin - 72;
  const stampW = 72;
  const stampH = 22;

  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.4);
  doc.roundedRect(stampX, stampY, stampW, stampH, 2, 2, 'S');

  doc.setTextColor(...TEAL); doc.setFont('helvetica','bold'); doc.setFontSize(8);
  doc.text('DIGITALLY AUTHENTICATED', stampX + stampW/2, stampY + 4, { align: 'center' });

  doc.setTextColor(...DARK); doc.setFont('helvetica','normal'); doc.setFontSize(7);
  doc.text('Computer-generated — no physical signature required', stampX + stampW/2, stampY + 8, { align: 'center' });
  const devPhoneShort = ctx.dev.doctor_phone ? ('+91 ' + ctx.dev.doctor_phone) : 'device-bound';
  doc.text(`Issued from: ${devPhoneShort}`, stampX + stampW/2, stampY + 12, { align: 'center' });
  doc.text(`Telegram-OTP verified · ${ctx.dateStr}`, stampX + stampW/2, stampY + 16, { align: 'center' });
  doc.setFont('helvetica','bold'); doc.setFontSize(7);
  doc.text(`Ref: ${ctx.refNo}`, stampX + stampW/2, stampY + 20, { align: 'center' });

  // ───────────────────────────────────────────
  // FOOTER
  // ───────────────────────────────────────────
  doc.setDrawColor(...TEAL); doc.setLineWidth(0.4);
  doc.line(margin, 282, page_w - margin, 282);
  doc.setFontSize(8); doc.setTextColor(...GREY); doc.setFont('helvetica','normal');
  doc.text(`Generated via LGK Scan Referral · ${CLINIC.name} · ${CLINIC.phone}`, page_w/2, 287, { align: 'center' });

  return doc.output('datauristring');
}

function triggerPdfDownload(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ============================================================
// Boot
// ============================================================
(function init() {
  const dev = STORE.get(DEVICE_KEY);
  if (dev && dev.device_token) enterMain();
  else show('setup-screen');
})();
