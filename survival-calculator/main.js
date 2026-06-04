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
    // ★ 새로 추가된 통계 함수 (Log-Rank Test, HR, OR & 95% CI)
    // ==========================================
    function calculateLogRankStats(groups) {
        let html = `<h4 style="margin: 15px 0 5px 0;">📊 Statistical Analysis (vs ${groups[0].name})</h4>`;
        html += `<div style="overflow-x: auto;">
                 <table class="stat-table" style="min-width: 700px;">
                    <tr>
                        <th>Comparison</th>
                        <th title="Odds Ratio: End-point probability ignoring time.">Odds Ratio (95% CI)</th>
                        <th title="Hazard Ratio: Instantaneous risk over time (Peto's method).">Hazard Ratio (95% CI)</th>
                        <th>Chi-Square</th>
                        <th>P-value</th>
                    </tr>`;
        
        const group1 = groups[0]; // Reference (Control) Group
        let orWarning = false;
        
        for(let i = 1; i < groups.length; i++) {
            const group2 = groups[i];
            const res = runLogRank(group1.data, group2.data);
            const pClass = res.p < 0.05 ? "stat-sig" : "stat-ns";
            const pVal = res.p < 0.001 ? "< 0.001" : res.p.toFixed(4);
            
            // Format OR
            let orDisplay = "N/A";
            if (res.or === Infinity || res.or === 0) {
                orDisplay = res.or === Infinity ? "Infinity*" : "0.00*";
                orWarning = true;
            } else if (isFinite(res.or) && !isNaN(res.or)) {
                orDisplay = `${res.or.toFixed(2)} (${res.orLower.toFixed(2)} - ${res.orUpper.toFixed(2)})`;
            }

            // Format HR
            let hrDisplay = "N/A";
            if (isFinite(res.hr) && !isNaN(res.hr)) {
                hrDisplay = `${res.hr.toFixed(2)} (${res.hrLower.toFixed(2)} - ${res.hrUpper.toFixed(2)})`;
            }

            html += `<tr>
                <td style="font-weight: 500;">${group1.name} vs ${group2.name}</td>
                <td>${orDisplay}</td>
                <td style="font-weight: bold; color: #0056b3;">${hrDisplay}</td>
                <td>${res.chisq.toFixed(2)}</td>
                <td class="${pClass}">${pVal}</td>
            </tr>`;
        }
        html += `</table></div>`;
        html += `<p style="font-size: 0.8rem; color: #666; margin-top: 4px;"><strong>HR:</strong> Calculated via Peto's approximation. HR < 1 indicates lower risk in the treatment group.</p>`;
        
        if(orWarning) {
            html += `<p style="font-size: 0.8rem; color: #b91c1c; margin-top: 2px;"><strong>*OR Warning:</strong> Cannot calculate exact odds when a group has 0% or 100% events (Division by zero).</p>`;
        }
        
        return html;
    }

    function runLogRank(g1, g2) {
        // 1. Log-Rank (Mantel-Cox) and Hazard Ratio (Peto's Approximation)
        let allTimes = new Set([
            ...g1.filter(d => d.status === 1).map(d => d.time), 
            ...g2.filter(d => d.status === 1).map(d => d.time)
        ]);
        let times = Array.from(allTimes).sort((a, b) => a - b);
        
        let O1 = 0, E1 = 0; // Observed and Expected for Group 1
        let O2 = 0, E2 = 0; // Observed and Expected for Group 2
        let V = 0;  // Variance

        times.forEach(t => {
            let r1 = g1.filter(d => d.time >= t).length;
            let r2 = g2.filter(d => d.time >= t).length;
            let r = r1 + r2;

            let d1 = g1.filter(d => d.time === t && d.status === 1).length;
            let d2 = g2.filter(d => d.time === t && d.status === 1).length;
            let d = d1 + d2;

            if (r > 0 && d > 0) {
                let e1 = r1 * (d / r);
                let e2 = r2 * (d / r);
                
                O1 += d1; E1 += e1;
                O2 += d2; E2 += e2;
                
                if (r > 1) {
                    V += (r1 * r2 * d * (r - d)) / (r * r * (r - 1));
                }
            }
        });

        // Chi-Square & P-value Calculation
        let chisq = 0, p = 1.0;
        if (V > 0) {
            let Z = (O1 - E1) / Math.sqrt(V);
            chisq = Z * Z;
            p = getChi2Pval(chisq);
        }

        // Hazard Ratio (Peto's method) & 95% CI
        let hr = NaN, hrLower = NaN, hrUpper = NaN;
        if (E1 > 0 && E2 > 0 && V > 0) {
            hr = Math.exp((O2 - E2) / V); // Peto's HR estimation
            let seLogHr = Math.sqrt(1 / V);
            hrLower = Math.exp(Math.log(hr) - 1.96 * seLogHr);
            hrUpper = Math.exp(Math.log(hr) + 1.96 * seLogHr);
        }

        // 2. Odds Ratio (OR) Calculation & 95% CI
        let events_g2 = g2.filter(d => d.status === 1).length;
        let alive_g2 = g2.filter(d => d.status === 0).length;
        let events_g1 = g1.filter(d => d.status === 1).length;
        let alive_g1 = g1.filter(d => d.status === 0).length;

        let or = NaN, orLower = NaN, orUpper = NaN;
        
        if (alive_g2 === 0 || events_g1 === 0) {
            or = Infinity; // Division by zero scenario
        } else if (events_g2 === 0 || alive_g1 === 0) {
            or = 0; // Numerator is zero
        } else {
            or = (events_g2 * alive_g1) / (alive_g2 * events_g1);
            let seLogOr = Math.sqrt((1/events_g2) + (1/alive_g1) + (1/alive_g2) + (1/events_g1));
            orLower = Math.exp(Math.log(or) - 1.96 * seLogOr);
            orUpper = Math.exp(Math.log(or) + 1.96 * seLogOr);
        }

        return { chisq, p, hr, hrLower, hrUpper, or, orLower, orUpper };
    }

    function getChi2Pval(x) {
        if (x <= 0 || isNaN(x)) return 1;
        return 2 * (1 - normalCDF(Math.sqrt(x)));
    }

    function normalCDF(x) {
        var t = 1 / (1 + 0.2316419 * Math.abs(x));
        var d = 0.3989423 * Math.exp(-x * x / 2);
        var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
        if (x > 0) return 1 - p;
        return p;
    }
}); // <-- 전체 DOMContentLoaded 이벤트를 닫는 괄호 (절대 삭제 금지)