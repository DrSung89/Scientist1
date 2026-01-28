document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. Tab Navigation (페이지 전환 기능 수정됨)
    // ==========================================
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.calculator');

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 1. 모든 버튼과 섹션 비활성화
            navButtons.forEach(btn => btn.classList.remove('active'));
            sections.forEach(sec => sec.classList.remove('active'));

            // 2. 클릭한 버튼 활성화
            button.classList.add('active');

            // 3. data-target 속성을 이용해 해당 섹션 활성화
            const targetId = button.getAttribute('data-target');
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add('active');
            }
        });
    });

// ==========================================
    // 2. Molarity Calculator (분자량 계산기)
    // ==========================================
    const massCalcButton = document.getElementById('calculate-mass');
    
    // 단위 변환 상수
    const units = {
        mass: { g: 1, mg: 1e-3, ug: 1e-6, ng: 1e-9, pg: 1e-12 },
        conc: { M: 1, mM: 1e-3, uM: 1e-6, nM: 1e-9, pM: 1e-12 },
        vol: { L: 1, mL: 1e-3, uL: 1e-6 }
    };

    if (massCalcButton) {
        massCalcButton.addEventListener('click', () => {
            const massInput = document.getElementById('mass');
            const concInput = document.getElementById('concentration');
            const volInput = document.getElementById('volume');
            const mwInput = document.getElementById('mw');

            const massVal = parseFloat(massInput.value);
            const concVal = parseFloat(concInput.value);
            const volVal = parseFloat(volInput.value);
            const mwVal = parseFloat(mwInput.value);

            const massUnit = units.mass[document.getElementById('mass-unit').value];
            const concUnit = units.conc[document.getElementById('concentration-unit').value];
            const volUnit = units.vol[document.getElementById('volume-unit').value];

            const resultDiv = document.getElementById('mass-result');
            let resultText = "";

            // 로직: 3개가 입력되고 1개가 비어있을 때 나머지 하나를 계산
            // 공식: Mass(g) = Conc(mol/L) * Vol(L) * MW(g/mol)

            if (!isNaN(concVal) && !isNaN(volVal) && !isNaN(mwVal) && isNaN(massVal)) {
                // Mass 계산
                const calculatedMassG = (concVal * concUnit) * (volVal * volUnit) * mwVal;
                const finalMass = calculatedMassG / massUnit;
                // 수정됨: toExponential(4) -> toFixed(1)
                resultText = `Calculated Mass: <strong>${finalMass.toFixed(1)}</strong> ${document.getElementById('mass-unit').value}`;
            } else if (!isNaN(massVal) && !isNaN(volVal) && !isNaN(mwVal) && isNaN(concVal)) {
                // Concentration 계산
                const massG = massVal * massUnit;
                const calculatedConcM = massG / (mwVal * (volVal * volUnit));
                const finalConc = calculatedConcM / concUnit;
                // 수정됨: toExponential(4) -> toFixed(1)
                resultText = `Calculated Concentration: <strong>${finalConc.toFixed(1)}</strong> ${document.getElementById('concentration-unit').value}`;
            } else if (!isNaN(massVal) && !isNaN(concVal) && !isNaN(mwVal) && isNaN(volVal)) {
                // Volume 계산
                const massG = massVal * massUnit;
                const calculatedVolL = massG / (mwVal * (concVal * concUnit));
                const finalVol = calculatedVolL / volUnit;
                // 수정됨: toExponential(4) -> toFixed(1)
                resultText = `Calculated Volume: <strong>${finalVol.toFixed(1)}</strong> ${document.getElementById('volume-unit').value}`;
            } else if (!isNaN(massVal) && !isNaN(concVal) && !isNaN(volVal) && isNaN(mwVal)) {
                // MW 계산
                const massG = massVal * massUnit;
                const calculatedMW = massG / ((concVal * concUnit) * (volVal * volUnit));
                // 수정됨: 통일성을 위해 여기도 toFixed(1)로 변경 (원래 toFixed(2)였음)
                resultText = `Calculated MW: <strong>${calculatedMW.toFixed(1)}</strong> g/mol`;
            } else {
                resultText = "<span style='color:red;'>Error: Please enter exactly 3 values.</span>";
            }

            resultDiv.innerHTML = resultText;
        });
    }
    // ==========================================
    // 3. Outlier Checker (이상치 & 정규성 검정)
    // ==========================================
    const outlierButton = document.getElementById('check-outliers');

    // 정규분포 누적확률 근사 함수 (P-value 계산용)
    function normalcdf(X) {
        var T = 1 / (1 + .2316419 * Math.abs(X));
        var D = .3989423 * Math.exp(-X * X / 2);
        var Prob = D * T * (.3193815 + T * (-.3565638 + T * (1.781478 + T * (-1.821256 + T * 1.330274))));
        if (X > 0) Prob = 1 - Prob;
        return Prob;
    }

    if (outlierButton) {
        outlierButton.addEventListener('click', () => {
            const rawInput = document.getElementById('outlier-data').value;
            
            // 쉼표(,)로 구분하여 배열 생성
            const data = rawInput.split(',')
                                .map(item => item.trim())
                                .filter(item => item !== '' && !isNaN(Number(item)))
                                .map(Number)
                                .sort((a, b) => a - b);

            const resultDiv = document.getElementById('outlier-result');

            if (data.length < 3) {
                resultDiv.innerHTML = "<span style='color:red;'>Error: Need at least 3 data points separated by commas.</span>";
                return;
            }

            // 기본 통계량
            const n = data.length;
            const mean = data.reduce((a, b) => a + b, 0) / n;
            const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
            const stdev = Math.sqrt(variance);

            // IQR 방식 Outlier
            const q1 = data[Math.floor((n - 1) / 4)];
            const q3 = data[Math.floor((n - 1) * 3 / 4)];
            const iqr = q3 - q1;
            const lowerFence = q1 - 1.5 * iqr;
            const upperFence = q3 + 1.5 * iqr;
            const outliers = data.filter(x => x < lowerFence || x > upperFence);

            // Skewness 계산 (Fisher-Pearson)
            let skewness = 0;
            if (n > 2 && stdev > 0) {
                const sumCubedDev = data.reduce((a, b) => a + Math.pow(b - mean, 3), 0);
                skewness = (n * sumCubedDev) / ((n - 1) * (n - 2) * Math.pow(stdev, 3));
            }

            // Normality Check (Skewness Z-score 기반)
            const ses = Math.sqrt((6 * n * (n - 1)) / ((n - 2) * (n + 1) * (n + 3))); // Standard Error of Skewness
            const zSkew = skewness / ses;
            const pValueApprox = 2 * (1 - normalcdf(Math.abs(zSkew))); // 2-tailed

            // 결과 텍스트 생성
            let shapeDesc = "";
            if (Math.abs(skewness) < 0.5) shapeDesc = "Fairly Symmetrical";
            else if (Math.abs(skewness) < 1) shapeDesc = "Moderately Skewed";
            else shapeDesc = "Highly Skewed";

            let normalityText = "";
            if (pValueApprox > 0.05) {
                normalityText = `<span style='color:green;'>Potentially Symmetrical (p=${pValueApprox.toFixed(3)})</span>`;
            } else {
                normalityText = `<span style='color:orange;'>Significant Skewness (p=${pValueApprox.toFixed(3)})</span>`;
            }

            resultDiv.innerHTML = `
                <strong>Statistics:</strong> N=${n}, Mean=${mean.toFixed(4)}, SD=${stdev.toFixed(4)}<br><br>
                <strong>Normality Check:</strong><br>
                Skewness: ${skewness.toFixed(4)} (${shapeDesc})<br>
                Result: ${normalityText}<br><br>
                <strong>Outlier Detection (IQR):</strong><br>
                Range: ${lowerFence.toFixed(2)} ~ ${upperFence.toFixed(2)}<br>
                Outliers: ${outliers.length > 0 ? `<span style='color:red;'>${outliers.join(', ')}</span>` : "None"}
            `;
        });
    }

    // ==========================================
    // 4. HED Calculator (인체 등가 용량 계산기)
    // ==========================================
    // FDA Guidance Km Factors
    const kmFactors = {
        "Mouse": 3, "Hamster": 5, "Rat": 6, "Ferret": 7, "Guinea Pig": 8,
        "Rabbit": 12, "Dog": 20, "Monkey": 12, "Marmoset": 6, 
        "Squirrel Monkey": 7, "Baboon": 20, "Micro Pig": 27, "Mini Pig": 35, "Human": 37
    };

    const hedButton = document.getElementById('calculate-hed');

    if (hedButton) {
        hedButton.addEventListener('click', () => {
            const speciesA = document.getElementById('species-a').value;
            const doseA = parseFloat(document.getElementById('dose-a').value); // mg/kg input
            
            const speciesB = document.getElementById('species-b').value;
            const weightB = parseFloat(document.getElementById('weight-b').value);
            const weightBUnit = document.getElementById('weight-b-unit').value;

            const resultDiv = document.getElementById('hed-result');

            if (isNaN(doseA)) {
                resultDiv.innerHTML = "<span style='color:red;'>Error: Please enter Dose (mg/kg) for Species A.</span>";
                return;
            }

            const kmA = kmFactors[speciesA] || 37;
            const kmB = kmFactors[speciesB] || 37;

            // 공식: HED (mg/kg) = Animal Dose (mg/kg) * (Animal Km / Human Km)
            const doseB_mg_kg = doseA * (kmA / kmB);

            let finalCalculation = "";
            
            // 종 B의 체중이 입력되었다면 절대 용량(mg) 계산
            if (!isNaN(weightB)) {
                const weightB_kg = weightBUnit === 'kg' ? weightB : weightB / 1000;
                const totalDose = doseB_mg_kg * weightB_kg;
                
                finalCalculation = `
                    <br><strong>Total Absolute Dose for ${speciesB}:</strong><br>
                    ${totalDose.toFixed(4)} mg (for ${weightB_kg} kg BW)
                `;
            }

            resultDiv.innerHTML = `
                <strong>Conversion Factors:</strong><br>
                ${speciesA} (Km=${kmA}) → ${speciesB} (Km=${kmB})<br><br>
                <strong>Equivalent Dose (${speciesB}):</strong><br>
                <span style="font-size: 1.2em; color: blue; font-weight:bold;">
                    ${doseB_mg_kg.toFixed(4)} mg/kg
                </span>
                ${finalCalculation}
            `;
        });
    }

});