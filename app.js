/* ==========================================================================
   QR Studio - Main Application Controller
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    // Initialize Lucide icons
    lucide.createIcons();

    // ==========================================================================
    // 1. STATE & GLOBAL INSTANCES
    // ==========================================================================
    const appState = {
        theme: localStorage.getItem("theme") || "dark",
        activeTab: "generator-tab",
        activeContentType: "text",
        generator: {
            size: 400,
            margin: 10,
            errorLevel: "M",
            dots: {
                type: "rounded",
                colorType: "single",
                color: "#6366f1",
                gradient: {
                    type: "linear",
                    rotation: 45,
                    start: "#6366f1",
                    end: "#a855f7"
                }
            },
            cornersSquare: {
                type: "extra-rounded",
                matchColor: true,
                color: "#6366f1"
            },
            cornersDot: {
                type: "dot",
                matchColor: true,
                color: "#6366f1"
            },
            background: {
                color: "#ffffff",
                opacity: 100
            },
            logo: {
                dataUrl: null,
                size: 0.15,
                margin: 3,
                clearBackground: true
            }
        },
        scanner: {
            mode: "camera", // 'camera' or 'file'
            html5QrCode: null,
            isCameraRunning: false,
            activeCameraId: null
        }
    };

    // Initialize QR Code Styling generator (using SVG to prevent canvas dot-streaking artifacts)
    const qrCode = new QRCodeStyling({
        width: appState.generator.size,
        height: appState.generator.size,
        margin: appState.generator.margin,
        type: "svg",
        data: "https://zdenekp03.github.io/clock/",
        dotsOptions: {
            color: appState.generator.dots.color,
            type: appState.generator.dots.type
        },
        backgroundOptions: {
            color: appState.generator.background.color
        },
        cornersSquareOptions: {
            type: appState.generator.cornersSquare.type,
            color: appState.generator.cornersSquare.color
        },
        cornersDotOptions: {
            type: appState.generator.cornersDot.type,
            color: appState.generator.cornersDot.color
        },
        imageOptions: {
            crossOrigin: "anonymous",
            margin: appState.generator.logo.margin
        }
    });

    // Append to container
    const qrContainer = document.getElementById("qr-canvas-container");
    qrCode.append(qrContainer);

    // Debounce timer for live QR updating
    let updateQrDebounceTimer = null;

    // ==========================================================================
    // 2. THEME SYSTEM
    // ==========================================================================
    const themeToggleBtn = document.getElementById("theme-toggle");

    function applyTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
        appState.theme = theme;
    }

    applyTheme(appState.theme);

    themeToggleBtn.addEventListener("click", () => {
        const nextTheme = appState.theme === "dark" ? "light" : "dark";
        applyTheme(nextTheme);
    });

    // ==========================================================================
    // 3. TAB MANAGEMENT (Generator vs Scanner)
    // ==========================================================================
    const navTabs = document.querySelectorAll(".nav-tab");
    const tabPanels = document.querySelectorAll(".tab-panel");

    navTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const targetTab = tab.dataset.tab;

            navTabs.forEach(t => t.classList.remove("active"));
            tabPanels.forEach(p => p.classList.remove("active"));

            tab.classList.add("active");
            document.getElementById(targetTab).classList.add("active");
            appState.activeTab = targetTab;

            // Handle Camera release when leaving Scanner Tab
            if (targetTab !== "scanner-tab") {
                stopCameraScanner();
            } else {
                // Just switched to scanner tab, trigger camera loading
                initCameraList();
            }
        });
    });

    // ==========================================================================
    // 4. ACCORDION SYSTEM
    // ==========================================================================
    const accordionHeaders = document.querySelectorAll(".accordion-header");

    accordionHeaders.forEach(header => {
        header.addEventListener("click", () => {
            const targetId = header.dataset.target;
            const content = document.getElementById(targetId);

            const isCurrentlyActive = header.classList.contains("active");

            // Close all
            accordionHeaders.forEach(h => h.classList.remove("active"));
            document.querySelectorAll(".accordion-content").forEach(c => {
                c.classList.remove("active");
            });

            // Toggle selected
            if (!isCurrentlyActive) {
                header.classList.add("active");
                content.classList.add("active");
            }
        });
    });

    // ==========================================================================
    // 5. COLOR PICKERS & SLIDERS SYNCHRONIZATION
    // ==========================================================================
    function setupColorSync(pickerId, hexId, stateTarget) {
        const picker = document.getElementById(pickerId);
        const hex = document.getElementById(hexId);

        picker.addEventListener("input", (e) => {
            const color = e.target.value;
            hex.value = color;
            stateTarget(color);
            triggerQrUpdate();
        });

        hex.addEventListener("input", (e) => {
            let color = e.target.value.trim();
            if (color.length === 6 && !color.startsWith("#")) {
                color = "#" + color;
                hex.value = color;
            }
            if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                picker.value = color;
                stateTarget(color);
                triggerQrUpdate();
            }
        });
    }

    // Bind color picker syncs
    setupColorSync("dots-color", "dots-color-hex", (color) => {
        appState.generator.dots.color = color;
    });
    setupColorSync("dots-grad-start", "dots-grad-start-hex", (color) => {
        appState.generator.dots.gradient.start = color;
    });
    setupColorSync("dots-grad-end", "dots-grad-end-hex", (color) => {
        appState.generator.dots.gradient.end = color;
    });
    setupColorSync("corners-square-color", "corners-square-color-hex", (color) => {
        appState.generator.cornersSquare.color = color;
    });
    setupColorSync("corners-dot-color", "corners-dot-color-hex", (color) => {
        appState.generator.cornersDot.color = color;
    });
    setupColorSync("bg-color", "bg-color-hex", (color) => {
        appState.generator.background.color = color;
    });

    // Setup Slider Label updates
    function setupSlider(sliderId, labelId, valueSuffix, stateTarget) {
        const slider = document.getElementById(sliderId);
        const label = document.getElementById(labelId);

        slider.addEventListener("input", (e) => {
            const val = e.target.value;
            label.textContent = val + valueSuffix;
            stateTarget(val);
            triggerQrUpdate();
        });
    }

    setupSlider("qr-size", "val-qr-size", "px", (val) => {
        appState.generator.size = parseInt(val);
    });
    setupSlider("qr-margin", "val-qr-margin", "px", (val) => {
        appState.generator.margin = parseInt(val);
    });
    setupSlider("dots-grad-rotation", "val-dots-grad-rotation", "°", (val) => {
        appState.generator.dots.gradient.rotation = parseInt(val);
    });
    setupSlider("bg-opacity", "val-bg-opacity", "%", (val) => {
        appState.generator.background.opacity = parseInt(val);
    });
    setupSlider("logo-size", "val-logo-size", "%", (val) => {
        appState.generator.logo.size = parseInt(val) / 100;
    });
    setupSlider("logo-margin", "val-logo-margin", "px", (val) => {
        appState.generator.logo.margin = parseInt(val);
    });

    // Match Color Checkboxes
    const matchSquareColorCheckbox = document.getElementById("corners-square-color-match");
    const matchSquareGroup = document.getElementById("corners-square-color-group");
    matchSquareColorCheckbox.addEventListener("change", (e) => {
        const match = e.target.checked;
        appState.generator.cornersSquare.matchColor = match;
        if (match) {
            matchSquareGroup.classList.add("hidden");
        } else {
            matchSquareGroup.classList.remove("hidden");
        }
        triggerQrUpdate();
    });

    const matchDotColorCheckbox = document.getElementById("corners-dot-color-match");
    const matchDotGroup = document.getElementById("corners-dot-color-group");
    matchDotColorCheckbox.addEventListener("change", (e) => {
        const match = e.target.checked;
        appState.generator.cornersDot.matchColor = match;
        if (match) {
            matchDotGroup.classList.add("hidden");
        } else {
            matchDotGroup.classList.remove("hidden");
        }
        triggerQrUpdate();
    });

    // Error Correction Level dropdown
    const qrErrorLevel = document.getElementById("qr-error-level");
    qrErrorLevel.addEventListener("change", (e) => {
        appState.generator.errorLevel = e.target.value;
        triggerQrUpdate();
    });

    // Dot shape selection
    const dotsType = document.getElementById("dots-type");
    dotsType.addEventListener("change", (e) => {
        appState.generator.dots.type = e.target.value;
        triggerQrUpdate();
    });

    // Corner Square shape selection
    const cornersSquareType = document.getElementById("corners-square-type");
    cornersSquareType.addEventListener("change", (e) => {
        appState.generator.cornersSquare.type = e.target.value;
        triggerQrUpdate();
    });

    // Corner Dot shape selection
    const cornersDotType = document.getElementById("corners-dot-type");
    cornersDotType.addEventListener("change", (e) => {
        appState.generator.cornersDot.type = e.target.value;
        triggerQrUpdate();
    });

    // Color Type selection (Single vs Gradient)
    const dotsColorType = document.getElementById("dots-color-type");
    const dotsSingleGroup = document.getElementById("dots-single-color-group");
    const dotsGradGroup = document.getElementById("dots-gradient-group");

    dotsColorType.addEventListener("change", (e) => {
        const type = e.target.value;
        appState.generator.dots.colorType = type;
        if (type === "gradient") {
            dotsSingleGroup.classList.add("hidden");
            dotsGradGroup.classList.remove("hidden");
        } else {
            dotsSingleGroup.classList.remove("hidden");
            dotsGradGroup.classList.add("hidden");
        }
        triggerQrUpdate();
    });

    // Wi-Fi Password reveal toggle
    const wifiTogglePass = document.getElementById("wifi-toggle-pass");
    const wifiPassInput = document.getElementById("wifi-pass");
    wifiTogglePass.addEventListener("click", () => {
        const type = wifiPassInput.getAttribute("type") === "password" ? "text" : "password";
        wifiPassInput.setAttribute("type", type);

        // Toggle icon
        const icon = wifiTogglePass.querySelector("i, svg");
        if (icon) {
            if (type === "text") {
                icon.setAttribute("data-lucide", "eye-off");
            } else {
                icon.setAttribute("data-lucide", "eye");
            }
        }
        lucide.createIcons();
    });

    // Wi-Fi open network logic (hide password if security is "nopass")
    const wifiType = document.getElementById("wifi-type");
    const wifiPassGroup = document.getElementById("wifi-pass-group");
    wifiType.addEventListener("change", (e) => {
        if (e.target.value === "nopass") {
            wifiPassGroup.classList.add("hidden");
        } else {
            wifiPassGroup.classList.remove("hidden");
        }
        triggerQrUpdate();
    });

    // ==========================================================================
    // 6. CONTENT TYPE SWITCHING (URL, WiFi, Email, etc.)
    // ==========================================================================
    const typeButtons = document.querySelectorAll(".type-btn");
    const inputPanels = document.querySelectorAll(".input-panel");

    typeButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const type = btn.dataset.type;

            typeButtons.forEach(b => b.classList.remove("active"));
            inputPanels.forEach(p => p.classList.remove("active"));

            btn.classList.add("active");
            document.getElementById(`input-${type}`).classList.add("active");
            appState.activeContentType = type;

            triggerQrUpdate();
        });
    });

    // Input listeners to trigger real-time updates
    const inputsToWatch = [
        "text-content",
        "wifi-ssid", "wifi-pass", "wifi-hidden",
        "email-to", "email-subject", "email-body",
        "sms-phone", "sms-message",
        "vcard-fn", "vcard-org", "vcard-tel", "vcard-email", "vcard-url", "vcard-adr"
    ];

    inputsToWatch.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("input", () => triggerQrUpdate());
            if (el.tagName === "SELECT" || el.type === "checkbox") {
                el.addEventListener("change", () => triggerQrUpdate());
            }
        }
    });

    // ==========================================================================
    // 7. QR CODE CONTENT FORMATTING LOGIC
    // ==========================================================================
    function getFormattedQrData() {
        const type = appState.activeContentType;
        let data = "";

        switch (type) {
            case "wifi":
                const ssid = document.getElementById("wifi-ssid").value.trim();
                const wifiSec = document.getElementById("wifi-type").value;
                const wifiPass = document.getElementById("wifi-pass").value;
                const hidden = document.getElementById("wifi-hidden").checked;

                if (!ssid) {
                    data = "WIFI:S:Sample_SSID;T:WPA;P:password;;";
                } else if (wifiSec === "nopass") {
                    data = `WIFI:S:${escapeWifiValue(ssid)};T:nopass;H:${hidden ? "true" : "false"};;`;
                } else {
                    data = `WIFI:S:${escapeWifiValue(ssid)};T:${wifiSec};P:${escapeWifiValue(wifiPass)};H:${hidden ? "true" : "false"};;`;
                }
                break;

            case "email":
                const to = document.getElementById("email-to").value.trim();
                const subject = document.getElementById("email-subject").value.trim();
                const body = document.getElementById("email-body").value;

                if (!to) {
                    data = "mailto:example@domain.com";
                } else {
                    data = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                }
                break;

            case "sms":
                const phone = document.getElementById("sms-phone").value.trim();
                const message = document.getElementById("sms-message").value;

                if (!phone) {
                    data = "SMSTO:+420123456789:Zprava";
                } else {
                    data = `SMSTO:${phone}:${message}`;
                }
                break;

            case "vcard":
                const fn = document.getElementById("vcard-fn").value.trim();
                const org = document.getElementById("vcard-org").value.trim();
                const tel = document.getElementById("vcard-tel").value.trim();
                const email = document.getElementById("vcard-email").value.trim();
                const url = document.getElementById("vcard-url").value.trim();
                const adr = document.getElementById("vcard-adr").value.trim();

                if (!fn && !tel) {
                    data = "BEGIN:VCARD\nVERSION:3.0\nFN:Jan Novak\nEND:VCARD";
                } else {
                    let vcard = "BEGIN:VCARD\nVERSION:3.0\n";
                    if (fn) vcard += `FN:${fn}\nN:${fn};;;;\n`;
                    if (org) vcard += `ORG:${org}\n`;
                    if (tel) vcard += `TEL;TYPE=CELL:${tel}\n`;
                    if (email) vcard += `EMAIL;TYPE=INTERNET:${email}\n`;
                    if (url) vcard += `URL:${url}\n`;
                    if (adr) vcard += `ADR:;;${adr};;;;\n`;
                    vcard += "END:VCARD";
                    data = vcard;
                }
                break;

            case "text":
            default:
                const text = document.getElementById("text-content").value.trim();
                data = text || "https://zdenekp03.github.io/clock/";
                break;
        }

        // Convert string to raw UTF-8 bytes represented in a Latin-1 string
        try {
            return unescape(encodeURIComponent(data));
        } catch (e) {
            console.error("UTF-8 encoding error", e);
            return data;
        }
    }

    function escapeWifiValue(val) {
        // Escapes \, ;, ,, and : backslashes for WiFi syntax
        return val.replace(/\\/g, "\\\\")
            .replace(/;/g, "\\;")
            .replace(/,/g, "\\,")
            .replace(/:/g, "\\:")
            .replace(/"/g, '\\"');
    }

    // ==========================================================================
    // 8. LOGO UPLOADING & CONFIGURATION
    // ==========================================================================
    const logoDropZone = document.getElementById("logo-drop-zone");
    const logoInput = document.getElementById("logo-input");
    const logoPreviewWrapper = document.getElementById("logo-preview-wrapper");
    const logoPreviewImg = document.getElementById("logo-preview-img");
    const removeLogoBtn = document.getElementById("remove-logo-btn");
    const logoClearBg = document.getElementById("logo-clear-bg");

    // Open file selector when clicking upload zone
    logoDropZone.addEventListener("click", () => logoInput.click());

    // Drag-over styling
    logoDropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        logoDropZone.classList.add("dragover");
    });

    logoDropZone.addEventListener("dragleave", () => {
        logoDropZone.classList.remove("dragover");
    });

    logoDropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        logoDropZone.classList.remove("dragover");
        if (e.dataTransfer.files && e.dataTransfer.files.length) {
            handleLogoFile(e.dataTransfer.files[0]);
        }
    });

    logoInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files.length) {
            handleLogoFile(e.target.files[0]);
        }
    });

    function handleLogoFile(file) {
        if (!file.type.startsWith("image/")) {
            showNotification("Vyberte prosím obrázek.", true);
            return;
        }
        if (file.size > 500 * 1024) { // 500 KB limits
            showNotification("Logo je příliš velké. Maximální velikost je 500 KB.", true);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            appState.generator.logo.dataUrl = dataUrl;

            // Show preview
            logoPreviewImg.src = dataUrl;
            logoDropZone.classList.add("hidden");
            logoPreviewWrapper.classList.remove("hidden");

            // Automatically increase error level to H for logo safety
            if (qrErrorLevel.value !== "H" && qrErrorLevel.value !== "Q") {
                qrErrorLevel.value = "H";
                appState.generator.errorLevel = "H";
                showNotification("Chybová korekce automaticky zvýšena na úroveň H.");
            }

            triggerQrUpdate();
        };
        reader.readAsDataURL(file);
    }

    removeLogoBtn.addEventListener("click", () => {
        appState.generator.logo.dataUrl = null;
        logoInput.value = "";
        logoPreviewImg.src = "";
        logoDropZone.classList.remove("hidden");
        logoPreviewWrapper.classList.add("hidden");
        triggerQrUpdate();
    });

    logoClearBg.addEventListener("change", (e) => {
        appState.generator.logo.clearBackground = e.target.checked;
        triggerQrUpdate();
    });

    // Helper: Hex color to RGBA for background options transparency
    function hexToRgba(hex, alphaPercent) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alphaPercent / 100})`;
    }

    // ==========================================================================
    // 9. RENDER ENGINE & DEBOUNCING
    // ==========================================================================
    function triggerQrUpdate() {
        if (updateQrDebounceTimer) {
            clearTimeout(updateQrDebounceTimer);
        }
        updateQrDebounceTimer = setTimeout(renderQrCode, 150);
    }

    function renderQrCode() {
        const genState = appState.generator;

        // 1. Dots options setup
        const dotsOpts = {
            type: genState.dots.type
        };

        if (genState.dots.colorType === "single") {
            dotsOpts.color = genState.dots.color;
            dotsOpts.gradient = null;
        } else {
            dotsOpts.color = undefined;
            dotsOpts.gradient = {
                type: genState.dots.gradient.type,
                rotation: genState.dots.gradient.rotation * Math.PI / 180,
                colorStops: [
                    { offset: 0, color: genState.dots.gradient.start },
                    { offset: 1, color: genState.dots.gradient.end }
                ]
            };
        }

        // 2. Corner Square Options (Vnější rohy)
        const cornerSquareOpts = {
            type: genState.cornersSquare.type
        };

        if (genState.cornersSquare.matchColor) {
            // Inherits from dots
            if (genState.dots.colorType === "single") {
                cornerSquareOpts.color = genState.dots.color;
                cornerSquareOpts.gradient = null;
            } else {
                cornerSquareOpts.color = undefined;
                cornerSquareOpts.gradient = dotsOpts.gradient;
            }
        } else {
            cornerSquareOpts.color = genState.cornersSquare.color;
            cornerSquareOpts.gradient = null;
        }

        // 3. Corner Dot Options (Vnitřní rohy)
        const cornerDotOpts = {
            type: genState.cornersDot.type
        };

        if (genState.cornersDot.matchColor) {
            // Inherits from dots
            if (genState.dots.colorType === "single") {
                cornerDotOpts.color = genState.dots.color;
                cornerDotOpts.gradient = null;
            } else {
                cornerDotOpts.color = undefined;
                cornerDotOpts.gradient = dotsOpts.gradient;
            }
        } else {
            cornerDotOpts.color = genState.cornersDot.color;
            cornerDotOpts.gradient = null;
        }

        // 4. Background options
        const bgOpts = {
            color: hexToRgba(genState.background.color, genState.background.opacity)
        };

        // 5. Build configuration package
        const config = {
            width: genState.size,
            height: genState.size,
            margin: genState.margin,
            data: getFormattedQrData(),
            qrOptions: {
                errorCorrectionLevel: genState.errorLevel
            },
            dotsOptions: dotsOpts,
            backgroundOptions: bgOpts,
            cornersSquareOptions: cornerSquareOpts,
            cornersDotOptions: cornerDotOpts,
            image: genState.logo.dataUrl || "",
            imageOptions: {
                crossOrigin: "anonymous",
                margin: genState.logo.margin,
                imageSize: genState.logo.size,
                hideBackgroundDots: genState.logo.clearBackground
            }
        };

        // Update the QR styling object
        qrCode.update(config);

        // Update live resolution badge
        const sizeBadge = document.getElementById("preview-size-badge");
        if (sizeBadge) {
            sizeBadge.textContent = `${genState.size} × ${genState.size} px`;
        }
    }

    // Initialize first render
    renderQrCode();

    // ==========================================================================
    // 10. HIGH-QUALITY EXPORT ENGINE (Flawless PNG rasterization from Vector SVG)
    // ==========================================================================
    async function svgToCanvas(size) {
        const svgEl = qrContainer.querySelector("svg");
        if (!svgEl) {
            throw new Error("SVG element nebyl nalezen");
        }

        // Clone SVG to avoid altering preview DOM
        const clonedSvg = svgEl.cloneNode(true);
        clonedSvg.setAttribute("width", size.toString());
        clonedSvg.setAttribute("height", size.toString());

        const serializer = new XMLSerializer();
        let svgString = serializer.serializeToString(clonedSvg);

        // Guarantee necessary XML namespaces for standalone parser
        if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
            svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        }
        if (!svgString.includes('xmlns:xlink="http://www.w3.org/1999/xlink"')) {
            svgString = svgString.replace('<svg', '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
        }

        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const URLObj = window.URL || window.webkitURL || window;
        const blobUrl = URLObj.createObjectURL(svgBlob);

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext("2d");
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = "high";
                ctx.drawImage(img, 0, 0, size, size);
                URLObj.revokeObjectURL(blobUrl);
                resolve(canvas);
            };
            img.onerror = (err) => {
                URLObj.revokeObjectURL(blobUrl);
                reject(err);
            };
            img.src = blobUrl;
        });
    }

    // ==========================================================================
    // 11. GENERATOR ACTION BUTTONS (Download, Copy, Print)
    // ==========================================================================
    const btnDownloadPng = document.getElementById("btn-download-png");
    const btnDownloadSvg = document.getElementById("btn-download-svg");
    const btnCopyQr = document.getElementById("btn-copy-qr");
    const btnPrintQr = document.getElementById("btn-print-qr");

    btnDownloadPng.addEventListener("click", async () => {
        try {
            btnDownloadPng.disabled = true;
            const targetSize = appState.generator.size;
            const canvas = await svgToCanvas(targetSize);

            canvas.toBlob((blob) => {
                if (!blob) {
                    showNotification("Chyba při exportu PNG.", true);
                    btnDownloadPng.disabled = false;
                    return;
                }
                const a = document.createElement("a");
                const url = URL.createObjectURL(blob);
                a.href = url;
                a.download = `qr-code-${targetSize}x${targetSize}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                btnDownloadPng.disabled = false;
                showNotification(`PNG (${targetSize}×${targetSize}px) úspěšně staženo!`);
            }, "image/png");
        } catch (err) {
            console.error("Download PNG error:", err);
            btnDownloadPng.disabled = false;
            // Fallback
            qrCode.download({ name: "qr-studio-code", extension: "png" });
        }
    });

    btnDownloadSvg.addEventListener("click", () => {
        const svgEl = qrContainer.querySelector("svg");
        if (svgEl) {
            const serializer = new XMLSerializer();
            let svgString = serializer.serializeToString(svgEl);
            if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
                svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
            }
            const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "qr-studio-code.svg";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showNotification("SVG vektorový soubor byl stažen!");
        } else {
            qrCode.download({ name: "qr-studio-code", extension: "svg" });
        }
    });

    btnCopyQr.addEventListener("click", async () => {
        try {
            const canvas = await svgToCanvas(appState.generator.size);
            canvas.toBlob(blob => {
                if (!blob) {
                    showNotification("Kopírování selhalo. QR kód se nenačetl.", true);
                    return;
                }
                const item = new ClipboardItem({ "image/png": blob });
                navigator.clipboard.write([item])
                    .then(() => {
                        showNotification("Obrázek QR kódu zkopírován do schránky!");
                    })
                    .catch(err => {
                        console.error("Copy failed: ", err);
                        showNotification("Kopírování do schránky není v tomto prohlížeči podporováno. Použijte stažení PNG.", true);
                    });
            }, "image/png");
        } catch (err) {
            console.error("Copy error:", err);
            showNotification("Kopírování selhalo.", true);
        }
    });

    btnPrintQr.addEventListener("click", async () => {
        try {
            const printSize = Math.max(appState.generator.size, 800);
            const canvas = await svgToCanvas(printSize);
            const dataUrl = canvas.toDataURL("image/png");
            const printWindow = window.open("", "_blank");

            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Tisk QR kódu - QR Studio</title>
                    <style>
                        body {
                            display: flex;
                            flex-direction: column;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            margin: 0;
                            font-family: 'Plus Jakarta Sans', sans-serif;
                        }
                        img {
                            max-width: 60%;
                            height: auto;
                            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                            border-radius: 8px;
                        }
                        p {
                            margin-top: 20px;
                            color: #6b7280;
                            font-size: 0.9rem;
                        }
                    </style>
                </head>
                <body onload="window.print(); window.close();">
                    <img src="${dataUrl}" alt="QR Code">
                    <p>Generováno v aplikaci QR Studio</p>
                </body>
                </html>
            `);
            printWindow.document.close();
        } catch (err) {
            console.error("Print error:", err);
            showNotification("Tisk selhal.", true);
        }
    });

    // Notification handler helper
    function showNotification(message, isError = false) {
        const notif = document.getElementById("notification");
        const notifMsg = document.getElementById("notification-message");
        const icon = notif.querySelector("i, svg");

        notifMsg.textContent = message;
        if (isError) {
            notif.style.borderColor = "var(--danger)";
            if (icon) {
                icon.setAttribute("data-lucide", "alert-circle");
                icon.style.color = "var(--danger)";
            }
        } else {
            notif.style.borderColor = "var(--primary)";
            if (icon) {
                icon.setAttribute("data-lucide", "check-circle-2");
                icon.style.color = "var(--accent)";
            }
        }
        lucide.createIcons();

        notif.classList.remove("hidden");

        // Clear previous timeout if any
        if (window.notifTimeout) clearTimeout(window.notifTimeout);

        window.notifTimeout = setTimeout(() => {
            notif.classList.add("hidden");
        }, 3000);
    }

    // ==========================================================================
    // 11. SCANNER SYSTEM - MODES SWITCHING (Camera vs File)
    // ==========================================================================
    const scanModeButtons = document.querySelectorAll(".scan-mode-btn");
    const scanPanels = document.querySelectorAll(".scan-panel");

    scanModeButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const mode = btn.dataset.mode;

            scanModeButtons.forEach(b => b.classList.remove("active"));
            scanPanels.forEach(p => p.classList.remove("active"));

            btn.classList.add("active");
            document.getElementById(`scan-${mode}-panel`).classList.add("active");
            appState.scanner.mode = mode;

            // Manage camera state during sub-tab switches
            if (mode !== "camera") {
                stopCameraScanner();
            }
        });
    });

    // ==========================================================================
    // 12. WEBCAM LIVE SCANNER IMPLEMENTATION (html5-qrcode)
    // ==========================================================================
    const btnToggleCamera = document.getElementById("btn-toggle-camera");
    const cameraSelect = document.getElementById("camera-select");
    const cameraPlaceholder = document.getElementById("camera-placeholder-msg");
    const cameraLaserOverlay = document.getElementById("camera-viewfinder-overlay");

    function initCameraList() {
        Html5Qrcode.getCameras().then(devices => {
            cameraSelect.innerHTML = "";
            if (devices && devices.length > 0) {
                // Populate dropdown
                devices.forEach((device, index) => {
                    const option = document.createElement("option");
                    option.value = device.id;
                    option.text = device.label || `Kamera ${index + 1}`;
                    cameraSelect.appendChild(option);
                });
                appState.scanner.activeCameraId = devices[0].id;
            } else {
                cameraSelect.innerHTML = '<option value="">Nebyla nalezena žádná kamera</option>';
            }
        }).catch(err => {
            console.error("Camera list loading error:", err);
            cameraSelect.innerHTML = '<option value="">Oprávnění odepřeno nebo chyba</option>';
        });
    }

    cameraSelect.addEventListener("change", (e) => {
        appState.scanner.activeCameraId = e.target.value;
        if (appState.scanner.isCameraRunning) {
            // Restart with the new camera
            stopCameraScanner().then(() => {
                startCameraScanner();
            });
        }
    });

    btnToggleCamera.addEventListener("click", () => {
        if (appState.scanner.isCameraRunning) {
            stopCameraScanner();
        } else {
            startCameraScanner();
        }
    });

    function startCameraScanner() {
        if (!appState.scanner.html5QrCode) {
            appState.scanner.html5QrCode = new Html5Qrcode("camera-reader-element");
        }

        const cameraId = appState.scanner.activeCameraId;
        if (!cameraId) {
            showNotification("Vyberte prosím platnou kameru.", true);
            return;
        }

        btnToggleCamera.disabled = true;
        btnToggleCamera.innerHTML = '<i data-lucide="loader" class="spinner"></i> Spouštění...';
        lucide.createIcons();

        const config = {
            fps: 10,
            qrbox: (videoWidth, videoHeight) => {
                // Dynamic sizing for viewfinder box
                const side = Math.min(videoWidth, videoHeight) * 0.65;
                return { width: side, height: side };
            }
        };

        appState.scanner.html5QrCode.start(
            cameraId,
            config,
            (decodedText) => {
                // Scan success
                handleDecodedData(decodedText);
                // Highlight successful read by pausing camera
                stopCameraScanner();
                showNotification("Kód byl úspěšně přečten!");
            },
            (errorMessage) => {
                // Verbose log is off, we skip frame decoding failures
            }
        ).then(() => {
            appState.scanner.isCameraRunning = true;
            btnToggleCamera.disabled = false;
            btnToggleCamera.innerHTML = '<i data-lucide="square"></i> Zastavit kameru';
            btnToggleCamera.classList.remove("btn-primary");
            btnToggleCamera.classList.add("btn-danger");
            cameraPlaceholder.classList.add("hidden");
            cameraLaserOverlay.classList.add("active");
            lucide.createIcons();
        }).catch(err => {
            console.error("Camera startup failed:", err);
            btnToggleCamera.disabled = false;
            btnToggleCamera.innerHTML = '<i data-lucide="play"></i> Zapnout kameru';
            lucide.createIcons();
            showNotification("Přístup ke kameře byl odepřen nebo je kamera obsazena jinou aplikací.", true);
        });
    }

    function stopCameraScanner() {
        return new Promise((resolve) => {
            if (appState.scanner.html5QrCode && appState.scanner.isCameraRunning) {
                btnToggleCamera.disabled = true;
                appState.scanner.html5QrCode.stop().then(() => {
                    appState.scanner.isCameraRunning = false;
                    btnToggleCamera.disabled = false;
                    btnToggleCamera.innerHTML = '<i data-lucide="play"></i> Zapnout kameru';
                    btnToggleCamera.classList.remove("btn-danger");
                    btnToggleCamera.classList.add("btn-primary");
                    cameraPlaceholder.classList.remove("hidden");
                    cameraLaserOverlay.classList.remove("active");
                    lucide.createIcons();
                    resolve();
                }).catch(err => {
                    console.error("Error stopping camera:", err);
                    btnToggleCamera.disabled = false;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    // ==========================================================================
    // 13. FILE SCANNER IMPLEMENTATION (html5-qrcode file reader)
    // ==========================================================================
    const scanFileDropZone = document.getElementById("scan-file-drop-zone");
    const scannerFileInput = document.getElementById("scanner-file-input");
    const scannerFilePreview = document.getElementById("scanner-file-preview");
    const scannedImagePreview = document.getElementById("scanned-image-preview");
    const removeScanFileBtn = document.getElementById("remove-scan-file-btn");

    scanFileDropZone.addEventListener("click", () => scannerFileInput.click());

    scanFileDropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        scanFileDropZone.classList.add("dragover");
    });

    scanFileDropZone.addEventListener("dragleave", () => {
        scanFileDropZone.classList.remove("dragover");
    });

    scanFileDropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        scanFileDropZone.classList.remove("dragover");
        if (e.dataTransfer.files && e.dataTransfer.files.length) {
            handleScannerFile(e.dataTransfer.files[0]);
        }
    });

    scannerFileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files.length) {
            handleScannerFile(e.target.files[0]);
        }
    });

    function handleScannerFile(file) {
        if (!file.type.startsWith("image/")) {
            showNotification("Zvolený soubor není platný obrázek.", true);
            return;
        }

        // Preview file locally
        const reader = new FileReader();
        reader.onload = (e) => {
            scannedImagePreview.src = e.target.result;
            scanFileDropZone.classList.add("hidden");
            scannerFilePreview.classList.remove("hidden");
        };
        reader.readAsDataURL(file);

        // Run detection logic
        const fileDecoder = new Html5Qrcode("camera-reader-element");

        fileDecoder.scanFile(file, false)
            .then(decodedText => {
                handleDecodedData(decodedText);
                showNotification("Kód naskenován z obrázku!");
            })
            .catch(err => {
                console.warn(err);
                // Clear result and show warning
                resetResultsDisplay();
                showNotification("V tomto obrázku se nepodařilo najít čitelný QR kód.", true);
            });
    }

    removeScanFileBtn.addEventListener("click", () => {
        scannerFileInput.value = "";
        scannedImagePreview.src = "";
        scanFileDropZone.classList.remove("hidden");
        scannerFilePreview.classList.add("hidden");
        resetResultsDisplay();
    });

    // ==========================================================================
    // 14. SCAN RESULTS INTERPRETER / PARSER
    // ==========================================================================
    const resultPlaceholder = document.getElementById("result-placeholder");
    const resultContentBox = document.getElementById("result-content-box");
    const resultBadge = document.getElementById("result-badge");
    const resultBadgeText = document.getElementById("result-badge-text");
    const decodedTextVal = document.getElementById("decoded-text-val");
    const resultTime = document.getElementById("result-time");

    // Actions
    const btnCopyResult = document.getElementById("btn-copy-result");
    const btnActionOpenUrl = document.getElementById("btn-action-open-url");
    const btnActionWifi = document.getElementById("btn-action-wifi");
    const btnActionEmail = document.getElementById("btn-action-email");
    const btnActionTel = document.getElementById("btn-action-tel");

    // Wi-Fi detail block
    const resultWifiDetails = document.getElementById("result-wifi-details");
    const wifiDetSsid = document.getElementById("wifi-det-ssid");
    const wifiDetPass = document.getElementById("wifi-det-pass");
    const wifiDetType = document.getElementById("wifi-det-type");

    function resetResultsDisplay() {
        resultPlaceholder.classList.remove("hidden");
        resultContentBox.classList.add("hidden");

        // Hide all actions
        btnActionOpenUrl.classList.add("hidden");
        btnActionWifi.classList.add("hidden");
        btnActionEmail.classList.add("hidden");
        btnActionTel.classList.add("hidden");
        resultWifiDetails.classList.add("hidden");
    }

    function handleDecodedData(text) {
        // Vibrate mobile device if available
        if (navigator.vibrate) {
            navigator.vibrate(100);
        }

        // Show contents panel
        resultPlaceholder.classList.add("hidden");
        resultContentBox.classList.remove("hidden");
        decodedTextVal.value = text;

        // Set timestamp
        const now = new Date();
        resultTime.textContent = `dnes v ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        // Reset actions
        btnActionOpenUrl.classList.add("hidden");
        btnActionWifi.classList.add("hidden");
        btnActionEmail.classList.add("hidden");
        btnActionTel.classList.add("hidden");
        resultWifiDetails.classList.add("hidden");

        // Parse content format
        const badgeIcon = resultBadge.querySelector("i, svg");

        if (text.startsWith("http://") || text.startsWith("https://") || text.startsWith("www.")) {
            // URL Link
            let url = text;
            if (text.startsWith("www.")) {
                url = "https://" + text;
            }
            resultBadgeText.textContent = "Webový odkaz";
            resultBadge.style.background = "rgba(99, 102, 241, 0.15)";
            resultBadge.style.color = "#818cf8";

            if (badgeIcon) badgeIcon.setAttribute("data-lucide", "link");

            btnActionOpenUrl.href = url;
            btnActionOpenUrl.classList.remove("hidden");
        }
        else if (text.startsWith("WIFI:")) {
            // Wi-Fi configurations
            resultBadgeText.textContent = "Wi-Fi Síť";
            resultBadge.style.background = "rgba(16, 185, 129, 0.15)";
            resultBadge.style.color = "#34d399";

            if (badgeIcon) badgeIcon.setAttribute("data-lucide", "wifi");

            // Parse parameters
            const ssid = text.match(/S:([^;]+);/)?.[1] || "-";
            const pass = text.match(/P:([^;]+);/)?.[1] || "Bez hesla";
            const secType = text.match(/T:([^;]+);/)?.[1] || "Otevřená";

            wifiDetSsid.textContent = unescapeWifiValue(ssid);
            wifiDetPass.textContent = unescapeWifiValue(pass);
            wifiDetType.textContent = secType;

            resultWifiDetails.classList.remove("hidden");
        }
        else if (text.startsWith("mailto:")) {
            // E-mail link
            resultBadgeText.textContent = "E-mail";
            resultBadge.style.background = "rgba(245, 158, 11, 0.15)";
            resultBadge.style.color = "#fbbf24";

            if (badgeIcon) badgeIcon.setAttribute("data-lucide", "mail");

            btnActionEmail.href = text;
            btnActionEmail.classList.remove("hidden");
        }
        else if (text.startsWith("tel:") || text.startsWith("SMSTO:")) {
            // Phone call or SMS config
            resultBadgeText.textContent = text.startsWith("tel:") ? "Telefonní číslo" : "SMS Zpráva";
            resultBadge.style.background = "rgba(168, 85, 247, 0.15)";
            resultBadge.style.color = "#c084fc";

            if (badgeIcon) badgeIcon.setAttribute("data-lucide", text.startsWith("tel:") ? "phone" : "message-square");

            let phoneNum = "";
            if (text.startsWith("tel:")) {
                phoneNum = text.replace("tel:", "");
            } else {
                phoneNum = text.split(":")[1] || "";
            }

            btnActionTel.href = `tel:${phoneNum}`;
            btnActionTel.classList.remove("hidden");
        }
        else {
            // Normal Plain Text
            resultBadgeText.textContent = "Textový obsah";
            resultBadge.style.background = "rgba(107, 114, 128, 0.15)";
            resultBadge.style.color = "#9ca3af";

            if (badgeIcon) badgeIcon.setAttribute("data-lucide", "file-text");
        }

        lucide.createIcons();
    }

    function unescapeWifiValue(val) {
        if (!val) return "";
        return val.replace(/\\;/g, ";")
            .replace(/\\,/g, ",")
            .replace(/\\:/g, ":")
            .replace(/\\\\/g, "\\")
            .replace(/\\"/g, '"');
    }

    // Copy result text to clipboard
    btnCopyResult.addEventListener("click", () => {
        const text = decodedTextVal.value;
        navigator.clipboard.writeText(text)
            .then(() => {
                showNotification("Text naskenovaného výsledku zkopírován do schránky!");
            })
            .catch(err => {
                console.error(err);
                showNotification("Zkopírování selhalo.", true);
            });
    });
});
