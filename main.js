document.addEventListener('DOMContentLoaded', () => {

    // --- Tab Navigation ---
    const navButtons = document.querySelectorAll('nav button');
    const calculators = document.querySelectorAll('.calculator');

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Deactivate all buttons and calculators
            navButtons.forEach(btn => btn.classList.remove('active'));
            calculators.forEach(calc => calc.classList.remove('active'));

            // Activate the clicked one
            button.classList.add('active');
            const target = document.getElementById(button.id.replace('show-', ''));
            if (target) {
                target.classList.add('active');
            } else if (button.id === 'show-mass-calc') {
                 document.getElementById('mass-calculator').classList.add('active');
            } else if (button.id === 'show-outlier-check') {
                 document.getElementById('outlier-checker').classList.add('active');
            } else if (button.id === 'show-hed-calc') {
                 document.getElementById('hed-calculator').classList.add('active');
            }
        });
    });
    
    // --- Molar Mass Calculator ---
    const massCalcButton = document.getElementById('calculate-mass');
    if(massCalcButton) {
        massCalcButton.addEventListener('click', () => {
            const mass = document.getElementById('mass');
            const concentration = document.getElementById('concentration');
            const volume = document.getElementById('volume');
            const mw = document.getElementById('mw');

            const inputs = [mass, concentration, volume, mw];
            const emptyInputs = inputs.filter(i => i.value === '');

            if (emptyInputs.length !== 1) {
                document.getElementById('mass-result').innerText = '오류: 네 개의 값 중 하나만 비워두세요.';
                return;
            }

            try {
                const massVal = mass.value ? convertMassToBase(parseFloat(mass.value), document.getElementById('mass-unit').value) : null;
                const concVal = concentration.value ? convertConcToBase(parseFloat(concentration.value), document.getElementById('concentration-unit').value) : null;
                const volVal = volume.value ? convertVolumeToBase(parseFloat(volume.value), document.getElementById('volume-unit').value) : null;
                const mwVal = mw.value ? parseFloat(mw.value) : null;

                const targetInput = emptyInputs[0];
                let result;

                if (targetInput.id === 'mass') {
                    result = concVal * volVal * mwVal;
                    document.getElementById('mass').value = convertMassFromBase(result, document.getElementById('mass-unit').value).toPrecision(4);
                } else if (targetInput.id === 'concentration') {
                    result = massVal / (volVal * mwVal);
                    document.getElementById('concentration').value = convertConcFromBase(result, document.getElementById('concentration-unit').value).toPrecision(4);
                } else if (targetInput.id === 'volume') {
                    result = massVal / (concVal * mwVal);
                    document.getElementById('volume').value = convertVolumeFromBase(result, document.getElementById('volume-unit').value).toPrecision(4);
                } else if (targetInput.id === 'mw') {
                    result = massVal / (concVal * volVal);
                    document.getElementById('mw').value = result.toPrecision(4);
                }
                document.getElementById('mass-result').innerText = '계산 완료! 빈 칸이 채워졌습니다.';

            } catch (e) {
                document.getElementById('mass-result').innerText = `오류: 잘못된 입력값이 있습니다. 
${e}`;
            }
        });
    }


    const massUnits = { 'g': 1, 'mg': 1e-3, 'ug': 1e-6, 'ng': 1e-9, 'pg': 1e-12 };
    const concUnits = { 'M': 1, 'mM': 1e-3, 'uM': 1e-6, 'nM': 1e-9, 'pM': 1e-12 };
    const volUnits = { 'L': 1, 'mL': 1e-3, 'uL': 1e-6 };

    const convertMassToBase = (val, unit) => val * massUnits[unit];
    const convertConcToBase = (val, unit) => val * concUnits[unit];
    const convertVolumeToBase = (val, unit) => val * volUnits[unit];

    const convertMassFromBase = (val, unit) => val / massUnits[unit];
    const convertConcFromBase = (val, unit) => val / concUnits[unit];
    const convertVolumeFromBase = (val, unit) => val / volUnits[unit];


    // --- Outlier Detector ---
    const outlierCheckButton = document.getElementById('check-outliers');
    if(outlierCheckButton){
        outlierCheckButton.addEventListener('click', () => {
            const dataStr = document.getElementById('outlier-data').value;
            const data = dataStr.split(/[\\s,]+/).filter(d => d !== '').map(Number).filter(n => !isNaN(n));
    
            if (data.length < 4) {
                document.getElementById('outlier-result').innerText = '오류: 최소 4개 이상의 데이터가 필요합니다.';
                return;
            }
    
            const sortedData = [...data].sort((a, b) => a - b);
            const n = sortedData.length;
            const mean = sortedData.reduce((a, b) => a + b) / n;
            const stdDev = Math.sqrt(sortedData.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n);
            
            // Simple normality check using skewness and kurtosis
            const m = median(sortedData);
            const skewness = (3 * (mean - m)) / stdDev;
            const kurtosis = (n * (n + 1) / ((n - 1) * (n - 2) * (n - 3))) * sortedData.reduce((s, x) => s + Math.pow((x - mean) / stdDev, 4), 0) - (3 * Math.pow(n - 1, 2) / ((n - 2) * (n - 3)));

            
            let resultText = '';
            // A very basic check. For real applications, a proper test like Shapiro-Wilk is better.
            if (Math.abs(skewness) < 0.5 && Math.abs(kurtosis) < 0.5) {
                resultText += '데이터가 정규분포를 따르는 것으로 보입니다.\nZ-score 방법을 사용합니다.\n';
                const zScoreThreshold = 3;
                const outliers = data.filter(d => Math.abs((d - mean) / stdDev) > zScoreThreshold);
                resultText += `Outlier 기준: |Z-score| > ${zScoreThreshold}\n`;
                resultText += `Outlier 값: ${outliers.length > 0 ? outliers.join(', ') : '없음'}`;
            } else {
                resultText += '데이터가 정규분포를 따르지 않는 것으로 보입니다.\nIQR 방법을 사용합니다.\n';
                const q1 = quantile(sortedData, 0.25);
                const q3 = quantile(sortedData, 0.75);
                const iqr = q3 - q1;
                const lowerBound = q1 - 1.5 * iqr;
                const upperBound = q3 + 1.5 * iqr;
                const outliers = data.filter(d => d < lowerBound || d > upperBound);
    
                resultText += `IQR: ${iqr.toFixed(3)}, Q1: ${q1.toFixed(3)}, Q3: ${q3.toFixed(3)}\n`;
                resultText += `Outlier 기준: 값 < ${lowerBound.toFixed(3)} 또는 값 > ${upperBound.toFixed(3)}\n`;
                resultText += `Outlier 값: ${outliers.length > 0 ? outliers.join(', ') : '없음'}`;
            }
            document.getElementById('outlier-result').innerText = resultText;
        });
    }

    const median = (arr) => {
        const mid = Math.floor(arr.length / 2);
        const nums = [...arr].sort((a, b) => a - b);
        return arr.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
    };

    const quantile = (arr, q) => {
        const pos = (arr.length - 1) * q;
        const base = Math.floor(pos);
        const rest = pos - base;
        if (arr[base + 1] !== undefined) {
            return arr[base] + rest * (arr[base + 1] - arr[base]);
        } else {
            return arr[base];
        }
    };


    // --- HED Calculator ---
    const hedCalcButton = document.getElementById('calculate-hed');
    if(hedCalcButton){
        hedCalcButton.addEventListener('click', () => {
            const kmFactors = {
                'Mouse': 3, 'Rat': 6, 'Hamster': 5, 'Gerbil': 5, 'Guinea Pig': 8,
                'Rabbit': 12, 'Dog': 20, 'Monkey': 12, 'Minipig': 12, 'Pig': 18, 'Human': 37
            };
    
            const speciesA = document.getElementById('species-a').value;
            const doseA = parseFloat(document.getElementById('dose-a').value);
            const doseAUnit = document.getElementById('dose-a-unit').value;
            const weightA = parseFloat(document.getElementById('weight-a').value);
            const weightAUnit = document.getElementById('weight-a-unit').value;
    
            const speciesB = document.getElementById('species-b').value;
            const weightB = parseFloat(document.getElementById('weight-b').value);
            const weightBUnit = document.getElementById('weight-b-unit').value;
    
            if (isNaN(doseA) || isNaN(weightA) || isNaN(weightB)) {
                document.getElementById('hed-result').innerText = '오류: 모든 값을 올바르게 입력해주세요.';
                return;
            }
    
            // Convert everything to base units (mg, kg)
            const doseA_mg = doseA * (doseAUnit === 'g' ? 1000 : 1);
            const weightA_kg = weightA * (weightAUnit === 'g' ? 0.001 : 1);
            const weightB_kg = weightB * (weightBUnit === 'g' ? 0.001 : 1);
    
            // Calculate mg/kg dose for species A
            const doseA_mg_per_kg = doseA_mg / weightA_kg;
    
            // Get Km factors
            const kmA = kmFactors[speciesA];
            const kmB = kmFactors[speciesB];
    
            // Calculate equivalent dose in mg/kg for species B
            const doseB_mg_per_kg = doseA_mg_per_kg * (kmA / kmB);
    
            // Calculate final dose amount for species B
            const finalDoseB = doseB_mg_per_kg * weightB_kg;
    
            document.getElementById('hed-result').innerText = 
                `종 B (${speciesB})의 해당 섭취량은 ${finalDoseB.toPrecision(4)} mg 입니다. (mg/kg 기준: ${doseB_mg_per_kg.toPrecision(4)} mg/kg)`;
        });
    }
});
