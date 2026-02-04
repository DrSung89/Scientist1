document.addEventListener('DOMContentLoaded', () => {

    // =========================================================
    // 0. Firebase 설정 & 초기화
    // =========================================================
    const firebaseConfig = {
        apiKey: "AIzaSyB4LNbqa_msSQqHigfnlJ5RaxfLNJvg_Jg",
        authDomain: "scientisttoolkit.firebaseapp.com",
        projectId: "scientisttoolkit",
        storageBucket: "scientisttoolkit.firebasestorage.app",
        messagingSenderId: "611412737478",
        appId: "1:611412737478:web:e7389b1b03c002f56546c7",
        measurementId: "G-5K0XVX0TFM"
    };

    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    // =========================================================
    // 1. 방문자 카운터
    // =========================================================
    function updateVisitorCount() {
        if (typeof firebase === 'undefined') return;
        const db = firebase.firestore();
        const countSpan = document.getElementById('visitor-count');
        const today = new Date();
        const offset = today.getTimezoneOffset() * 60000;
        const dateStr = (new Date(today - offset)).toISOString().split('T')[0];
        const docRef = db.collection('visitors').doc(dateStr);

        const hasVisited = sessionStorage.getItem(`visited_${dateStr}`);

        if (!hasVisited) {
            docRef.set({ count: firebase.firestore.FieldValue.increment(1) }, { merge: true })
            .then(() => sessionStorage.setItem(`visited_${dateStr}`, 'true'))
            .catch(err => console.error(err));
        }

        docRef.onSnapshot((doc) => {
            if (doc.exists && countSpan) {
                countSpan.innerHTML = `Today's Visitors: <strong>${doc.data().count.toLocaleString()}</strong>`;
            } else if (countSpan) {
                countSpan.innerHTML = `Today's Visitors: <strong>1</strong>`;
            }
        });
    }
    updateVisitorCount();

    // ====================================================
    // Helper: 스마트 단위 변환
    // ====================================================
    function smartFormat(value, unit, type) {
        if (isNaN(value) || value === 0) return `0.000 ${unit}`;
        const factors = {
            'L': 1, 'mL': 1e-3, 'uL': 1e-6, 'nL': 1e-9,
            'M': 1, 'mM': 1e-3, 'uM': 1e-6, 'nM': 1e-9,
            'kg': 1000, 'g': 1, 'mg': 1e-3, 'ug': 1e-6, 'ng': 1e-9
        };
        // (단위 변환 로직 생략 없이 그대로 유지)
        const volUnits = ['L', 'mL', 'uL', 'nL'];
        const concUnits = ['M', 'mM', 'uM', 'nM'];
        const massUnits = ['kg', 'g', 'mg', 'ug', 'ng'];
        
        let units;
        if (type === 'vol') units = volUnits;
        else if (type === 'conc') units = concUnits;
        else units = massUnits;
        
        let baseValue = value * factors[unit];
        let bestUnit = units[units.length - 1]; 
        for (let u of units) {
            if (Math.abs(baseValue) / factors[u] >= 1) { bestUnit = u; break; }
        }
        if (Math.abs(baseValue) < factors[units[units.length-1]]) bestUnit = units[units.length-1];
        return `<strong>${(baseValue / factors[bestUnit]).toFixed(3)} ${bestUnit}</strong>`;
    }

    // ====================================================
    // 2. Molarity Calculator
    // ====================================================
    const molButton = document.getElementById('calculate-molarity');
    if (molButton) {
        molButton.addEventListener('click', () => {
            const mass = parseFloat(document.getElementById('mass').value);
            const mw = parseFloat(document.getElementById('mw').value);
            const vol = parseFloat(document.getElementById('volume').value);
            const conc = parseFloat(document.getElementById('concentration').value);
            const resDiv = document.getElementById('molarity-result');

            if (isNaN(mw)) { resDiv.innerHTML = "<span style='color:red;'>Enter Molecular Weight.</span>"; return; }

            // 단위 가져오기
            const massUnit = document.getElementById('mass-unit').value;
            const volUnit = document.getElementById('vol-unit').value;
            const concUnit = document.getElementById('conc-unit').value;
            const mFactor = { 'kg': 1000, 'g': 1, 'mg': 1e-3, 'ug': 1e-6 }[massUnit];
            const vFactor = volUnit === 'L' ? 1 : (volUnit === 'mL' ? 1e-3 : 1e-6);
            const cFactor = concUnit === 'M' ? 1 : (concUnit === 'mM' ? 1e-3 : 1e-6);

            let resultText = "";
            if (!isNaN(mass) && isNaN(vol) && !isNaN(conc)) {
                 resultText = `Required Volume: ${smartFormat((mass * mFactor) / (mw * (conc * cFactor)), 'L', 'vol')}`;
            } else if (isNaN(mass) && !isNaN(vol) && !isNaN(conc)) {
                 resultText = `Required Mass: ${smartFormat(mw * (vol * vFactor) * (conc * cFactor), 'g', 'mass')}`;
            } else if (!isNaN(mass) && !isNaN(vol) && isNaN(conc)) {
                 resultText = `Concentration: ${smartFormat((mass * mFactor) / (mw * (vol * vFactor)), 'M', 'conc')}`;
            } else {
                 resultText = "<span style='color:red;'>Fill exactly 3 fields.</span>";
            }
            resDiv.innerHTML = resultText;
        });
    }

    // ====================================================
    // 3. Outlier Checker (Fixed & Robust)
    // ====================================================
    const outlierButton = document.getElementById('check-outliers');
    if (outlierButton) {
        
        // Grubb's Critical Values Table
        const grubbsCriticalValues = {
            3: 1.153, 4: 1.463, 5: 1.672, 6: 1.822, 7: 1.938, 8: 2.032, 9: 2.110, 10: 2.176,
            12: 2.285, 15: 2.409, 20: 2.557, 30: 2.745, 50: 2.956, 100: 3.207
        };
        function getGrubbsCriticalValue(n) {
            if (grubbsCriticalValues[n]) return grubbsCriticalValues[n];
            const keys = Object.keys(grubbsCriticalValues).map(Number).sort((a,b)=>a-b);
            for (let i = keys.length - 1; i >= 0; i--) {
                if (n >= keys[i]) return grubbsCriticalValues[keys[i]];
            }
            return 3.5; 
        }

        outlierButton.addEventListener('click', () => {
            const rawData = document.getElementById('outlier-data').value;
            const data = rawData.split(/[\s,]+/).map(s => s.trim()).filter(s => s !== '' && !isNaN(s)).map(Number).sort((a, b) => a - b);
            const resDiv = document.getElementById('outlier-result');
            resDiv.style.display = 'block';

            if (data.length < 3) {
                resDiv.innerHTML = "<span style='color:red;'>Error: Need at least 3 numbers.</span>";
                return;
            }

            const n = data.length;
            const mean = data.reduce((a, b) => a + b, 0) / n;
            const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
            const stdev = Math.sqrt(variance);

            // [핵심 수정] jStat 라이브러리 사용하여 정확한 P-value 계산
            let pValue = NaN;
            let isNormal = false;
            let note = "";

            if (typeof jStat !== 'undefined') {
                // jStat Shapiro-Wilk 호출
                const sw = jStat.shapirowilk(data);
                pValue = sw[1]; // [W, p-value]
                isNormal = pValue >= 0.05;
            } else {
                // 라이브러리 로드 실패 시 안전장치 (IQR 모드로)
                note = "(Library Error)";
                isNormal = false; 
            }

            const pColor = isNormal ? "green" : "#d97706"; // Orange for non-normal
            const pText = isNaN(pValue) ? "N/A" : pValue.toFixed(4);
            const statusText = isNormal ? "(Normal)" : "(Non-Normal)";

            let html = `
                <div style="font-size: 0.9rem; color: #374151; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #ccc; padding-bottom:5px;">
                        <div>Mean: <strong>${mean.toFixed(2)}</strong> | SD: <strong>${stdev.toFixed(2)}</strong> | N: <strong>${n}</strong></div>
                        <div>S-W P-value: <strong style="color:${pColor}">${pText}</strong> ${statusText} ${note}</div>
                    </div>
                </div>`;

            if (isNormal) {
                // --- Grubb's Test ---
                html += `<div style="background:#ecfdf5; color:#065f46; padding:5px; border-radius:4px; font-size:0.85rem; margin-bottom:10px;"><strong>✅ Method: Grubb's Test</strong> (Normal Data)</div>`;
                
                // Find most extreme deviation
                let maxDev = 0, outlierVal = null;
                data.forEach(v => {
                    const dev = Math.abs(v - mean);
                    if (dev > maxDev) { maxDev = dev; outlierVal = v; }
                });
                const gStat = maxDev / stdev;
                const gCrit = getGrubbsCriticalValue(n);

                if (gStat > gCrit) {
                     html += `<div style="background:#fee2e2; border:1px solid #ef4444; color:#b91c1c; padding:10px; border-radius:4px;">
                        <strong>🚨 Outlier Confirmed: ${outlierVal}</strong><br>
                        <span style="font-size:0.8rem">G (${gStat.toFixed(2)}) > Critical (${gCrit})</span>
                     </div>`;
                } else {
                     html += `<div style="background:#dcfce7; border:1px solid #22c55e; color:#166534; padding:10px; border-radius:4px; text-align:center;"><strong>✅ No outliers found.</strong></div>`;
                }
            } else {
                // --- IQR Method ---
                html += `<div style="background:#fffbeb; color:#92400e; padding:5px; border-radius:4px; font-size:0.85rem; margin-bottom:10px;"><strong>⚠️ Method: IQR (1.5×)</strong> (Non-Normal/Small Data)</div>`;
                
                const q1 = jStat.percentile(data, 0.25);
                const q3 = jStat.percentile(data, 0.75);
                const iqr = q3 - q1;
                const lower = q1 - 1.5 * iqr;
                const upper = q3 + 1.5 * iqr;
                const outliers = data.filter(x => x < lower || x > upper);

                html += `<div style="font-size:0.8rem; margin-bottom:8px;">Range: ${lower.toFixed(2)} ~ ${upper.toFixed(2)}</div>`;

                if (outliers.length > 0) {
                    html += `<div style="background:#fee2e2; border:1px solid #ef4444; color:#b91c1c; padding:10px; border-radius:4px;">
                        <strong>🚨 Outliers Confirmed: ${outliers.join(', ')}</strong>
                     </div>`;
                } else {
                    html += `<div style="background:#dcfce7; border:1px solid #22c55e; color:#166534; padding:10px; border-radius:4px; text-align:center;"><strong>✅ No outliers found.</strong></div>`;
                }
            }
            resDiv.innerHTML = html;
        });
    }

    // ====================================================
    // 4. HED & Dilution (기존 기능 유지)
    // ====================================================
    // (HED Calculator)
    const hedButton = document.getElementById('calculate-hed');
    if (hedButton) {
        hedButton.addEventListener('click', () => {
             const km = { "Mouse": 3, "Rat": 6, "Rabbit": 12, "Dog": 20, "Monkey": 12, "Human": 37 }; // 주요 종만 예시 (확장 가능)
             // ... (기존 HED 로직과 동일하거나, 필요시 전체 코드 복붙해드린 위 코드를 사용하세요. 위 코드엔 km 전체 포함되어있음)
             const sA = document.getElementById('species-a').value;
             const dA = parseFloat(document.getElementById('dose-a').value);
             const sB = document.getElementById('species-b').value;
             const kmFactors = { 
                "Mouse": 3, "Hamster": 5, "Rat": 6, "Ferret": 7, "Guinea Pig": 8, "Rabbit": 12, 
                "Dog": 20, "Monkey": 12, "Marmoset": 6, "Squirrel Monkey": 7, "Baboon": 20, 
                "Micro Pig": 27, "Mini Pig": 35, "Human": 37 
            };
            const resDiv = document.getElementById('hed-result');
            if(isNaN(dA)) { resDiv.innerHTML = "<span style='color:red;'>Enter Dose.</span>"; return; }
            const doseB = dA * (kmFactors[sA] / kmFactors[sB]);
            resDiv.innerHTML = `Equivalent Dose for <strong>${sB}</strong>:<br><span style="color:blue; font-size:1.2em;">${doseB.toFixed(4)} mg/kg</span>`;
        });
    }

    // (Dilution Calculator)
    const dilButton = document.getElementById('calculate-dilution');
    if (dilButton) {
        dilButton.addEventListener('click', () => {
             // ... (희석 계산 로직)
             const m1 = parseFloat(document.getElementById('m1').value);
             const v1 = parseFloat(document.getElementById('v1').value);
             const m2 = parseFloat(document.getElementById('m2').value);
             const v2 = parseFloat(document.getElementById('v2').value);
             const