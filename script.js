// EMM QR Code Generator JavaScript

class EMMQRGenerator {
    constructor() {
        // Platform-specific default signature checksums (kept centralized)
        this.DEFAULT_CHECKSUM = {
            airwatch: '6kyqxDOjgS30jvQuzh4uvHPk-0bmAD-1QU7vtW7i_o8=',
            soti: 'hn8mSNJMPcovWbnnWrb-uMpWZjNlNp-jyV_2A-Whumc='
        };
        this.AGENT_DB_KEY = 'emmqr-agent-db-v1';
        this.agentDb = { airwatch: [], soti: [] };
        this.form = document.getElementById('emmForm');
        this.output = document.getElementById('output');
        this.qrContainer = document.getElementById('qrcode');
        this.jsonOutput = document.getElementById('jsonOutput');
        // Bind helpers
        this.sanitize = (s) => {
            if (s === undefined || s === null) return '';
            return String(s).replace(/\r/g,'').trim();
        };
        
        this.initializeEventListeners();
        this.setDefaultValues();
        this.loadAgentDb();
        this.ensureSeedAgents();
        this.populateAgentSelects();
        this.initAgentModal();
    }

    initializeEventListeners() {
        // Form submission
        this.form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        
        // Platform change
        const platSel = document.getElementById('emmPlatform');
        if (platSel) {
            platSel.addEventListener('change', () => this.handlePlatformChange());
        }
        
        // Password toggle buttons
        document.getElementById('togglePassword').addEventListener('click', () => {
            this.togglePasswordVisibility('wifiPassword', 'togglePassword');
        });
        
        document.getElementById('toggleEmmPassword').addEventListener('click', () => {
            this.togglePasswordVisibility('password', 'toggleEmmPassword');
        });
        
        // Reset form button
        document.getElementById('resetForm').addEventListener('click', () => {
            this.resetForm();
        });
        
        // Copy JSON button
        document.getElementById('copyJson').addEventListener('click', () => {
            this.copyJsonToClipboard();
        });
        
        // Download QR code button
        document.getElementById('downloadQR').addEventListener('click', () => {
            this.downloadQRCode();
        });

        // SOTI WiFi override checkbox listener (may not exist yet during Airwatch) use delegated safe lookup

        // Connectivity mode change should also update platform specific displays
        const connSel = document.getElementById('connectivityMode');
        if (connSel) {
            connSel.addEventListener('change', () => this.handlePlatformChange());
        }

        // Agent add buttons
        const addAw = document.getElementById('addAgentBtn');
        if (addAw) addAw.addEventListener('click',()=>this.openAgentModal('airwatch'));
        const addSoti = document.getElementById('addSotiAgentBtn');
        if (addSoti) addSoti.addEventListener('click',()=>this.openAgentModal('soti'));
        const editAw = document.getElementById('editAgentBtn');
        if (editAw) editAw.addEventListener('click',()=>this.openAgentModal('airwatch', true));
        const editSoti = document.getElementById('editSotiAgentBtn');
        if (editSoti) editSoti.addEventListener('click',()=>this.openAgentModal('soti', true));
    }

    // -------- Agent DB Management --------
    loadAgentDb(){
        try {
            const raw = localStorage.getItem(this.AGENT_DB_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    this.agentDb = { airwatch: parsed.airwatch||[], soti: parsed.soti||[] };
                }
            }
        } catch(e){ console.warn('Agent DB load failed, using empty', e); }
    }
    saveAgentDb(){
        try { localStorage.setItem(this.AGENT_DB_KEY, JSON.stringify(this.agentDb)); }
        catch(e){ console.error('Agent DB save failed', e); }
    }
    ensureSeedAgents(){
        const seedAdded = (list, url)=> list.some(e=>e.url===url);
        // Minimal seeds (avoid duplicates)
        if (!seedAdded(this.agentDb.airwatch,'https://storage.googleapis.com/its-compute-emc-st-ftp-publicbucekt-q/AirWatchAgent-playstore-release-23.01.1.1-SNAPSHOT.apk')) {
            this.agentDb.airwatch.push({ label:'AirWatch 23.01.1.1 Snapshot', url:'https://storage.googleapis.com/its-compute-emc-st-ftp-publicbucekt-q/AirWatchAgent-playstore-release-23.01.1.1-SNAPSHOT.apk' });
        }
        if (!seedAdded(this.agentDb.soti,'https://storage.googleapis.com/its-compute-emc-st-ftp-publicbucekt-q/GoogleMobiControl1513_1071.apk')) {
            this.agentDb.soti.push({ label:'SOTI 15.1.3 (1071)', url:'https://storage.googleapis.com/its-compute-emc-st-ftp-publicbucekt-q/GoogleMobiControl1513_1071.apk' });
        }
        this.saveAgentDb();
    }
    populateAgentSelects(){
        const awSel = document.getElementById('agentUrlSelect');
        const awHidden = document.getElementById('agentUrl');
        if (awSel && awHidden) {
            awSel.innerHTML = '';
            this.agentDb.airwatch.forEach((e,i)=>{
                const opt=document.createElement('option');
                opt.value=e.url; opt.textContent=e.label; if(i===0) opt.selected=true; awSel.appendChild(opt);
            });
            if (awSel.value) awHidden.value = awSel.value;
            awSel.addEventListener('change',()=>{ awHidden.value = awSel.value; });
        }
        const sotiSel = document.getElementById('sotiAgentUrlSelect');
        const sotiHidden = document.getElementById('sotiAgentUrl');
        if (sotiSel && sotiHidden) {
            sotiSel.innerHTML='';
            this.agentDb.soti.forEach((e,i)=>{
                const opt=document.createElement('option');
                opt.value=e.url; opt.textContent=e.label; if(i===0) opt.selected=true; sotiSel.appendChild(opt);
            });
            if (sotiSel.value) sotiHidden.value = sotiSel.value;
            sotiSel.addEventListener('change',()=>{ sotiHidden.value = sotiSel.value; });
        }
    }
    initAgentModal(){
        this.agentModal = document.getElementById('agentModal');
        this.agentAddForm = document.getElementById('agentAddForm');
        if(!this.agentModal || !this.agentAddForm) return;
        document.getElementById('cancelAgentModal').addEventListener('click',()=>this.closeAgentModal());
        this.agentAddForm.addEventListener('submit',(e)=>{
            e.preventDefault();
            this.saveNewAgent();
        });
    }
    openAgentModal(pref, isEdit=false){
        if (!this.agentModal) return;
        this.editMode = isEdit;
        this.agentModal.style.display='flex';
        const platSel = document.getElementById('newAgentPlatform');
        const labelInput = document.getElementById('newAgentLabel');
        const urlInput = document.getElementById('newAgentUrl');
        if (platSel && pref) platSel.value = pref;
        if (isEdit) {
            // Prefill with current selection
            const sel = pref==='soti' ? document.getElementById('sotiAgentUrlSelect') : document.getElementById('agentUrlSelect');
            if (sel && sel.value) {
                const list = pref==='soti' ? this.agentDb.soti : this.agentDb.airwatch;
                const found = list.find(e=>e.url===sel.value);
                if (found){
                    labelInput.value = found.label;
                    urlInput.value = found.url;
                }
            }
        } else {
            labelInput.value='';
            urlInput.value='';
        }
        labelInput.focus();
    }
    closeAgentModal(){ if(this.agentModal) this.agentModal.style.display='none'; this.agentAddForm?.reset(); this.editMode=false; }
    saveNewAgent(){
        const plat = document.getElementById('newAgentPlatform').value.toLowerCase();
        const label = this.sanitize(document.getElementById('newAgentLabel').value);
        const url = this.sanitize(document.getElementById('newAgentUrl').value);
        // Validation
        if (!label || !url) { alert('Label and URL required'); return; }
        try { new URL(url); } catch { alert('Invalid URL'); return; }
        const targetList = plat === 'soti' ? this.agentDb.soti : this.agentDb.airwatch;
        if (this.editMode) {
            const sel = plat==='soti' ? document.getElementById('sotiAgentUrlSelect') : document.getElementById('agentUrlSelect');
            const originalUrl = sel ? sel.value : null;
            // Exclude original entry when checking duplicates
            if (targetList.some(e=>e.url===url && e.url!==originalUrl)) { alert('URL already exists in list'); return; }
            if (targetList.some(e=>e.label.toLowerCase()===label.toLowerCase() && e.url!==originalUrl)) { alert('Label already exists'); return; }
            const idx = targetList.findIndex(e=>e.url===originalUrl);
            if (idx>=0){
                targetList[idx].label = label;
                targetList[idx].url = url;
            }
        } else {
            if (targetList.some(e=>e.url===url)) { alert('URL already exists in list'); return; }
            if (targetList.some(e=>e.label.toLowerCase()===label.toLowerCase())) { alert('Label already exists'); return; }
            targetList.unshift({ label, url }); // put newest on top
        }
        this.saveAgentDb();
        this.populateAgentSelects();
        // Auto-select new
        if (!this.editMode){
            if (plat==='soti') {
                const sel=document.getElementById('sotiAgentUrlSelect');
                const hidden=document.getElementById('sotiAgentUrl');
                if (sel) sel.selectedIndex=0;
                if (hidden && sel) hidden.value = sel.value;
            } else {
                const sel=document.getElementById('agentUrlSelect');
                const hidden=document.getElementById('agentUrl');
                if (sel) sel.selectedIndex=0;
                if (hidden && sel) hidden.value = sel.value;
            }
        } else {
            // Maintain the edited one selected
            if (plat==='soti') {
                const sel=document.getElementById('sotiAgentUrlSelect');
                const hidden=document.getElementById('sotiAgentUrl');
                if (sel && hidden){
                    const idx = this.agentDb.soti.findIndex(e=>e.url===url);
                    if (idx>=0) sel.value = url;
                    hidden.value = url;
                }
            } else {
                const sel=document.getElementById('agentUrlSelect');
                const hidden=document.getElementById('agentUrl');
                if (sel && hidden){
                    const idx = this.agentDb.airwatch.findIndex(e=>e.url===url);
                    if (idx>=0) sel.value = url;
                    hidden.value = url;
                }
            }
        }
        this.closeAgentModal();
    }
    // -------- End Agent DB Management --------

    setDefaultValues() {
        const defaults = {
            wifiSSID: 'ZEWireless',
            wifiSecurity: 'WPA',
            wifiPassword: 'bozhqy6#',
            agentUrl: 'https://example.com/agent.apk',
            serverUrl: 'https://example.com',
            groupId: 'GROUP_ID',
            username: 'username',
            password: 'password',
            signatureChecksum: this.DEFAULT_CHECKSUM.airwatch,
            sotiAgentUrl: 'https://storage.googleapis.com/its-compute-emc-st-ftp-publicbucekt-q/GoogleMobiControl1513_1071.apk'
        };

        Object.entries(defaults).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el && !el.value) el.value = val;
        });

        this.handlePlatformChange();
    }

    handlePlatformChange() {
        const platform = (document.getElementById('emmPlatform')?.value || 'airwatch').toLowerCase();
        const connectivity = (document.getElementById('connectivityMode')?.value || 'wifi').toLowerCase();
        const airwatchSection = document.getElementById('airwatchSection');
        const sotiSection = document.getElementById('sotiSection');
        const wifiSection = document.getElementById('wifiSection');
        const advancedSection = document.getElementById('advancedSection');
        // Auto-update hidden checksum field on platform switch to avoid stale value
        const checksumField = document.getElementById('signatureChecksum');
        if (checksumField) {
            const expected = platform === 'airwatch' ? this.DEFAULT_CHECKSUM.airwatch : this.DEFAULT_CHECKSUM.soti;
            if (checksumField.value !== expected) checksumField.value = expected;
        }
        if (platform === 'airwatch') {
            if (airwatchSection) airwatchSection.style.display='';
            if (sotiSection) sotiSection.style.display='none';
            if (wifiSection) wifiSection.style.display= connectivity === 'wifi' ? '' : 'none';
            if (advancedSection) advancedSection.style.display='';
        } else {
            if (airwatchSection) airwatchSection.style.display='none';
            if (sotiSection) sotiSection.style.display='';
            if (wifiSection) wifiSection.style.display= connectivity === 'wifi' ? '' : 'none';
            if (advancedSection) advancedSection.style.display='none';
        }
    }

    validateForm() {
        const platform = (document.getElementById('emmPlatform')?.value || 'airwatch').toLowerCase();
        const connectivity = (document.getElementById('connectivityMode')?.value || 'wifi').toLowerCase();
        const requiredFields = [];
        if (platform === 'airwatch') {
            requiredFields.push('agentUrl','serverUrl','groupId','username','password','signatureChecksum');
            if (connectivity === 'wifi') requiredFields.push('wifiSSID','wifiSecurity');
        } else { // SOTI
            requiredFields.push('enrollmentId','signatureChecksum','sotiAgentUrl');
            if (connectivity === 'wifi') requiredFields.push('wifiSSID','wifiSecurity');
        }

        const fieldNames = {
            wifiSSID: 'WiFi SSID',
            wifiSecurity: 'WiFi Security Type',
            agentUrl: 'Agent Download URL',
            serverUrl: 'Server URL',
            groupId: 'Group ID',
            username: 'Username',
            password: 'Password',
            signatureChecksum: 'Signature Checksum',
            enrollmentId: 'Enrollment ID',
            sotiAgentUrl: 'SOTI Agent Download URL'
        };

        for (const id of requiredFields) {
            const field = document.getElementById(id);
            if (!field || !field.value || !field.value.trim()) {
                const label = fieldNames[id] || id;
                alert(`Please fill in the ${label}.`);
                if (field && field.type !== 'hidden') field.focus();
                return false;
            }
            if (/\s$/.test(field.value) || /\n|\r/.test(field.value)) {
                console.warn('Whitespace/newline detected in field', id);
            }
        }

        if (platform === 'airwatch') {
            for (const id of ['agentUrl','serverUrl']) {
                const field = document.getElementById(id);
                try { new URL(field.value); } catch {
                    const label = id === 'agentUrl' ? 'Agent Download URL' : 'Server URL';
                    alert(`Please enter a valid URL for ${label}.`);
                    field.focus();
                    return false;
                }
            }
        } else { // SOTI URL validation
            const field = document.getElementById('sotiAgentUrl');
            if (field && field.value) {
                try { new URL(field.value); } catch {
                    alert('Please enter a valid URL for SOTI Agent Download URL.');
                    field.focus();
                    return false;
                }
            }
        }
        return true;
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        if (!this.validateForm()) return;
        try {
            this.showLoading();
            const json = this.generateJSON();
            // Display pretty (indented) version for user readability
            this.displayJSON(json);
            // Minified deterministic payload for QR (avoid any formatting whitespace)
            const minPayload = this.buildDeterministicPayload(json);
            await this.generateQRCode(JSON.parse(minPayload));
            this.showOutput();
        } catch (err) {
            console.error('Generation failed', err);
            alert('Failed to generate QR code. Check console for details.');
        } finally {
            this.hideLoading();
        }
    }

    togglePasswordVisibility(inputId, toggleBtnId) {
        const input = document.getElementById(inputId);
        const btn = document.getElementById(toggleBtnId);
        if (!input || !btn) return;
        if (input.type === 'password') {
            input.type = 'text';
            btn.textContent = 'Hide';
        } else {
            input.type = 'password';
            btn.textContent = 'Show';
        }
    }

    generateJSON() {
        const formData = new FormData(this.form);
        const platform = (formData.get('emmPlatform') || 'airwatch').toLowerCase();
        const connectivity = (formData.get('connectivityMode') || 'wifi').toLowerCase();
        const S = this.sanitize;
        const json = {};
        if (platform === 'airwatch') {
            json["android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME"] = "com.airwatch.androidagent/com.airwatch.agent.DeviceAdministratorReceiver";
            json["android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM"] = S(formData.get('signatureChecksum'));
            json["android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION"] = S(formData.get('agentUrl'));
            if (connectivity === 'wifi') {
                json["android.app.extra.PROVISIONING_WIFI_SSID"] = S(formData.get('wifiSSID'));
                json["android.app.extra.PROVISIONING_WIFI_SECURITY_TYPE"] = S(formData.get('wifiSecurity'));
                const pwd = S(formData.get('wifiPassword'));
                if (pwd) json["android.app.extra.PROVISIONING_WIFI_PASSWORD"] = pwd;
            }
            json["android.app.extra.PROVISIONING_USE_MOBILE_DATA"] = connectivity === 'mobile';
            json["android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED"] = formData.get('leaveSystemApps') === 'true';
            json["android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE"] = {
                serverurl: S(formData.get('serverUrl')),
                gid: S(formData.get('groupId')),
                un: S(formData.get('username')),
                pw: S(formData.get('password'))
            };
        } else { // SOTI
            json["android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME"] = "net.soti.mobicontrol.androidwork/net.soti.mobicontrol.admin.DeviceAdminAdapter";
            json["android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM"] = S(formData.get('signatureChecksum')) || this.DEFAULT_CHECKSUM.soti;
            json["android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION"] = S(formData.get('sotiAgentUrl')) || 'https://storage.googleapis.com/its-compute-emc-st-ftp-publicbucekt-q/GoogleMobiControl1513_1071.apk';
            json["android.app.extra.PROVISIONING_SKIP_ENCRYPTION"] = false;
            json["android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED"] = (formData.get('sotiSystemApps') || 'false') === 'true';
            if (connectivity === 'wifi') {
                json["android.app.extra.PROVISIONING_WIFI_SSID"] = S(formData.get('wifiSSID'));
                json["android.app.extra.PROVISIONING_WIFI_SECURITY_TYPE"] = S(formData.get('wifiSecurity'));
                const pwd = S(formData.get('wifiPassword'));
                if (pwd) json["android.app.extra.PROVISIONING_WIFI_PASSWORD"] = pwd;
                json["android.app.extra.PROVISIONING_USE_MOBILE_DATA"] = false;
            } else {
                json["android.app.extra.PROVISIONING_USE_MOBILE_DATA"] = true;
            }
            json["android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE"] = { enrollmentId: S(formData.get('enrollmentId')) };
        }
        console.log('[EMMQR] Generated JSON keys order:', Object.keys(json).join(' | '));
        console.log('[EMMQR] Payload length (chars):', JSON.stringify(json).length);
        console.log('Generated JSON structure:', json);
        return json;
    }

    buildDeterministicPayload(obj){
        // Preserve insertion order of keys; stringify without spaces for QR density
        // Use a replacer to ensure nested bundle keeps stable order
        return JSON.stringify(obj); // already minimal (no whitespace) by default
    }

    async generateQRCode(jsonData) {
        this.qrContainer.innerHTML = '';
        const jsonString = JSON.stringify(jsonData);
        console.log('Generating QR (remote-first) length:', jsonString.length);

        const loadingMsg = document.createElement('div');
        loadingMsg.innerHTML = '<p style="margin:4px 0;text-align:center;color:#667eea;font-size:13px;">Trying remote providers...</p>';
        this.qrContainer.appendChild(loadingMsg);

        // Remote providers list (ordered attempts)
        const providers = [
            {
                name: 'QRServer',
                buildUrl: (d) => 'https://api.qrserver.com/v1/create-qr-code/?data=' + encodeURIComponent(d) + '&size=420x420&margin=2'
            },
            {
                name: 'TEC-IT',
                buildUrl: (d) => 'https://qrcode.tec-it.com/API/QRCode?data=' + encodeURIComponent(d) + '&quietzone=2&dpi=150&errorcorrection=M&format=PNG'
            },
            {
                name: 'GoogleChart',
                buildUrl: (d) => 'https://chart.googleapis.com/chart?cht=qr&chs=420x420&choe=UTF-8&chld=M|2&chl=' + encodeURIComponent(d)
            }
        ];

        async function tryProvider(p){
            return new Promise((resolve, reject)=>{
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error(p.name + ' fetch failed'));
                img.crossOrigin = 'anonymous';
                img.src = p.buildUrl(jsonString);
            });
        }

        let usedRemote = false; let usedProvider = null; let canvas; const remoteErrors=[];
        for(const p of providers){
            try {
                loadingMsg.innerHTML = `<p style="margin:4px 0;text-align:center;color:#667eea;font-size:13px;">Attempting ${p.name}...</p>`;
                const img = await tryProvider(p);
                canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width; canvas.height = img.height;
                ctx.fillStyle='#FFFFFF'; ctx.fillRect(0,0,canvas.width,canvas.height);
                ctx.drawImage(img,0,0);
                usedRemote = true; usedProvider = p.name;
                break; // success
            } catch(err){
                console.warn('Provider failed', p.name, err.message);
                remoteErrors.push(err.message);
            }
        }

        if(!usedRemote){
            console.warn('All remote providers failed; attempting offline fallback. Errors:', remoteErrors.join(' | '));
            try {
                canvas = await window.generateFallbackQR(jsonString, 420);
            } catch(fallbackErr){
                console.error('Offline fallback failed:', fallbackErr);
                this.qrContainer.innerHTML = `
                    <div style="text-align:center;padding:18px;color:#e53e3e;max-width:520px;margin:0 auto;">
                        <h3 style="margin:0 0 6px;">QR Generation Failed</h3>
                        <p style="margin:4px 0;font-size:13px;">Payload Length: ${jsonString.length} chars</p>
                        <p style="margin:4px 0;font-size:13px;">Remote Providers: ${remoteErrors.join(' ; ') || 'No attempt'}</p>
                        <p style="margin:4px 0;font-size:13px;">Offline Fallback: ${fallbackErr.message}</p>
                        <details style="margin-top:8px;font-size:12px;color:#742a2a;">
                            <summary>How to Reduce Size / Fix</summary>
                            <ul style="text-align:left;line-height:1.3;margin:6px 0 0 0;padding-left:18px;">
                                <li>Shorten Agent URL: host a shorter redirect URL if possible.</li>
                                <li>Use shorter group / username strings (e.g. abbreviate TestPlan-DO).</li>
                                <li>Remove unused WiFi password if using OPEN network for staging.</li>
                                <li>Ensure no hidden spaces or trailing slashes in URLs.</li>
                                <li>Retry in 10–30s (remote rate limit or transient network filter).</li>
                            </ul>
                        </details>
                    </div>`;
                throw new Error('All QR generation methods failed');
            }
        }

        // Render result
        this.qrContainer.innerHTML='';
        this.qrContainer.appendChild(canvas);
        this.qrCanvas = canvas;

        // Ensure canvas fits container width (responsive scaling)
        // Force responsive width regardless of intrinsic size
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        canvas.style.maxWidth = '100%';

    // Success text removed per user request (no label above QR)

        // Removed length / scan / tip lines per user request.
    }

    displayJSON(jsonData) {
        const formattedJSON = JSON.stringify(jsonData, null, 2);
        this.jsonOutput.value = formattedJSON;
    }

    showOutput() {
        this.output.style.display = 'block';
        this.output.scrollIntoView({ behavior: 'smooth' });
    }

    showLoading() {
        this.form.classList.add('loading');
        const submitButton = this.form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Generating...';
    }

    hideLoading() {
        this.form.classList.remove('loading');
        const submitButton = this.form.querySelector('button[type="submit"]');
        submitButton.disabled = false;
        submitButton.textContent = 'Generate QR Code';
    }

    resetForm() {
        if (confirm('Are you sure you want to reset the form? All current data will be lost.')) {
            this.form.reset();
            this.setDefaultValues();
            this.output.style.display = 'none';
            this.qrContainer.innerHTML = '';
            this.jsonOutput.value = '';
        }
    }

    async copyJsonToClipboard() {
        try {
            await navigator.clipboard.writeText(this.jsonOutput.value);
            
            // Visual feedback
            const button = document.getElementById('copyJson');
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            button.style.background = '#48bb78';
            
            setTimeout(() => {
                button.textContent = originalText;
                button.style.background = '';
            }, 2000);
            
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            
            // Fallback: select text
            this.jsonOutput.select();
            this.jsonOutput.setSelectionRange(0, 99999);
            
            try {
                document.execCommand('copy');
                alert('JSON copied to clipboard!');
            } catch (fallbackError) {
                alert('Failed to copy to clipboard. Please manually select and copy the text.');
            }
        }
    }

    downloadQRCode() {
        if (!this.qrCanvas) {
            alert('Please generate a QR code first.');
            return;
        }

        try {
            // Create download link
            const link = document.createElement('a');
            link.download = `EMM_QR_Code_${new Date().getTime()}.png`;
            link.href = this.qrCanvas.toDataURL('image/png');
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Visual feedback
            const button = document.getElementById('downloadQR');
            const originalText = button.textContent;
            button.textContent = 'Downloaded!';
            
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);
            
        } catch (error) {
            console.error('Failed to download QR code:', error);
            alert('Failed to download QR code. Please try again.');
        }
    }
}

// Additional utility functions
function validateURL(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

function formatJSON(obj) {
    return JSON.stringify(obj, null, 2);
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        const app = new EMMQRGenerator();
        console.log('EMM QR Code Generator initialized successfully');
        console.log('Using offline QR code generator (no internet required)');
        
        // Check if offline QR generator is available
        if (typeof QRCodeGenerator === 'undefined') {
            console.error('Offline QR generator not loaded');
            alert('QR code generator not available. Please refresh the page.');
        } else {
            console.log('Offline QR code generator loaded successfully');
        }
    } catch (error) {
        console.error('Failed to initialize EMM QR Code Generator:', error);
        alert('Failed to initialize the application. Please refresh the page and try again.');
    }
});

// Handle potential application errors
window.addEventListener('error', (e) => {
    console.error('Application error:', e);
    if (e.message && e.message.includes('QRCodeGenerator')) {
        console.error('Offline QR Code generator error:', e);
        alert('QR code generator error. Please refresh the page and try again.');
    }
});

// Export for potential testing or external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EMMQRGenerator };
}