// ==========================================
// 0. 다운로드 함수 (전역 window 객체에 등록)
// ==========================================
window.downloadChart = function() {
    const canvas = document.getElementById('survivalChart');
    if(!canvas) { alert("Chart not found."); return; }

    try {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.drawImage(canvas, 0, 0);
        
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
            
            // ★ 통계용 데이터 저장 배열
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
                
                // ★ Censor Tick 데이터셋 추가
                if (kmResult.censoredPoints && kmResult.censoredPoints.length > 0) {
                     allDatasets.push({
                        label: groupName + ' (Censored)',
                        data: kmResult.censoredPoints,
                        type: 'scatter', 
                        backgroundColor: colors[(g-1) % 4],
                        borderColor: colors[(g-1) % 4],
                        pointStyle: 'cross', 
                        pointRadius: 6,      
                        pointHoverRadius: 8,
                        showLine: false      
                    });
                }

                medianResults.push({ name: groupName, median: kmResult.median, color: colors[(g-1) % 4] });
            }

            if (allDatasets.length === 0) {
                alert("Please enter data for at least one group.");
                return;
            }

            let statsHtml = "";
            if (groupData.length >= 2) {
                statsHtml = calculateLogRankStats(groupData);
            }

            displayResults(medianResults, allDatasets, statsHtml);
        });
    }

    // ★ 그래프 깨짐 방지 및 정확한 At-risk 감소 반영
    function calculateSingleKM(data) {
        data.sort((a, b) => a.time - b.time);
        let n = data.length;
        let survivalProb = 1.0;
        let points = [{x: 0, y: 1.0}]; 
        let censoredPoints = []; 
        let grouped = {};
        
        data.forEach(d => {
            if (!grouped[d.time]) grouped[d.time] = { event: 0, censor: 0, total: 0 };
            if (d.status === 1) grouped[d.time].event++; 
            else grouped[d.time].censor++;
            grouped[d.time].total++;
        });
        
        const times = Object.keys(grouped).map(Number).sort((a, b) => a - b);
        let currentN = n;
        let medianTime = "Not Reached";
        let medianFound = false;
        
        times.forEach(t => {
            const info = grouped[t];
            
            // Event 발생 시에만 points.push
            if (info.event > 0) {
                survivalProb *= (1 - (info.event / currentN));
                points.push({ x: t, y: survivalProb });
                
                if (!medianFound && survivalProb <= 0.5) { 
                    medianTime = t; 
                    medianFound = true; 
                }
            }
            
            // Censor 마크
            if (info.censor > 0) {
                 censoredPoints.push({ x: t, y: survivalProb });
            }

            currentN -= info.event;
            currentN -= info.censor;
        });
        
        return { median: medianTime, points: points, censoredPoints: censoredPoints };
    }

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

        resultDiv.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <h3 style="margin: 0; font-size: 1.1rem; color: #333; padding: 0;">📊 Analysis Result</h3>
                <div style="margin: 0;">${medianHtml}</div>
                <div style="margin: 0;">${statsHtml || ""}</div>
                <div style="position: relative; height: 350px; width: 100%; margin: 15px 0;">
                    <canvas id="survivalChart"></canvas>
                </div>
                <div style="text-align: right; margin: 0;">
                    <button type="button" onclick="window.downloadChart()" style="
                        background-color: #2c3e50; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: 500; display: inline-flex; align-items: center; gap: 5px;
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
        
        if (typeof Chart === 'undefined') {
            console.error("Chart.js is not loaded.");
            return;
        }

        if (chartInstance) chartInstance.destroy();

        chartInstance = new Chart(ctx, {
            type: 'line',
            data: { datasets: datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                layout: { padding: { top: 10, right: 10, bottom: 10, left: 10 } },
                plugins: {
                    title: { display: true, text: 'Kaplan-Meier Survival Curve', font: { size: 16, weight: 'bold' }, padding: { top: 0, bottom: 15 } },
                    tooltip: { 
                        callbacks: { 
                            label: c => {
                                if(c.dataset.label.includes('(Censored)')) {
                                    return 'Censored at ' + c.parsed.x;
                                }
                                return c.dataset.label + ': ' + (c.parsed.y * 100).toFixed(1) + '%' 
                            }
                        } 
                    },
                    legend: { 
                        position: 'top', align: 'end', 
                        labels: { 
                            boxWidth: 12, padding: 10, font: { size: 12 },
                            filter: function(item, chart) {
                                return !item.text.includes('(Censored)');
                            }
                        } 
                    }
                },
                scales: {
                    x: { type: 'linear', title: { display: true, text: xLabel, font: {weight:'bold', size: 12} }, beginAtZero: true },
                    y: { title: { display: true, text: 'Survival Prob.', font: {weight:'bold', size: 12} }, min: 0, max: 1.05, beginAtZero: true }
                }
            }
        });
    }

    // ==========================================
    // ★ 새로 추가된 통계 함수 (HR, 95% CI, P-value)
    // ==========================================
    function calculateLogRankStats(groups) {
        let html = `<h4 style="margin: 15px 0 5px 0; color: #191c1d; font-size: 1rem;">📈 Pairwise Statistical Analysis (vs ${groups[0].name})</h4>`;
        html += `<div style="overflow-x: auto; border: 1px solid #e1e3e4; border-radius: 8px;">
                 <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 0.9rem;">
                    <tr style="background-color: #f8f9fa; border-bottom: 1px solid #e1e3e4;">
                        <th style="padding: 10px; font-weight: 600; color: #414754; text-align: left;">Comparison</th>
                        <th style="padding: 10px; font-weight: 600; color: #414754;" title="Hazard Ratio: Instantaneous risk (Peto's method).">HR (95% CI)</th>
                        <th style="padding: 10px; font-weight: 600; color: #414754;">Chi-Square</th>
                        <th style="padding: 10px; font-weight: 600; color: #414754;">P-value (Pairwise Log-rank)</th>
                    </tr>`;
        
        const group1 = groups[0]; 
        
        for(let i=1; i<groups.length; i++) {
            const group2 = groups[i];
            const res = runLogRank(group1.data, group2.data);
            const pStyle = res.p < 0.05 ? "font-weight: bold; color: #0056b3;" : "color: #414754;";
            const pVal = res.p < 0.001 ? "< 0.001" : res.p.toFixed(4);
            
            let hrDisplay = "N/A";
            if (isFinite(res.hr) && !isNaN(res.hr)) {
                hrDisplay = `${res.hr.toFixed(2)} (${res.hrLower.toFixed(2)} - ${res.hrUpper.toFixed(2)})`;
            }

            html += `<tr style="border-bottom: 1px solid #e1e3e4;">
                <td style="padding: 10px; text-align: left; font-weight: 500;">${group1.name} vs ${group2.name}</td>
                <td style="padding: 10px; font-weight: bold; color: #0056b3;">${hrDisplay}</td>
                <td style="padding: 10px; color: #414754;">${res.chisq.toFixed(2)}</td>
                <td style="padding: 10px; ${pStyle}">${pVal}</td>
            </tr>`;
        }
        html += `</table></div>`;
        html += `<p style="font-size: 0.8rem; color: #666; margin-top: 6px;"><strong>Note:</strong> Hazard Ratio (HR) is calculated via Peto's approximation. HR < 1 indicates lower risk (better survival) in the treatment group.</p>`;
        return html;
    }

    function runLogRank(g1, g2) {
        let allTimes = new Set([
            ...g1.filter(d => d.status === 1).map(d => d.time), 
            ...g2.filter(d => d.status === 1).map(d => d.time)
        ]);
        let times = Array.from(allTimes).sort((a, b) => a - b);
        
        let O1 = 0, E1 = 0, O2 = 0, E2 = 0, V = 0;

        times.forEach(t => {
            // ★ At-risk 집합 오류 수정
            let r1 = g1.filter(d => d.time > t || (d.time === t && d.status === 1)).length;
            let r2 = g2.filter(d => d.time > t || (d.time === t && d.status === 1)).length;
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

        let chisq = 0, p = 1.0;
        if (V > 0) {
            let Z = (O1 - E1) / Math.sqrt(V);
            chisq = Z * Z;
            p = getChi2Pval(chisq);
        }
        
        let hr = NaN, hrLower = NaN, hrUpper = NaN;
        if (E1 > 0 && E2 > 0 && V > 0) {
            hr = Math.exp((O2 - E2) / V); 
            let seLogHr = Math.sqrt(1 / V);
            hrLower = Math.exp(Math.log(hr) - 1.96 * seLogHr);
            hrUpper = Math.exp(Math.log(hr) + 1.96 * seLogHr);
        }

        return { chisq, p, hr, hrLower, hrUpper };
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
});