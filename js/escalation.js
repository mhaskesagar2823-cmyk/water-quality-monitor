/**
 * AQUA SCAN - Official Mining Supervisor Emergency Escalation & Photo Grievance System
 */

const EscalationController = {
  mediaStream: null,
  capturedPhotoBase64: '',
  authorities: [],

  init: async function () {
    this.loadAuthorities();
    this.bindModalEvents();
    this.bindCameraEvents();
    this.loadPastEscalations();
  },

  loadAuthorities: async function () {
    try {
      const res = await fetch('/api/authorities');
      const data = await res.json();
      this.authorities = data.authorities || [];
      this.renderAuthoritiesChecklist();
    } catch (e) {
      console.warn('Failed to load authorities', e);
    }
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
        // Auto check regulatory authorities by default
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

    // Select all / recommend buttons
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
    const cameraBox = document.getElementById('camera-stream-box');

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

    const supervisorName = document.getElementById('supv-name').value;
    const supervisorBadge = document.getElementById('supv-badge').value;
    const location = document.getElementById('supv-location').value;
    const severity = document.getElementById('supv-severity').value;
    const description = document.getElementById('supv-statement').value;

    const selectedAuths = [];
    document.querySelectorAll('input[name="auth-id"]:checked').forEach(cb => selectedAuths.push(cb.value));

    const payload = {
      supervisorName,
      supervisorBadge,
      location,
      severity,
      description,
      photoBase64: this.capturedPhotoBase64,
      targetAuthorityIds: selectedAuths
    };

    try {
      const res = await fetch('/api/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success && data.ticket) {
        document.getElementById('escalation-modal').classList.remove('open');
        this.stopCamera();
        this.showSuccessDocket(data.ticket);
        this.loadPastEscalations();
      } else {
        alert('Failed to submit escalation: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Error connecting to backend: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'SUBMIT OFFICIAL ESCALATION DOCKET';
    }
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

    // Authorities list
    const authListEl = document.getElementById('docket-authorities-list');
    if (authListEl) {
      authListEl.innerHTML = '';
      (ticket.targetAuthorityNames || []).forEach(name => {
        const li = document.createElement('li');
        li.textContent = name;
        authListEl.appendChild(li);
      });
    }

    // Photo
    const imgEl = document.getElementById('docket-photo');
    if (imgEl) {
      if (ticket.photoBase64 && ticket.photoBase64.length > 50) {
        imgEl.src = ticket.photoBase64;
        imgEl.style.display = 'block';
      } else {
        imgEl.style.display = 'none';
      }
    }

    // Dynamic QR code for verification
    const qrContainer = document.getElementById('docket-qr');
    if (qrContainer) {
      qrContainer.innerHTML = '';
      const verificationUrl = window.location.origin + '/mining.html?verify=' + ticket.ticketId;
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

    try {
      const res = await fetch('/api/escalations');
      const data = await res.json();
      const tickets = data.tickets || [];

      tableBody.innerHTML = '';
      tickets.forEach(t => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${t.ticketId}</strong></td>
          <td>${t.timestamp}</td>
          <td><span class="status-badge-sm ${t.severity.includes('CRITICAL') ? 'badge-fail' : 'badge-warn'}">${t.severity}</span></td>
          <td>${t.sampleBottleId}</td>
          <td>${(t.targetAuthorityNames || []).length} Authorities</td>
          <td><button class="btn btn-outline" style="padding:2px 8px; font-size:0.75rem;" onclick='EscalationController.showSuccessDocket(${JSON.stringify(t)})'>View Docket</button></td>
        `;
        tableBody.appendChild(tr);
      });
    } catch (e) {
      console.warn('Failed to load past escalations', e);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => EscalationController.init());
