document.addEventListener('DOMContentLoaded', () => {

    // =========================================================
    // 0. Firebase 설정 & 초기화
    // =========================================================
    try {
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
        // 방문자 카운터
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            const db = firebase.firestore();
            const countSpan = document.getElementById('visitor-count');
            if (countSpan) {
                const today = new Date();
                const offset = today.getTimezoneOffset() * 60000;
                const dateStr = (new Date(today - offset)).toISOString().split('T')[0];
                const docRef = db.collection('visitors').doc(dateStr);
                
                if (!sessionStorage.getItem(`visited_${dateStr}`)) {
                    docRef.set({ count: firebase.firestore.FieldValue.increment(1) }, { merge: true })
                    .then(() => sessionStorage.setItem(`visited_${dateStr}`, 'true')).catch(()=>{});
                }
                docRef.onSnapshot((doc) => {
                    if (doc.exists) countSpan.innerHTML = `Today's Visitors: <strong>${doc.data().count.toLocaleString()}</strong>`;
                });
            }
        }
    } catch (e) { console.log("Firebase init skipped"); }


    // ====================================================
    // [통계 라이브러리 내장] jStat 의존성 제거 및 보완
    // ====================================================
    
    // 1. 기본 통계 함수
    const stat = {
        mean: d => d.reduce((a,b)=>a+b,0)/d.length,
        sd: (d, meanVal) => {
            const m = meanVal || stat.mean(d);
            return Math.sqrt(d.reduce((a,b)=>a+Math.pow(b-m,2),0)/(d.length-1));
        },
        skewness: (d, meanVal, sdVal) => {
            const n = d.length;
            if (n < 3) return 0;
            const m = meanVal || stat.mean(d);
            const s = sdVal || stat.sd(d, m);
            let sum = 0;
            d.forEach(v => sum += Math.pow((v-m)/s, 3));
            return (n / ((n-1)*(n-2))) * sum;
        },
        percentile: (d, p) => {
            const sorted = [...d].sort((a,b)=>a-b);
            const pos = (sorted.length - 1) * p;
            const base = Math.floor(pos);
            const rest = pos - base;
            if (sorted[base+1] !== undefined) {
                return sorted[base] + rest * (sorted[base+1] - sorted[base]);
            }
            return sorted[base];
        }
    };

    // 2. Shapiro-Wilk 계산 함수 (직접 구현)
    function normalCDF(x) {
        var t = 1 / (1 + 0.2316419 * Math.abs(x));
        var d = 0.3989423 * Math.exp(-x * x / 2);
        var prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
        if (x > 0) prob = 1 - prob;
        return prob;
    }

    function calculateShapiroWilk(data) {
        const n = data.length;
        if (n < 3) return { p: 0 };
        const mean = stat.mean(data);
        const ss = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
        if (ss === 0) return { p: 1 }; // 모든 숫자가 같음

        // 상수 계산 (Approximation)
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
        if (n === 3) { a[0] = 0.7071; a[2] = -0.7071; } 
        else {
            const an = c[n-1] + 0.221157*Math.pow(n,-1) - 0.147981*Math.pow(n,-2) - 2.07119*Math.pow(n,-3) + 4.434685*Math.pow(n,-4) - 2.706056*Math.pow(n,-5);
            const an_1 = c[n-2] + 0.042981*Math.pow(n,-1) - 0.293762*Math.pow(n,-2) - 1.752461*Math.pow(n,-3) + 5.682633*Math.pow(n,-4) - 3.582633*Math.pow(n,-5);
            a[n-1] = an; a[n-2] = an_1; a[0] = -an; a[1] = -an_1;
            let epsilon = (mNorm*mNorm - 2*an*an - 2*an_1*an_1) / (1 - 2*a[n-1]*a[n-1] - 2*a[n-2]*a[n-2]); 
            if (epsilon < 0) epsilon = 0;
            epsilon = Math.sqrt(epsilon);
            for (let i = 2; i < n - 2; i++) { a[i] = c[i]; }
        }

        let b = 0;
        const sorted = [...data].sort((x,y)=>x-y);
        for (let i = 0; i < n; i++) { b += a[i] * sorted[i]; }

        const w = (b * b) / ss;
        const mu = 0.0038915 * Math.pow(Math.log(n), 3) - 0.083751 * Math.pow(Math.log(n), 2) - 0.31082 * Math.log(n) - 1.5861;
        const sigma = Math.exp(0.0030302 * Math.pow(Math.log(n), 2) - 0.082676 * Math.log(n) - 0.4803);
        const z = (Math.log(1 - w) - mu) / sigma;
        let p = 1 - normalCDF(z);
        if (p > 1) p = 1; if (p < 0) p = 0;
        return { p: p };
    }


    // ====================================================
    // 2. Outlier Checker (Advanced: Skewness + Internal S-W)
    // ====================================================
    const outlierButton = document.getElementById('check-outliers');
    if (outlierButton) {
        
        // Grubb's Critical Values
        const grubbsTable = {
            3: 1.153, 4: 1.463, 5: 1.672, 6: 1.822, 7: 1.938, 8: 2.032, 9: 2.110, 10: 2.176,
            12: 2.285, 15: 2.409, 20: 2.557, 30: 2.745, 50: 2.956, 100: 3.207
        };
        const getGCrit = (n) => {
            const keys = Object.keys(grubbsTable).map(Number).sort((a,b)=>a-b);
            for (let k of keys) { if(n <= k) return grubbsTable[k]; }
            return 3.5;
        };

        // Grubb's T-inv helper (approx for missing library)
        const getTCrit = (alpha, df) => {
            // jStat이 있으면 사용, 없으면 대략적인 값 (2.0~2.2) 사용하지만
            // 여기선 jStat이 로드되었을 확률이 높으므로 jStat 시도
            if(typeof jStat !== 'undefined' && jStat.studentt) return jStat.studentt.inv(1 - alpha, df);
            return 2.228; // fallback (df=10, 0.05) - 정확도 위해 jStat 권장
        };

        outlierButton.addEventListener('click', () => {
            const raw = document.getElementById('outlier-data').value;
            const data = raw.split(/[\s,]+/).filter(s=>s.trim()!=='' && !isNaN(s)).map(Number).sort((a,b)=>a-b);
            const resDiv = document.getElementById('outlier-result');
            resDiv.style.display = 'block';

            if (data.length < 3) {
                resDiv.innerHTML = "<span style='color:red;'>Please enter at least 3 numbers.</span>";
                return;
            }

            const n = data.length;
            const mean = stat.mean(data);
            const sd = stat.sd(data, mean);
            const skew = stat.skewness(data, mean, sd);

            // ==========================================
            // ★ 개선된 정규성 판단 로직 (Skewness + Internal S-W) ★
            // ==========================================
            let isNormal = false;
            let pValueDisplay = "-";
            let normMsg = "";

            if (n <= 5) {
                // Small N: Skewness Heuristic
                const isApproxNormal = Math.abs(skew) < 0.8; // Skewness가 작으면 정규분포로 '간주'
                isNormal = isApproxNormal;
                pValueDisplay = "N/A"; 
                
                if (isNormal) normMsg = `<span style="color:#059669;">(Small N, Low Skew=${skew.toFixed(2)})</span>`;
                else normMsg = `<span style="color:#d97706;">(Small N, High Skew=${skew.toFixed(2)})</span>`;
                
            } else {
                // Standard N: Shapiro-Wilk (내장 함수 사용)
                const sw = calculateShapiroWilk(data);
                const pVal = sw.p;
                
                isNormal = pVal >= 0.05;
                pValueDisplay = pVal.toFixed(4);
                normMsg = isNormal ? "(Normal)" : "(Non-Normal)";
            }

            // 이상치 탐지
            let methodUsed = "";
            let outliers = [];
            let thresholdInfo = "";

            if (isNormal) {
                // Grubb's Test
                methodUsed = "Grubb's Test";
                const alpha = 0.05;
                
                // jStat 라이브러리 활용하여 Critical G 계산 (없으면 fallback)
                let t_crit;
                if(typeof jStat !== 'undefined') t_crit = jStat.studentt.inv(1 - alpha / (2 * n), n - 2);
                else t_crit = 2.306; // fallback

                const g_crit = ((n - 1) * Math.sqrt(Math.pow(t_crit, 2))) / (Math.sqrt(n) * Math.sqrt(n - 2 + Math.pow(t_crit, 2)));
                
                const g_max = (data[n-1] - mean) / sd;
                const g_min = (mean - data[0]) / sd;

                if (g_max > g_crit) outliers.push(data[n-1]);
                if (g_min > g_crit) outliers.push(data[0]);
                
                thresholdInfo = `Critical G: ${g_crit.toFixed(3)}`;
            } else {
                // IQR Method
                methodUsed = "IQR (1.5×)";
                const q1 = stat.percentile(data, 0.25);
                const q3 = stat.percentile(data, 0.75);
                const iqr = q3 - q1;
                const lower = q1 - 1.5 * iqr;
                const upper = q3 + 1.5 * iqr;

                outliers = data.filter(x => x < lower || x > upper);
                thresholdInfo = `Limit: ${lower.toFixed(2)} ~ ${upper.toFixed(2)}`;
            }

            // 결과 HTML
            let resultHTML = `
                <div style="font-size: 0.9rem; color: #374151; margin-bottom:15px;">
                    <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; border-bottom: 1px dashed #ccc; padding-bottom: 8px; gap: 10px;">
                        <div style="white-space: nowrap;">
                            Mean: <strong>${mean.toFixed(2)}</strong> | SD: <strong>${sd.toFixed(2)}</strong> | N: <strong>${n}</strong>
                        </div>
                        <div style="white-space: nowrap;">
                            S-W P-value: <strong>${pValueDisplay}</strong> ${normMsg}
                        </div>
                    </div>
                </div>

                <div style="background:#fffbeb; padding:10px; border-radius:4px; margin-bottom:15px; border:1px solid #fcd34d; font-size: 0.9rem;">
                    ⚠️ <strong>Method: ${methodUsed}</strong> <br>
                    <span style="color:#666; font-size: 0.85rem;">(${thresholdInfo})</span>
                </div>
            `;

            if (outliers.length > 0) {
                if (n <= 5) {
                    resultHTML += `
                        <div style="background:#fff7ed; border:1px solid #f97316; color:#9a3412; padding:15px; border-radius:6px;">
                            <div style="font-weight:bold; font-size:1.1em; margin-bottom:8px;">
                                ⚠️ Potential Outlier: ${outliers.join(", ")}
                            </div>
                            <div style="font-weight:bold; margin-bottom:4px;">
                                Sample size is too small (N=${n}).
                            </div>
                            <div style="font-size: 0.95em; line-height: 1.5;">
                                It is recommended to <strong>increase the number of replicates (n)</strong> rather than removing this value.
                            </div>
                        </div>
                    `;
                } else {
                    resultHTML += `
                        <div style="background:#fef2f2; border:1px solid #ef4444; color:#991b1b; padding:15px; border-radius:6px; font-weight:bold;">
                            🚨 Outliers Confirmed:<br>
                            <span style="font-size:1.5em;">${outliers.join(", ")}</span>
                            <div style="font-size:0.8em; margin-top:5px; font-weight:normal;">
                                Statistical outlier detected based on ${methodUsed}.
                            </div>
                        </div>
                    `;
                }
            } else {
                resultHTML += `
                    <div style="background:#ecfdf5; border:1px solid #10b981; color:#065f46; padding:15px; border-radius:6px; font-weight:bold; text-align:center;">
                        ✅ No Outliers Detected
                    </div>
                `;
            }
            resDiv.innerHTML = resultHTML;
        });
    }

    // ====================================================
    // Helper: 스마트 단위 변환기 (Molarity 등에서 사용)
    // ====================================================
    function smartFormat(value, unit, type) {
        if (isNaN(value) || value === 0) return `0.000 ${unit}`;
        const factors = {
            'L': 1, 'mL': 1e-3, 'uL': 1e-6, 'nL': 1e-9,
            'M': 1, 'mM': 1e-3, 'uM': 1e-6, 'nM': 1e-9,
            'kg': 1000, 'g': 1, 'mg': 1e-3, 'ug': 1e-6, 'ng': 1e-9
        };
        const volUnits = ['L', 'mL', 'uL', 'nL'];
        const concUnits = ['M', 'mM', 'uM', 'nM'];
        const massUnits = ['kg', 'g', 'mg', 'ug', 'ng'];
        
        let units = (type === 'vol') ? volUnits : (type === 'conc') ? concUnits : massUnits;
        let baseValue = value * factors[unit];
        let bestUnit = units[units.length - 1]; 
        for (let u of units) {
            if (Math.abs(baseValue) / factors[u] >= 1) { bestUnit = u; break; }
        }
        if (Math.abs(baseValue) < factors[units[units.length-1]]) bestUnit = units[units.length-1];
        let scaledValue = baseValue / factors[bestUnit];
        return `<strong>${scaledValue.toFixed(3)} ${bestUnit}</strong>`;
    }

    // ====================================================
    // 3. Molarity Calculator
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

            const factors = { 'kg': 1000, 'g': 1, 'mg': 1e-3, 'ug': 1e-6, 'L': 1, 'mL': 1e-3, 'uL': 1e-6, 'M': 1, 'mM': 1e-3, 'uM': 1e-6 };
            const mF = factors[document.getElementById('mass-unit').value];
            const vF = factors[document.getElementById('vol-unit').value];
            const cF = factors[document.getElementById('conc-unit').value];

            let txt = "";
            if (!isNaN(mass) && isNaN(vol) && !isNaN(conc)) txt = `Required Volume: ${smartFormat((mass * mF) / (mw * (conc * cF)), 'L', 'vol')}`;
            else if (isNaN(mass) && !isNaN(vol) && !isNaN(conc)) txt = `Required Mass: ${smartFormat(mw * (vol * vF) * (conc * cF), 'g', 'mass')}`;
            else if (!isNaN(mass) && !isNaN(vol) && isNaN(conc)) txt = `Concentration: ${smartFormat((mass * mF) / (mw * (vol * vF)), 'M', 'conc')}`;
            else txt = "<span style='color:red;'>Fill exactly 3 fields.</span>";
            resDiv.innerHTML = txt;
        });
    }

    // ====================================================
    // 4. HED Calculator
    // ====================================================
    const hedButton = document.getElementById('calculate-hed');
    if (hedButton) {
        hedButton.addEventListener('click', () => {
            const fullKm = { 
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

            if(isNaN(dA)) { resDiv.innerHTML = "<span style='color:red;'>Enter valid Dose.</span>"; return; }
            const doseB = dA * (fullKm[sA] / fullKm[sB]);
            let absText = "";
            if(!isNaN(wB)) {
                const wKg = unitB === 'kg' ? wB : wB/1000;
                absText = `<br><br><strong>Absolute Dose (${wKg}kg):</strong><br>${(doseB * wKg).toFixed(4)} mg`;
            }
            resDiv.innerHTML = `Equivalent for <strong>${sB}</strong>:<br><span style="color:blue; font-size:1.2em; font-weight:bold;">${doseB.toFixed(4)} mg/kg</span>${absText}`;
        });
    }

    // ====================================================
    // 5. Dilution Calculator
    // ====================================================
    const dilButton = document.getElementById('calculate-dilution');
    if (dilButton) {
        dilButton.addEventListener('click', () => {
            const m1 = parseFloat(document.getElementById('m1').value);
            const v1 = parseFloat(document.getElementById('v1').value);
            const m2 = parseFloat(document.getElementById('m2').value);
            const v2 = parseFloat(document.getElementById('v2').value);

            const factors = { "M": 1, "mM": 1e-3, "uM": 1e-6, "nM": 1e-9, "L": 1, "mL": 1e-3, "uL": 1e-6 };
            const m1U = factors[document.getElementById('m1-unit').value];
            const v1U = factors[document.getElementById('v1-unit').value];
            const m2U = factors[document.getElementById('m2-unit').value];
            const v2U = factors[document.getElementById('v2-unit').value];

            const resDiv = document.getElementById('dilution-result');
            const isNaNs = [isNaN(m1), isNaN(v1), isNaN(m2), isNaN(v2)];
            if(isNaNs.filter(x=>x).length !== 1) {
                resDiv.innerHTML = "<span style='color:red;'>Leave exactly one field empty.</span>";
                return;
            }

            let result = "";
            const m1T = document.getElementById('m1-unit').value;
            const v1T = document.getElementById('v1-unit').value;
            const m2T = document.getElementById('m2-unit').value;
            const v2T = document.getElementById('v2-unit').value;

            if(isNaN(m1)) result = `Stock Conc (M₁): ${smartFormat((m2*m2U*v2*v2U)/(v1*v1U), 'M', 'conc')}`;
            else if(isNaN(v1)) {
                const val = (m2*m2U*v2*v2U)/(m1*m1U);
                const solvent = (v2*v2U) - val;
                result = `Stock Vol (V₁): ${smartFormat(val, 'L', 'vol')}<br><span style="font-size:0.9em;color:#555">(Add + <strong>${(solvent/factors[v2T]).toFixed(3)} ${v2T}</strong> Solvent)</span>`;
            }
            else if(isNaN(m2)) result = `Final Conc (M₂): ${smartFormat((m1*m1U*v1*v1U)/(v2*v2U), 'M', 'conc')}`;
            else if(isNaN(v2)) result = `Final Vol (V₂): ${smartFormat((m1*m1U*v1*v1U)/(m2*m2U), 'L', 'vol')}`;

            resDiv.innerHTML = `<div style="font-size: 1rem; color: #1f2937;">${result}</div>`;
        });
    }

});