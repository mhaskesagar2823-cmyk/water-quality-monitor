/**
 * AQUA SCAN - Official Mining Supervisor Emergency Escalation & Photo Grievance System
 * Serverless Version (GitHub Pages / LocalStorage Compatible)
 */

const EscalationController = {
  mediaStream: null,
  capturedPhotoBase64: '',
  authorities: [
    { id: 'SPCB', name: 'State Pollution Control Board', role: 'Regulatory Compliance', category: 'Environmental Regulators' },
    { id: 'CWC', name: 'Central Water Commission', role: 'Water Resource Management', category: 'Environmental Regulators' },
    { id: 'CGWB', name: 'Central Ground Water Board', role: 'Aquifer Protection', category: 'Environmental Regulators' },
    { id: 'NGT', name: 'National Green Tribunal', role: 'Environmental Law Enforcement', category: 'Environmental Regulators' },
    { id: 'COLLECTOR', name: 'District Collector / Magistrate', role: 'Executive Authority', category: 'Civil Administration' },
    { id: 'SDM', name: 'Sub-Divisional Magistrate', role: 'Local Executive', category: 'Civil Administration' },
    { id: 'SP', name: 'Superintendent of Police', role: 'Law & Order', category: 'Civil Administration' },
    { id: 'ZILLA_PARISHAD', name: 'Zilla Parishad CEO', role: 'Rural Governance', category: 'Civil Administration' },
    { id: 'DMF', name: 'District Mineral Foundation', role: 'Community Welfare', category: 'Mining Oversight' },
    { id: 'DIST_MINING_OFFICER', name: 'District Mining Officer', role: 'Mining Operations Control', category: 'Mining Oversight' },
    { id: 'IBM', name: 'Indian Bureau of Mines', role: 'Federal Mining Regulation', category: 'Mining Oversight' },
    { id: 'DGMS', name: 'Dir. Gen. of Mines Safety', role: 'Mining Safety', category: 'Mining Oversight' },
    { id: 'HEALTH_DEPT', name: 'State Health Department', role: 'Public Health Safety', category: 'Health & Safety' },
    { id: 'JAL_SHAKTI', name: 'Ministry of Jal Shakti (JJM)', role: 'Water Safety Policy', category: 'Health & Safety' },
    { id: 'PHED', name: 'Public Health Engineering Dept', role: 'Drinking Water Supply', category: 'Health & Safety' },
    { id: 'NDRF', name: 'National Disaster Response Force', role: 'Emergency Hazard Response', category: 'Health & Safety' }
  ],

  init: async function () {
    this.renderAuthoritiesChecklist();
    this.bindModalEvents();
    this.bindCameraEvents();
    this.loadPastEscalations();
  },

  renderAuthoritiesChecklist: function () {
    const container = document.getElementById('authority-picker-list');
    if (!container) return;

    container.innerHTML = '';
    const categories = {};

    this.authorities.forEach(auth => {
      if (!categories[auth.category]) categories[auth.category] = [];
      categories[auth.category].push(auth);
    });

    for (const [catName, list] of Object.entries(categories)) {
      const groupHeader = document.createElement('div');
      groupHeader.style.gridColumn = '1 / -1';
      groupHeader.style.fontWeight = '800';
      groupHeader.style.fontSize = '0.78rem';
      groupHeader.style.color = '#0284c7';
      groupHeader.style.textTransform = 'uppercase';
      groupHeader.style.padding = '0.5rem 0 0.2rem';
      groupHeader.textContent = catName;
      container.appendChild(groupHeader);

      list.forEach(auth => {
        const item = document.createElement('label');
        item.className = 'auth-check-item';
        const defaultChecked = ['SPCB', 'COLLECTOR', 'DMF', 'DIST_MINING_OFFICER', 'HEALTH_DEPT'].includes(auth.id);
        item.innerHTML = `
          <input type="checkbox" name="auth-id" value="${auth.id}" ${defaultChecked ? 'checked' : ''} />
          <div class="auth-check-info">
            <span class="auth-check-name">${auth.name}</span>
            <span class="auth-check-role">${auth.role}</span>
          </div>
        `;
        container.appendChild(item);
      });
    }
  },

  bindModalEvents: function () {
    const openBtn = document.getElementById('open-escalation-modal-btn');
    const modal = document.getElementById('escalation-modal');
    const closeBtn = document.getElementById('close-escalation-modal-btn');
    const form = document.getElementById('escalation-form');

    if (openBtn && modal) {
      openBtn.addEventListener('click', () => {
        modal.classList.add('open');
        this.startCamera();
      });
    }

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => {
        modal.classList.remove('open');
        this.stopCamera();
      });
    }

    if (form) {
      form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    const selectAllBtn = document.getElementById('btn-select-all-auth');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        document.querySelectorAll('input[name="auth-id"]').forEach(cb => cb.checked = true);
      });
    }

    const selectRecBtn = document.getElementById('btn-select-rec-auth');
    if (selectRecBtn) {
      selectRecBtn.addEventListener('click', () => {
        const rec = ['SPCB', 'COLLECTOR', 'DMF', 'DIST_MINING_OFFICER', 'HEALTH_DEPT', 'JAL_SHAKTI'];
        document.querySelectorAll('input[name="auth-id"]').forEach(cb => {
          cb.checked = rec.includes(cb.value);
        });
      });
    }
  },

  bindCameraEvents: function () {
    const snapBtn = document.getElementById('btn-camera-snap');
    const fileInput = document.getElementById('photo-file-input');
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');
    const preview = document.getElementById('captured-preview');

    if (snapBtn && video && canvas) {
      snapBtn.addEventListener('click', () => {
        if (!this.mediaStream) {
          alert('Camera stream not active. Please allow camera permissions or upload an image file below.');
          return;
        }
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        this.capturedPhotoBase64 = canvas.toDataURL('image/jpeg', 0.85);

        if (preview) {
          preview.src = this.capturedPhotoBase64;
          preview.style.display = 'block';
          video.style.display = 'none';
        }
        snapBtn.textContent = 'Retake Photo';
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            this.capturedPhotoBase64 = evt.target.result;
            if (preview) {
              preview.src = this.capturedPhotoBase64;
              preview.style.display = 'block';
              if (video) video.style.display = 'none';
            }
          };
          reader.readAsDataURL(file);
        }
      });
    }
  },

  startCamera: async function () {
    const video = document.getElementById('camera-video');
    const preview = document.getElementById('captured-preview');
    if (!video) return;

    if (preview) preview.style.display = 'none';
    video.style.display = 'block';

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      video.srcObject = this.mediaStream;
      video.play();
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err);
      if (video) {
        video.style.display = 'none';
      }
    }
  },

  stopCamera: function () {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
  },

  handleSubmit: async function (e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submit-escalation-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Transmitting Emergency Docket...';

    const location = document.getElementById('supv-location').value;
    const severity = document.getElementById('supv-severity').value;
    const description = document.getElementById('supv-statement').value;

    const selectedAuths = [];
    document.querySelectorAll('input[name="auth-id"]:checked').forEach(cb => selectedAuths.push(cb.value));

    // Serverless Mock Ticket Creation
    const targetAuthorityNames = selectedAuths.map(id => {
      const auth = this.authorities.find(a => a.id === id);
      return auth ? auth.name : id;
    });

    const ticket = {
      ticketId: 'AQ-ESC-' + Math.floor(Math.random() * 900000 + 100000),
      timestamp: new Date().toLocaleString(),
      location: location,
      severity: severity,
      sampleBottleId: 'CUSTODY-TKN-' + Math.floor(Math.random() * 9000 + 1000),
      description: description,
      verificationHash: 'SHA256-' + Math.random().toString(36).substring(2, 15).toUpperCase(),
      targetAuthorityNames: targetAuthorityNames,
      photoBase64: this.capturedPhotoBase64
    };

    setTimeout(() => {
      // Save to browser LocalStorage instead of backend
      let pastEscalations = JSON.parse(localStorage.getItem('aqua_escalations') || '[]');
      pastEscalations.unshift(ticket);
      localStorage.setItem('aqua_escalations', JSON.stringify(pastEscalations));

      document.getElementById('escalation-modal').classList.remove('open');
      this.stopCamera();
      this.showSuccessDocket(ticket);
      this.loadPastEscalations();

      submitBtn.disabled = false;
      submitBtn.textContent = 'SUBMIT OFFICIAL ESCALATION DOCKET';
    }, 800); // Slight delay for realistic UI feel
  },

  showSuccessDocket: function (ticket) {
    const modal = document.getElementById('docket-view-modal');
    if (!modal) return;

    document.getElementById('docket-id').textContent = ticket.ticketId;
    document.getElementById('docket-time').textContent = ticket.timestamp;
    document.getElementById('docket-location').textContent = ticket.location;
    document.getElementById('docket-severity').textContent = ticket.severity;
    document.getElementById('docket-sample-id').textContent = ticket.sampleBottleId;
    document.getElementById('docket-desc').textContent = ticket.description;
    document.getElementById('docket-hash').textContent = ticket.verificationHash;

    const authListEl = document.getElementById('docket-authorities-list');
    if (authListEl) {
      authListEl.innerHTML = '';
      (ticket.targetAuthorityNames || []).forEach(name => {
        const li = document.createElement('li');
        li.textContent = name;
        authListEl.appendChild(li);
      });
    }

    const imgEl = document.getElementById('docket-photo');
    if (imgEl) {
      if (ticket.photoBase64 && ticket.photoBase64.length > 50) {
        imgEl.src = ticket.photoBase64;
        imgEl.style.display = 'block';
      } else {
        imgEl.style.display = 'none';
      }
    }

    const qrContainer = document.getElementById('docket-qr');
    if (qrContainer) {
      qrContainer.innerHTML = '';
      // Fixed absolute path issue for GH Pages
      const verificationUrl = window.location.href.split('?')[0] + '?verify=' + ticket.ticketId;
      new QRCode(qrContainer, {
        text: verificationUrl,
        width: 140,
        height: 140
      });
    }

    modal.classList.add('open');
  },

  loadPastEscalations: async function () {
    const tableBody = document.getElementById('past-escalations-tbody');
    if (!tableBody) return;

    // Load from LocalStorage instead of backend
    const tickets = JSON.parse(localStorage.getItem('aqua_escalations') || '[]');

    tableBody.innerHTML = '';
    tickets.forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${t.ticketId}</strong></td>
        <td>${t.timestamp}</td>
        <td><span class="status-badge-sm ${t.severity.includes('CRITICAL') ? 'badge-fail' : 'badge-warn'}">${t.severity}</span></td>
        <td>${t.sampleBottleId}</td>
        <td>${(t.targetAuthorityNames || []).length} Authorities</td>
        <td><button class="btn btn-outline" style="padding:2px 8px; font-size:0.75rem;" onclick='EscalationController.showSuccessDocket(${JSON.stringify(t).replace(/'/g, "&#39;")})'>View Docket</button></td>
      `;
      tableBody.appendChild(tr);
    });
  }
};

document.addEventListener('DOMContentLoaded', () => EscalationController.init());
