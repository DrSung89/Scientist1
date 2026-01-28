// --- Tab Navigation ---
const tabs = document.querySelectorAll('nav button');
const sections = document.querySelectorAll('.calculator');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active'));
        
        tab.classList.add('active');
        const targetId = tab.id.replace('show-', '') + (tab.id.includes('mass') ? '-calculator' : (tab.id.includes('outlier') ? '-checker' : '-calculator'));
        document.getElementById(targetId).classList.add('active');
    });
});

// --- 1. Mass Calculator ---
const units = {
    mass: { g: 1, mg: 1e-3, ug: 1e-6, ng: 1e-9, pg: 1e-12 },
    conc: { M: 1, mM: 1e-3, uM: 1e-6, nM: 1e-9, pM: 1e-12 },
    vol: { L: 1, mL: 1e-3, uL: 1e-6 }
};

document.getElementById('calculate-mass').addEventListener('click', () => {
    const mass = parseFloat(document.getElementById('mass').value);
    const conc = parseFloat(document.getElementById('concentration').value);
    const vol = parseFloat(document.getElementById('volume').value);
    const mw = parseFloat(document.getElementById('mw').value);

    const massUnit = units.mass[document.getElementById('mass-unit').value];
    const concUnit = units.conc[document.getElementById('concentration-unit').value];
    const volUnit = units.vol[document.getElementById('volume-unit').value];

    const resultDiv = document.getElementById('mass-result');

    // Logic: Standardize everything to g, L, mol
    // Formula: Mass(g) = Conc(mol/L) * Vol(L) * MW(g/mol)
    
    let resultText = "";

    if (!isNaN(conc) && !isNaN(vol) && !isNaN(mw) && isNaN(mass)) {
        // Calculate Mass
        const calculatedMassG = (conc * concUnit) * (vol * volUnit) * mw;
        const finalMass = calculatedMassG / massUnit;
        resultText = `Calculated Mass: <strong>${finalMass.toExponential(4)}</strong> ${document.getElementById('mass-unit').value}`;
    } else if (!isNaN(mass) && !isNaN(vol) && !isNaN(mw) && isNaN(conc)) {
        // Calculate Concentration
        const massG = mass * massUnit;
        const calculatedConcM = massG / (mw * (vol * volUnit));
        const finalConc = calculatedConcM / concUnit;
        resultText = `Calculated Concentration: <strong>${finalConc.toExponential(4)}</strong> ${document.getElementById('concentration-unit').value}`;
    } else if (!isNaN(mass) && !isNaN(conc) && !isNaN(mw) && isNaN(vol)) {
        // Calculate Volume
        const massG = mass * massUnit;
        const calculatedVolL = massG / (mw * (conc * concUnit));
        const finalVol = calculatedVolL / volUnit;
        resultText = `Calculated Volume: <strong>${finalVol.toExponential(4)}</strong> ${document.getElementById('volume-unit').value}`;
    } else if (!isNaN(mass) && !isNaN(conc) && !isNaN(vol) && isNaN(mw)) {
        // Calculate MW
        const massG = mass * massUnit;
        const calculatedMW = massG / ((conc * concUnit) * (vol * volUnit));
        resultText = `Calculated MW: <strong>${calculatedMW.toFixed(2)}</strong> g/mol`;
    } else {
        resultText = "Please enter exactly 3 values to calculate the 4th.";
    }

    resultDiv.innerHTML = resultText;
});

// --- 2. Outlier & Normality Checker ---
document.getElementById('check-outliers').addEventListener('click', () => {
    const rawInput = document.getElementById('outlier-data').value;
    
    // Explicitly split by comma, then map to number
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

    // Basic Stats
    const n = data.length;
    const mean = data.reduce((a, b) => a + b, 0) / n;
    const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
    const stdev = Math.sqrt(variance);

    // IQR Method for Outliers
    const q1 = data[Math.floor((n - 1) / 4)];
    const q3 = data[Math.floor((n - 1) * 3 / 4)];
    const iqr = q3 - q1;
    const lowerFence = q1 - 1.5 * iqr;
    const upperFence = q3 + 1.5 * iqr;
    const outliers = data.filter(x => x < lowerFence || x > upperFence);

    // Skewness Calculation (Fisher-Pearson coefficient of skewness)
    // g1 = [n / ((n-1)(n-2))] * sum((xi - mean)^3) / s^3
    let skewness = 0;
    if (n > 2 && stdev > 0) {
        const sumCubedDev = data.reduce((a, b) => a + Math.pow(b - mean, 3), 0);
        skewness = (n * sumCubedDev) / ((n - 1) * (n - 2) * Math.pow(stdev, 3));
    }

    // Normality Check (Simplified based on Skewness Z-score)
    // Standard Error of Skewness (SES) ~ sqrt(6/n) for large n, but using exact formula:
    const ses = Math.sqrt((6 * n * (n - 1)) / ((n - 2) * (n + 1) * (n + 3)));
    const zSkew = skewness / ses;
    
    // Approx P-value from Z-score (2-tailed)
    // Using an approximation for standard normal cumulative distribution function
    const pValueApprox = 2 * (1 - normalcdf(Math.abs(zSkew)));

    let shapeDesc = "";
    if (Math.abs(skewness) < 0.5) shapeDesc = "Fairly Symmetrical";
    else if (Math.abs(skewness) < 1) shapeDesc = "Moderately Skewed";
    else shapeDesc = "Highly Skewed";

    let normalityText = "";
    if (pValueApprox > 0.05) {
        normalityText = `<span style='color:green;'>Potentially Symmetrical (Approx. p=${pValueApprox.toFixed(3)})</span>`;
    } else {
        normalityText = `<span style='color:orange;'>Significant Skewness (Approx. p=${pValueApprox.toFixed(3)})</span>`;
    }

    resultDiv.innerHTML = `
        <strong>Data Count:</strong> ${n}<br>
        <strong>Mean:</strong> ${mean.toFixed(4)} ± ${stdev.toFixed(4)} (SD)<br>
        <hr>
        <strong>Outlier Detection (IQR Method):</strong><br>
        Detected Outliers: ${outliers.length > 0 ? `<span style='color:red;'>${outliers.join(', ')}</span>` : "None"}<br>
        <small>(Fence: ${lowerFence.toFixed(2)} ~ ${upperFence.toFixed(2)})</small><br>
        <hr>
        <strong>Normality / Shape:</strong><br>
        Skewness: ${skewness.toFixed(4)} (${shapeDesc})<br>
        Result: ${normalityText}
    `;
});

// Helper for p-value approximation
function normalcdf(X){   // Hasting's approximation
    var T = 1 / (1 + .2316419 * Math.abs(X));
    var D = .3989423 * Math.exp(-X * X / 2);
    var Prob = D * T * (.3193815 + T * (-.3565638 + T * (1.781478 + T * (-1.821256 + T * 1.330274))));
    if (X > 0) Prob = 1 - Prob;
    return Prob;
}


// --- 3. HED Calculator ---
// Km Factors (FDA Guidance)
const kmFactors = {
    "Mouse": 3,
    "Hamster": 5,
    "Rat": 6,
    "Ferret": 7,
    "Guinea Pig": 8,
    "Rabbit": 12,
    "Dog": 20,
    "Monkey": 12, // Cynomolgus/Rhesus
    "Marmoset": 6, 
    "Squirrel Monkey": 7,
    "Baboon": 20,
    "Micro Pig": 27, // Approx
    "Mini Pig": 35,
    "Human": 37
};

document.getElementById('calculate-hed').addEventListener('click', () => {
    const speciesA = document.getElementById('species-a').value;
    const doseA = parseFloat(document.getElementById('dose-a').value);
    
    const speciesB = document.getElementById('species-b').value;
    const weightB = parseFloat(document.getElementById('weight-b').value);
    const weightBUnit = document.getElementById('weight-b-unit').value;

    const resultDiv = document.getElementById('hed-result');

    if (isNaN(doseA)) {
        resultDiv.innerHTML = "<span style='color:red;'>Please enter the dose for Species A.</span>";
        return;
    }

    const kmA = kmFactors[speciesA] || 37; // Default to Human if missing
    const kmB = kmFactors[speciesB] || 37;

    // HED Formula: DoseB (mg/kg) = DoseA (mg/kg) * (KmA / KmB)
    const doseB_mg_kg = doseA * (kmA / kmB);

    let finalCalculation = "";
    
    // If user provided weight for Species B, calculate total absolute dose
    if (!isNaN(weightB)) {
        const weightB_kg = weightBUnit === 'kg' ? weightB : weightB / 1000;
        const totalDose = doseB_mg_kg * weightB_kg;
        
        finalCalculation = `
            <br><strong>Total Absolute Dose for ${speciesB}:</strong><br>
            ${totalDose.toFixed(4)} mg (for ${weightB_kg} kg body weight)
        `;
    }

    resultDiv.innerHTML = `
        <strong>Conversion (${speciesA} → ${speciesB}):</strong><br>
        Factor: ${speciesA} (Km=${kmA}) / ${speciesB} (Km=${kmB})<br>
        <br>
        <strong>Equivalent Dose:</strong><br>
        <span style="font-size: 1.2em; color: var(--primary-color);">
            ${doseB_mg_kg.toFixed(4)} mg/kg
        </span>
        ${finalCalculation}
    `;
});