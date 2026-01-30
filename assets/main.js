document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------
    // 1. 네비게이션 및 화면 전환 로직
    // ----------------------------------------------------
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.calculator');

    function showSection(targetId) {
        navButtons.forEach(btn => btn.classList.remove('active'));
        sections.forEach(sec => sec.classList.remove('active'));

        const targetSection = document.getElementById(targetId);
        const targetBtn = document.querySelector(`[data-target="${targetId}"]`);

        if (targetSection && targetBtn) {
            targetSection.classList.add('active');
            targetBtn.classList.add('active');
        }
    }

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            showSection(button.getAttribute('data-target'));
        });
    });

    // 초기 접속 처리
    const urlPath = window.location.pathname.replace(/\//g, ''); 
    // 로컬 파일 등 경로 문제 방지를 위해 단순화
    const initialId = (urlPath && document.getElementById(urlPath)) ? urlPath : 'molarity-calc';
    showSection(initialId);


    // ----------------------------------------------------
    // 2. Molarity Calculator 로직
    // ----------------------------------------------------
    const massCalcButton = document.getElementById('calculate-mass');
    if (massCalcButton) {
        massCalcButton.addEventListener('click', () => {
            const massVal = parseFloat(document.getElementById('mass').value);
            const concVal = parseFloat(document.getElementById('concentration').value);
            const volVal = parseFloat(document.getElementById('volume').value);
            const mwVal = parseFloat(document.getElementById('mw').value);

            const mUnits = { g: 1, mg: 1e-3, ug: 1e-6, ng: 1e-9, pg: 1e-12 };
            const cUnits = { M: 1, mM: 1e-3, uM: 1e-6, nM: 1e-9, pM: 1e-12 };
            const vUnits = { L: 1, mL: 1e-3, uL: 1e-6 };

            const mUnit = mUnits[document.getElementById('mass-unit').value];
            const cUnit = cUnits[document.getElementById('concentration-unit').value];
            const vUnit = vUnits[document.getElementById('volume-unit').value];
            const resultDiv = document.getElementById('mass-result');

            if (!isNaN(concVal) && !isNaN(volVal) && !isNaN(mwVal) && isNaN(massVal)) {
                const calcMassG = (concVal * cUnit) * (volVal * vUnit) * mwVal;
                resultDiv.innerHTML = `Calculated Mass: <strong>${(calcMassG / mUnit).toFixed(4)}</strong> ${document.getElementById('mass-unit').value}`;
            } else if (!isNaN(massVal) && !isNaN(volVal) && !isNaN(mwVal) && isNaN(concVal)) {
                const calcConcM = (massVal * mUnit) / (mwVal * (volVal * vUnit));
                resultDiv.innerHTML = `Calculated Concentration: <strong>${(calcConcM / cUnit).toFixed(4)}</strong> ${document.getElementById('concentration-unit').value}`;
            } else if (!isNaN(massVal) && !isNaN(concVal) && !isNaN(mwVal) && isNaN(volVal)) {
                const calcVolL = (massVal * mUnit) / (mwVal * (concVal * cUnit));
                resultDiv.innerHTML = `Calculated Volume: <strong>${(calcVolL / vUnit).toFixed(4)}</strong> ${document.getElementById('volume-unit').value}`;
            } else if (!isNaN(massVal) && !isNaN(concVal) && !isNaN(volVal) && isNaN(mwVal)) {
                const calcMW = (massVal * mUnit) / ((concVal * cUnit) * (volVal * vUnit));
                resultDiv.innerHTML = `Calculated MW: <strong>${calcMW.toFixed(2)}</strong> g/mol`;
            } else {
                resultDiv.innerHTML = "<span style='color:red;'>Please enter exactly 3 values. Leave the target field empty.</span>";
            }
        });
    }

    // ----------------------------------------------------
    // 3. Outlier Checker 로직 (Shapiro-Wilk Approximation 적용)
    // ----------------------------------------------------
    
    // [보조 함수] 정규분포 누적확률분포 (CDF) 근사 함수
    function normalCDF(x) {
        var t = 1 / (1 + 0.2316419 * Math.abs(x));
        var d = 0.3989423 * Math.exp(-x * x / 2);
        var prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
        if (x > 0) prob = 1 - prob;
        return prob;
    }

    // [보조 함수] Shapiro-Wilk W 통계량 및 P-value 계산 (Royston 1992 근사)
    function calculateShapiroWilk(data) {
        const n = data.length;
        if (n < 3) return { w: 0, p: 0, valid: false };

        const mean = data.reduce((a, b) => a + b, 0) / n;
        // 분모 S^2 (SS)
        const ss = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
        
        // 계수 a_i 계산 (간소화된 근사식)
        const m = new Array(n);
        for (let i = 0; i < n; i++) {
            // i는 1-based index (1...n)
            const index = i + 1;
            // Mi calculation (Expectation of normal order statistics approximation)
            // Blom's approximation
            m[i] = 4.91 * (Math.pow((index - 0.375) / (n + 0.25), 0.14) - Math.pow((n - index + 0.625) / (n + 0.25), 0.14));
        }

        let c = new Array(n);
        let mSumSq = 0;
        for(let val of m) mSumSq += val*val;
        const mNorm = Math.sqrt(mSumSq);
        for(let i=0; i<n; i++) c[i] = m[i] / mNorm;

        // a_i coefficients approximations based on n
        let a = new Array(n).fill(0);
        
        if (n === 3) {
            a[0] = 0.7071; a[2] = -0.7071; // a[1] is 0
        } else {
            // Polynomial approximation for a_n and a_{n-1}
            const an = c[n-1] + 0.221157*Math.pow(n, -1) - 0.147981*Math.pow(n, -2) - 2.07119*Math.pow(n, -3) + 4.434685*Math.pow(n, -4) - 2.706056*Math.pow(n, -5);
            const an_1 = c[n-2] + 0.042981*Math.pow(n, -1) - 0.293762*Math.pow(n, -2) - 1.752461*Math.pow(n, -3) + 5.682633*Math.pow(n, -4) - 3.582633*Math.pow(n, -5);
            
            a[n-1] = an;
            a[n-2] = an_1;
            a[0] = -an;
            a[1] = -an_1;

            // Remaining constants
            let epsilon = (mNorm*mNorm - 2*an*an - 2*an_1*an_1) / (1 - 2*a[n-1]*a[n-1] - 2*a[n-2]*a[n-2]); 
            if (epsilon < 0) epsilon = 0; // safety
            epsilon = Math.sqrt(epsilon);

            for (let i = 2; i < n - 2; i++) {
                a[i] = m[i] / Math.sqrt(mSumSq) * epsilon; // approximation fix
                // For simpler calculation in JS without full table, 
                // we use simple m/sqrt(sum) for inner values as fallback
                a[i] = c[i]; 
            }
        }

        // Calculate b
        let b = 0;
        for (let i = 0; i < n; i++) {
            b += a[i] * data[i];
        }

        const w = (b * b) / ss;

        // Calculate P-value (Royston's transformation)
        // This is a rough approximation for JS client-side
        let p = 0;
        
        // Very simplified p-value lookup logic for W statistic
        // transforming W to Z score approximation
        const mu = 0.0038915 * Math.pow(Math.log(n), 3) - 0.083751 * Math.pow(Math.log(n), 2) - 0.31082 * Math.log(n) - 1.5861;
        const sigma = Math.exp(0.0030302 * Math.pow(Math.log(n), 2) - 0.082676 * Math.log(n) - 0.4803);
        const z = (Math.log(1 - w) - mu) / sigma;
        p = 1 - normalCDF(z);

        // Safety caps
        if (p > 1) p = 1;
        if (p < 0) p = 0;

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
            const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
            const stdev = Math.sqrt(variance);

            // Shapiro-Wilk Calculation
            const swResult = calculateShapiroWilk(data);
            const pValue = swResult.p;

            // Skewness 계산 (UI 표시용)
            let skewness = 0;
            if (n > 2) {
                const sumCubicDiff = data.reduce((acc, val) => acc + Math.pow((val - mean)/stdev, 3), 0);
                skewness = (n / ((n - 1) * (n - 2))) * sumCubicDiff;
            }

            // Normality & Skewness Text
            let skewnessText = "Symmetric";
            let skewnessColor = "green";
            if (skewness > 1) { skewnessText = "Skewed (Right)"; skewnessColor = "#d97706"; } 
            else if (skewness < -1) { skewnessText = "Skewed (Left)"; skewnessColor = "#d97706"; } 

            const isNormal = pValue >= 0.05;
            const pValueColor = isNormal ? "green" : "#d97706";
            const pValueText = isNormal ? "Probable Normal" : "Non-Normal";

            // Outlier Detection (IQR)
            const q1 = data[Math.floor((n - 1) / 4)];
            const q3 = data[Math.floor((n - 1) * 3 / 4)];
            const iqr = q3 - q1;
            const lowerFence = q1 - 1.5 * iqr;
            const upperFence = q3 + 1.5 * iqr;
            const outliers = data.filter(x => x < lowerFence || x > upperFence);

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
                    // Normal distribution but has outliers -> Warning
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
                    // Non-normal and outliers -> Alert
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

    // ----------------------------------------------------
    // 4. HED Calculator 로직
    // ----------------------------------------------------
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

    // Disqus 로딩
    if (document.getElementById('disqus_thread')) {
        (function() { 
            var d = document, s = d.createElement('script');
            s.src = 'https://scientisttoolkit.disqus.com/embed.js';
            s.setAttribute('data-timestamp', +new Date());
            (d.head || d.body).appendChild(s);
        })();
    }
// ====================================================
    // 5. Dilution Calculator 로직 (Any 3 Variables & All Units)
    // ====================================================
    const dilutionButton = document.getElementById('calculate-dilution');
    if (dilutionButton) {
        dilutionButton.addEventListener('click', () => {
            // 1. 값과 단위 가져오기
            const m1Val = parseFloat(document.getElementById('m1').value);
            const v1Val = parseFloat(document.getElementById('v1').value);
            const m2Val = parseFloat(document.getElementById('m2').value);
            const v2Val = parseFloat(document.getElementById('v2').value);

            // 2. 단위 변환 계수 (Base: Molar, Liter)
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
            
            // 결과창 초기화 및 스타일 (줄간격 좁게)
            resDiv.innerHTML = "";
            resDiv.style.whiteSpace = "normal";

            // 3. 어떤 값이 비었는지 확인
            const isNaN_m1 = isNaN(m1Val);
            const isNaN_v1 = isNaN(v1Val);
            const isNaN_m2 = isNaN(m2Val);
            const isNaN_v2 = isNaN(v2Val);

            // 정확히 1개만 비어있어야 함 (true가 1개일 때)
            const emptyCount = [isNaN_m1, isNaN_v1, isNaN_m2, isNaN_v2].filter(Boolean).length;

            if (emptyCount !== 1) {
                resDiv.innerHTML = "<span style='color:red;'>Please enter exactly 3 values. Leave the target field empty.</span>";
                return;
            }

            // 4. 계산 로직 (기본 단위 M, L로 변환 후 계산)
            let resultHTML = "";

            if (isNaN_m1) {
                // Calculate M1 = (M2 * V2) / V1
                const calcM1_Base = (m2Val * m2Unit * v2Val * v2Unit) / (v1Val * v1Unit);
                const finalM1 = calcM1_Base / m1Unit; // 사용자가 선택한 단위로 변환
                resultHTML = `Required Stock Conc (M₁): <strong>${finalM1.toPrecision(4)} ${m1Text}</strong>`;
            } 
            else if (isNaN_v1) {
                // Calculate V1 = (M2 * V2) / M1
                const calcV1_Base = (m2Val * m2Unit * v2Val * v2Unit) / (m1Val * m1Unit);
                const finalV1 = calcV1_Base / v1Unit;
                
                // V1을 구할 때는 Solvent(용매) 양도 알려주면 친절함 (단, 단위가 같을 때만 계산)
                let solventText = "";
                // 같은 부피 단위일 때만 뺄셈 표시 (예: 둘 다 mL)
                if (document.getElementById('v1-unit').value === document.getElementById('v2-unit').value) {
                    const solventVol = v2Val - finalV1;
                    solventText = `<br><span style="font-size:0.9em; color:#555;">(Add <strong>${finalV1.toPrecision(4)} ${v1Text}</strong> of Stock + <strong>${solventVol.toPrecision(4)} ${v1Text}</strong> of Solvent)</span>`;
                }

                resultHTML = `Required Stock Vol (V₁): <strong>${finalV1.toPrecision(4)} ${v1Text}</strong>${solventText}`;
            } 
            else if (isNaN_m2) {
                // Calculate M2 = (M1 * V1) / V2
                const calcM2_Base = (m1Val * m1Unit * v1Val * v1Unit) / (v2Val * v2Unit);
                const finalM2 = calcM2_Base / m2Unit;
                resultHTML = `Final Concentration (M₂): <strong>${finalM2.toPrecision(4)} ${m2Text}</strong>`;
            } 
            else if (isNaN_v2) {
                // Calculate V2 = (M1 * V1) / M2
                const calcV2_Base = (m1Val * m1Unit * v1Val * v1Unit) / (m2Val * m2Unit);
                const finalV2 = calcV2_Base / v2Unit;
                resultHTML = `Final Volume (V₂): <strong>${finalV2.toPrecision(4)} ${v2Text}</strong>`;
            }

            resDiv.innerHTML = `<div style="font-size: 1rem; color: #1f2937;">${resultHTML}</div>`;
        });
    }
});