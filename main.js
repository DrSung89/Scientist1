document.addEventListener('DOMContentLoaded', () => {
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.calculator');

    // 1. 각 페이지(탭)별 검색 엔진 최적화(SEO) 데이터 설정
    const seoData = {
        'mass-calculator': {
            title: "Molarity Calculator | Scientist's Toolkit",
            desc: "Calculate Mass, Concentration, Volume, and MW with unit conversions for your lab experiments.",
            url: "https://scientisttoolkit.xyz/"
        },
        'outlier-checker': {
            title: "Outlier Checker & Normality | Scientist's Toolkit",
            desc: "Identify data outliers using the IQR method and check normality with skewness Z-score analysis.",
            url: "https://scientisttoolkit.xyz/outlier-checker"
        },
        'hed-calculator': {
            title: "HED (Human Equivalent Dose) Calculator | Scientist's Toolkit",
            desc: "Convert animal doses to Human Equivalent Dose (HED) based on FDA BSA normalization guidelines.",
            url: "https://scientisttoolkit.xyz/hed-calculator"
        },
        'help-section': {
            title: "Help & References | Scientist's Toolkit",
            desc: "User guide and official FDA references for molarity, outlier detection, and HED calculation.",
            url: "https://scientisttoolkit.xyz/help-section"
        }
    };

    // 2. 섹션 전환 및 SEO 업데이트 함수
    function showSection(targetId, updateHistory = true) {
        // 모든 버튼과 섹션 비활성화
        navButtons.forEach(btn => btn.classList.remove('active'));
        sections.forEach(sec => sec.classList.remove('active'));

        const targetSection = document.getElementById(targetId);
        const targetBtn = document.querySelector(`[data-target="${targetId}"]`);

        if (targetSection && targetBtn) {
            targetSection.classList.add('active');
            targetBtn.classList.add('active');

            // --- [SEO 메타 태그 업데이트] ---
            const data = seoData[targetId];
            if (data) {
                document.title = data.title; // 브라우저 탭 제목
                if(document.getElementById('meta-desc')) document.getElementById('meta-desc').setAttribute('content', data.desc);
                if(document.getElementById('og-title')) document.getElementById('og-title').setAttribute('content', data.title);
                if(document.getElementById('og-desc')) document.getElementById('og-desc').setAttribute('content', data.desc);
                if(document.getElementById('og-url')) document.getElementById('og-url').setAttribute('content', data.url);
            }

            // URL 주소 업데이트 (새로고침 없이 경로만 변경)
            if (updateHistory) {
                const path = targetId === 'mass-calculator' ? '/' : '/' + targetId;
                history.pushState({ targetId }, '', path);
            }
        }
    }

    // 3. 네비게이션 클릭 이벤트 연결
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-target');
            showSection(targetId);
        });
    });

    // 4. 브라우저 뒤로가기/앞으로가기 버튼 대응
    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.targetId) {
            showSection(e.state.targetId, false);
        } else {
            showSection('mass-calculator', false);
        }
    });

    // 5. 초기 접속 경로 처리 (404 리다이렉트 대응)
    const urlPath = window.location.pathname.replace('/', '');
    const urlParams = new URLSearchParams(window.location.search);
    const redirectPath = urlParams.get('p'); // 404.html에서 p 파라미터로 보낸 경우

    const finalPath = redirectPath ? redirectPath.replace('/', '') : urlPath;

    if (finalPath && document.getElementById(finalPath)) {
        showSection(finalPath, false);
    } else {
        showSection('mass-calculator', false);
    }

    // ==========================================
    // 6. 계산기 로직 (수정된 소수점 표기 포함)
    // ==========================================

    // [Molarity Calculator]
    const massCalcButton = document.getElementById('calculate-mass');
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

            if (!isNaN(concVal) && !isNaN(volVal) && !isNaN(mwVal) && isNaN(massVal)) {
                const calculatedMassG = (concVal * concUnit) * (volVal * volUnit) * mwVal;
                resultText = `Calculated Mass: <strong>${(calculatedMassG / massUnit).toFixed(1)}</strong> ${document.getElementById('mass-unit').value}`;
            } else if (!isNaN(massVal) && !isNaN(volVal) && !isNaN(mwVal) && isNaN(concVal)) {
                const calculatedConcM = (massVal * massUnit) / (mwVal * (volVal * volUnit));
                resultText = `Calculated Concentration: <strong>${(calculatedConcM / concUnit).toFixed(1)}</strong> ${document.getElementById('concentration-unit').value}`;
            } else if (!isNaN(massVal) && !isNaN(concVal) && !isNaN(mwVal) && isNaN(volVal)) {
                const calculatedVolL = (massVal * massUnit) / (mwVal * (concVal * concUnit));
                resultText = `Calculated Volume: <strong>${(calculatedVolL / volUnit).toFixed(1)}</strong> ${document.getElementById('volume-unit').value}`;
            } else if (!isNaN(massVal) && !isNaN(concVal) && !isNaN(volVal) && isNaN(mwVal)) {
                const calculatedMW = (massVal * massUnit) / ((concVal * concUnit) * (volVal * volUnit));
                resultText = `Calculated MW: <strong>${calculatedMW.toFixed(1)}</strong> g/mol`;
            } else {
                resultText = "<span style='color:red;'>Error: Please enter exactly 3 values.</span>";
            }
            resultDiv.innerHTML = resultText;
        });
    }

    // [Outlier Checker]
    const outlierButton = document.getElementById('check-outliers');
    function normalcdf(X) {
        var T = 1 / (1 + .2316419 * Math.abs(X));
        var D = .3989423 * Math.exp(-X * X / 2);
        var Prob = D * T * (.3193815 + T * (-.3565638 + T * (1.781478 + T * (-1.821256 + T * 1.330274))));
        if (X > 0) Prob = 1 - Prob;
        return Prob;
    }

    if (outlierButton) {
        outlierButton.addEventListener('click', () => {
            const rawData = document.getElementById('outlier-data').value;
            const data = rawData.split(',').map(s => s.trim()).filter(s => s !== '' && !isNaN(s)).map(Number).sort((a,b)=>a-b);
            const resultDiv = document.getElementById('outlier-result');
            
            if (data.length < 3) {
                resultDiv.innerHTML = "<span style='color:red;'>Error: Need at least 3 points.</span>";
                return;
            }

            const n = data.length;
            const mean = data.reduce((a, b) => a + b, 0) / n;
            const stdev = Math.sqrt(data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1));
            const q1 = data[Math.floor((n - 1) / 4)];
            const q3 = data[Math.floor((n - 1) * 3 / 4)];
            const iqr = q3 - q1;
            const outliers = data.filter(x => x < q1 - 1.5 * iqr || x > q3 + 1.5 * iqr);

            resultDiv.innerHTML = `<strong>Statistics:</strong> Mean=${mean.toFixed(2)}, SD=${stdev.toFixed(2)}<br><strong>Outliers:</strong> ${outliers.length > 0 ? `<span style='color:red;'>${outliers.join(', ')}</span>` : "None"}`;
        });
    }

    // [HED Calculator]
    const kmFactors = { "Mouse": 3, "Hamster": 5, "Rat": 6, "Ferret": 7, "Guinea Pig": 8, "Rabbit": 12, "Dog": 20, "Monkey": 12, "Marmoset": 6, "Squirrel Monkey": 7, "Baboon": 20, "Micro Pig": 27, "Mini Pig": 35, "Human": 37 };
    const hedButton = document.getElementById('calculate-hed');
    
    if (hedButton) {
        hedButton.addEventListener('click', () => {
            const sA = document.getElementById('species-a').value;
            const dA = parseFloat(document.getElementById('dose-a').value);
            const sB = document.getElementById('species-b').value;
            const wB = parseFloat(document.getElementById('weight-b').value);
            const unitB = document.getElementById('weight-b-unit').value;
            const resDiv = document.getElementById('hed-result');

            if(isNaN(dA)) { resDiv.innerHTML = "<span style='color:red;'>Error: Enter dose.</span>"; return; }

            const doseB = dA * (kmFactors[sA] / kmFactors[sB]);
            let absDose = "";

            if(!isNaN(wB)) {
                const wbkg = unitB === 'kg' ? wB : wB / 1000;
                absDose = `<br><strong>Total Absolute Dose for ${sB}:</strong><br>${(doseB * wbkg).toFixed(4)} mg`;
            }
            resDiv.innerHTML = `<strong>Equivalent Dose (${sB}):</strong><br><span style="color:blue; font-weight:bold;">${doseB.toFixed(4)} mg/kg</span>${absDose}`;
        });
    }
});