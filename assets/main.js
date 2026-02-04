document.addEventListener('DOMContentLoaded', () => {

    // =========================================================
    // 0. Firebase 설정 & 초기화 (방문자 카운트용)
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

    // Firebase가 아직 초기화되지 않았을 때만 초기화
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    // =========================================================
    // 1. 일일 방문자 수 카운터 로직
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
            docRef.set({
                count: firebase.firestore.FieldValue.increment(1)
            }, { merge: true })
            .then(() => {
                sessionStorage.setItem(`visited_${dateStr}`, 'true');
            })
            .catch(err => console.error("Error updating count:", err));
        }

        docRef.onSnapshot((doc) => {
            if (doc.exists && countSpan) {
                const count = doc.data().count;
                countSpan.innerHTML = `Today's Visitors: <strong>${count.toLocaleString()}</strong>`;
            } else if (countSpan) {
                countSpan.innerHTML = `Today's Visitors: <strong>1</strong>`;
            }
        });
    }

    updateVisitorCount();

    // ====================================================
    // Helper: 스마트 단위 변환기
    // ====================================================
    function smartFormat(value, unit, type) {
        if (isNaN(value) || value === 0) return `0.000 ${unit}`;

        const volUnits = ['L', 'mL', 'uL', 'nL'];
        const concUnits = ['M', 'mM', 'uM', 'nM'];
        const massUnits = ['kg', 'g', 'mg', 'ug', 'ng'];

        const factors = {
            'L': 1, 'mL': 1e-3, 'uL': 1e-6, 'nL': 1e-9,
            'M': 1, 'mM': 1e-3, 'uM': 1e-6, 'nM': 1e-9,
            'kg': 1000, 'g': 1, 'mg': 1e-3, 'ug': 1e-6, 'ng': 1e-9
        };

        let units;
        if (type === 'vol') units = volUnits;
        else if (type === 'conc') units = concUnits;
        else units = massUnits;
        
        let baseValue = value * factors[unit];
        let bestUnit = units[units.length - 1]; 
        
        for (let u of units) {
            if (Math.abs(baseValue) / factors[u] >= 1) { 
                bestUnit = u;
                break;
            }
        }
        
        if (Math.abs(baseValue) < factors[units[units.length-1]]) {
             bestUnit = units[units.length-1];
        }

        let scaledValue = baseValue / factors[bestUnit];
        return `<strong>${scaledValue.toFixed(3)} ${bestUnit}</strong>`;
    }

    // ====================================================
    // 2. Molarity Calculator Logic
    // ====================================================
    const molButton = document.getElementById('calculate-molarity');
    if (molButton) {
        molButton.addEventListener('click', () => {
            const mass = parseFloat(document.getElementById('mass').value);
            const mw = parseFloat(document.getElementById('mw').value);
            const vol = parseFloat(document.getElementById('volume').value);
            const conc = parseFloat(document.getElementById('concentration').value);

            const massUnit = document.getElementById('mass-unit').value;
            const volUnit = document.getElementById('vol-unit').value;
            const concUnit = document.getElementById('conc-unit').value;

            const mFactor = { 'kg': 1000, 'g': 1, 'mg': 1e-3, 'ug': 1e-6 }[massUnit];
            const vFactor = volUnit === 'L' ? 1 : (volUnit === 'mL' ? 1e-3 : 1e-6);
            const cFactor = concUnit === 'M' ? 1 : (concUnit === 'mM' ? 1e-3 : 1e-6);

            const resDiv = document.getElementById('molarity-result');
            let resultText = "";

            if (isNaN(mw)) {
                resDiv.innerHTML = "<span style='color:red;'>Please enter Molecular Weight.</span>";
                return;
            }

            if (isNaN(mass) && !isNaN(vol) && !isNaN(conc)) {
                const calcMassGram = mw * (vol * vFactor) * (conc * cFactor);
                resultText = `Required Mass: ${smartFormat(calcMassGram, 'g', 'mass')}`;
            } else if (!isNaN(mass) && !isNaN(vol) && isNaN(conc)) {
                const calcConcMolar = (mass * mFactor) / (mw * (vol * vFactor));
                resultText = `Concentration: ${smartFormat(calcConcMolar, 'M', 'conc')}`;
            } else if (!isNaN(mass) && isNaN(vol) && !isNaN(conc)) {
                const calcVolLiter = (mass * mFactor) / (mw * (conc * cFactor));
                resultText = `Required Volume: ${smartFormat(calcVolLiter, 'L', 'vol')}`;
            } else {
                resultText = "<span style='color:red;'>Please fill in exactly 3 fields (MW is required).</span>";
            }
            resDiv.innerHTML = resultText;
        });
    }

    // ====================================================
    // 3. Outlier Checker Logic (Updated for Robustness)
    // ====================================================
    
    // Grubb's Test Critical Values (Alpha = 0.05)
    const grubbsCriticalValues = {
        3: 1.153, 4: 1.463, 5: 1.672, 6: 1.822, 7: 1.938, 8: 2.032, 9: 2.110, 10: 2.176,
        11: 2.234, 12: 2.285, 13: 2.331, 14: 2.371, 15: 2.409, 16: 2.443, 17: 2.475, 18: 2.504,
        19: 2.532, 20: 2.557, 21: 2.580, 22: 2.603, 23: 2.624, 24: 2.644, 25: 2.663, 26: 2.681,
        27: 2.698, 28: 2.714, 29: 2.730, 30: 2.745, 35: 2.811, 40: 2.866, 50: 2.956, 60: 3.025,
        70: 3.082, 80: 3.130, 90: 3.171, 100: 3.207
    };

    function getGrubbsCriticalValue(n) {
        if (grubbsCriticalValues[n]) return grubbsCriticalValues[n];
        const keys = Object.keys(grubbsCriticalValues).map(Number).sort((a,b)=>a-b);
        for (let i = keys.length - 1; i >= 0; i--) {
            if (n >= keys[i]) return grubbsCriticalValues[keys[i]];
        }
        return 3.5; 
    }

    function normalCDF(x) {
        var t = 1 / (1 + 0.2316419 * Math.abs(x));
        var d = 0.3989423 * Math.exp(-x * x / 2);
        var prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
        if (x > 0) prob = 1 - prob;
        return prob;
    }

    function calculateShapiroWilk(data) {
        const n = data.length;
        // NaN 방지: 데이터가 3개 미만이면 계산 불가
        if (n < 3) return { w: 0, p: 0, valid: false };

        const mean = data.reduce((a, b) => a + b, 0) / n;
        const ss = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
        
        // 분산이 0인 경우 (모든 숫자가 같음) 예외 처리
        if (ss === 0) return { w: 1, p: 1, valid: true };

        const m = new Array(n);
        for (let i = 0; i < n; i++) {
            const index = i + 1;
            m[i] = 4.91 * (Math.pow((index - 0.375) / (n + 0.25), 0.14) - Math.pow((n - index + 0.625) / (n + 0.25), 0.14));
        }

        let c = new Array(n);
        let mSumSq = 0;
        for(let val of m) mSumSq += val*val;
        const mNorm = Math.sqrt(mSumSq);
        for(let i=0; i<n; i++) c[i] = m[i] / mNorm;

        let a = new Array(n).fill(0);
        if (n === 3) {
            a[0] = 0.7071; a[2] = -0.7071; 
        } else {
            const an = c[n-1] + 0.221157*Math.pow(n, -1) - 0.147981*Math.pow(n, -2) - 2.07119*Math.pow(n, -3) + 4.434685*Math.pow(n, -4) - 2.706056*Math.pow(n, -5);
            const an_1 = c[n-2] + 0.042981*Math.pow(n, -1) - 0.293762*Math.pow(n, -2) - 1.752461*Math.pow(n, -3) + 5.682633*Math.pow(n, -4) - 3.582633*Math.pow(n, -5);
            a[n-1] = an; a[n-2] = an_1; a[0] = -an; a[1] = -an_1;

            let epsilon = (mNorm*mNorm - 2*an*an - 2*an_1*an_1) / (1 - 2*a[n-1]*a[n-1] - 2*a[n-2]*a[n-2]); 
            if (epsilon < 0) epsilon = 0;
            epsilon = Math.sqrt(epsilon);

            for (let i = 2; i < n - 2; i++) { a[i] = c[i]; }
        }

        let b = 0;
        for (let i = 0; i < n; i++) { b += a[i] * data[i]; }

        const w = (b * b) / ss;
        const mu = 0.0038915 * Math.pow(Math.log(n), 3) - 0.083751 * Math.pow(Math.log(n), 2) - 0.31082 * Math.log(n) - 1.5861;
        const sigma = Math.exp(0.0030302 * Math.pow(Math.log(n), 2) - 0.082676 * Math.log(n) - 0.4803);
        const z = (Math.log(1 - w) - mu) / sigma;
        let p = 1 - normalCDF(z);

        if (p > 1) p = 1; if (p < 0) p = 0;
        return { w: w, p: p, valid: true };
    }

    const outlierButton = document.getElementById('check-outliers');
    if (outlierButton) {
        outlierButton.addEventListener('click', () => {
            const rawData = document.getElementById('outlier-data').value;
            const data = rawData.split(/[\s,]+/)
                .map(s => s.trim())
                .filter(s => s !== '' && !isNaN(s))
                .map(Number)
                .sort((a, b) => a - b);

            const resDiv = document.getElementById('outlier-result');
            resDiv.style.whiteSpace = 'normal';
            resDiv.style.padding = '10px'; 
            
            if (data.length < 3) {
                resDiv.innerHTML = "<span style='color:red; font-size: 0.9rem;'>Error: Need at least 3 numbers.</span>";
                resDiv.style.display = 'block';
                return;
            }

            const n = data.length;
            const mean = data.reduce((a, b) => a + b, 0) / n;
            const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
            const stdev = Math.sqrt(variance);

            // 1. Normality Check & NaN Handling
            let pValue = NaN;
            let isNormal = false;
            let pValueText = "";
            let pValueColor = "";

            if (n < 6) {
                // 표본 6개 미만이면 P-value 계산 생략 (NaN 방지)
                pValueText = "N < 6 (Too small)";
                pValueColor = "#d97706";
                isNormal = false; // 강제 IQR 모드
            } else {
                const swResult = calculateShapiroWilk(data);
                pValue = swResult.p;
                isNormal = pValue >= 0.05;
                pValueText = pValue.toFixed(4);
                pValueColor = isNormal ? "green" : "#d97706";
            }

            const normalityStatus = isNormal ? "(Normal)" : "(Non-Normal)";

            let resultHTML = `<div style="font-size: 0.9rem; line-height: 1.4; color: #374151;">
                    <div style="display: flex; justify-content: space-between; gap: 10px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px dashed #e5e7eb;">
                        <div style="flex: 1;">
                            <div style="font-weight: 700; color:#111; margin-bottom: 2px; font-size: 0.85rem;">Desc. Stats</div>
                            <div style="font-size: 0.8rem; color: #4b5563;">
                                Mean: <strong>${mean.toFixed(2)}</strong> | N: <strong>${n}</strong><br>
                                SD: <strong>${stdev.toFixed(2)}</strong>
                            </div>
                        </div>
                        <div style="flex: 1.2; text-align: right;">
                            <div style="font-weight: 700; color:#111; margin-bottom: 2px; font-size: 0.85rem;">Normality (S-W)</div>
                            <div style="font-size: 0.8rem; color: #4b5563;">
                                P-value: <strong style="color:${pValueColor};">${pValueText}</strong> <span style="font-size:0.75rem; color:#666;">${normalityStatus}</span>
                            </div>
                        </div>
                    </div>`;

            // 2. Logic Branching: Grubb's vs IQR
            if (isNormal) {
                // Grubb's Test
                resultHTML += `<div style="margin-bottom: 5px; font-size: 0.85rem; color:#065f46; background:#ecfdf5; padding:4px 8px; border-radius:4px;">
                    <strong>✅ Method: Grubb's Test</strong> (Normal Data)
                </div>`;

                let maxDev = 0;
                let outlierVal = null;
                data.forEach(val => {
                    const dev = Math.abs(val - mean);
                    if (dev > maxDev) {
                        maxDev = dev;
                        outlierVal = val;
                    }
                });
                const gStat = maxDev / stdev;
                const gCrit = getGrubbsCriticalValue(n);

                if (gStat > gCrit) {
                    resultHTML += `<div style="padding: 10px; background-color: #fee2e2; border-radius: 4px; border: 1px solid #ef4444; margin-top: 10px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px;">
                            <strong style="color:#b91c1c; font-size: 0.95rem;">🚨 Outlier Confirmed:</strong>
                            <strong style="font-size: 1rem; color: #b91c1c;">${outlierVal}</strong>
                        </div>
                        <div style="font-size: 0.8rem; color: #b91c1c;">
                             Grubb's G (${gStat.toFixed(2)}) > Critical (${gCrit}).<br>
                             This is a significant outlier.
                        </div></div></div>`;
                } else {
                    resultHTML += `<div style="padding: 8px; background-color: #dcfce7; border-radius: 4px; border: 1px solid #22c55e; color: #166534; font-weight: bold; font-size: 0.9rem; text-align: center; margin-top: 10px;">✅ No outliers found (Grubb's Test).</div></div>`;
                }

            } else {
                // IQR Method
                const q1 = data[Math.floor((n - 1) / 4)];
                const q3 = data[Math.floor((n - 1) * 3 / 4)];
                const iqr = q3 - q1;
                const lowerFence = q1 - 1.5 * iqr;
                const upperFence = q3 + 1.5 * iqr;
                const outliers = data.filter(x => x < lowerFence || x > upperFence);

                resultHTML += `<div style="margin-bottom: 5px; font-size: 0.85rem; color:#92400e; background:#fffbeb; padding:4px 8px; border-radius:4px;">
                    <strong>⚠️ Method: IQR (1.5×)</strong> (Non-Normal/Small Data)
                </div>
                <div style="margin-bottom: 8px; font-size: 0.85rem;">
                     Limit: <span style="font-family: monospace; background: #f3f4f6;">${lowerFence.toFixed(2)} ~ ${upperFence.toFixed(2)}</span>
                </div>`;

                if (outliers.length > 0) {
                    resultHTML += `<div style="padding: 10px; background-color: #fee2e2; border-radius: 4px; border: 1px solid #ef4444; margin-top: 10px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px;">
                            <strong style="color:#b91c1c; font-size: 0.95rem;">🚨 Outliers Confirmed:</strong>
                            <strong style="font-size: 1rem; color: #b91c1c;">${outliers.join(', ')}</strong>
                        </div>
                        <div style="font-size: 0.8rem; color: #b91c1c;">
                             Values outside the limit.
                        </div></div></div>`;
                } else {
                    resultHTML += `<div style="padding: 8px; background-color: #dcfce7; border-radius: 4px; border: 1px solid #22c55e; color: #166534; font-weight: bold; font-size: 0.9rem; text-align: center; margin-top: 10px;">✅ No outliers found (IQR).</div></div>`;
                }
            }
            resDiv.innerHTML = resultHTML;
            resDiv.style.display = 'block';
        });
    }

    // ====================================================
    // 4. HED Calculator Logic
    // ====================================================
    const hedButton = document.getElementById('calculate-hed');
    if (hedButton) {
        hedButton.addEventListener('click', () => {
            const kmFactors = { 
                "Mouse": 3, "Hamster": 5, "Rat": 6, "Ferret": 7, "Guinea Pig": 8, "Rabbit": 12, 
                "Dog": 20, "Monkey": 12, "Marmoset": 6, "Squirrel Monkey": 7, "Baboon": 20, 
                "Micro Pig": 27, "Mini Pig": 35, "Human": 37 
            };
            const sA = document.getElementById('species-a').value;
            const dA = parseFloat(document.getElementById('dose-a').value);
            const sB = document.getElementById('species-b').value;
            const wB = parseFloat(document.getElementById('weight-b').value);
            const unitB = document.getElementById('weight-b-unit').value;
            const resDiv = document.getElementById('hed-result');

            if(isNaN(dA)) { resDiv.innerHTML = "<span style='color:red;'>Error: Please enter a valid Dose.</span>"; return; }

            const doseB = dA * (kmFactors[sA] / kmFactors[sB]);
            let absDoseText = "";
            if(!isNaN(wB)) {
                const wbkg = unitB === 'kg' ? wB : wB / 1000;
                absDoseText = `<br><br><strong>Absolute Dose for ${sB} (${wbkg}kg):</strong><br>${(doseB * wbkg).toFixed(4)} mg`;
            }
            resDiv.innerHTML = `Equivalent Dose for <strong>${sB}</strong>:<br><span style="color:blue; font-size:1.2em; font-weight:bold;">${doseB.toFixed(4)} mg/kg</span>${absDoseText}`;
        });
    }

    // ====================================================
    // 5. Dilution Calculator Logic
    // ====================================================
    const dilutionButton = document.getElementById('calculate-dilution');
    if (dilutionButton) {
        dilutionButton.addEventListener('click', () => {
            const m1Val = parseFloat(document.getElementById('m1').value);
            const v1Val = parseFloat(document.getElementById('v1').value);
            const m2Val = parseFloat(document.getElementById('m2').value);
            const v2Val = parseFloat(document.getElementById('v2').value);

            const cFactors = { "M": 1, "mM": 1e-3, "uM": 1e-6, "nM": 1e-9 };
            const vFactors = { "L": 1, "mL": 1e-3, "uL": 1e-6 };

            const m1Unit = cFactors[document.getElementById('m1-unit').value];
            const v1Unit = vFactors[document.getElementById('v1-unit').value];
            const m2Unit = cFactors[document.getElementById('m2-unit').value];
            const v2Unit = vFactors[document.getElementById('v2-unit').value];

            const m1Text = document.getElementById('m1-unit').value;
            const v1Text = document.getElementById('v1-unit').value;
            const m2Text = document.getElementById('m2-unit').value;
            const v2Text = document.getElementById('v2-unit').value;

            const resDiv = document.getElementById('dilution-result');
            resDiv.innerHTML = "";
            resDiv.style.whiteSpace = "normal";

            const isNaN_m1 = isNaN(m1Val);
            const isNaN_v1 = isNaN(v1Val);
            const isNaN_m2 = isNaN(m2Val);
            const isNaN_v2 = isNaN(v2Val);

            const emptyCount = [isNaN_m1, isNaN_v1, isNaN_m2, isNaN_v2].filter(Boolean).length;

            if (emptyCount !== 1) {
                resDiv.innerHTML = "<span style='color:red;'>Please enter exactly 3 values. Leave the target field empty.</span>";
                return;
            }

            let resultHTML = "";

            if (isNaN_m1) {
                const calcM1_Base = (m2Val * m2Unit * v2Val * v2Unit) / (v1Val * v1Unit);
                resultHTML = `Required Stock Conc (M₁): ${smartFormat(calcM1_Base, 'M', 'conc')}`;
            } 
            else if (isNaN_v1) {
                const calcV1_Base = (m2Val * m2Unit * v2Val * v2Unit) / (m1Val * m1Unit); 
                const smartV1 = smartFormat(calcV1_Base, 'L', 'vol');
                const solventBase = (v2Val * v2Unit) - calcV1_Base;
                const solventInV2Unit = solventBase / v2Unit;
                let solventText = `<br><span style="font-size:0.9em; color:#555;">(Add ${smartV1} of Stock + <strong>${solventInV2Unit.toFixed(3)} ${v2Text}</strong> of Solvent)</span>`;
                resultHTML = `Required Stock Vol (V₁): ${smartV1}${solventText}`;
            } 
            else if (isNaN_m2) {
                const calcM2_Base = (m1Val * m1Unit * v1Val * v1Unit) / (v2Val * v2Unit);
                resultHTML = `Final Concentration (M₂): ${smartFormat(calcM2_Base, 'M', 'conc')}`;
            } 
            else if (isNaN_v2) {
                const calcV2_Base = (m1Val * m1Unit * v1Val * v1Unit) / (m2Val * m2Unit);
                resultHTML = `Final Volume (V₂): ${smartFormat(calcV2_Base, 'L', 'vol')}`;
            }

            resDiv.innerHTML = `<div style="font-size: 1rem; color: #1f2937;">${resultHTML}</div>`;
        });
    }

});