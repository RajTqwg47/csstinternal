// EMM QR Code Generator JavaScript

class EMMQRGenerator {
    constructor() {
        // Platform-specific default signature checksums (kept centralized)
        this.DEFAULT_CHECKSUM = {
            airwatch: '6kyqxDOjgS30jvQuzh4uvHPk-0bmAD-1QU7vtW7i_o8=',
            soti: 'hn8mSNJMPcovWbnnWrb-uMpWZjNlNp-jyV_2A-Whumc='
        };
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

        // Connectivity mode change should also update platform specific displays
        const connSel = document.getElementById('connectivityMode');
        if (connSel) {
            connSel.addEventListener('change', () => this.handlePlatformChange());
        }
    }

    setDefaultValues() {
        const defaults = {
            wifiSSID: 'WLWPA2PSK',
            wifiSecurity: 'WPA',
            wifiPassword: 'validation',
            agentUrl: 'https://storage.googleapis.com/its-compute-emc-st-ftp-publicbucekt-q/AirWatchAgent-playstore-release-25.07.0.1331-SNAPSHOT.apk',
            serverUrl: 'https://techp.awmdm.com',
            groupId: 'TestPlan-DO',
            username: 'TestPlan-DO',
            password: 'TestPlan-DO',
            signatureChecksum: this.DEFAULT_CHECKSUM.airwatch,
            sotiAgentUrl: 'https://storage.googleapis.com/its-compute-emc-st-ftp-publicbucekt-q/GoogleMobiControl1513_1071.apk',
            enrollmentId: 'WEWUXV79'
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
            checksumField.value = this.DEFAULT_CHECKSUM[platform] || this.DEFAULT_CHECKSUM.airwatch;
        }

        if (platform === 'airwatch') {
            if (airwatchSection) airwatchSection.style.display = 'block';
            if (sotiSection) sotiSection.style.display = 'none';
            if (advancedSection) advancedSection.style.display = 'block';
        } else if (platform === 'soti') {
            if (airwatchSection) airwatchSection.style.display = 'none';
            if (sotiSection) sotiSection.style.display = 'block';
            if (advancedSection) advancedSection.style.display = 'block';
        }

        // Handle WiFi section visibility based on connectivity mode
        if (wifiSection) {
            wifiSection.style.display = (connectivity === 'wifi') ? 'block' : 'none';
        }
    }

    togglePasswordVisibility(passwordFieldId, buttonId) {
        const passwordField = document.getElementById(passwordFieldId);
        const toggleButton = document.getElementById(buttonId);

        if (passwordField.type === 'password') {
            passwordField.type = 'text';
            toggleButton.textContent = 'Hide';
        } else {
            passwordField.type = 'password';
            toggleButton.textContent = 'Show';
        }
    }

    resetForm() {
        this.form.reset();
        this.setDefaultValues();
        if (this.output) this.output.style.display = 'none';
        if (this.qrContainer) this.qrContainer.innerHTML = '';
        if (this.jsonOutput) this.jsonOutput.textContent = '';
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        
        if (!this.validateForm()) return;
        
        try {
            // Show loading state
            const submitBtn = this.form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Generating...';
            submitBtn.disabled = true;
            
            const json = this.generateJSON();
            await this.generateQR(json);
            
            // Show output
            if (this.output) this.output.style.display = 'block';
            
            // Reset button
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        } catch (error) {
            console.error('Error generating QR code:', error);
            alert('Failed to generate QR code. Please check the console for details.');
            
            // Reset button on error
            const submitBtn = this.form.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Generate QR Code';
            submitBtn.disabled = false;
        }
    }

    generateJSON() {
        const formData = new FormData(this.form);
        const data = Object.fromEntries(formData.entries());
        
        // Sanitize all inputs
        Object.keys(data).forEach(key => {
            data[key] = this.sanitize(data[key]);
        });
        
        const platform = data.emmPlatform?.toLowerCase() || 'airwatch';
        const connectivity = data.connectivityMode?.toLowerCase() || 'wifi';
        
        let config = {};
        
        if (platform === 'airwatch') {
            config = {
                "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "com.airwatch.androidagent/com.airwatch.agent.DeviceAdministratorReceiver",
                "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": data.signatureChecksum + "\n",
                "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": data.agentUrl,
                "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false,
                "android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED": data.leaveSystemApps === 'true',
                "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
                    "serverurl": data.serverUrl,
                    "gid": data.groupId,
                    "un": data.username,
                    "pw": data.password
                }
            };
            
            if (connectivity === 'wifi') {
                config["android.app.extra.PROVISIONING_WIFI_SSID"] = data.wifiSSID;
                config["android.app.extra.PROVISIONING_WIFI_SECURITY_TYPE"] = data.wifiSecurity.toUpperCase();
                config["android.app.extra.PROVISIONING_WIFI_PASSWORD"] = data.wifiPassword;
                config["android.app.extra.PROVISIONING_USE_MOBILE_DATA"] = false;
            } else {
                config["android.app.extra.PROVISIONING_USE_MOBILE_DATA"] = true;
            }
            
        } else if (platform === 'soti') {
            config = {
                "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": "net.soti.mobicontrol.androidwork/net.soti.mobicontrol.admin.DeviceAdminAdapter",
                "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": data.signatureChecksum + "\n",
                "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": data.sotiAgentUrl,
                "android.app.extra.PROVISIONING_SKIP_ENCRYPTION": false,
                "android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED": data.leaveSystemApps === 'true',
                "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
                    "enrollmentId": data.enrollmentId || ""
                }
            };
            
            if (connectivity === 'wifi') {
                config["android.app.extra.PROVISIONING_WIFI_SSID"] = data.wifiSSID;
                config["android.app.extra.PROVISIONING_WIFI_SECURITY_TYPE"] = data.wifiSecurity.toUpperCase();
                config["android.app.extra.PROVISIONING_WIFI_PASSWORD"] = data.wifiPassword;
                config["android.app.extra.PROVISIONING_USE_MOBILE_DATA"] = false;
            } else {
                config["android.app.extra.PROVISIONING_USE_MOBILE_DATA"] = true;
            }
        }
        
        // Convert to deterministic minified JSON (stable key ordering, no extra whitespace)
        const sortedConfig = {};
        Object.keys(config).sort().forEach(key => {
            sortedConfig[key] = config[key];
        });
        
        const jsonString = JSON.stringify(sortedConfig);
        console.log('Generated JSON:', jsonString);
        console.log('JSON length:', jsonString.length);
        
        return jsonString;
    }

    validateForm() {
        const requiredFields = {
            airwatch: ['agentUrl', 'serverUrl', 'groupId', 'username', 'password'],
            soti: ['sotiAgentUrl']
        };
        
        const fieldNames = {
            agentUrl: 'Agent Download URL',
            serverUrl: 'Server URL', 
            groupId: 'Group ID',
            username: 'Username',
            password: 'Password',
            sotiAgentUrl: 'SOTI Agent Download URL'
        };
        
        // Always require WiFi fields if WiFi connectivity is selected
        const connectivity = document.getElementById('connectivityMode')?.value?.toLowerCase() || 'wifi';
        const wifiFields = ['wifiSSID', 'wifiPassword'];
        const wifiFieldNames = {
            wifiSSID: 'WiFi SSID',
            wifiPassword: 'WiFi Password'
        };
        
        const platform = document.getElementById('emmPlatform')?.value?.toLowerCase() || 'airwatch';
        const fields = requiredFields[platform] || requiredFields.airwatch;
        
        // Add WiFi validation if connectivity mode is WiFi
        const allFields = connectivity === 'wifi' ? [...fields, ...wifiFields] : fields;
        const allFieldNames = connectivity === 'wifi' ? {...fieldNames, ...wifiFieldNames} : fieldNames;
        
        for (const field of allFields) {
            const element = document.getElementById(field);
            const value = this.sanitize(element?.value || '');
            
            if (!value) {
                alert(`Please fill in the ${allFieldNames[field] || field} field.`);
                element?.focus();
                return false;
            }
            
            // URL validation for agent URLs and server URL
            if (field.includes('Url') || field === 'serverUrl') {
                try {
                    new URL(value);
                } catch {
                    alert(`Please enter a valid URL for ${allFieldNames[field] || field}.`);
                    element?.focus();
                    return false;
                }
            }
            
            // Whitespace warning
            if (element?.value !== value) {
                console.warn(`Whitespace detected in ${field}, trimmed to: "${value}"`);
            }
        }
        
        return true;
    }

    async generateQR(jsonString) {
        if (this.qrContainer) {
            this.qrContainer.innerHTML = '<div style="text-align:center;padding:20px;">Generating QR code...</div>';
        }
        
        if (this.jsonOutput) {
            // Display formatted JSON for readability
            const formattedJson = JSON.stringify(JSON.parse(jsonString), null, 2);
            this.jsonOutput.value = formattedJson;
        }
        
        try {
            // Try different QR code generation methods
            const qrResult = await this.tryQRGeneration(jsonString);
            
            if (this.qrContainer && qrResult) {
                this.qrContainer.innerHTML = '';
                this.qrContainer.appendChild(qrResult.canvas);
            }
        } catch (error) {
            console.error('QR generation failed:', error);
            if (this.qrContainer) {
                this.qrContainer.innerHTML = '<div style="color:red;text-align:center;padding:20px;">Failed to generate QR code. Please try again.</div>';
            }
            throw error;
        }
    }

    async tryQRGeneration(text) {
        const providers = [
            () => this.generateQRServer(text),
            () => this.generateQRTecIT(text),
            () => this.generateQRGoogle(text),
            () => this.generateFallbackQR(text)
        ];
        
        for (const provider of providers) {
            try {
                const result = await provider();
                if (result) return result;
            } catch (error) {
                console.warn('Provider failed:', error);
            }
        }
        
        throw new Error('All QR generation methods failed');
    }

    async generateQRServer(text) {
        const size = 300;
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
        
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve({ canvas, source: 'Generated via QRServer.com' });
            };
            img.onerror = () => reject(new Error('QRServer failed'));
            img.src = url;
        });
    }

    async generateQRTecIT(text) {
        const size = 300;
        const url = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(text)}&code=QRCode&multiplebarcodes=false&translate-esc=false&unit=Fit&dpi=96&imagetype=Gif&rotation=0&color=%23000000&bgcolor=%23ffffff&qunit=Mm&quiet=0&size=Medium`;
        
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, size, size);
                resolve({ canvas, source: 'Generated via TEC-IT' });
            };
            img.onerror = () => reject(new Error('TEC-IT failed'));
            img.src = url;
        });
    }

    async generateQRGoogle(text) {
        const size = 300;
        const url = `https://chart.googleapis.com/chart?chs=${size}x${size}&cht=qr&chl=${encodeURIComponent(text)}`;
        
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve({ canvas, source: 'Generated via Google Charts' });
            };
            img.onerror = () => reject(new Error('Google Charts failed'));
            img.src = url;
        });
    }

    async generateFallbackQR(text) {
        if (window.generateFallbackQR) {
            const canvas = await window.generateFallbackQR(text, 300);
            return { canvas, source: 'Generated offline (fallback)' };
        }
        throw new Error('No fallback QR generator available');
    }

    copyJsonToClipboard() {
        if (this.jsonOutput) {
            this.jsonOutput.select();
            document.execCommand('copy');
            
            const btn = document.getElementById('copyJson');
            if (btn) {
                const originalText = btn.textContent;
                btn.textContent = 'Copied!';
                setTimeout(() => {
                    btn.textContent = originalText;
                }, 2000);
            }
        }
    }

    downloadQRCode() {
        const canvas = this.qrContainer?.querySelector('canvas');
        if (canvas) {
            const link = document.createElement('a');
            link.download = 'emm-qr-code.png';
            link.href = canvas.toDataURL();
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
}

// Theme toggle functionality
function toggleTheme() {
    document.body.classList.toggle('theme-dark');
    localStorage.setItem('theme', document.body.classList.contains('theme-dark') ? 'dark' : 'light');
    
    const btn = document.getElementById('toggleTheme');
    if (btn) {
        btn.textContent = document.body.classList.contains('theme-dark') ? 'Light Theme' : 'Dark Theme';
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Apply saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('theme-dark');
    }
    
    // Update theme button text
    const themeBtn = document.getElementById('toggleTheme');
    if (themeBtn) {
        themeBtn.textContent = document.body.classList.contains('theme-dark') ? 'Light Theme' : 'Dark Theme';
        themeBtn.addEventListener('click', toggleTheme);
    }
    
    // Initialize the EMM QR Generator
    window.emmGenerator = new EMMQRGenerator();
});