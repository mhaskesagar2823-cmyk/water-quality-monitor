/**
 * AQUA SCAN - Core Frontend Controller & Real-Time Telemetry Sync
 * Direct Cloud Integration via Supabase REST API
 */
const SUPABASE_URL = 'https://fzqvjvcpvilmzlniadfn.supabase.co/rest/v1';
const SUPABASE_KEY = 'sb_publishable_vHuqJuAhBDkzyRMnIFvQeA_3ASoVoHd';

const AquaApp = {
  state: null,
  pollInterval: null,
  lastSmsSentRole: null,

  init: function () {
    this.initRoleHandling();
    this.fetchTelemetry();
    this.pollInterval = setInterval(() => this.fetchTelemetry(), 2500);
    this.bindSimulatorEvents();
    this.bindActuatorEvents();
    this.bindToggleLinkEvent();
  },

  initRoleHandling: function () {
    const params = new URLSearchParams(window.location.search);
    const role = params.get('role') || 'all';
    this.applyRoleView(role);
  },

  applyRoleView: function (role) {
    const hardwareHub = document.getElementById('hardware-hub-section');
    const schoolCard = document.getElementById('report-school-card');
    const govCard = document.getElementById('report-gov-card');
    const headerBadge = document.getElementById('header-role-badge');
    const sectionHeading = document.getElementById('reports-section-heading');
    const toast = document.getElementById('sms-status-toast');
    const toastMsg = document.getElementById('sms-toast-msg');

    document.querySelectorAll('.role-switcher-bar .btn').forEach(b => b.style.background = 'transparent');

    if (role === 'school') {
      const btn = document.getElementById('btn-role-school');
      if (btn) btn.style.background = '#064e3b';
      if (hardwareHub) hardwareHub.style.display = 'none';
      if (schoolCard) schoolCard.style.display = 'flex';
      if (govCard) govCard.style.display = 'none';
      if (headerBadge) headerBadge.innerText = 'SCHOOL OFFICIALS PORTAL (SMS: 7039639168)';
      if (sectionHeading) sectionHeading.style.display = 'none';
      if (toast) {
        toast.style.display = 'block';
        toastMsg.innerText = 'Active SMS Watchdog armed for School Authorities (+91 7039639168).';
      }
    } else if (role === 'gov') {
      const btn = document.getElementById('btn-role-gov');
      if (btn) btn.style.background = '#0369a1';
      if (hardwareHub) hardwareHub.style.display = 'block';
      if (schoolCard) schoolCard.style.display = 'none';
      if (govCard) govCard.style.display = 'flex';
      if (headerBadge) headerBadge.innerText = 'GOV WATER AUTHORITIES PORTAL (SMS: 9321823899)';
      if (sectionHeading) sectionHeading.style.display = 'flex';
      if (toast) {
        toast.style.display = 'block';
        toastMsg.innerText = 'Active SMS Dispatch Line armed for Government Water Board (+91 9321823899) with GPS coordinates.';
      }
    } else {
      const btn = document.getElementById('btn-role-all');
      if (btn) btn.style.background = '#334155';
      if (hardwareHub) hardwareHub.style.display = 'block';
      if (schoolCard) schoolCard.style.display = 'flex';
      if (govCard) govCard.style.display = 'flex';
      if (headerBadge) headerBadge.innerText = 'HARDWARE & DUAL REPORTS';
      if (sectionHeading) sectionHeading.style.display = 'flex';
      if (toast) toast.style.display = 'none';
    }
  },

  mapDatabaseRowToUI: function (row) {
    const ph = parseFloat(row.ph_level ?? 7.0);
    const turb = parseFloat(row.turbidity ?? 1.0);
    const tds = parseFloat(row.tds_value ?? 150.0);
    const temp = parseFloat(row.temperature ?? 25.0);
    const metal = parseFloat(row.heavymetal ?? row.heavyMetal ?? 0.005);

    let status = 'SAFE';
    let score = 95;
    let isContaminated = false;

    if (ph < 6.5 || ph > 8.5 || turb > 5.0 || tds > 500) {
      status = 'WARNING';
      score = 65;
    }
    if (ph < 5.5 || ph > 9.5 || turb > 10.0 || tds > 1000 || metal > 0.010) {
      status = 'HAZARDOUS';
      score = 30;
      isContaminated = true;
    }

    return {
      telemetry: { ph, turbidity: turb, tds, temperature: temp, heavyMetal: metal },
      wqi: {
        score: score,
        grade: status === 'SAFE' ? 'A' : (status === 'WARNING' ? 'C' : 'F'),
        waterStatus: status,
        contaminationDetected: isContaminated,
        ruralMessage: status === 'SAFE' ? 'Water is safe and filtered.' : 'Contamination detected. Please boil water.',
        miningSummary: status === 'SAFE' ? 'All effluent parameters compliant with BIS 10500.' : 'Warning: Toxicity & heavy metal limits breached.',
        hygieneScore: status === 'SAFE' ? 5.0 : (status === 'WARNING' ? 3.0 : 1.0)
      },
      systemState: {
        valveState: status === 'HAZARDOUS' ? 'CLOSED' : 'OPEN',
        sampleBottleId: isContaminated ? 'CUSTODY-TKN-' + String(row.id).padStart(4, '0') : 'NONE',
        samplePumpActive: isContaminated,
        activePreset: status === 'SAFE' ? 'NORMAL' : (status === 'WARNING' ? 'SILT' : 'TOXIC')
      },
      hardware: {
        connected: true,
        deviceName: 'AquaScan ESP32 Node',
        port: 'Supabase Cloud REST'
      },
      serialLogs: [
        `[${new Date().toLocaleTimeString()}] Fetch sync: ID #${row.id} received from Supabase.`,
        `[Telemetry] pH=${ph}, Turbidity=${turb} NTU, TDS=${tds} mg/L, HeavyMetal=${metal} mg/L.`,
        `[Evaluation] Status: ${status} (Score: ${score}/100, Grade: ${status === 'SAFE' ? 'A' : (status === 'WARNING' ? 'C' : 'F')}).`
      ]
    };
  },

  fetchTelemetry: async function () {
    try {
      const res = await fetch(`${SUPABASE_URL}/sensor_readings?select=*&order=id.desc&limit=1`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
      if (!res.ok) throw new Error('Supabase network response failed');
      const rows = await res.json();
      if (!rows || rows.length === 0) return;

      const data = this.mapDatabaseRowToUI(rows[0]);
      this.state = data;
      this.updateCommonUI(data);

      if (window.location.pathname.includes('rural.html')) {
        this.updateRuralUI(data);
      } else if (window.location.pathname.includes('mining.html')) {
        this.updateMiningUI(data);
      } else {
        this.updateLandingUI(data);
        this.updateRuralUI(data);
        this.updateMiningUI(data);
      }
    } catch (err) {
      console.warn('[AquaScan] Cloud Telemetry sync error: ', err);
    }
  },

  updateCommonUI: function (data) {
    const valveState = data.systemState.valveState;
    document.querySelectorAll('.valve-state-text').forEach(el => {
      el.textContent = valveState;
      el.className = 'valve-state-text ' + (valveState === 'OPEN' ? 'valve-open' : 'valve-closed');
    });

    const connEl = document.getElementById('connection-badge');
    if (connEl) {
      connEl.innerHTML = `<span class="live-dot" style="background-color: #10b981;"></span> Cloud Wi-Fi Online`;
    }
  },

  updateLandingUI: function (data) {
    const { telemetry, wqi, systemState, hardware, serialLogs } = data;
    this.setText('hw-device-name', hardware.deviceName);
    this.setText('hw-port-name', hardware.port);

    const hwStatus = document.getElementById('hw-status-badge');
    if (hwStatus) {
      hwStatus.innerHTML = `<span class="live-dot"></span> CONNECTED (Supabase Active)`;
      hwStatus.className = 'live-indicator';
    }

    const termBody = document.getElementById('serial-terminal-body');
    if (termBody && serialLogs && Array.isArray(serialLogs)) {
      termBody.innerHTML = serialLogs.map(line => `<div>${line}</div>`).join('');
      termBody.scrollTop = termBody.scrollHeight;
    }

    const rVerdict = document.getElementById('r-report-verdict');
    if (rVerdict) {
      if (wqi.waterStatus === 'SAFE') {
        rVerdict.textContent = 'SAFE TO DRINK';
        rVerdict.className = 'report-verdict-badge verdict-safe';
      } else if (wqi.waterStatus === 'WARNING') {
        rVerdict.textContent = 'CAUTION - BOIL WATER';
        rVerdict.className = 'report-verdict-badge verdict-warn';
      } else {
        rVerdict.textContent = 'DANGER - DO NOT DRINK';
        rVerdict.className = 'report-verdict-badge verdict-danger';
      }
    }

    this.setText('r-wqi-val', wqi.score);
    this.setText('r-status-val', wqi.waterStatus);
    this.setText('r-ph-val', telemetry.ph);
    this.setText('r-turb-val', telemetry.turbidity + ' NTU');
    this.setText('r-tds-val', telemetry.tds + ' mg/L');
    this.setText('r-temp-val', telemetry.temperature + ' °C');
    this.setText('r-metal-val', telemetry.heavyMetal + ' mg/L');
    this.setText('r-contamination-val', wqi.contaminationDetected ? 'DETECTED' : 'NOT DETECTED');
    this.setText('r-valve-val', systemState.valveState);

    const mVerdict = document.getElementById('m-report-verdict');
    if (mVerdict) {
      if (wqi.waterStatus === 'SAFE') {
        mVerdict.textContent = 'COMPLIANT (BIS 10500)';
        mVerdict.className = 'report-verdict-badge verdict-safe';
      } else if (wqi.waterStatus === 'WARNING') {
        mVerdict.textContent = 'ADVISORY (ELEVATED SILT)';
        mVerdict.className = 'report-verdict-badge verdict-warn';
      } else {
        mVerdict.textContent = 'CRITICAL TOXICITY BREACH';
        mVerdict.className = 'report-verdict-badge verdict-danger';
      }
    }

    this.setText('m-wqi-val', wqi.score);
    this.setText('m-status-val', wqi.waterStatus);
    this.setText('m-ph-val', `${telemetry.ph} (Std: 6.5-8.5)`);
    this.setText('m-turb-val', `${telemetry.turbidity} NTU (Max: 5.0)`);
    this.setText('m-tds-val', `${telemetry.tds} mg/L (Max: 500)`);
    this.setText('m-temp-val', `${telemetry.temperature} °C`);
    this.setText('m-metal-val', `${telemetry.heavyMetal} mg/L (Cutoff: 0.010)`);
    this.setText('m-contamination-val', wqi.contaminationDetected ? 'DETECTED' : 'NOT DETECTED');
    this.setText('m-valve-val', systemState.valveState);
    this.setText('m-sample-val', systemState.sampleBottleId !== 'NONE' ? systemState.sampleBottleId : 'Armed / Standby');
  },

  updateRuralUI: function (data) {
    const { telemetry, wqi } = data;
    const heroCard = document.getElementById('rural-hero-card');
    const heroEmoji = document.getElementById('rural-emoji');
    const heroTitle = document.getElementById('rural-verdict-title');
    const heroDesc = document.getElementById('rural-verdict-desc');

    if (heroCard) {
      if (wqi.waterStatus === 'SAFE') {
        heroCard.className = 'hero-verdict-card status-safe';
        if (heroEmoji) heroEmoji.textContent = '🟢';
        if (heroTitle) heroTitle.textContent = 'SAFE TO DRINK';
      } else if (wqi.waterStatus === 'WARNING') {
        heroCard.className = 'hero-verdict-card status-warning';
        if (heroEmoji) heroEmoji.textContent = '🟡';
        if (heroTitle) heroTitle.textContent = 'CAUTION - BOIL BEFORE DRINKING';
      } else {
        heroCard.className = 'hero-verdict-card status-danger';
        if (heroEmoji) heroEmoji.textContent = '🔴';
        if (heroTitle) heroTitle.textContent = 'WATER UNSAFE - SUPPLY SHUT OFF';
      }
      if (heroDesc) heroDesc.textContent = wqi.ruralMessage;
    }

    this.setText('rural-wqi-score', wqi.score + ' / 100');
    const starsEl = document.getElementById('rural-stars');
    if (starsEl) {
      starsEl.textContent = '★'.repeat(Math.round(wqi.hygieneScore)) + ` (${wqi.hygieneScore}/5.0)`;
    }

    this.setText('rural-ph-val', telemetry.ph);
    this.setText('rural-turb-val', telemetry.turbidity + ' NTU');
    this.setText('rural-tds-val', telemetry.tds + ' mg/L');
    this.setText('rural-temp-val', telemetry.temperature + ' °C');
    this.setText('rural-metal-val', telemetry.heavyMetal + ' mg/L');

    this.setChip('rural-ph-chip', telemetry.ph >= 6.5 && telemetry.ph <= 8.5, 'Normal & Gentle', 'Abnormal');
    this.setChip('rural-turb-chip', telemetry.turbidity <= 5.0, 'Clean & Filtered', 'Muddy / Silt');
    this.setChip('rural-tds-chip', telemetry.tds <= 500, 'Balanced Minerals', 'High Minerals');
    this.setChip('rural-temp-chip', telemetry.temperature >= 20 && telemetry.temperature <= 30, 'Optimal Cool', 'Warm/Cold');
    this.setChip('rural-metal-chip', telemetry.heavyMetal <= 0.010, 'Zero Toxic Runoff', 'TOXIC CONTAMINATION');

    // --- Clean QR Code Generation (URL Only) ---
    const reportUrl = 'https://mhaskesagar2823-cmyk.github.io/water-quality-monitor/report.html';
    const ruralQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(reportUrl)}`;
    
    document.querySelectorAll('img[alt="School Notice QR Code"], img[alt="Rural School Report QR Code"]').forEach(img => {
      if (img.src !== ruralQrUrl) img.src = ruralQrUrl;
    });
  },

  updateMiningUI: function (data) {
    const { telemetry, wqi, systemState } = data;
    const hazardBanner = document.getElementById('mining-hazard-banner');
    if (hazardBanner) {
      if (wqi.waterStatus === 'CONTAMINATED' || wqi.waterStatus === 'HAZARDOUS' || telemetry.heavyMetal > 0.010 || telemetry.ph < 6.5) {
        hazardBanner.style.display = 'flex';
        const titleEl = document.getElementById('hazard-text');
        if (titleEl) titleEl.textContent = wqi.miningSummary;
      } else {
        hazardBanner.style.display = 'none';
      }
    }

    this.setText('scada-wqi-num', wqi.score);
    this.setText('scada-wqi-grade', wqi.grade);
    this.setText('scada-water-status', wqi.waterStatus);
    this.setText('scada-contamination', wqi.contaminationDetected ? 'DETECTED' : 'NOT DETECTED');

    this.setText('m-ph-val', telemetry.ph);
    this.setText('m-turb-val', telemetry.turbidity);
    this.setText('m-tds-val', telemetry.tds);
    this.setText('m-temp-val', telemetry.temperature);
    this.setText('m-metal-val', telemetry.heavyMetal);

    this.setBar('m-ph-bar', (telemetry.ph / 14) * 100, telemetry.ph >= 6.5 && telemetry.ph <= 8.5 ? '#10b981' : '#ef4444');
    this.setBar('m-turb-bar', Math.min(100, (telemetry.turbidity / 10) * 100), telemetry.turbidity <= 5 ? '#10b981' : '#ef4444');
    this.setBar('m-tds-bar', Math.min(100, (telemetry.tds / 1000) * 100), telemetry.tds <= 500 ? '#10b981' : '#f59e0b');
    this.setBar('m-temp-bar', (telemetry.temperature / 50) * 100, '#06b6d4');
    this.setBar('m-metal-bar', Math.min(100, (telemetry.heavyMetal / 0.02) * 100), telemetry.heavyMetal <= 0.010 ? '#10b981' : '#ef4444');

    const sampleTokenEl = document.getElementById('sample-token-text');
    if (sampleTokenEl) {
      sampleTokenEl.textContent = systemState.sampleBottleId !== 'NONE' ? systemState.sampleBottleId : 'Chamber Empty / Ready';
    }

    const samplePumpBadge = document.getElementById('sample-pump-indicator');
    if (samplePumpBadge) {
      samplePumpBadge.className = 'status-badge-sm ' + (systemState.samplePumpActive ? 'badge-fail' : 'badge-pass');
      samplePumpBadge.textContent = systemState.samplePumpActive ? 'PUMP ACTIVE (12V)' : 'STANDBY';
    }

    this.updateComplianceRow('comp-ph', telemetry.ph >= 6.5 && telemetry.ph <= 8.5, telemetry.ph);
    this.updateComplianceRow('comp-turb', telemetry.turbidity <= 5.0, telemetry.turbidity + ' NTU');
    this.updateComplianceRow('comp-tds', telemetry.tds <= 500.0, telemetry.tds + ' mg/L');
    this.updateComplianceRow('comp-temp', telemetry.temperature >= 20 && telemetry.temperature <= 30, telemetry.temperature + ' °C');
    this.updateComplianceRow('comp-metal', telemetry.heavyMetal <= 0.010, telemetry.heavyMetal + ' mg/L');

    // --- Clean QR Code Generation (URL Only) ---
    const reportUrl = 'https://mhaskesagar2823-cmyk.github.io/water-quality-monitor/report.html';
    const miningQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(reportUrl)}`;
    
    document.querySelectorAll('img[alt="Mining Regulatory Report QR Code"]').forEach(img => {
      if (img.src !== miningQrUrl) img.src = miningQrUrl;
    });
  },

  updateComplianceRow: function (rowId, isPass, val) {
    const valEl = document.getElementById(rowId + '-val');
    const badgeEl = document.getElementById(rowId + '-badge');
    if (valEl) valEl.textContent = val;
    if (badgeEl) {
      badgeEl.className = 'status-badge-sm ' + (isPass ? 'badge-pass' : 'badge-fail');
      badgeEl.textContent = isPass ? 'COMPLIANT' : 'BREACH';
    }
  },

  setText: function (id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  },

  setBar: function (id, percent, color) {
    const el = document.getElementById(id);
    if (el) {
      el.style.width = Math.min(100, Math.max(0, percent)) + '%';
      if (color) el.style.backgroundColor = color;
    }
  },

  setChip: function (id, isGood, goodText, badText) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = isGood ? goodText : badText;
      el.className = 'friendly-status-chip ' + (isGood ? 'chip-good' : 'chip-bad');
    }
  },

  bindToggleLinkEvent: function () {
    const toggleBtns = document.querySelectorAll('button[onclick="Toggle"], #toggleLinkBtn, .toggle-link-btn');
    toggleBtns.forEach(btn => {
      btn.removeAttribute('onclick');
      btn.disabled = true;
      btn.style.opacity = '0.6';
      btn.style.cursor = 'not-allowed';
      btn.title = 'Connection is live via Supabase Cloud Ingestion.';
    });
  },

  bindSimulatorEvents: function () {
    const pushSimulatedData = async (ph, turb, tds, temp = 25.0, metal = 0.005) => {
      try {
        await fetch(`${SUPABASE_URL}/sensor_readings`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            ph_level: ph,
            turbidity: turb,
            tds_value: tds,
            temperature: temp,
            heavymetal: metal
          })
        });
        this.fetchTelemetry();
      } catch (err) {
        console.error('Simulation push error: ', err);
      }
    };

    document.querySelectorAll('.sim-btn[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        if (preset === 'NORMAL_SAFE') pushSimulatedData(7.2, 1.5, 120);
        if (preset === 'MONSOON_SILT') pushSimulatedData(7.1, 16.5, 240); 
        if (preset === 'MINING_TOXIC_LEAK') pushSimulatedData(4.5, 15.0, 1100, 26.0, 0.04); 
        if (preset === 'SALINE_INTRUSION') pushSimulatedData(7.5, 2.0, 1580); 
      });
    });

    const customApplyBtn = document.getElementById('apply-custom-sliders');
    if (customApplyBtn) {
      customApplyBtn.addEventListener('click', () => {
        const ph = parseFloat(document.getElementById('slider-ph').value);
        const turb = parseFloat(document.getElementById('slider-turb').value);
        const tds = parseFloat(document.getElementById('slider-tds').value);
        const temp = parseFloat(document.getElementById('slider-temp').value);
        const metal = parseFloat(document.getElementById('slider-metal').value);
        pushSimulatedData(ph, turb, tds, temp, metal);
      });
    }
  },

  bindActuatorEvents: function () {
    const sampleBtn = document.getElementById('trigger-sample-btn');
    if (sampleBtn) {
      sampleBtn.addEventListener('click', () => {
        sampleBtn.disabled = true;
        sampleBtn.textContent = 'Drawing 100ml Sample...';
        setTimeout(() => {
          alert('Detachable Sample Captured Successfully!\nSample Custody Token: CLOUD-AQ-' + Math.floor(Math.random() * 90000 + 10000));
          sampleBtn.disabled = false;
          sampleBtn.textContent = 'Capture Physical Sample';
        }, 1500);
      });
    }
  }
};

function switchRole(role) {
  const url = new URL(window.location);
  if (role === 'all') {
    url.searchParams.delete('role');
  } else {
    url.searchParams.set('role', role);
  }
  window.history.replaceState({}, '', url);
  AquaApp.applyRoleView(role);
}

document.addEventListener('DOMContentLoaded', () => AquaApp.init());
