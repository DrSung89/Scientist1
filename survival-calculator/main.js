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
                    const rawTime = timeInputs[i].value.trim();
                    if (rawTime === "") continue;

                    const t = Number(rawTime);
                    const rawStatus = statusInputs[i].value;
                    if (!Number.isFinite(t) || t < 0) {
                        alert("Group " + g + ", row " + (i + 1) + ": enter a valid non-negative follow-up time.");
                        return;
                    }
                    if (rawStatus !== "0" && rawStatus !== "1") {
                        alert("Group " + g + ", row " + (i + 1) + ": status must be 1 (event) or 0 (censored).");
                        return;
                    }
                    data.push({ time: t, status: Number(rawStatus) });
                }

                if (data.length === 0) continue;

                groupData.push({ name: groupName, data: data });

                const kmResult = calculateSingleKM(data);
                const groupColor = colors[(g-1) % 4];
                const ciColor = groupColor === '#007bff' ? 'rgba(0, 123, 255, 0.12)'
                    : groupColor === '#dc3545' ? 'rgba(220, 53, 69, 0.12)'
                    : groupColor === '#28a745' ? 'rgba(40, 167, 69, 0.12)'
                    : 'rgba(253, 126, 20, 0.12)';
                allDatasets.push({
                    label: groupName + ' (95% CI upper)',
                    data: kmResult.points.map(point => ({ x: point.x, y: point.upper })),
                    borderColor: 'transparent', backgroundColor: 'transparent',
                    borderWidth: 0, pointRadius: 0, stepped: true, fill: false, tension: 0
                });
                allDatasets.push({
                    label: groupName + ' (95% CI)',
                    data: kmResult.points.map(point => ({ x: point.x, y: point.lower })),
                    borderColor: 'transparent', backgroundColor: ciColor,
                    borderWidth: 0, pointRadius: 0, stepped: true, fill: '-1', tension: 0
                });
                allDatasets.push({
                    label: groupName, data: kmResult.points,
                    borderColor: groupColor, backgroundColor: groupColor,
                    borderWidth: 2, fill: false, stepped: true, tension: 0,
                    pointRadius: 2, pointHoverRadius: 5
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
        let currentN = data.length;
        let survivalProb = 1.0;
        let greenwoodSum = 0;
        const z = 1.96;
        const points = [{ x: 0, y: 1.0, lower: 1.0, upper: 1.0 }];
        const censoredPoints = [];
        const grouped = {};
        data.forEach(d => {
            if (!grouped[d.time]) grouped[d.time] = { event: 0, censor: 0 };
            if (d.status === 1) grouped[d.time].event++;
            else grouped[d.time].censor++;
        });
        function confidenceInterval(survival, greenwood) {
            if (survival <= 0) return { lower: 0, upper: 0 };
            if (survival >= 1 || greenwood <= 0) return { lower: survival, upper: survival };
            const logSurvival = Math.log(survival);
            const standardError = Math.sqrt(greenwood) / Math.abs(logSurvival);
            const theta = Math.log(-logSurvival);
            const lower = Math.exp(-Math.exp(theta + z * standardError));
            const upper = Math.exp(-Math.exp(theta - z * standardError));
            return {
                lower: Math.max(0, Math.min(survival, lower)),
                upper: Math.min(1, Math.max(survival, upper))
            };
        }
        const times = Object.keys(grouped).map(Number).sort((a, b) => a - b);
        let medianTime = "Not Reached";
        let medianFound = false;
        times.forEach(t => {
            const info = grouped[t];
            if (info.event > 0) {
                const events = info.event;
                if (currentN > 0) {
                    survivalProb *= 1 - events / currentN;
                    if (currentN > events) greenwoodSum += events / (currentN * (currentN - events));
                }
                const ci = confidenceInterval(survivalProb, greenwoodSum);
                points.push({ x: t, y: survivalProb, lower: ci.lower, upper: ci.upper });
                if (!medianFound && survivalProb <= 0.5) {
                    medianTime = t;
                    medianFound = true;
                }
            }
            if (info.censor > 0) {
                const ci = confidenceInterval(survivalProb, greenwoodSum);
                censoredPoints.push({ x: t, y: survivalProb, lower: ci.lower, upper: ci.upper });
            }
            currentN -= info.event + info.censor;
        });
        return { median: medianTime, points, censoredPoints };
    }
    function escapeHtml(value) {
        return String(value).replace(/[&<>"\']/g, function(char) {
            return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"' : "&quot;", "\'": "&#39;" })[char];
        });
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
                    <td style="padding:6px 10px; font-weight:bold; color:${res.color};">${escapeHtml(res.name)}</td>
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
                                if(c.dataset.label.includes('(95% CI')) return null;
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
                                return !item.text.includes('(Censored)') && !item.text.includes('(95% CI)');
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

    // Preserve meaningful digits for small hazard ratios and confidence limits.
    function formatHRValue(value) {
        return Number(value).toPrecision(3);
    }

    // ==========================================
    // ★ 새로 추가된 통계 함수 (HR, 95% CI, P-value)
    // ==========================================
    function calculateLogRankStats(groups) {
        let html = `<h4 style="margin: 15px 0 5px 0; color: #191c1d; font-size: 1rem;">📈 Pairwise Statistical Analysis (other groups vs ${escapeHtml(groups[0].name)})</h4>`;
        html += `<div style="overflow-x: auto; border: 1px solid #e1e3e4; border-radius: 8px;">
                 <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 0.9rem;">
                    <tr style="background-color: #f8f9fa; border-bottom: 1px solid #e1e3e4;">
                        <th style="padding: 10px; font-weight: 600; color: #414754; text-align: left;">Comparison</th>
                        <th style="padding: 10px; font-weight: 600; color: #414754;" title="Univariate Cox proportional-hazards estimate for Group 2 relative to Group 1, using Efron handling of tied event times.">Cox HR (95% CI)</th>
                        <th style="padding: 10px; font-weight: 600; color: #414754;">Chi-Square</th>
                        <th style="padding: 10px; font-weight: 600; color: #414754;">P-value (Pairwise Log-rank)</th>
                    </tr>`;
        
        const group1 = groups[0]; 
        
        for(let i=1; i<groups.length; i++) {
            const group2 = groups[i];
            const logRank = runLogRank(group1.data, group2.data);
            const cox = fitCoxHR(group1.data, group2.data);
            const res = {
                ...logRank,
                hr: cox.converged ? cox.hr : NaN,
                hrLower: cox.converged ? cox.hrLower : NaN,
                hrUpper: cox.converged ? cox.hrUpper : NaN
            };
            const pStyle = res.p < 0.05 ? "font-weight: bold; color: #0056b3;" : "color: #414754;";
            const pVal = res.p < 0.001 ? "&lt; 0.001" : res.p.toFixed(4);
            
            let hrDisplay = "N/A";
            if ([res.hr, res.hrLower, res.hrUpper].every(value => Number.isFinite(value) && value > 0)) {
                hrDisplay = `${formatHRValue(res.hr)} (${formatHRValue(res.hrLower)} - ${formatHRValue(res.hrUpper)})`;
            }

            html += `<tr style="border-bottom: 1px solid #e1e3e4;">
                <td style="padding: 10px; text-align: left; font-weight: 500;">${escapeHtml(group2.name)} vs ${escapeHtml(group1.name)}</td>
                <td style="padding: 10px; font-weight: bold; color: #0056b3;">${hrDisplay}</td>
                <td style="padding: 10px; color: #414754;">${res.chisq.toFixed(2)}</td>
                <td style="padding: 10px; ${pStyle}">${pVal}</td>
            </tr>`;
        }
        html += `</table></div>`;
        html += `<p style="font-size: 0.8rem; color: #666; margin-top: 6px;"><strong>Note:</strong> HR is estimated from a univariate Cox proportional-hazards model (Group 2 relative to Group 1), with Efron handling of tied event times and a Wald 95% confidence interval. “N/A” means the estimate did not converge to a finite, stable solution (for example, if either group has no observed events or the data exhibit separation). HR &lt; 1 indicates a lower estimated hazard in Group 2. The displayed p-value and chi-square are from the pairwise log-rank test, not the Cox model; pairwise p-values are unadjusted for multiple comparisons.</p>`;
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
            // Subjects censored at t remain at risk immediately before events at t.
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

        let chisq = 0, p = 1.0;
        if (V > 0) {
            let Z = (O1 - E1) / Math.sqrt(V);
            chisq = Z * Z;
            p = getChi2Pval(chisq);
        }
        
        let hr = NaN, hrLower = NaN, hrUpper = NaN;
        if (E1 > 0 && E2 > 0 && V > 0 && O1 > 0 && O2 > 0) {
            hr = Math.exp((O2 - E2) / V); 
            let seLogHr = Math.sqrt(1 / V);
            hrLower = Math.exp(Math.log(hr) - 1.96 * seLogHr);
            hrUpper = Math.exp(Math.log(hr) + 1.96 * seLogHr);
        }

        return { chisq, p, hr, hrLower, hrUpper };
    }

    // Fit a univariate Cox model for a binary group indicator (Group 2 = 1).
    // Efron's method is used for tied event times. The log-rank test remains separate.
    function fitCoxHR(g1, g2) {
        const invalid = reason => ({
            converged: false, reason,
            beta: NaN, se: NaN, hr: NaN, hrLower: NaN, hrUpper: NaN
        });
        if (!Array.isArray(g1) || !Array.isArray(g2) || !g1.length || !g2.length) {
            return invalid("empty-group");
        }
        const validRows = [...g1, ...g2].every(d =>
            d && Number.isFinite(d.time) && d.time >= 0 &&
            (d.status === 0 || d.status === 1)
        );
        if (!validRows) return invalid("invalid-data");

        const events1 = g1.filter(d => d.status === 1).length;
        const events2 = g2.filter(d => d.status === 1).length;
        if (events1 === 0 || events2 === 0) return invalid("no-events-in-group");

        const eventTimes = Array.from(new Set(
            [...g1, ...g2].filter(d => d.status === 1).map(d => d.time)
        )).sort((a, b) => a - b);
        if (!eventTimes.length) return invalid("no-events");

        function scoreAndInformation(beta) {
            const expBeta = Math.exp(beta);
            if (!Number.isFinite(expBeta) || expBeta === 0) return null;
            let score = 0;
            let information = 0;

            for (const time of eventTimes) {
                const risk1 = g1.filter(d => d.time >= time).length;
                const risk2 = g2.filter(d => d.time >= time).length;
                const deaths1 = g1.filter(d => d.time === time && d.status === 1).length;
                const deaths2 = g2.filter(d => d.time === time && d.status === 1).length;
                const deaths = deaths1 + deaths2;
                if (deaths === 0) continue;

                const weightedRisk2 = risk2 * expBeta;
                const weightedDeaths2 = deaths2 * expBeta;
                const s0 = risk1 + weightedRisk2;
                const s0Deaths = deaths1 + weightedDeaths2;
                if (!(s0 > 0) || !Number.isFinite(s0)) return null;

                score += deaths2;
                for (let l = 0; l < deaths; l++) {
                    const fraction = l / deaths;
                    const denominator = s0 - fraction * s0Deaths;
                    const group2Weight = weightedRisk2 - fraction * weightedDeaths2;
                    if (!(denominator > 0) || !Number.isFinite(denominator)) return null;
                    const probability = group2Weight / denominator;
                    score -= probability;
                    information += probability * (1 - probability);
                }
            }
            return { score, information };
        }

        let beta = 0;
        let converged = false;
        let finalStats = null;
        for (let iteration = 0; iteration < 100; iteration++) {
            const stats = scoreAndInformation(beta);
            if (!stats || !(stats.information > 1e-12) ||
                !Number.isFinite(stats.score) || !Number.isFinite(stats.information)) {
                return invalid("singular-information");
            }
            finalStats = stats;
            const rawStep = stats.score / stats.information;
            if (!Number.isFinite(rawStep)) return invalid("non-finite-step");
            const step = Math.max(-2, Math.min(2, rawStep));
            beta += step;
            if (!Number.isFinite(beta) || Math.abs(beta) > 20) {
                return invalid("separation-or-unbounded-estimate");
            }
            if (Math.abs(step) < 1e-8) {
                converged = true;
                break;
            }
        }

        if (!converged) return invalid("non-convergence");
        finalStats = scoreAndInformation(beta);
        if (!finalStats || !(finalStats.information > 0)) return invalid("singular-information");
        const se = Math.sqrt(1 / finalStats.information);
        const lower = Math.exp(beta - 1.96 * se);
        const upper = Math.exp(beta + 1.96 * se);
        const hr = Math.exp(beta);
        if (![se, lower, upper, hr].every(Number.isFinite) || lower <= 0 || upper <= 0) {
            return invalid("non-finite-estimate");
        }
        return { converged: true, reason: null, beta, se, hr, hrLower: lower, hrUpper: upper };
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