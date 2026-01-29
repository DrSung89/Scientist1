document.addEventListener('DOMContentLoaded', () => {
    const navButtons = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.calculator');

    const seoData = {
        'molarity-calc': {
            title: "Molarity Calculator | Scientist's Toolkit",
            desc: "Professional molarity calculator. Calculate Mass, Concentration, and Volume.",
            url: "https://scientisttoolkit.xyz/molarity-calc"
        },
        'outlier-checker': {
            title: "Outlier Checker | Scientist's Toolkit",
            desc: "Identify data outliers using the IQR method and check normality.",
            url: "https://scientisttoolkit.xyz/outlier-checker"
        },
        'hed-calculator': {
            title: "HED Calculator | Scientist's Toolkit",
            desc: "Convert animal doses to Human Equivalent Dose (HED) based on FDA guidelines.",
            url: "https://scientisttoolkit.xyz/hed-calculator"
        },
        'help-section': {
            title: "Help & Info | Scientist's Toolkit",
            desc: "User guide and references for molarity, outlier detection, and HED.",
            url: "https://scientisttoolkit.xyz/help-section"
        },
        'comments-section': {
            title: "Comments | Scientist's Toolkit",
            desc: "Leave feedback and questions for the Scientist's Toolkit.",
            url: "https://scientisttoolkit.xyz/comments-section"
        }
    };

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

    const urlPath = window.location.pathname.replace('/', '');
    const urlParams = new URLSearchParams(window.location.search);
    const redirectPath = urlParams.get('p') ? urlParams.get('p').replace('/', '') : urlPath;

    if (!redirectPath || !document.getElementById(redirectPath)) {
        showSection('molarity-calc', true); 
    } else {
        showSection(redirectPath, false);
    }

    // [Molarity Calculator 로직]
    const massCalcButton = document.getElementById('calculate-mass');
    const mUnits = {
        mass: { g: 1, mg: 1e-3, ug: 1e-6, ng: 1e-9, pg: 1e-12 },
        conc: { M: 1, mM: 1e-3, uM: 1e-6, nM: 1e-9, pM: 1e-12 },
        vol: { L: 1, mL: 1e-3, uL: 1e-6 }
    };

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
            } else {
                resultDiv.innerHTML = "<span style='color:red;'>Please enter exactly 3 values.</span>";
            }
        });
    }

    // [Outlier Checker 로직]
    const outlierButton = document.getElementById('check-outliers');
    if (outlierButton) {
        outlierButton.addEventListener('click', () => {
            const rawData = document.getElementById('outlier-data').value;
            const data = rawData.split(',').map(s => s.trim()).filter(s => s !== '' && !isNaN(s)).map(Number).sort((a,b)=>a-b);
            const resDiv = document.getElementById('outlier-result');
            if (data.length < 3) { resDiv.innerHTML = "Need at least 3 points."; return; }
            const n = data.length;
            const mean = data.reduce((a, b) => a + b, 0) / n;
            const stdev = Math.sqrt(data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1));
            const q1 = data[Math.floor((n - 1) / 4)];
            const q3 = data[Math.floor((n - 1) * 3 / 4)];
            const iqr = q3 - q1;
            const outliers = data.filter(x => x < q1 - 1.5 * iqr || x > q3 + 1.5 * iqr);
            resDiv.innerHTML = `Mean=${mean.toFixed(2)}, SD=${stdev.toFixed(2)}<br>Outliers: ${outliers.length > 0 ? outliers.join(', ') : "None"}`;
        });
    }

    // [HED Calculator 로직]
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
            if(isNaN(dA)) { resDiv.innerHTML = "Enter dose."; return; }
            const doseB = dA * (kmFactors[sA] / kmFactors[sB]);
            let absDoseText = "";
            if(!isNaN(wB)) {
                const wbkg = unitB === 'kg' ? wB : wB / 1000;
                absDoseText = `<br>Absolute Dose: ${(doseB * wbkg).toFixed(4)} mg`;
            }
            resDiv.innerHTML = `Equivalent Dose: <strong>${doseB.toFixed(4)} mg/kg</strong>${absDoseText}`;
        });
    }

    // [Disqus 로딩]
    if (document.getElementById('disqus_thread')) {
        var d = document, s = d.createElement('script');
        s.src = 'https://scientisttoolkit.disqus.com/embed.js';
        s.setAttribute('data-timestamp', +new Date());
        (d.head || d.body).appendChild(s);
    }
});