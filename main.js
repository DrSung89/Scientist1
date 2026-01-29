document.addEventListener('DOMContentLoaded', () => {
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.calculator');

    // SEO 데이터
    const seoData = {
        'molarity-calc': { title: "Molarity Calculator | Scientist's Toolkit", desc: "Professional molarity calculator.", url: "https://scientisttoolkit.xyz/molarity-calc" },
        'outlier-checker': { title: "Outlier Checker | Scientist's Toolkit", desc: "Identify data outliers using IQR.", url: "https://scientisttoolkit.xyz/outlier-checker" },
        'hed-calculator': { title: "HED Calculator | Scientist's Toolkit", desc: "Convert animal doses to HED.", url: "https://scientisttoolkit.xyz/hed-calculator" },
        'help-section': { title: "Help & Info | Scientist's Toolkit", desc: "User guide and references.", url: "https://scientisttoolkit.xyz/help-section" },
        'comments-section': { title: "Comments | Scientist's Toolkit", desc: "Feedback and inquiries.", url: "https://scientisttoolkit.xyz/comments-section" }
    };

    // Disqus 로딩 함수
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

    // 화면 전환 함수
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
                const meta = document.getElementById('meta-desc');
                if(meta) meta.setAttribute('content', data.desc);
            }

            // 댓글 탭일 때만 지연 로딩
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
            const targetId = button.getAttribute('data-target');
            showSection(targetId);
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

    // [계산기 기능]
    // 1. Molarity
    const mUnits = { mass: { g: 1, mg: 1e-3, ug: 1e-6, ng: 1e-9, pg: 1e-12 }, conc: { M: 1, mM: 1e-3, uM: 1e-6, nM: 1e-9, pM: 1e-12 }, vol: { L: 1, mL: 1e-3, uL: 1e-6 } };
    const massCalcButton = document.getElementById('calculate-mass');
    if (massCalcButton) {
        massCalcButton.addEventListener('click', () => {
            const massVal = parseFloat(document.getElementById('mass').value);
            const concVal = parseFloat(document.getElementById('concentration').value);
            const volVal = parseFloat(document.getElementById('volume').value);
            const mwVal = parseFloat(document.getElementById('mw').value);
            const mUnit = mUnits.mass[document.getElementById('mass-unit').value];
            const cUnit = mUnits.conc[document.getElementById('concentration-unit').value];
            const vUnit = mUnits.vol[document.getElementById('volume-unit').value];
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
            } else { resultDiv.innerHTML = "<span style='color:red;'>Please enter exactly 3 values.</span>"; }
        });
    }

    // 2. Outlier
    const outlierButton = document.getElementById('check-outliers');
    if (outlierButton) {
        outlierButton.addEventListener('click', () => {
            const data = document.getElementById('outlier-data').value.split(',').map(s => s.trim()).filter(s => s !== '' && !isNaN(s)).map(Number).sort((a,b)=>a-b);
            const resDiv = document.getElementById('outlier-result');
            if (data.length < 3) { resDiv.innerHTML = "Error: Need at least 3 points."; return; }
            const n = data.length, mean = data.reduce((a, b) => a + b, 0) / n;
            const stdev = Math.sqrt(data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1));
            const q1 = data[Math.floor((n - 1) / 4)], q3 = data[Math.floor((n - 1) * 3 / 4)], iqr = q3 - q1;
            const outliers = data.filter(x => x < q1 - 1.5 * iqr || x > q3 + 1.5 * iqr);
            resDiv.innerHTML = `Mean=${mean.toFixed(2)}, SD=${stdev.toFixed(2)}<br>Outliers: ${outliers.length > 0 ? `<span style='color:red;'>${outliers.join(', ')}</span>` : "None"}`;
        });
    }

    // 3. HED
    const kmFactors = { "Mouse": 3, "Hamster": 5, "Rat": 6, "Ferret": 7, "Guinea Pig": 8, "Rabbit": 12, "Dog": 20, "Monkey": 12, "Human": 37 };
    const hedButton = document.getElementById('calculate-hed');
    if (hedButton) {
        hedButton.addEventListener('click', () => {
            const sA = document.getElementById('species-a').value, dA = parseFloat(document.getElementById('dose-a').value);
            const sB = document.getElementById('species-b').value, wB = parseFloat(document.getElementById('weight-b').value);
            const resDiv = document.getElementById('hed-result');
            if(isNaN(dA)) { resDiv.innerHTML = "Error: Enter dose."; return; }
            const doseB = dA * (kmFactors[sA] / kmFactors[sB]);
            resDiv.innerHTML = `Equivalent Dose (${sB}): <strong>${doseB.toFixed(4)} mg/kg</strong>`;
        });
    }
});