document.addEventListener('DOMContentLoaded', () => {

    // =========================================================
    // 0. Firebase (에러 무시)
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
        if (typeof firebase !== 'undefined' && !firebase.apps.length) firebase.initializeApp(firebaseConfig);
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            const db = firebase.firestore();
            const countSpan = document.getElementById('visitor-count');
            if (countSpan) {
                const dateStr = (new Date(new Date() - new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                const docRef = db.collection('visitors').doc(dateStr);
                if (!sessionStorage.getItem(`visited_${dateStr}`)) {
                    docRef.set({ count: firebase.firestore.FieldValue.increment(1) }, { merge: true }).then(() => sessionStorage.setItem(`visited_${dateStr}`, 'true')).catch(()=>{});
                }
                docRef.onSnapshot((doc) => { if (doc.exists) countSpan.innerHTML = `Today's Visitors: <strong>${doc.data().count.toLocaleString()}</strong>`; });
            }
        }
    } catch (e) {}

    // ====================================================
    // 1. [핵심] 통계 로직 (D'Agostino-Pearson K-squared Test 수정 완료)
    // ====================================================
    const stat = {
        mean: d => d.reduce((a,b)=>a+b,0)/d.length,
        sd: (d, m) => Math.sqrt(d.reduce((a,b)=>a+Math.pow(b-m,2),0)/(d.length-1)),
        skewness: (d, m, s) => {
            const n = d.length;
            if (n < 3) return 0;
            let sum = 0; d.forEach(v => sum += Math.pow((v-m)/s, 3));
            return (n / ((n-1)*(n-2))) * sum;
        },
        kurtosis: (d, m, s) => {
            const n = d.length;
            if (n < 4) return 0;
            let sum = 0; d.forEach(v => sum += Math.pow((v-m)/s, 4));
            const part1 = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3));
            const part2 = sum;
            const part3 = (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
            return (part1 * part2) - part3;
        },
        percentile: (d, p) => {
            const sorted = [...d].sort((a,b)=>a-b);
            const pos = (sorted.length - 1) * p;
            const base = Math.floor(pos);
            const rest = pos - base;
            return sorted[base+1]!==undefined ? sorted[base]+rest*(sorted[base+1]-sorted[base]) : sorted[base];
        }
    };

    function chiSquareCDF(x, df) {
        if (typeof jStat !== 'undefined') return jStat.chisquare.cdf(x, df);
        return 1 - Math.exp(-x / 2); 
    }

    function testNormalityDP(data) {
        const n = data.length;
        // Do not fabricate a normality-test p-value for small samples.
        if (n < 8) return { p: null, reason: 'small-sample' };

        const mean = stat.mean(data);
        const sd = stat.sd(data, mean);
        if (sd === 0) return { p: 1 }; 
        
        // Z1 (왜도 변환)
        const g1 = stat.skewness(data, mean, sd);
        const y_skew = g1 * Math.sqrt(((n + 1) * (n + 3)) / (6 * (n - 2)));
        const beta2_skew = (3 * (n*n + 27*n - 70) * (n+1) * (n+3)) / ((n-2) * (n+5) * (n+7) * (n+9));
        const w2_skew = -1 + Math.sqrt(2 * (beta2_skew - 1));
        const delta_skew = 1 / Math.sqrt(0.5 * Math.log(w2_skew));
        const alpha_skew = Math.sqrt(2 / (w2_skew - 1));
        const z1 = delta_skew * Math.log(y_skew / alpha_skew + Math.sqrt(Math.pow(y_skew / alpha_skew, 2) + 1));

        // Z2 (첨도 변환)
        const g2 = stat.kurtosis(data, mean, sd);
        const mean_g2 = (-6 * (n - 1)) / ((n + 1) * (n + 3));
        const var_g2 = (24 * n * (n - 2) * (n - 3)) / (Math.pow(n + 1, 2) * (n + 3) * (n + 5));
        const x_kurt = (g2 - mean_g2) / Math.sqrt(var_g2);
        const root_beta1_kurt = (6 * (n*n - 5*n + 2)) / ((n + 7) * (n + 9)) * Math.sqrt((6 * (n + 3) * (n + 5)) / (n * (n - 2) * (n - 3)));
        const a_kurt = 6 + (8 / root_beta1_kurt) * (2 / root_beta1_kurt + Math.sqrt(1 + 4 / Math.pow(root_beta1_kurt, 2)));
        
        const W = 1 + x_kurt * Math.sqrt(2 / (a_kurt - 4));
        let z2 = 0;
        
        if (W > 0) {
            const term1 = 1 - 2 / (9 * a_kurt);
            const term2 = Math.cbrt((1 - 2 / a_kurt) / W); 
            z2 = Math.sqrt(9 * a_kurt / 2) * (term1 - term2);
        } else {
            z2 = 10; 
        }

        // K-squared 통계량 및 P-value
        const k2 = Math.pow(z1, 2) + Math.pow(z2, 2);
        let p = 1 - chiSquareCDF(k2, 2);
        
        if (!isFinite(p) || p < 0) p = 0;
        if (p > 1) p = 1;

        return { p: p };
    }

    // ====================================================
    // 2. Outlier Checker 
    // ====================================================
    const outlierButton = document.getElementById('check-outliers');
    if (outlierButton) {
        // Two-sided Grubbs critical value at alpha = 0.05.
        // Use the exact t-quantile formula when jStat is available; otherwise use conservative tabulated values.
        const grubbsTable = {
            3: 1.1547, 4: 1.481, 5: 1.715, 6: 1.887, 7: 2.020, 8: 2.127, 9: 2.215, 10: 2.290,
            12: 2.412, 15: 2.549, 20: 2.708, 30: 2.908, 50: 3.128, 100: 3.384, 150: 3.518, 200: 3.606, 500: 3.864, 1000: 4.041
        };
        const getGCrit = (n) => {
            if (typeof jStat !== 'undefined' && jStat.studentt && typeof jStat.studentt.inv === 'function') {
                const tCrit = jStat.studentt.inv(1 - 0.05 / (2 * n), n - 2);
                return ((n - 1) / Math.sqrt(n)) * Math.sqrt((tCrit * tCrit) / (n - 2 + tCrit * tCrit));
            }
            const keys = Object.keys(grubbsTable).map(Number).sort((a,b)=>a-b);
            for (let k of keys) { if (n <= k) return grubbsTable[k]; }
            return 4.5;
        };

        outlierButton.addEventListener('click', () => {
            const raw = document.getElementById('outlier-data').value;
            const methodSelect = document.getElementById('outlier-method');
            const requestedMethod = methodSelect ? methodSelect.value : 'auto';
            const tokens = raw.split(/[\s,]+/).filter(s => s.trim() !== '');
            const resDiv = document.getElementById('outlier-result');

            resDiv.style.whiteSpace = 'normal';
            resDiv.style.display = 'block';

            if (tokens.length === 0 || tokens.some(s => !Number.isFinite(Number(s)))) {
                resDiv.innerHTML = "<span style='color:red;'>Use only valid numbers separated by commas or spaces. Invalid entries are not ignored.</span>";
                return;
            }
            const data = tokens.map(Number).sort((a,b)=>a-b);
            if (data.length < 3) { resDiv.innerHTML = "<span style='color:red;'>Enter at least 3 numbers.</span>"; return; }

            const n = data.length;
            const mean = stat.mean(data);
            const sd = stat.sd(data, mean);
            
            if (!isFinite(sd) || sd === 0) {
                resDiv.innerHTML = `<div style="background:#fee2e2; padding:10px; color:#b91c1c; border-radius:4px;">🚨 SD is 0. All values are identical.</div>`;
                return;
            }

            const skew = stat.skewness(data, mean, sd);

            let isNormal, pValueDisplay, normMsg;
            if (n < 8) {
                // Small samples should not be routed to Grubbs using a skewness heuristic.
                isNormal = false;
                pValueDisplay = "Not assessed (N<8)";
                normMsg = "<span style='color:#d97706; font-weight:bold;'>Small sample; normality not assessed</span>";
            } else {
                const normTest = testNormalityDP(data);
                const pVal = normTest.p;
                isNormal = Number.isFinite(pVal) && pVal >= 0.05;
                pValueDisplay = Number.isFinite(pVal) ? pVal.toFixed(3) : "Not available";
                normMsg = isNormal
                    ? "<span style='color:#059669; font-weight:bold;'>No evidence against normality</span>"
                    : "<span style='color:#d97706; font-weight:bold;'>Evidence against normality</span>";
            }

            let methodUsed, outliers = [], thresholdInfo;
            if (requestedMethod === 'grubbs' || (requestedMethod === 'auto' && isNormal)) {
                methodUsed = "Grubb's Test";
                const g_crit = getGCrit(n);
                const g_max = (data[n-1] - mean) / sd;
                const g_min = (mean - data[0]) / sd;
                // Standard Grubbs' test evaluates one most-extreme observation per test.
                if (Math.max(g_max, g_min) > g_crit) {
                    outliers.push(g_max >= g_min ? data[n-1] : data[0]);
                }
                thresholdInfo = `Critical G: ${g_crit.toFixed(2)}`;
            } else {
                methodUsed = "IQR (1.5×)";
                const q1 = stat.percentile(data, 0.25);
                const q3 = stat.percentile(data, 0.75);
                const iqr = q3 - q1;
                const lower = q1 - 1.5 * iqr;
                const upper = q3 + 1.5 * iqr;
                outliers = data.filter(x => x < lower || x > upper);
                thresholdInfo = `Limit: ${lower.toFixed(1)} ~ ${upper.toFixed(1)}`;
            }

            let html = `
            <div style="border-bottom:1px solid #eee; padding-bottom:8px; margin-bottom:10px;">
                <div style="font-size:0.9em; color:#666; margin-bottom:4px;">Desc. Stats (N=${n})</div>
                <div style="font-weight:bold; color:#333;">Mean: ${mean.toFixed(2)} | SD: ${sd.toFixed(2)} | Skew: ${skew.toFixed(2)}</div>
            </div>
            <div style="background:#f9fafb; padding:8px; border-radius:4px; margin-bottom:10px; font-size:0.9em;">
                <div style="display:flex; justify-content:space-between;">
                    <span>Normality P-value: <strong>${pValueDisplay}</strong></span>
                    <span>${normMsg}</span>
                </div>
            </div>
            <div style="background:#fffbeb; padding:8px; border-radius:4px; border:1px solid #fcd34d; font-size:0.9em; margin-bottom:10px;">
                <strong>🔸 Method: ${methodUsed}</strong> <span style="color:#666">(${thresholdInfo})</span>
            </div>`;

            if (outliers.length > 0) {
                if (n < 8) {
                    html += `<div style="background:#fff7ed; padding:10px; border-radius:4px; color:#9a3412;">
                        <strong>⚠️ Potential: ${outliers.join(", ")}</strong><br>
                        <span style="font-size:0.85em">Small N (N<8). Interpret this screening result cautiously.</span>
                    </div>`;
                } else {
                    let tipText = "";
                    if (outliers.length > 1) {
                        tipText = `<div style="margin-top:8px; border-top:1px dashed #fca5a5; padding-top:5px; font-size:0.85em; color:#7f1d1d;">
                            <strong>💡 Recommendation:</strong><br>
                            Removing multiple outliers at once may bias results.<br>
                            Try removing the <u>most extreme value</u> first, then re-check.
                        </div>`;
                    }

                    html += `<div style="background:#fef2f2; padding:12px; border-radius:6px; color:#b91c1c; border:1px solid #fecaca;">
                        <div style="font-weight:bold; font-size:1.1em; margin-bottom:5px;">🚨 Outlier: ${outliers.join(", ")}</div>
                        <div style="font-size:0.9em;">Detected by ${methodUsed}</div>
                        ${tipText}
                    </div>`;
                }
            } else {
                html += `<div style="background:#ecfdf5; padding:10px; border-radius:4px; color:#065f46; text-align:center; font-weight:bold;">✅ No Outliers Detected</div>`;
            }
            resDiv.innerHTML = html;
        });
    }

    // ====================================================
    // 3. Other Calculators
    // ====================================================
function smartFormat(v,u,t){if(isNaN(v)||v===0)return`0.000 ${u}`;const f={'L':1,'mL':1e-3,'uL':1e-6,'M':1,'mM':1e-3,'uM':1e-6,'nM':1e-9,'kg':1e3,'g':1,'mg':1e-3,'ug':1e-6,'ng':1e-9};let b=v*f[u],U=['L','mL','uL'];if(t==='conc')U=['M','mM','uM','nM'];if(t==='mass')U=['kg','g','mg','ug','ng'];let best=U[U.length-1];for(let x of U){if(Math.abs(b)/f[x]>=1){best=x;break;}}return`<strong>${(b/f[best]).toFixed(3)} ${best}</strong>`;}

    // Molarity Calculator
    const mb = document.getElementById('calculate-molarity');
    if(mb) mb.addEventListener('click',()=>{
        const m=parseFloat(document.getElementById('mass').value), mw=parseFloat(document.getElementById('mw').value), v=parseFloat(document.getElementById('volume').value), c=parseFloat(document.getElementById('concentration').value), rd=document.getElementById('molarity-result');
        rd.innerHTML = '';
        if (!Number.isFinite(mw) || mw <= 0) { rd.innerHTML = "<span style='color:red'>Enter a molecular weight greater than zero.</span>"; return; }
        const values = [m, v, c];
        if (values.filter(Number.isFinite).length !== 2) { rd.innerHTML = "<span style='color:red'>Enter exactly two of mass, volume, and concentration.</span>"; return; }
        if (values.some(x => Number.isFinite(x) && x <= 0)) { rd.innerHTML = "<span style='color:red'>Known mass, volume, and concentration values must be greater than zero.</span>"; return; }
        const f={'kg':1e3,'g':1,'mg':1e-3,'ug':1e-6,'ng':1e-9,'L':1,'mL':1e-3,'uL':1e-6,'M':1,'mM':1e-3,'uM':1e-6};
        const mF=f[document.getElementById('mass-unit').value], vF=f[document.getElementById('vol-unit').value], cF=f[document.getElementById('conc-unit').value];
        if(!Number.isFinite(m)) rd.innerHTML=`Required Mass: ${smartFormat(mw*v*vF*c*cF,'g','mass')}`;
        else if(!Number.isFinite(v)) rd.innerHTML=`Required Vol: ${smartFormat((m*mF)/(mw*c*cF),'L','vol')}`;
        else rd.innerHTML=`Conc: ${smartFormat((m*mF)/(mw*v*vF),'M','conc')}`;
    });

    // ★★★ [업그레이드된 HED Calculator] ★★★
    const hb=document.getElementById('calculate-hed');
    if(hb) hb.addEventListener('click',()=>{
        // Km 값 및 표준 체중 (Standard Weights in kg)
        const km={"Mouse":3,"Hamster":5,"Rat":6,"Ferret":7,"Guinea Pig":8,"Rabbit":12,"Dog":20,"Monkey":12,"Marmoset":6,"Squirrel Monkey":7,"Baboon":20,"Micro Pig":27,"Mini Pig":35,"Human":37};
        const stdW={"Mouse":0.02,"Hamster":0.08,"Rat":0.15,"Ferret":0.3,"Guinea Pig":0.4,"Rabbit":1.8,"Dog":10,"Monkey":3,"Marmoset":0.35,"Squirrel Monkey":1,"Baboon":12,"Micro Pig":20,"Mini Pig":35,"Human":60};
        
        const sA=document.getElementById('species-a').value;
        const dA=parseFloat(document.getElementById('dose-a').value);
        const unitA=document.getElementById('dose-a-unit').value; // HTML에 새로 추가된 단위 판별
        
        const sB=document.getElementById('species-b').value;
        const wB=parseFloat(document.getElementById('weight-b').value);
        
        if (!Number.isFinite(dA) || dA <= 0) { document.getElementById('hed-result').innerHTML = "<span style='color:red'>Enter a dose greater than zero.</span>"; return; }
        if (Number.isFinite(wB) && wB <= 0) { document.getElementById('hed-result').innerHTML = "<span style='color:red'>Target body weight must be greater than zero.</span>"; return; }
        
        // 사용자가 mg을 입력했을 경우, A 동물의 표준 체중으로 나누어 mg/kg으로 환산
        let baseMpk = dA;
        if (unitA === 'mg') {
            baseMpk = dA / stdW[sA];
        }
        
        // HED 변환 공식 적용 (항상 mg/kg 기준으로 계산)
        const dB = baseMpk * (km[sA] / km[sB]); 
        
        let txt = "";
        
        // mg 입력 시, 어떻게 변환되었는지 안내 문구 표시
        if (unitA === 'mg') {
            txt += `<div style="font-size:0.85em; color:#888; margin-bottom:8px; border-bottom: 1px dashed #eee; padding-bottom: 5px;">
                    Info: ${dA}mg parsed as <strong>${baseMpk.toFixed(2)} mg/kg</strong> (Assuming standard ${sA} wt: ${stdW[sA]}kg)
                    </div>`;
        }
        
        txt += `Equivalent Dose: <strong style="color:#2c3e50;">${dB.toFixed(4)} mg/kg</strong>`;
        
        // 타겟 동물(B)의 체중 처리 및 절대 투여량(mg) 자동 계산
        if(!isNaN(wB)){
            // 사용자가 타겟 동물의 체중을 직접 입력한 경우
            const unit=document.getElementById('weight-b-unit').value; 
            const kg=unit==='kg'?wB:wB/1000; 
            txt+=`<br>Absolute Dose (<span style="color:#666;">Custom ${kg}kg</span>): <strong style="color:#007bff;">${(dB*kg).toFixed(4)} mg</strong>`;
        } else {
            // 사용자가 타겟 동물의 체중을 비워둔 경우 -> 표준 체중(stdW)으로 자동 계산
            txt+=`<br>Absolute Dose (<span style="color:#666;">Standard ${stdW[sB]}kg</span>): <strong style="color:#007bff;">${(dB*stdW[sB]).toFixed(4)} mg</strong>`;
        }
        
        document.getElementById('hed-result').innerHTML=txt;
    });

// Dilution Calculator
    const db=document.getElementById('calculate-dilution');
    if(db) db.addEventListener('click',()=>{
        const m1=parseFloat(document.getElementById('m1').value), 
              v1=parseFloat(document.getElementById('v1').value), 
              m2=parseFloat(document.getElementById('m2').value), 
              v2=parseFloat(document.getElementById('v2').value), 
              rd=document.getElementById('dilution-result');

        // [여기에 추가됨] 결과창의 숨김 설정을 해제합니다.
        rd.classList.remove('hidden');
        rd.style.display = 'block';

        const f={'M':1,'mM':1e-3,'uM':1e-6,'nM':1e-9,'L':1,'mL':1e-3,'uL':1e-6};
        const m1U=f[document.getElementById('m1-unit').value], 
              v1U=f[document.getElementById('v1-unit').value], 
              m2U=f[document.getElementById('m2-unit').value], 
              v2U=f[document.getElementById('v2-unit').value];

        const values = [m1, v1, m2, v2];
        if (values.filter(Number.isFinite).length !== 3) {
            rd.innerHTML = "<span style='color:red'>Enter exactly three of stock concentration, stock volume, final concentration, and final volume.</span>";
            return;
        }
        if (values.some(x => Number.isFinite(x) && x <= 0)) {
            rd.innerHTML = "<span style='color:red'>Known concentrations and volumes must be greater than zero.</span>";
            return;
        }

        if(!Number.isFinite(m1)) rd.innerHTML=`Stock Conc: ${smartFormat((m2*m2U*v2*v2U)/(v1*v1U),'M','conc')}`;
        else if(!Number.isFinite(v1)){
            const val=(m2*m2U*v2*v2U)/(m1*m1U);
            if (val > v2*v2U) { rd.innerHTML = "<span style='color:red'>Required stock volume exceeds the final volume; choose a lower final concentration or a larger final volume.</span>"; return; }
            const v2UnitText = document.getElementById('v2-unit').value;
            rd.innerHTML=`Stock Vol: ${smartFormat(val,'L','vol')}<br><span style='font-size:0.9em;color:#666'>(Add + ${((v2*v2U-val)/v2U).toFixed(3)} ${v2UnitText} Solvent)</span>`;
        }
        else if(!Number.isFinite(m2)) rd.innerHTML=`Final Conc: ${smartFormat((m1*m1U*v1*v1U)/(v2*v2U),'M','conc')}`;
        else {
            const val=(m1*m1U*v1*v1U)/(m2*m2U);
            if (val < v1*v1U) { rd.innerHTML = "<span style='color:red'>Calculated final volume is smaller than the stock volume; this is not a dilution.</span>"; return; }
            rd.innerHTML=`Final Vol: ${smartFormat(val,'L','vol')}`;
        }
});

// ====================================================
    // 6. Protein Quantification (Western Prep)
    // ====================================================
    const pbtn = document.getElementById('calculate-protein');
    if (pbtn) pbtn.addEventListener('click', () => {
        const mode = document.querySelector('input[name="prot-mode"]:checked').value;
        const parseList = (raw) => {
            const tokens = raw.split(/[\s,]+/).filter(x => x.trim() !== '');
            if (tokens.length === 0 || tokens.some(x => !Number.isFinite(Number(x)))) return null;
            return tokens.map(Number);
        };
        const samples = parseList(document.getElementById('prot-sample-od').value);
        const tMass = parseFloat(document.getElementById('prot-target-mass').value);
        const tVol = parseFloat(document.getElementById('prot-total-vol').value);
        const dyeX = parseFloat(document.getElementById('prot-dye-x').value);
        const repsRaw = document.getElementById('prot-replicates').value.trim();
        const reps = repsRaw === '' ? 1 : Number(repsRaw);
        const resDiv = document.getElementById('protein-result');

        if (!samples || samples.length === 0 || !Number.isFinite(tVol) || tVol <= 0 || !Number.isFinite(dyeX) || dyeX <= 1 || !Number.isInteger(reps) || reps < 1) {
            resDiv.innerHTML = "<span style='color:#b91c1c; background:#fee2e2; padding:10px; display:block; border-radius:4px;'>🚨 Enter valid sample O.D. values, a positive total volume, a dye multiplier greater than 1, and a positive whole-number replicate count. Invalid values are not ignored.</span>";
            resDiv.style.display = 'block';
            if(resDiv.classList.contains('hidden')) resDiv.classList.remove('hidden');
            return;
        }

        const dyeVol = tVol / dyeX;
        const maxSampleVol = tVol - dyeVol;
        let html = '';
        
        // Multiplier 안내 문구 (1보다 클 때만 표시)
        const repNotice = reps > 1 ? `<div style="background:#e0f2fe; color:#0369a1; padding:8px; border-radius:4px; font-weight:bold; margin-bottom:10px; text-align:center;">🧪 Volumes multiplied by ${reps}x for master mix preparation</div>` : '';

        if (mode === 'std') {
            const concRaw = document.getElementById('prot-std-conc').value;
            const odRaw = document.getElementById('prot-std-od').value;
            const concs = parseList(concRaw);
            const ods = parseList(odRaw);

            if (!concs || !ods || concs.length !== ods.length || concs.length < 2) {
                resDiv.innerHTML = "<span style='color:#b91c1c; background:#fee2e2; padding:10px; display:block; border-radius:4px;'>🚨 Standard Concentrations and O.D.s must have the same number of values (minimum 2).</span>";
                resDiv.style.display = 'block';
                if(resDiv.classList.contains('hidden')) resDiv.classList.remove('hidden');
                return;
            }
            if (!Number.isFinite(tMass) || tMass <= 0) {
                resDiv.innerHTML = "<span style='color:#b91c1c; background:#fee2e2; padding:10px; display:block; border-radius:4px;'>🚨 Target mass must be greater than zero in Standard Curve mode.</span>";
                resDiv.style.display = 'block';
                if(resDiv.classList.contains('hidden')) resDiv.classList.remove('hidden');
                return;
            }

            if (concs.some(x => x < 0) || new Set(concs).size < 2) {
                resDiv.innerHTML = "<span style='color:#b91c1c; background:#fee2e2; padding:10px; display:block; border-radius:4px;'>🚨 Standard concentrations must be non-negative and include at least two distinct values.</span>";
                resDiv.style.display = 'block';
                if(resDiv.classList.contains('hidden')) resDiv.classList.remove('hidden');
                return;
            }
            const n = concs.length;
            const sumX = concs.reduce((a, b) => a + b, 0);
            const sumY = ods.reduce((a, b) => a + b, 0);
            const sumXY = concs.reduce((a, c, i) => a + c * ods[i], 0);
            const sumXX = concs.reduce((a, c) => a + c * c, 0);
            
            const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
            const intercept = (sumY - slope * sumX) / n;
            if (!Number.isFinite(slope) || slope === 0 || !Number.isFinite(intercept)) {
                resDiv.innerHTML = "<span style='color:#b91c1c; background:#fee2e2; padding:10px; display:block; border-radius:4px;'>🚨 The standards do not produce a valid non-zero linear slope. Check the standard concentrations and O.D. values.</span>";
                resDiv.style.display = 'block';
                if(resDiv.classList.contains('hidden')) resDiv.classList.remove('hidden');
                return;
            }

            const meanY = sumY / n;
            const ssTot = ods.reduce((a, c) => a + Math.pow(c - meanY, 2), 0);
            const ssRes = ods.reduce((a, c, i) => a + Math.pow(c - (slope * concs[i] + intercept), 2), 0);
            if (ssTot === 0) {
                resDiv.innerHTML = "<span style='color:#b91c1c; background:#fee2e2; padding:10px; display:block; border-radius:4px;'>🚨 Standard O.D. values have no variation, so R² cannot be calculated.</span>";
                resDiv.style.display = 'block';
                if(resDiv.classList.contains('hidden')) resDiv.classList.remove('hidden');
                return;
            }
            const r2 = 1 - (ssRes / ssTot);

            const r2Color = r2 >= 0.95 ? '#065f46' : '#b91c1c';
            const r2Warning = r2 < 0.95 ? '<br><span style="color:#b91c1c; font-size:0.85em;">⚠️ R² < 0.95: Curve is sub-optimal. Check your pipetting.</span>' : '';

            html += repNotice;
            html += `<div style="margin-bottom:15px; padding:15px; background:#f8fafc; border-left:4px solid #3b82f6; border-radius:4px;">
                        <strong style="color:#1e40af;">Standard Curve Equation:</strong><br>
                        O.D. = ${slope.toFixed(4)} × Conc + ${intercept.toFixed(4)} <br>
                        <strong style="color:${r2Color};">R² = ${r2.toFixed(4)}</strong> ${r2Warning}
                     </div>`;

            html += `<table class="chi-table" style="background:#fff;">
                        <tr style="background:#f1f5f9;">
                            <th>Sample</th><th>O.D.</th><th>Conc.<br><span style="font-size:0.8em;color:#666;">(µg/µL)</span></th>
                            <th style="color:#2563eb;">Sample<br><span style="font-size:0.8em;">(µL)</span></th>
                            <th style="color:#059669;">Buffer<br><span style="font-size:0.8em;">(µL)</span></th>
                            <th style="color:#d97706;">${dyeX}X Dye<br><span style="font-size:0.8em;">(µL)</span></th>
                            <th>Total<br><span style="font-size:0.8em;">(µL)</span></th>
                        </tr>`;

            samples.forEach((od, i) => {
                const conc = (od - intercept) / slope;
                const reqVol = tMass / conc;
                let bufVol = maxSampleVol - reqVol;
                let warnMsg = '';
                let finalSampleVol = reqVol;

                if (reqVol > maxSampleVol) {
                    warnMsg = `<br><span style="color:#b91c1c; font-size:0.8em; font-weight:bold;">Over Vol!</span>`;
                    finalSampleVol = maxSampleVol; 
                    bufVol = 0;
                } else if (reqVol < 0 || conc < 0) {
                    warnMsg = `<br><span style="color:#b91c1c; font-size:0.8em; font-weight:bold;">Too Dilute</span>`;
                    finalSampleVol = 0;
                    bufVol = maxSampleVol;
                }

                // [추가됨] Replicates 값 곱하기
                const finalSampleDisp = finalSampleVol * reps;
                const finalBufDisp = bufVol * reps;
                const finalDyeDisp = dyeVol * reps;
                const finalTotDisp = tVol * reps;

                html += `<tr>
                    <td contenteditable="true" class="editable-cell font-bold text-primary" style="outline:none;">Sample ${i + 1}</td>
                    <td>${od}</td>
                    <td>${Math.max(0, conc).toFixed(2)}</td>
                    <td style="color:#2563eb; font-weight:bold;">${finalSampleDisp.toFixed(2)} ${warnMsg}</td>
                    <td style="color:#059669;">${finalBufDisp.toFixed(2)}</td>
                    <td style="color:#d97706;">${finalDyeDisp.toFixed(2)}</td>
                    <td><strong>${finalTotDisp.toFixed(2)}</strong></td>
                </tr>`;
            });
            html += `</table>`;

        } else {
            const blankODRaw = document.getElementById('prot-blank-od').value.trim();
            const blankOD = Number(blankODRaw);

            if (blankODRaw === '' || !Number.isFinite(blankOD)) {
                 resDiv.innerHTML = "<span style='color:#b91c1c; background:#fee2e2; padding:10px; display:block; border-radius:4px;'>🚨 Enter a valid numeric Blank O.D. value. Negative values are allowed.</span>";
                 resDiv.style.display = 'block';
                 if(resDiv.classList.contains('hidden')) resDiv.classList.remove('hidden');
                 return;
            }

            const netODs = samples.map(od => od - blankOD);
            const minNetOD = Math.min(...netODs);

            if (minNetOD <= 0) {
                 resDiv.innerHTML = "<span style='color:#b91c1c; background:#fee2e2; padding:10px; display:block; border-radius:4px;'>🚨 A sample has Net O.D. ≤ 0. Please check your Blank O.D. or Sample O.D. values.</span>";
                 resDiv.style.display = 'block';
                 if(resDiv.classList.contains('hidden')) resDiv.classList.remove('hidden');
                 return;
            }
            
            html += repNotice;
            html += `<div style="margin-bottom:15px; padding:15px; background:#fffbeb; border-left:4px solid #f59e0b; border-radius:4px;">
                        <strong style="color:#b45309;">Relative Quantification Mode:</strong><br>
                        Reference O.D. (Most dilute sample) = <strong>${minNetOD.toFixed(4)}</strong><br>
                        <span style="font-size:0.85em; color:#666; display:block; margin-top:5px;">* The most dilute sample is assigned the maximum possible volume. Volumes scale inversely to equalize total protein.</span>
                     </div>`;

            html += `<table class="chi-table" style="background:#fff;">
                        <tr style="background:#f1f5f9;">
                            <th>Sample</th><th>Net O.D.<br><span style="font-size:0.8em;color:#666;">(Raw-Blank)</span></th><th>Ratio</th>
                            <th style="color:#2563eb;">Sample<br><span style="font-size:0.8em;">(µL)</span></th>
                            <th style="color:#059669;">Buffer<br><span style="font-size:0.8em;">(µL)</span></th>
                            <th style="color:#d97706;">${dyeX}X Dye<br><span style="font-size:0.8em;">(µL)</span></th>
                            <th>Total<br><span style="font-size:0.8em;">(µL)</span></th>
                        </tr>`;

            netODs.forEach((net, i) => {
                const ratio = net / minNetOD;
                const reqVol = maxSampleVol / ratio; 
                const bufVol = maxSampleVol - reqVol;
                let ratioText = ratio === 1 ? `<span style="color:#b45309; font-weight:bold;">1.00x (Ref)</span>` : `${ratio.toFixed(2)}x`;
                
                // [추가됨] Replicates 값 곱하기
                const finalSampleDisp = reqVol * reps;
                const finalBufDisp = bufVol * reps;
                const finalDyeDisp = dyeVol * reps;
                const finalTotDisp = tVol * reps;

                html += `<tr>
                    <td contenteditable="true" class="editable-cell font-bold text-primary" style="outline:none;">Sample ${i + 1}</td>
                    <td>${net.toFixed(3)}</td>
                    <td>${ratioText}</td>
                    <td style="color:#2563eb; font-weight:bold;">${finalSampleDisp.toFixed(2)}</td>
                    <td style="color:#059669;">${finalBufDisp.toFixed(2)}</td>
                    <td style="color:#d97706;">${finalDyeDisp.toFixed(2)}</td>
                    <td><strong>${finalTotDisp.toFixed(2)}</strong></td>
                </tr>`;
            });
            html += `</table>`;
        }

          resDiv.innerHTML = html;
        resDiv.style.display = 'block';
        if(resDiv.classList.contains('hidden')) resDiv.classList.remove('hidden');

        // 👇 엑셀 버튼 추가 로직 👇
        const exportBtnHTML = `
            <div class="flex justify-end mb-4">
                <button id="export-excel-btn" class="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 transition-colors font-headline font-bold text-sm">
                    <span class="material-symbols-outlined text-[18px]">table_view</span> Export to Excel
                </button>
            </div>
        `;
        resDiv.insertAdjacentHTML('afterbegin', exportBtnHTML);
    });
});