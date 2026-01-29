document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------
    // 1. 네비게이션 및 화면 전환 로직
    // ----------------------------------------------------
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.calculator');

    const seoData = {
        'molarity-calc': { title: "Molarity Calculator | Scientist's Toolkit", desc: "Professional molarity calculator.", url: "https://scientisttoolkit.xyz/molarity-calc" },
        'outlier-checker': { title: "Outlier Checker | Scientist's Toolkit", desc: "Identify data outliers using IQR.", url: "https://scientisttoolkit.xyz/outlier-checker" },
        'hed-calculator': { title: "HED Calculator | Scientist's Toolkit", desc: "Convert animal doses to HED.", url: "https://scientisttoolkit.xyz/hed-calculator" },
        'help-section': { title: "Help & Info | Scientist's Toolkit", desc: "User guide and references.", url: "https://scientisttoolkit.xyz/help-section" },
        'comments-section': { title: "Comments | Scientist's Toolkit", desc: "Feedback and inquiries.", url: "https://scientisttoolkit.xyz/comments-section" }
    };

    function loadDisqus() {
        if (typeof DISQUS !== 'undefined') {
            DISQUS.reset({
                reload: true,
                config: function () {
                    this.page.url = 'https://scientisttoolkit.xyz/comments-section';
                    this.page.identifier = 'comments-section';
                }
            });
        } else {
            var d = document, s = d.createElement('script');
            s.src = 'https://scientisttoolkit.disqus.com/embed.js';
            s.setAttribute('data-timestamp', +new Date());
            (d.head || d.body).appendChild(s);
        }
    }

    function showSection(targetId, updateHistory = true) {
        navButtons.forEach(btn => btn.classList.remove('active'));
        sections.forEach(sec => sec.classList.remove('active'));

        const targetSection = document.getElementById(targetId);
        const targetBtn = document.querySelector(`[data-target="${targetId}"]`);

        if (targetSection && targetBtn) {
            targetSection.classList.add('active');
            targetBtn.classList.add('active');

            const data = seoData[targetId];
            if (data) {
                document.title = data.title;
            }

            if (targetId === 'comments-section') {
                setTimeout(loadDisqus, 100);
            }

            if (updateHistory) {
                window.history.pushState({ targetId: targetId }, '', '/' + targetId);
            }
        }
    }

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            showSection(button.getAttribute('data-target'));
        });
    });

    window.addEventListener('popstate', (e) => {
        const id = (e.state && e.state.targetId) ? e.state.targetId : 'molarity-calc';
        showSection(id, false);
    });

    // 초기 접속 처리
    const urlPath = window.location.pathname.replace('/', '');
    const urlParams = new URLSearchParams(window.location.search);
    const redirectPath = urlParams.get('p') ? urlParams.get('p').replace('/', '') : urlPath;
    const finalPath = (redirectPath && document.getElementById(redirectPath)) ? redirectPath : 'molarity-calc';
    showSection(finalPath, false);


    // ----------------------------------------------------
    // 2. Molarity Calculator 로직
    // ----------------------------------------------------
    const massCalcButton = document.getElementById('calculate-mass');
    if (massCalcButton) {
        massCalcButton.addEventListener('click', () => {
            // 입력값 가져오기
            const massVal = parseFloat(document.getElementById('mass').value);
            const concVal = parseFloat(document.getElementById('concentration').value);
            const volVal = parseFloat(document.getElementById('volume').value);
            const mwVal = parseFloat(document.getElementById('mw').value);

            // 단위 변환 계수
            const mUnits = { g: 1, mg: 1e-3, ug: 1e-6, ng: 1e-9, pg: 1e-12 };
            const cUnits = { M: 1, mM: 1e-3, uM: 1e-6, nM: 1e-9, pM: 1e-12 };
            const vUnits = { L: 1, mL: 1e-3, uL: 1e-6 };

            const mUnit = mUnits[document.getElementById('mass-unit').value];
            const cUnit = cUnits[document.getElementById('concentration-unit').value];
            const vUnit = vUnits[document.getElementById('volume-unit').value];

            const resultDiv = document.getElementById('mass-result');

            // 계산 로직 (빈칸 찾아서 계산)
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
    // 3. Outlier Checker 로직
    // ----------------------------------------------------
    const outlierButton = document.getElementById('check-outliers');
    if (outlierButton) {
        outlierButton.addEventListener('click', () => {
            const rawData = document.getElementById('outlier-data').value;
            const data = rawData.split(',').map(s => s.trim()).filter(s => s !== '' && !isNaN(s)).map(Number).sort((a,b)=>a-b);
            const resDiv = document.getElementById('outlier-result');
            
            if (data.length < 3) {
                resDiv.innerHTML = "<span style='color:red;'>Error: Need at least 3 numbers.</span>";
                return;
            }

            const n = data.length;
            const mean = data.reduce((a, b) => a + b, 0) / n;
            const stdev = Math.sqrt(data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1));
            const q1 = data[Math.floor((n - 1) / 4)];
            const q3 = data[Math.floor((n - 1) * 3 / 4)];
            const iqr = q3 - q1;
            const outliers = data.filter(x => x < q1 - 1.5 * iqr || x > q3 + 1.5 * iqr);

            resDiv.innerHTML = `<strong>Results:</strong><br>Mean: ${mean.toFixed(2)}<br>SD: ${stdev.toFixed(2)}<br><br><strong>Outliers:</strong> ${outliers.length > 0 ? `<span style='color:red; font-weight:bold;'>${outliers.join(', ')}</span>` : "None"}`;
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

            if(isNaN(dA)) { 
                resDiv.innerHTML = "<span style='color:red;'>Error: Please enter a valid Dose.</span>"; 
                return; 
            }

            const doseB = dA * (kmFactors[sA] / kmFactors[sB]);
            let absDoseText = "";
            
            if(!isNaN(wB)) {
                const wbkg = unitB === 'kg' ? wB : wB / 1000;
                absDoseText = `<br><br><strong>Absolute Dose for ${sB} (${wbkg}kg):</strong><br>${(doseB * wbkg).toFixed(4)} mg`;
            }

            resDiv.innerHTML = `Equivalent Dose for <strong>${sB}</strong>:<br><span style="color:blue; font-size:1.2em; font-weight:bold;">${doseB.toFixed(4)} mg/kg</span>${absDoseText}`;
        });
    }
});