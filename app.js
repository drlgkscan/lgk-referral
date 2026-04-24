// ============================================================
// LGK Scan Referral — client-side logic
// ============================================================

// >>> REPLACE WITH YOUR DEPLOYED APPS SCRIPT WEB APP URL <<<
const API_URL = "https://script.google.com/macros/s/XXXXXXXXXXXXXXXXXXXX/exec";

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
  bookingUrl: "https://drlgkscan.github.io/lgk-booking/",
  timings: "Mon–Sat: 9:00 AM – 1:30 PM, 4:30 PM – 7:30 PM · Sun closed",
  advanceBooking: "Advance token booking available via the booking link below."
};

// Scan type definitions: label + prep instructions
const SCAN_DB = {
  EP:             { label: "Early Pregnancy Scan",         prep: "No preparation needed" },
  NT:             { label: "NT Scan (11–14 weeks)",        prep: "Full bladder preferred — drink 3–4 glasses of water 1 hour before" },
  GROWTH:         { label: "Growth Scan",                  prep: "No preparation needed" },
  GROWTH_DOPPLER: { label: "Growth Scan + Doppler",        prep: "No preparation needed" },
  ANOMALY:        { label: "Anomaly Scan",                 prep: "No preparation needed. Allow 45 minutes for the scan" },
  FETAL_ECHO:     { label: "Fetal Echo",                   prep: "No preparation needed" },
  ANOMALY_ECHO:   { label: "Anomaly + Fetal Echo",         prep: "No preparation needed. Allow 60 minutes" },
  FETAL_NEURO:    { label: "Fetal Neurosonogram",          prep: "No preparation needed" },
  FOLLICULAR:     { label: "Follicular Study",             prep: "Full bladder — drink 3–4 glasses of water 1 hour before" },
  ABDOMEN:        { label: "Abdomen Ultrasound",           prep: "6 hours fasting. Plain water is allowed" },
  PELVIS:         { label: "Pelvis Ultrasound",            prep: "Full bladder — drink 4–5 glasses of water 1 hour before, do not urinate" },
  AP:             { label: "Abdomen + Pelvis",             prep: "6 hours fasting AND full bladder at time of scan" },
  KUB:            { label: "KUB (Kidney-Ureter-Bladder)",  prep: "Full bladder — drink 4–5 glasses of water 1 hour before" },
  THYROID:        { label: "Neck / Thyroid Ultrasound",    prep: "No preparation needed" },
  BREAST1:        { label: "Breast Ultrasound (unilateral)", prep: "No preparation needed" },
  BREAST2:        { label: "Breast Ultrasound (bilateral)", prep: "No preparation needed" },
  MSK:            { label: "Musculoskeletal Ultrasound",   prep: "No preparation needed" },
  SCROTUM:        { label: "Scrotum Ultrasound",           prep: "No preparation needed" },
  EYE:            { label: "Eye / Orbit Ultrasound",       prep: "No preparation needed" },
  CHEST:          { label: "Chest Ultrasound",             prep: "No preparation needed" },
  ADS:            { label: "Arterial Doppler — Single limb", prep: "No preparation needed" },
  VDS:            { label: "Venous Doppler — Single limb", prep: "No preparation needed" },
  ADB:            { label: "Arterial Doppler — Both limbs", prep: "No preparation needed" },
  VDB:            { label: "Venous Doppler — Both limbs",  prep: "No preparation needed" },
  AVS:            { label: "Arterio-Venous Doppler — Single limb", prep: "No preparation needed" },
  ADA:            { label: "Arterial Doppler — All limbs", prep: "No preparation needed" },
  AVB:            { label: "Arterio-Venous Doppler — Both limbs", prep: "No preparation needed" },
  CVD:            { label: "Carotid / Vertebral Doppler",  prep: "No preparation needed" },
  RAD:            { label: "Renal Artery Doppler",         prep: "6 hours fasting. Plain water is allowed" },
  PVD:            { label: "Portal Venous Doppler",        prep: "6 hours fasting. Plain water is allowed" },
  PENILE:         { label: "Penile Doppler",               prep: "No preparation needed" }
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
// Shape: { device_token, doctor_id, doctor_name, doctor_qualification, doctor_reg_no, doctor_clinic, doctor_address, doctor_phone, bound_at }

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
    // text/plain avoids CORS preflight — Apps Script reads e.postData.contents
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
    // Generate a stable-ish device id for this browser
    let deviceId = STORE.get('lgk_device_id');
    if (!deviceId) {
      deviceId = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      STORE.set('lgk_device_id', deviceId);
    }
    const data = await api('verify_otp', { phone, otp, device_id: deviceId });
    // data contains: device_token, doctor { id, name, qualification, reg_no, clinic, address, phone }
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

  // 1. Generate PDF
  loading(true, 'Generating referral PDF…');
  try {
    lastPdfDataUrl = buildPdf(ctx);
  } catch (e) {
    loading(false);
    toast('PDF generation failed: ' + e.message, 'error');
    return;
  }

  // 2. Log on backend + alert Satish (do not block UX if this fails)
  try {
    await api('submit_referral', {
      device_token: dev.device_token,
      patient_name: patientName,
      patient_phone: patientPhone,
      scan_key: scanKey,
      scan_label: scan.label,
      history: history,
      ref_no: refNo
    });
  } catch (e) {
    // Log failure is not fatal — doctor can still send PDF via WhatsApp
    console.warn('Backend log failed:', e.message);
    toast('Referral created (offline log failed)', 'error');
  }

  loading(false);

  // 3. Download PDF for doctor (so they have a copy)
  triggerPdfDownload(lastPdfDataUrl, `Referral_${refNo}.pdf`);

  // 4. Open WhatsApp with patient message
  const waMsg = buildPatientMessage(ctx);
  const waUrl = `https://wa.me/91${patientPhone}?text=${encodeURIComponent(waMsg)}`;
  window.open(waUrl, '_blank');

  // 5. Show success screen
  document.getElementById('success-message').textContent =
    `Referral ${refNo} sent. PDF downloaded. WhatsApp opened for ${patientName}.`;
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

function buildPatientMessage(ctx) {
  const { patientName, scan, dev, refNo } = ctx;
  return `Namaskara ${patientName},

Dr. ${dev.doctor_name} has referred you for *${scan.label}* at:

🏥 ${CLINIC.name}
📍 ${CLINIC.address}
📞 ${CLINIC.phone}

🕐 *Timings:* ${CLINIC.timings}

⚠ *Preparation:* ${scan.prep}

📌 *Please bring:*
• This referral slip (PDF will be shared separately)
• Aadhaar card
• All previous scan reports / prescriptions

🗺 *Directions:* ${CLINIC.mapUrl}

📅 *Book your token in advance:* ${CLINIC.bookingUrl}
${CLINIC.advanceBooking}

Ref: ${refNo}

— ${CLINIC.name}`;
}

// ============================================================
// PDF builder (jsPDF)
// ============================================================
function buildPdf(ctx) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const TEAL = [26, 122, 94];
  const DARK = [40, 40, 40];
  const GREY = [110, 110, 110];
  const page_w = 210;
  const margin = 18;

  // === Doctor letterhead (top band) ===
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, page_w, 28, 'F');
  doc.setTextColor(255,255,255);
  doc.setFont('helvetica','bold'); doc.setFontSize(18);
  doc.text(ctx.dev.doctor_name, margin, 13);
  doc.setFont('helvetica','normal'); doc.setFontSize(10);
  const line2 = [ctx.dev.doctor_qualification, ctx.dev.doctor_reg_no].filter(Boolean).join(' · ');
  doc.text(line2, margin, 19);
  if (ctx.dev.doctor_clinic) doc.text(ctx.dev.doctor_clinic, margin, 24);

  // Right: phone
  if (ctx.dev.doctor_phone) {
    doc.setFontSize(10);
    doc.text('Ph: ' + ctx.dev.doctor_phone, page_w - margin, 19, { align: 'right' });
  }

  // === Title bar ===
  let y = 40;
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

  // === Refer To ===
  y += 10;
  doc.setFillColor(232, 244, 240);
  doc.roundedRect(margin, y, page_w - 2*margin, 22, 2, 2, 'F');
  doc.setTextColor(...TEAL); doc.setFont('helvetica','bold'); doc.setFontSize(11);
  doc.text('REFER TO:', margin + 4, y + 6);
  doc.setTextColor(...DARK); doc.setFont('helvetica','bold'); doc.setFontSize(13);
  doc.text(CLINIC.doctor, margin + 4, y + 12);
  doc.setFont('helvetica','normal'); doc.setFontSize(10);
  doc.text(`${CLINIC.name}, ${CLINIC.address} · Ph: ${CLINIC.phone}`, margin + 4, y + 18);
  y += 30;

  // === Patient details ===
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

  // === Scan requested ===
  doc.setTextColor(...TEAL); doc.setFont('helvetica','bold'); doc.setFontSize(11);
  doc.text('SCAN REQUESTED', margin, y);
  y += 2; doc.line(margin, y, page_w - margin, y);
  y += 7;
  doc.setTextColor(...DARK); doc.setFont('helvetica','bold'); doc.setFontSize(13);
  doc.text('• ' + ctx.scan.label, margin, y);
  y += 10;

  // === Clinical history ===
  doc.setTextColor(...TEAL); doc.setFont('helvetica','bold'); doc.setFontSize(11);
  doc.text('CLINICAL HISTORY / INDICATION', margin, y);
  y += 2; doc.line(margin, y, page_w - margin, y);
  y += 7;

  doc.setTextColor(...DARK); doc.setFont('helvetica','normal'); doc.setFontSize(11);
  const historyText = ctx.history || '(Not provided)';
  const wrapped = doc.splitTextToSize(historyText, page_w - 2*margin);
  doc.text(wrapped, margin, y);
  y += wrapped.length * 5 + 5;

  // === Preparation (for patient) ===
  if (y > 230) { doc.addPage(); y = 20; }
  doc.setFillColor(254, 252, 232);
  doc.roundedRect(margin, y, page_w - 2*margin, 18, 2, 2, 'F');
  doc.setTextColor(180, 100, 10); doc.setFont('helvetica','bold'); doc.setFontSize(10);
  doc.text('PATIENT PREPARATION:', margin + 4, y + 6);
  doc.setTextColor(...DARK); doc.setFont('helvetica','normal'); doc.setFontSize(10);
  const prepWrapped = doc.splitTextToSize(ctx.scan.prep, page_w - 2*margin - 8);
  doc.text(prepWrapped, margin + 4, y + 12);
  y += 25;

  // === Signature block ===
  if (y < 240) y = 240;
  doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.3);
  doc.line(page_w - margin - 60, y, page_w - margin, y);
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...GREY);
  doc.text('Referring Doctor Signature', page_w - margin - 30, y + 5, { align: 'center' });
  doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...DARK);
  doc.text(ctx.dev.doctor_name, page_w - margin - 30, y + 11, { align: 'center' });
  if (ctx.dev.doctor_reg_no) {
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...GREY);
    doc.text(ctx.dev.doctor_reg_no, page_w - margin - 30, y + 15, { align: 'center' });
  }

  // === Footer ===
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
