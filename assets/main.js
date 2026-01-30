document.addEventListener('DOMContentLoaded', () => {

    // ====================================================
    // Helper: 스마트 단위 변환기 (자동 단위 최적화 + 소수점 3자리)
    // ====================================================
    function smartFormat(value, unit, type) {
        if (isNaN(value) || value === 0) return `0.000 ${unit}`;

        const volUnits = ['L', 'mL', 'uL', 'nL'];
        const concUnits = ['M', 'mM', 'uM', 'nM'];
        
        const factors = {
            'L': 1, 'mL': 1e-3, 'uL': 1e-6, 'nL': 1e-9,
            'M': 1, 'mM': 1e-3, 'uM': 1e-6, 'nM': 1e-9
        };

        const units = type === 'vol' ? volUnits : concUnits;
        let baseValue = value * factors[unit];
        let bestUnit = units[units.length - 1]; 
        
        for (let u of units) {
            if (Math.abs(baseValue) >= factors[u] * 0.1) { 
                bestUnit = u;
                break;
            }
        }

        let scaledValue = baseValue / factors[bestUnit];
        return `<strong>${scaledValue.toFixed(3)} ${bestUnit}</strong>`;
    }


    // ====================================================
    // 1. Molarity Calculator Logic
    // ====================================================
    const molButton = document.getElementById('calculate-molarity');
    if (molButton) {
        molButton.addEventListener('click', () => {
            const mass = parseFloat(document.getElementById('mass').value);
            const mw = parseFloat(document.getElementById('mw').value);
            const vol = parseFloat(document.getElementById('volume').value);
            const conc = parseFloat(document.getElementById('concentration').value);

            const volUnit = document.getElementById('vol-unit').value;
            const concUnit = document.getElementById('conc-unit').value;

            const vFactor = volUnit === 'L' ? 1 : (volUnit === 'mL' ? 1e-3 : 1e-6);
            const cFactor = concUnit === 'M' ? 1 : (concUnit === 'mM' ? 1e-3 : 1e-6);

            const resDiv = document.getElementById('molarity-result');
            let resultText = "";

            if (isNaN(mw)) {
                resDiv.innerHTML = "<span style='color:red;'>Please enter Molecular Weight.</span>";
                return;
            }

            if (isNaN(mass) && !isNaN(vol) && !isNaN(conc)) {
                const calcMass = mw * (vol * vFactor) * (conc * cFactor);
                resultText = `Required Mass: <strong>${calcMass.toFixed(3)} g</strong>`;
            } else if (!isNaN(mass) && !isNaN(vol) && isNaN(conc)) {
                const calcConc = mass / (mw * (vol * vFactor));
                const finalConc = calcConc / cFactor;
                resultText = `Concentration: <strong>${finalConc.toFixed(3)} ${concUnit}</strong>`;
            } else if (!isNaN(mass) && isNaN(vol) && !isNaN(conc)) {
                const calcVol = mass / (mw * (conc * cFactor));
                const finalVol = calcVol / vFactor;
                resultText = `Required Volume: <strong>${finalVol.toFixed(3)} ${volUnit}</strong>`;
            } else {
                resultText = "<span style='color:red;'>Please fill in exactly 3 fields (MW is required).</span>";
            }

            resDiv.innerHTML = resultText;
        });
    }

    // ====================================================
    // 2. Outlier Checker Logic (IQR + Shapiro-Wilk) - [복구됨]
    // ====================================================
    function normalCDF(x) {
        var t = 1 / (1 + 0.2316419 * Math.abs(x));
        var d = 0.3989423 * Math.exp(-x * x / 2);
        var prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
        if (x > 0) prob = 1 - prob;
        return prob;
    }

    function calculateShapiroWilk(data) {
        const n = data.length;
        if (n < 3) return { w: 0, p: 0, valid: false };

        const mean = data.reduce((a, b) => a + b, 0) / n;
        const ss = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
        
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
                resDiv.innerHTML = "<span style='color:red; font-size: 0.9rem;'>Error: Need at least 3 numbers for statistics.</span>";
                return;
            }

            const n = data.length;
            const mean = data.reduce((a, b) => a + b, 0) / n;
            // ▼▼▼ SD 계산 복구 ▼▼▼
            const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
            const stdev = Math.sqrt(variance);

            const swResult = calculateShapiroWilk(data);
            const pValue = swResult.p;

            const isNormal = pValue >= 0.05;
            const pValueColor = isNormal ? "green" : "#d97706";
            const pValueText = isNormal ? "Probable Normal" : "Non-Normal";

            const q1 = data[Math.floor((n - 1) / 4)];
            const q3 = data[Math.floor((n - 1) * 3 / 4)];
            const iqr = q3 - q1;
            const lowerFence = q1 - 1.5 * iqr;
            const upperFence = q3 + 1.5 * iqr;
            const outliers = data.filter(x => x < lowerFence || x > upperFence);

            // ▼▼▼ 결과창 상세 설명 복구 ▼▼▼
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
                                W: <strong>${swResult.w.toFixed(3)}</strong> <br>
                                P-value: <strong style="color:${pValueColor};">${pValue.toFixed(3)}</strong> <span style="font-size:0.75rem; color:#666;">(${pValueText})</span>
                            </div>
                        </div>
                    </div>
                    <div style="margin-bottom: 8px; font-size: 0.85rem;">
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color:#111; font-weight: 600;">Detection Limit (1.5×IQR):</span>
                            <span style="font-family: monospace; background: #f3f4f6; padding: 2px 6px; border-radius: 3px;">
                                ${lowerFence.toFixed(2)} ~ ${upperFence.toFixed(2)}
                            </span>
                        </div>
                    </div>`;

            if (outliers.length > 0) {
                if (isNormal) {
                    resultHTML += `<div style="padding: 10px; background-color: #fff7ed; border-radius: 4px; border: 1px solid #f97316; margin-top: 10px;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                            <strong style="color:#c2410c; font-size: 0.95rem;">⚠️ Outliers Detected, but...</strong>
                        </div>
                        <div style="font-size: 0.85rem; color: #9a3412; margin-bottom: 8px;">
                            P-value (S-W) is <strong>${pValue.toFixed(3)}</strong> (≥ 0.05). Data follows a <strong>Normal Distribution</strong>.
                        </div>
                        <div style="font-weight: bold; color: #c2410c; text-align: center; border-top: 1px dashed #fdba74; padding-top: 5px;">
                            Recommendation: Do NOT exclude them.
                        </div></div></div>`;
                } else {
                    resultHTML += `<div style="padding: 10px; background-color: #fee2e2; border-radius: 4px; border: 1px solid #ef4444; margin-top: 10px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px;">
                            <strong style="color:#b91c1c; font-size: 0.95rem;">🚨 Outliers Confirmed:</strong>
                            <strong style="font-size: 1rem; color: #b91c1c;">${outliers.join(', ')}</strong>
                        </div>
                        <div style="font-size: 0.8rem; color: #b91c1c;">
                             P-value (${pValue.toFixed(3)}) < 0.05. Data is Non-normal. <br><strong>IQR method is appropriate.</strong>
                        </div></div></div>`;
                }
            } else {
                resultHTML += `<div style="padding: 8px; background-color: #dcfce7; border-radius: 4px; border: 1px solid #22c55e; color: #166534; font-weight: bold; font-size: 0.9rem; text-align: center; margin-top: 10px;">✅ No outliers found.</div></div>`;
            }
            resDiv.innerHTML = resultHTML;
        });
    }

    // ====================================================
    // 3. HED Calculator Logic
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
    // 4. Dilution Calculator Logic
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
                const finalM1 = calcM1_Base / m1Unit; 
                resultHTML = `Required Stock Conc (M₁): <strong>${finalM1.toFixed(3)} ${m1Text}</strong>`;
            } 
            else if (isNaN_v1) {
                const calcV1_Base = (m2Val * m2Unit * v2Val * v2Unit) / (m1Val * m1Unit); 
                const finalV1 = calcV1_Base / v1Unit; 
                const smartV1 = smartFormat(finalV1, v1Text, 'vol');

                const solventBase = (v2Val * v2Unit) - calcV1_Base;
                const solventInV2Unit = solventBase / v2Unit;

                let solventText = `<br><span style="font-size:0.9em; color:#555;">(Add ${smartV1} of Stock + <strong>${solventInV2Unit.toFixed(3)} ${v2Text}</strong> of Solvent)</span>`;
                resultHTML = `Required Stock Vol (V₁): ${smartV1}${solventText}`;
            } 
            else if (isNaN_m2) {
                const calcM2_Base = (m1Val * m1Unit * v1Val * v1Unit) / (v2Val * v2Unit);
                const finalM2 = calcM2_Base / m2Unit;
                resultHTML = `Final Concentration (M₂): <strong>${finalM2.toFixed(3)} ${m2Text}</strong>`;
            } 
            else if (isNaN_v2) {
                const calcV2_Base = (m1Val * m1Unit * v1Val * v1Unit) / (m2Val * m2Unit);
                const finalV2 = calcV2_Base / v2Unit;
                resultHTML = `Final Volume (V₂): <strong>${finalV2.toFixed(3)} ${v2Text}</strong>`;
            }

            resDiv.innerHTML = `<div style="font-size: 1rem; color: #1f2937;">${resultHTML}</div>`;
        });
    }

    // ====================================================
    // 5. Disqus Loader
    // ====================================================
    if (document.getElementById('disqus_thread')) {
        (function() { 
            var d = document, s = d.createElement('script');
            s.src = 'https://scientisttoolkit.disqus.com/embed.js';
            s.setAttribute('data-timestamp', +new Date());
            (d.head || d.body).appendChild(s);
        })();
    }

});