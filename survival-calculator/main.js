// ==========================================
// 0. 다운로드 함수 (전역 window 객체에 등록)
// ==========================================
window.downloadChart = function() {
    const canvas = document.getElementById('survivalChart');
    if(!canvas) { alert("Chart not found."); return; }

    try {
        // 흰색 배경 캔버스 생성 (투명 배경 방지)
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        
        // 흰색 채우기
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // 그래프 그리기
        tempCtx.drawImage(canvas, 0, 0);
        
        // 다운로드 실행
        const link = document.createElement('a');
        link.download = 'survival-curve.png';
        link.href = tempCanvas.toDataURL('image/png', 1.0);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch(e) {
        alert("Download failed.");
        console.error(e);
    }
};

document.addEventListener("DOMContentLoaded", function() {
    
    // --- 랜덤 문구 ---
    const quotes = [
        "Cheering for your dedication today. 🧪", 
        "Behind every data point is effort. 📊",
        "Science is a journey of resilience. 🚀",
        "Trust your data. 📉"
    ];
    const quoteEl = document.getElementById("quote-display");
    if(quoteEl) quoteEl.innerText = quotes[Math.floor(Math.random() * quotes.length)];

    // ==========================================
    // 1. SAS Time Converter (간격 최소화)
    // ==========================================
    const timeInput = document.getElementById("time-input");
    const timeUnit = document.getElementById("time-unit");
    const convertResult = document.getElementById("convert-result");

    function convertTime() {
        if (!timeInput || !timeUnit || !convertResult) return;
        const val = parseFloat(timeInput.value);
        
        // ★ [강제 스타일] 패딩 10px로 고정
        convertResult.style.cssText = "padding: 10px 15px !important; min-height: 0 !important; background: #f8f9fa; border: 1px solid #eee; border-radius: 5px; margin-top: 10px; display: block;";

        if (isNaN(val)) {
            convertResult.innerHTML = "<div style='color:#888; font-size:0.9rem; margin:0;'>Please enter a value.</div>";
            return;
        }

        let days = 0;
        const unit = timeUnit.value;
        if (unit === "days") days = val;
        else if (unit === "weeks") days = val * 7;
        else if (unit === "months") days = val * 30.4375;
        else if (unit === "years") days = val * 365.25;

        // ★ 내부 간격 최소화
        convertResult.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 3px; margin: 0; padding: 0;">
                <p style="margin: 0; line-height: 1.3; font-size: 0.95rem;"><strong>Days:</strong> ${days.toFixed(2)}</p>
                <p style="margin: 0; line-height: 1.3; font-size: 0.95rem;"><strong>Weeks:</strong> ${(days / 7).toFixed(2)}</p>
                <p style="margin: 0; line-height: 1.3; font-size: 0.95rem; color: #0056b3;"><strong>Months (SAS):</strong> ${(days / 30.4375).toFixed(2)}</p>
                <p style="margin: 0; line-height: 1.3; font-size: 0.95rem;"><strong>Years:</strong> ${(days / 365.25).toFixed(2)}</p>
            </div>
        `;
    }
    if(timeInput) timeInput.addEventListener("input", convertTime);
    if(timeUnit) timeUnit.addEventListener("change", convertTime);

    // ==========================================
    // 2. Kaplan-Meier Logic
    // ==========================================
    const numGroupsSelect = document.getElementById("num-groups");
    const groupsWrapper = document.getElementById("groups-wrapper");
    const calcBtn = document.getElementById("calc-os-btn");
    let chartInstance = null;

    if(numGroupsSelect) {
        createGroupInputs(parseInt(numGroupsSelect.value));
        numGroupsSelect.addEventListener("change", function() { createGroupInputs(parseInt(this.value)); });
    }

    function createGroupInputs(num) {
        let html = "";
        for (let g = 1; g <= num; g++) {
            const defaultName = g === 1 && num === 2 ? "Control" : (g === 2 && num === 2 ? "Treatment" : `Group ${g}`);
            html += `
            <div class="group-container" id="group-box-${g}">
                <div class="group-header">
                    <div>
                        <label style="font-size:0.9rem; font-weight:bold;">Group:</label>
                        <input type="text" class="group-name-input" value="${defaultName}" style="padding:2px 5px; width:100px; font-size:0.9rem;">
                    </div>
                    <div>
                        <label style="font-size:0.9rem;">N:</label>
                        <select class="group-n-select" data-group="${g}" style="padding:2px; font-size:0.9rem;">
                            <option value="5">5</option>
                            <option value="10" selected>10</option>
                            <option value="15">15</option>
                            <option value="20">20</option>
                            <option value="30">30</option>
                            <option value="50">50</option>
                        </select>
                    </div>
                </div>
                <div id="group-data-${g}">
                    ${generateTableRows(10, g)}
                </div>
            </div>`;
        }
        if(groupsWrapper) groupsWrapper.innerHTML = html;

        document.querySelectorAll(".group-n-select").forEach(select => {
            select.addEventListener("change", function() {
                const g = this.dataset.group;
                const n = parseInt(this.value);
                document.getElementById(`group-data-${g}`).innerHTML = generateTableRows(n, g);
            });
        });
    }

    function generateTableRows(n, groupId) {
        let html = `<table style="width: 100%; border-spacing: 0 2px;">
            <thead><tr style="text-align: left; font-size: 0.8rem; color: #666;">
                <th>No.</th><th>Time</th><th>Status</th>
            </tr></thead><tbody>`;
        for (let i = 1; i <= n; i++) {
            html += `<tr>
                <td style="width: 15%; font-size:0.8rem;">#${i}</td>
                <td style="width: 40%;"><input type="number" class="time-val group-${groupId}-time" placeholder="Time" style="width: 90%; padding: 4px; font-size:0.9rem;"></td>
                <td style="width: 45%;">
                    <select class="status-val group-${groupId}-status" style="width: 95%; padding: 4px; font-size:0.9rem;">
                        <option value="1">1 (Event/Death)</option>
                        <option value="0">0 (Censored)</option>
                    </select>
                </td>
            </tr>`;
        }
        html += `</tbody></table>`;
        return html;
    }

if(calcBtn) {
        calcBtn.addEventListener("click", function() {
            const numGroups = parseInt(numGroupsSelect.value);
            const allDatasets = [];
            const medianResults = [];
            const groupNames = document.querySelectorAll(".group-name-input");
            const colors = ['#007bff', '#dc3545', '#28a745', '#fd7e14']; 
            
            // ★ 통계용 데이터 저장 배열 추가
            let groupData = []; 

            for (let g = 1; g <= numGroups; g++) {
                const timeInputs = document.querySelectorAll(`.group-${g}-time`);
                const statusInputs = document.querySelectorAll(`.group-${g}-status`);
                const groupName = groupNames[g-1].value;
                let data = [];

                for (let i = 0; i < timeInputs.length; i++) {
                    const t = parseFloat(timeInputs[i].value);
                    const s = parseInt(statusInputs[i].value);
                    if (!isNaN(t)) {
                        data.push({ time: t, status: s });
                    }
                }

                if (data.length === 0) continue;

                // ★ 통계 분석을 위해 원본 데이터 저장
                groupData.push({ name: groupName, data: data });

                const kmResult = calculateSingleKM(data);
                
                allDatasets.push({
                    label: groupName,
                    data: kmResult.points,
                    borderColor: colors[(g-1) % 4],
                    backgroundColor: colors[(g-1) % 4],
                    borderWidth: 2,
                    fill: false,       
                    stepped: true,     
                    tension: 0,
                    pointRadius: 2,
                    pointHoverRadius: 5
                });

                medianResults.push({ name: groupName, median: kmResult.median, color: colors[(g-1) % 4] });
            }

            if (allDatasets.length === 0) {
                alert("Please enter data for at least one group.");
                return;
            }

            // ★ 통계 분석 실행 (그룹이 2개 이상일 때만)
            let statsHtml = "";
            if (groupData.length >= 2) {
                statsHtml = calculateLogRankStats(groupData);
            }

            // 결과 함수에 통계 HTML도 같이 전달
            displayResults(medianResults, allDatasets, statsHtml);
        });
    }

    function calculateSingleKM(data) {
        data.sort((a, b) => a.time - b.time);
        let n = data.length;
        let survivalProb = 1.0;
        let points = [{x: 0, y: 1.0}]; 
        let grouped = {};
        data.forEach(d => {
            if (!grouped[d.time]) grouped[d.time] = { event: 0, censor: 0, total: 0 };
            if (d.status === 1) grouped[d.time].event++; else grouped[d.time].censor++;
            grouped[d.time].total++;
        });
        const times = Object.keys(grouped).map(Number).sort((a, b) => a - b);
        let currentN = n;
        let medianTime = "Not Reached";
        let medianFound = false;
        times.forEach(t => {
            const info = grouped[t];
            if (info.event > 0) survivalProb *= (1 - (info.event / currentN));
            points.push({ x: t, y: survivalProb });
            if (!medianFound && survivalProb <= 0.5) { medianTime = t; medianFound = true; }
            currentN -= info.total;
        });
        return { median: medianTime, points: points };
    }

// statsHtml 인자 추가됨
    function displayResults(medianResults, datasets, statsHtml) {
        const resultDiv = document.getElementById("os-result");
        if(!resultDiv) return;

        resultDiv.style.cssText = "display: block; margin-top: 20px; padding: 15px !important; border: 1px solid #eee; background: #fff; border-radius: 8px;";

        let medianHtml = `
            <table class="km-table">
                <tr><th>Group</th><th>Median Survival</th></tr>
        `;
        medianResults.forEach(res => {
            medianHtml += `
                <tr>
                    <td style="padding:6px 10px; font-weight:bold; color:${res.color};">${res.name}</td>
                    <td style="padding:6px 10px;">${res.median}</td>
                </tr>
            `;
        });
        medianHtml += `</table>`;

        // ★ statsHtml(통계 표)을 중간에 삽입
        resultDiv.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 10px;">
                
                <h3 style="margin: 0; font-size: 1.1rem; color: #333; padding: 0;">📊 Analysis Result</h3>
                
                <div style="margin: 0;">${medianHtml}</div>
                
                <div style="margin: 0;">${statsHtml || ""}</div>

                <div style="position: relative; height: 300px; width: 100%; margin: 0;">
                    <canvas id="survivalChart"></canvas>
                </div>
                
                <div style="text-align: right; margin: 0;">
                    <button type="button" onclick="window.downloadChart()" style="
                        background-color: #2c3e50; 
                        color: white; 
                        border: none; 
                        padding: 6px 12px; 
                        border-radius: 4px; 
                        cursor: pointer; 
                        font-size: 0.8rem; 
                        font-weight: 500; 
                        display: inline-flex; 
                        align-items: center; 
                        gap: 5px;
                    ">
                        <span>📥</span> Download Graph
                    </button>
                </div>
            </div>
        `;

        drawChart(datasets);
    }

    function drawChart(datasets) {
        const ctx = document.getElementById('survivalChart').getContext('2d');
        const xInput = document.getElementById('xaxis-label');
        const xLabel = xInput ? xInput.value : "Time";
        if (chartInstance) chartInstance.destroy();

        chartInstance = new Chart(ctx, {
            type: 'line',
            data: { datasets: datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                layout: { padding: 0 },
                plugins: {
                    title: { display: true, text: 'Kaplan-Meier Survival Curve', font: { size: 14 }, padding: { top: 0, bottom: 5 } },
                    tooltip: { callbacks: { label: c => c.dataset.label + ': ' + (c.parsed.y * 100).toFixed(1) + '%' } },
                    legend: { position: 'top', align: 'end', labels: { boxWidth: 10, padding: 8, font: { size: 11 } } }
                },
                scales: {
                    x: { type: 'linear', title: { display: true, text: xLabel, font: {weight:'bold', size: 11} }, beginAtZero: true },
                    y: { title: { display: true, text: 'Survival Prob.', font: {weight:'bold', size: 11} }, min: 0, max: 1.05, beginAtZero: true }
                }
            }
        });
    }
// ==========================================
    // ★ 새로 추가된 통계 함수 (Log-Rank Test)
    // ==========================================
    function calculateLogRankStats(groups) {
        let html = `<h4 style="margin: 15px 0 5px 0;">📊 Log-Rank Test (Statistics)</h4>`;
        html += `<table class="stat-table"><tr><th>Comparison</th><th>Chi-Square</th><th>P-value</th></tr>`;
        
        const group1 = groups[0]; // 첫 번째 그룹을 Control로 가정
        
        for(let i=1; i<groups.length; i++) {
            const group2 = groups[i];
            const res = runLogRank(group1.data, group2.data);
            const pClass = res.p < 0.05 ? "stat-sig" : "stat-ns";
            const pVal = res.p < 0.001 ? "< 0.001" : res.p.toFixed(4);
            
            html += `<tr>
                <td>${group1.name} vs ${group2.name}</td>
                <td>${res.chisq.toFixed(2)}</td>
                <td class="${pClass}">${pVal}</td>
            </tr>`;
        }
        html += `</table>`;
        return html;
    }

function runLogRank(g1, g2) {
        // 1. Combine all unique time points from both groups where events occurred
        // (Log-rank only cares about times where at least one event happened)
        let allTimes = new Set([
            ...g1.filter(d => d.status === 1).map(d => d.time), 
            ...g2.filter(d => d.status === 1).map(d => d.time)
        ]);
        let times = Array.from(allTimes).sort((a, b) => a - b);
        
        let O1 = 0; // Observed events in Group 1
        let E1 = 0; // Expected events in Group 1
        let V = 0;  // Variance

        times.forEach(t => {
            // Number at risk in each group just before time t (include events at t)
            let r1 = g1.filter(d => d.time >= t).length;
            let r2 = g2.filter(d => d.time >= t).length;
            let r = r1 + r2; // Total at risk

            // Number of events at time t in each group
            let d1 = g1.filter(d => d.time === t && d.status === 1).length;
            let d2 = g2.filter(d => d.time === t && d.status === 1).length;
            let d = d1 + d2; // Total events

            // Only calculate if there are people at risk and at least one event occurred
            if (r > 0 && d > 0) {
                // Expected events for Group 1
                let e1 = r1 * (d / r);
                
                O1 += d1;
                E1 += e1;

                // Variance calculation (hypergeometric variance)
                // If r == 1, avoid division by zero
                if (r > 1) {
                    let varTerm = (r1 * r2 * d * (r - d)) / (r * r * (r - 1));
                    V += varTerm;
                }
            }
        });

        // Calculate Chi-Square statistic: (O - E)^2 / V
        // Using Z-score method: Z = (O1 - E1) / sqrt(V) -> ChiSq = Z^2
        let Z = (O1 - E1) / Math.sqrt(V);
        let chisq = Z * Z;
        
        // Handle edge cases (e.g., V=0 implies no variance/identical data or insufficient data)
        if (isNaN(chisq) || !isFinite(chisq)) return { chisq: 0, p: 1.0 };
        
        // Calculate P-value (1 degree of freedom for 2 groups)
        // Ensure jStat is loaded. If not, return valid placeholder.
        let p = 1.0;
        if (typeof jStat !== 'undefined') {
            p = 1 - jStat.chisquare.cdf(chisq, 1);
        } else {
            console.error("jStat library not loaded.");
        }
        
        return { chisq, p };
    }

    // --- Firebase Visitor Count ---
    const firebaseConfig = {
        apiKey: "AIzaSyB4LNbqa_msSQqHigfnlJ5RaxfLNJvg_Jg",
        authDomain: "scientisttoolkit.firebaseapp.com",
        projectId: "scientisttoolkit",
        storageBucket: "scientisttoolkit.firebasestorage.app",
        messagingSenderId: "611412737478",
        appId: "1:611412737478:web:e7389b1b03c002f56546c7",
        measurementId: "G-5K0XVX0TFM"
    };
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        const db = firebase.firestore();
        const countSpan = document.getElementById('visitor-count');
        const dateStr = (new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000))).toISOString().split('T')[0];
        const docRef = db.collection('visitors').doc(dateStr);
        
        if (!sessionStorage.getItem(`visited_${dateStr}`)) {
            docRef.set({ count: firebase.firestore.FieldValue.increment(1) }, { merge: true }).then(() => sessionStorage.setItem(`visited_${dateStr}`, 'true'));
        }
        docRef.onSnapshot((doc) => {
            if (doc.exists && countSpan) countSpan.innerHTML = `Today's Visitors: <strong>${doc.data().count.toLocaleString()}</strong>`;
        });
    }
});