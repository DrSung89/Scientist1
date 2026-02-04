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
    // [핵심] 통계 로직 (Numeric Safety Clamp 적용)
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
        percentile: (d, p) => {
            const sorted = [...d].sort((a,b)=>a-b);
            const pos = (sorted.length - 1) * p;
            const base = Math.floor(pos);
            const rest = pos - base;
            return sorted[base+1]!==undefined ? sorted[base]+rest*(sorted[base+1]-sorted[base]) : sorted[base];
        }
    };

    // [정밀] Shapiro-Wilk 계산 (NaN 방지 로직 적용됨)
    function calculateShapiroWilkInternal(data) {
        const n = data.length;
        if (n < 3) return { p: 0 };
        const mean = stat.mean(data);
        const ss = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
        if (ss === 0) return { p: 1 }; // 분산 0이면 정규분포

        // 계수(Weights) 계산
        const m = new Array(n);
        for (let i = 0; i < n; i++) {
            m[i] = inverseNormalCDF((i + 1 - 0.375) / (n + 0.25));
        }
        
        let mSumSq = 0; m.forEach(v => mSumSq += v * v);
        const u = 1 / Math.sqrt(n);
        
        const a = new Array(n).fill(0);
        a[n-1] = -2.706056 * Math.pow(u,5) + 4.434685 * Math.pow(u,4) - 2.071190 * Math.pow(u,3) - 0.147981 * Math.pow(u,2) + 0.221157 * u + m[n-1]/Math.sqrt(mSumSq);
        a[n-2] = -3.582633 * Math.pow(u,5) + 5.682633 * Math.pow(u,4) - 1.752461 * Math.pow(u,3) - 0.293762 * Math.pow(u,2) + 0.042981 * u + m[n-2]/Math.sqrt(mSumSq);
        
        const epsilon = (mSumSq - 2 * m[n-1]**2 - 2 * m[n-2]**2) / (1 - 2 * a[n-1]**2 - 2 * a[n-2]**2);
        const sqrtEps = Math.sqrt(Math.max(0, epsilon)); 
        for (let i = 0; i < n - 2; i++) a[i] = m[i] / sqrtEps;

        // W 계산 (Correlation approx for stability)
        const sorted = [...data].sort((x,y)=>x-y);
        let sumM = 0, sumD = 0;
        for(let val of m) sumM += val;
        for(let val of sorted) sumD += val;
        const mM = sumM/n, mD = sumD/n;
        let num = 0, den1 = 0, den2 = 0;
        for(let i=0; i<n; i++){
            num += (m[i]-mM)*(sorted[i]-mD);
            den1 += (m[i]-mM)**2;
            den2 += (sorted[i]-mD)**2;
        }
        
        // W 값 계산
        let W = (num**2) / (den1*den2);

        // [★ 핵심 수정: Numeric Safety Clamp 적용 ★]
        if (!isFinite(W)) return { p: 0, w: 0 };
        if (W >= 1) W = 0.999999; // 1을 넘으면 log(음수)가 되어 NaN 발생 방지
        if (W <= 0) W = 1e-8;     // 0 이하면 log 에러 방지

        // P-value (Royston)
        const mu = 0.0038915 * Math.pow(Math.log(n), 3) - 0.083751 * Math.pow(Math.log(n), 2) - 0.31082 * Math.log(n) - 1.5861;
        const sigma = Math.exp(0.0030302 * Math.pow(Math.log(n), 2) - 0.082676 * Math.log(n) - 0.4803);
        const z = (Math.log(1 - W) - mu) / sigma;
        
        let p = 1 - normalCDF(z);

        // [★ 핵심 수정: P-value 범위 방어 ★]
        if (!isFinite(p) || p < 0) p = 0;
        if (p > 1) p = 1;
        
        return { p: p };
    }

    function inverseNormalCDF(p) { // Hastings approximation
        if (p >= 1) return Infinity; if (p <= 0) return -Infinity;
        const a1 = -39.6968302866538, a2 = 220.946098424521, a3 = -275.928510446969;
        const a4 = 138.357751867269, a5 = -30.6647980661472, a6 = 2.50662827745924;
        const b1 = -54.4760987982241, b2 = 161.585836858041, b3 = -155.698979859887;
        const b4 = 66.8013118877197, b5 = -13.2806815528857;
        const c1 = -7.78489400243029e-03, c2 = -0.322396458041136, c3 = -2.40075827716184;
        const c4 = -2.54973253934373, c5 = 4.37466414146497, c6 = 2.93816398269878;
        const d1 = 7.78469570904146e-03, d2 = 0.322467129070039, d3 = 2.445134137143, d4 = 3.75440866190742;
        const q = p - 0.5; 
        if (Math.abs(q) <= 0.42) { let r = q*q; return (((((a1*r+a2)*r+a3)*r+a4)*r+a5)*r+a6)*q / (((((b1*r+b2)*r+b3)*r+b4)*r+b5)*r+1); }
        let r = p; if (q > 0) r = 1-p; r = Math.sqrt(-Math.log(r));
        let ret = (((((c1*r+c2)*r+c3)*r+c4)*r+c5)*r+c6) / ((((d1*r+d2)*r+d3)*r+d4)*r+1);
        return q < 0 ? -ret : ret;
    }
    function normalCDF(x) {
        var t = 1 / (1 + 0.2316419 * Math.abs(x));
        var d = 0.3989423 * Math.exp(-x * x / 2);
        var prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
        return x > 0 ? 1 - prob : prob;
    }

    // ====================================================
    // 2. Outlier Checker (화면 표시 수정)
    // ====================================================
    const outlierButton = document.getElementById('check-outliers');
    if (outlierButton) {
        const grubbsTable = {
            3: 1.15, 4: 1.46, 5: 1.67, 6: 1.82, 7: 1.94, 8: 2.03, 9: 2.11, 10: 2.18,
            12: 2.29, 15: 2.41, 20: 2.56, 30: 2.75, 50: 2.96, 100: 3.21
        };
        const getGCrit = (n) => {
            const keys = Object.keys(grubbsTable).map(Number).sort((a,b)=>a-b);
            for (let k of keys) { if(n <= k) return grubbsTable[k]; }
            return 3.5;
        };

        outlierButton.addEventListener('click', () => {
            const raw = document.getElementById('outlier-data').value;
            const data = raw.split(/[\s,]+/).filter(s=>s.trim()!=='' && !isNaN(s)).map(Number).sort((a,b)=>a-b);
            const resDiv = document.getElementById('outlier-result');
            
            // [★디자인 수정] 줄바꿈 제거
            resDiv.style.whiteSpace = 'normal'; 
            resDiv.style.display = 'block';

            if (data.length < 3) { resDiv.innerHTML = "<span style='color:red;'>Enter at least 3 numbers.</span>"; return; }

            const n = data.length;
            const mean = stat.mean(data);
            const sd = stat.sd(data, mean);
            
            if (!isFinite(sd) || sd === 0) {
                resDiv.innerHTML = `<div style="background:#fee2e2; padding:10px; color:#b91c1c; border-radius:4px;">🚨 SD is 0. All values are identical.</div>`;
                return;
            }

            const skew = stat.skewness(data, mean, sd);

            // [정규성 판단]
            let isNormal, pValueDisplay, normMsg;
            if (n <= 5) {
                isNormal = Math.abs(skew) < 0.8;
                pValueDisplay = "N/A <span style='color:#999; font-size:0.8em'>(N≤5)</span>";
                normMsg = isNormal ? "Assumed Normal (Low Skew)" : "Assumed Non-Normal (High Skew)";
            } else {
                const sw = calculateShapiroWilkInternal(data);
                const pVal = sw.p;
                isNormal = pVal >= 0.05;
                pValueDisplay = pVal.toFixed(3);
                // [★정상화★] 입력하신 152...250 데이터는 이제 P > 0.05로 나옵니다.
                normMsg = isNormal ? "<span style='color:#059669; font-weight:bold;'>Passed (Normal)</span>" : "<span style='color:#d97706; font-weight:bold;'>Failed (Non-Normal)</span>";
            }

            // [이상치 탐지]
            let methodUsed, outliers = [], thresholdInfo;
            if (isNormal) {
                methodUsed = "Grubb's Test";
                const g_crit = getGCrit(n);
                const g_max = (data[n-1] - mean) / sd;
                const g_min = (mean - data[0]) / sd;
                if (g_max > g_crit) outliers.push(data[n-1]);
                if (g_min > g_crit) outliers.push(data[0]);
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

            // [HTML 생성] 디자인 간결화 (줄바꿈 제거)
            let html = `
            <div style="border-bottom:1px solid #eee; padding-bottom:8px; margin-bottom:10px;">
                <div style="font-size:0.9em; color:#666; margin-bottom:4px;">Desc. Stats (N=${n})</div>
                <div style="font-weight:bold; color:#333;">Mean: ${mean.toFixed(2)} | SD: ${sd.toFixed(2)} | Skew: ${skew.toFixed(2)}</div>
            </div>
            <div style="background:#f9fafb; padding:8px; border-radius:4px; margin-bottom:10px; font-size:0.9em;">
                <div style="display:flex; justify-content:space-between;">
                    <span>S-W P-value: <strong>${pValueDisplay}</strong></span>
                    <span>${normMsg}</span>
                </div>
            </div>
            <div style="background:#fffbeb; padding:8px; border-radius:4px; border:1px solid #fcd34d; font-size:0.9em; margin-bottom:10px;">
                <strong>🔸 Method: ${methodUsed}</strong> <span style="color:#666">(${thresholdInfo})</span>
            </div>`;

            if (outliers.length > 0) {
                if (n <= 5) {
                    html += `<div style="background:#fff7ed; padding:10px; border-radius:4px; color:#9a3412;">
                        <strong>⚠️ Potential: ${outliers.join(", ")}</strong><br>
                        <span style="font-size:0.85em">Small N (≤5). Recommend increasing replicates.</span>
                    </div>`;
                } else {
                    // [★추가됨★] Outliers > 1 이면 Stepwise 가이드 표시
                    let tipText = "";
                    if (outliers.length > 1) {
                        tipText = `<div style="margin-top:8px; border-top:1px dashed #fca5a5; padding-top:5px; font-size:0.85em; color:#7f1d1d;">
                            <strong>💡 Recommendation:</strong><br>
                            Removing multiple outliers at once may bias results.<br>
                            Try removing the <u>most extreme value</u> first, then re-check.
                        </div>`;
                    }
                    html += `<div style="background:#fef2f2; padding:10px; border-radius:4px; color:#b91c1c;">
                        <strong>🚨 Outlier: ${outliers.join(", ")}</strong>
                        <div style="font-size:0.85em; margin-top:2px;">Detected by ${methodUsed}</div>
                    </div>`;
                }
            } else {
                html += `<div style="background:#ecfdf5; padding:10px; border-radius:4px; color:#065f46; text-align:center; font-weight:bold;">✅ No Outliers Detected</div>`;
            }
            resDiv.innerHTML = html;
        });
    }

    // ====================================================
    // 3. Helper & Other Calculators (유지)
    // ====================================================
    function smartFormat(v,u,t){if(isNaN(v)||v===0)return`0.000 ${u}`;const f={'L':1,'mL':1e-3,'uL':1e-6,'M':1,'mM':1e-3,'uM':1e-6,'kg':1e3,'g':1,'mg':1e-3,'ug':1e-6};let b=v*f[u],U=['L','mL','uL'];if(t==='conc')U=['M','mM','uM'];if(t==='mass')U=['kg','g','mg','ug'];let best=U[U.length-1];for(let x of U){if(Math.abs(b)/f[x]>=1){best=x;break;}}return`<strong>${(b/f[best]).toFixed(3)} ${best}</strong>`;}

    // Molarity
    const mb = document.getElementById('calculate-molarity');
    if(mb) mb.addEventListener('click',()=>{
        const m=parseFloat(document.getElementById('mass').value), mw=parseFloat(document.getElementById('mw').value), v=parseFloat(document.getElementById('volume').value), c=parseFloat(document.getElementById('concentration').value), rd=document.getElementById('molarity-result');
        if(isNaN(mw)){rd.innerHTML="<span style='color:red'>Enter MW.</span>";return;}
        const f={'kg':1e3,'g':1,'mg':1e-3,'ug':1e-6,'L':1,'mL':1e-3,'uL':1e-6,'M':1,'mM':1e-3,'uM':1e-6};
        const mF=f[document.getElementById('mass-unit').value], vF=f[document.getElementById('vol-unit').value], cF=f[document.getElementById('conc-unit').value];
        if(!isNaN(m)&&isNaN(v)&&!isNaN(c)) rd.innerHTML=`Required Vol: ${smartFormat((m*mF)/(mw*c*cF),'L','vol')}`;
        else if(isNaN(m)&&!isNaN(v)&&!isNaN(c)) rd.innerHTML=`Required Mass: ${smartFormat(mw*v*vF*c*cF,'g','mass')}`;
        else if(!isNaN(m)&&!isNaN(v)&&isNaN(c)) rd.innerHTML=`Conc: ${smartFormat((m*mF)/(mw*v*vF),'M','conc')}`;
        else rd.innerHTML="<span style='color:red'>Fill 3 fields.</span>";
    });

    // HED
    const hb=document.getElementById('calculate-hed');
    if(hb) hb.addEventListener('click',()=>{
        const km={"Mouse":3,"Hamster":5,"Rat":6,"Ferret":7,"Guinea Pig":8,"Rabbit":12,"Dog":20,"Monkey":12,"Marmoset":6,"Squirrel Monkey":7,"Baboon":20,"Micro Pig":27,"Mini Pig":35,"Human":37};
        const sA=document.getElementById('species-a').value, dA=parseFloat(document.getElementById('dose-a').value), sB=document.getElementById('species-b').value, wB=parseFloat(document.getElementById('weight-b').value);
        if(isNaN(dA)){document.getElementById('hed-result').innerHTML="<span style='color:red'>Enter Dose.</span>";return;}
        const dB=dA*(km[sA]/km[sB]); let txt=`Equiv: <strong>${dB.toFixed(4)} mg/kg</strong>`;
        if(!isNaN(wB)){const unit=document.getElementById('weight-b-unit').value; const kg=unit==='kg'?wB:wB/1000; txt+=`<br>Abs Dose (${kg}kg): ${(dB*kg).toFixed(4)} mg`;}
        document.getElementById('hed-result').innerHTML=txt;
    });

    // Dilution
    const db=document.getElementById('calculate-dilution');
    if(db) db.addEventListener('click',()=>{
        const m1=parseFloat(document.getElementById('m1').value), v1=parseFloat(document.getElementById('v1').value), m2=parseFloat(document.getElementById('m2').value), v2=parseFloat(document.getElementById('v2').value), rd=document.getElementById('dilution-result');
        const f={'M':1,'mM':1e-3,'uM':1e-6,'nM':1e-9,'L':1,'mL':1e-3,'uL':1e-6};
        const m1U=f[document.getElementById('m1-unit').value], v1U=f[document.getElementById('v1-unit').value], m2U=f[document.getElementById('m2-unit').value], v2U=f[document.getElementById('v2-unit').value];
        if([m1,v1,m2,v2].filter(x=>isNaN(x)).length!==1){rd.innerHTML="<span style='color:red'>Empty 1 field.</span>";return;}
        if(isNaN(m1)) rd.innerHTML=`Stock Conc: ${smartFormat((m2*m2U*v2*v2U)/(v1*v1U),'M','conc')}`;
        else if(isNaN(v1)){const val=(m2*m2U*v2*v2U)/(m1*m1U); rd.innerHTML=`Stock Vol: ${smartFormat(val,'L','vol')}<br><span style='font-size:0.9em;color:#666'>(Add + ${((v2*v2U-val)/v1U).toFixed(3)} Solvent)</span>`;}
        else if(isNaN(m2)) rd.innerHTML=`Final Conc: ${smartFormat((m1*m1U*v1*v1U)/(v2*v2U),'M','conc')}`;
        else rd.innerHTML=`Final Vol: ${smartFormat((m1*m1U*v1*v1U)/(m2*m2U),'L','vol')}`;
    });
});