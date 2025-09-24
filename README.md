# EMM Enrollment QR Code Generator

A web application to generate QR codes for Android Enterprise Mobile Management (EMM) enrollment with customizable WiFi and agent configurations.

## Features

- **WiFi Configuration**: Set SSID, security type (WPA/WPA2/WEP/Open), and password
- **EMM Agent Settings**: Configure agent download URL, server URL, group ID, username, and password
- **Advanced Options**: Skip encryption settings and signature checksum
- **QR Code Generation**: Creates QR codes from the JSON configuration
- **JSON Export**: View and copy the generated JSON configuration
- **Download**: Save QR codes as PNG images
- **Responsive Design**: Works on desktop and mobile devices

## Usage

1. **Open the Application**: Open `index.html` in a web browser
2. **Configure WiFi Settings**:
   - Enter WiFi SSID
   - Select security type
   - Enter WiFi password (optional for open networks)
3. **Configure EMM Agent**:
   - Enter agent download URL
   - Set server URL
   - Provide group ID, username, and password
4. **Advanced Settings**:
   - Set encryption preferences
   - Verify signature checksum
5. **Generate QR Code**: Click "Generate QR Code" button
6. **Use the QR Code**: 
   - View the generated QR code
   - Copy the JSON configuration
   - Download the QR code as PNG

## Default Configuration

The application comes pre-configured with sample values based on the provided JSON structure:

```json
{
   "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME":"com.airwatch.androidagent/com.airwatch.agent.DeviceAdministratorReceiver",
   "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM":"6kyqxDOjgS30jvQuzh4uvHPk-0bmAD-1QU7vtW7i_o8=",
   "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION":"https://storage.googleapis.com/its-compute-emc-st-ftp-publicbucekt-q/AirWatchAgent-playstore-release-23.01.1.1-SNAPSHOT.apk",
   "android.app.extra.PROVISIONING_SKIP_ENCRYPTION":false,
   "android.app.extra.PROVISIONING_WIFI_SSID":"ZEWireless",
   "android.app.extra.PROVISIONING_WIFI_SECURITY_TYPE":"WPA",
   "android.app.extra.PROVISIONING_WIFI_PASSWORD":"bozhqy6#",
   "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE":{
      "serverurl":"https://techp.awmdm.com",
      "gid":"TestPlan-DO",
      "un":"TestPlan-DO",
      "pw":"TestPlan-DO"
   }
}
```

## File Structure

```
EMM_QR/
├── index.html          # Main HTML file
├── styles.css          # CSS styling
├── script.js           # JavaScript functionality
└── README.md           # This file
```

## Dependencies

- **QRCode.js**: Loaded via CDN for QR code generation
- Modern web browser with JavaScript enabled

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## Features Details

### Form Validation
- Required field validation
- URL format validation
- Real-time error feedback

### Security Features
- Password visibility toggle
- Input sanitization
- Error handling

### User Experience
- Responsive design for mobile devices
- Loading states and visual feedback
- Copy to clipboard functionality
- QR code download capability

## Technical Notes

- QR codes are generated client-side using QRCode.js library
- No data is sent to external servers
- JSON structure follows Android Enterprise provisioning standards
- Error correction level set to 'M' for optimal scanning

## Troubleshooting

1. **QR Code not generating**: Check internet connection for QRCode.js library
2. **Invalid URL errors**: Ensure URLs start with http:// or https://
3. **Copy not working**: Use manual selection if clipboard API fails
4. **Download not working**: Check browser popup blocker settings

## License

This project is provided as-is for educational and internal use purposes.