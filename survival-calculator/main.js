// 전역 함수로 선언하여 HTML에서도 접근 가능하게 함
window.downloadSurvivalChart = function() {
    const canvas = document.getElementById('survivalChart');
    if(!canvas) {
        alert("Chart not found.");
        return;
    }

    try {
        // 흰색 배경을 가진 임시 캔버스 생성
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        
        // 투명 배경 방지 (흰색 채우기)
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // 원본 차트 복사
        tempCtx.drawImage(canvas, 0, 0);
        
        // 다운로드 실행
        const link = document.createElement('a');
        link.download = 'survival-curve.png';
        link.href = tempCanvas.toDataURL('image/png', 1.0);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        console.error(e);
        alert("Download failed. Please check console.");
    }
};

document.addEventListener("DOMContentLoaded", function() {
    
    // ==========================================
    // 1. SAS Time Unit Converter (강제 스타일 적용)
    // ==========================================
    const timeInput = document.getElementById("time-input");
    const timeUnit = document.getElementById("time-unit");
    const convertResult = document.getElementById("convert-result");

    function convertTime() {
        if (!timeInput || !timeUnit || !convertResult) return;

        const val = parseFloat(timeInput.value);
        const unit = timeUnit.value;

        // ★ [핵심] 기존 CSS 무시하고 강제로 스타일 주입 (!important)
        convertResult.setAttribute("style", "padding: 10px 15px !important; min-height: 0 !important; background: #f8f9fa; border: 1px solid #eee; border-radius: 5px; margin-top: 10px;");

        if (isNaN(val)) {
            convertResult.innerHTML = "<div style='color:#888; font-size:0.9rem; margin:0;'>Please enter a value.</div>";
            return;
        }

        let days = 0;
        if (unit === "days") days = val;
        else if (unit === "weeks") days = val * 7;
        else if (unit === "months") days = val * 30.4375;
        else if (unit === "years") days = val * 365.25;

        // 결과 출력 (여백 0으로 강제)
        convertResult.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0;">
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
    // 2. Multi-Group Kaplan-Meier Logic
    // ==========================================
    const numGroupsSelect = document.getElementById("num-groups");
    const groupsWrapper = document.getElementById("groups-wrapper");
    const calcBtn = document.getElementById("calc-os-btn");
    
    let chartInstance = null;

    if(numGroupsSelect) {
        createGroupInputs(parseInt(numGroupsSelect.value));
        numGroupsSelect.addEventListener("change", function() {
            createGroupInputs(parseInt(this.value));
        });
    }

    function createGroupInputs(num) {
        let html = "";
        for (let g = 1; g <= num; g++) {
            const defaultName = g === 1 && num === 2 ? "Control" : (g === 2 && num === 2 ? "Treatment" : `Group ${g}`);
            
            html += `
            <div class="group-container" id="group-box-${g}" style="margin-bottom: 15px; background: #f8f9fa; padding: 10px; border-radius: 5px; border: 1px solid #eee;">
                <div class="group-header" style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <div>
                        <label style="font-size:0.9rem;"><strong>Group:</strong></label>
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
            </div>
            `;
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
        let html = `
            <table style="width: 100%; border-spacing: 0 2px;">
                <thead>
                    <tr style="text-align: left; font-size: 0.8rem; color: #666;">
                        <th style="padding-bottom:5px;">No.</th>
                        <th style="padding-bottom:5px;">Time</th>
                        <th style="padding-bottom:5px;">Status</th>
                    </tr>
                </thead>
                <tbody>
        `;
        for (let i = 1; i <= n; i++) {
            html += `
                <tr>
                    <td style="width: 15%; font-size:0.8rem;">#${i}</td>
                    <td style="width: 40%;">
                        <input type="number" class="time-val group-${groupId}-time" placeholder="Time" style="width: 90%; padding: 4px; font-size:0.9rem;">
                    </td>
                    <td style="width: 45%;">
                        <select class="status-val group-${groupId}-status" style="width: 95%; padding: 4px; font-size:0.9rem;">
                            <option value="1">1 (Event/Death)</option>
                            <option value="0">0 (Censored)</option>
                        </select>
                    </td>
                </tr>
            `;
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

            displayResults(medianResults, allDatasets);
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
            const d = info.event;
            
            if (d > 0) {
                survivalProb = survivalProb * (1 - (d / currentN));
            }

            points.push({ x: t, y: survivalProb });

            if (!medianFound && survivalProb <= 0.5) {
                medianTime = t;
                medianFound = true;
            }
            currentN -= info.total;
        });
        
        return { median: medianTime, points: points };
    }

    function displayResults(medianResults, datasets) {
        const resultDiv = document.getElementById("os-result");
        if(!resultDiv) return;

        // ★ [핵심] 결과창 컨테이너의 스타일을 강제로 덮어씌움 (Padding 최소화)
        resultDiv.setAttribute("style", "display: block; margin-top: 20px; padding: 15px; border: 1px solid #eee; background: #fff; border-radius: 8px;");

        // Median Table
        let medianHtml = `
            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                <tr style="background:#f1f1f1; border-bottom:1px solid #ccc;">
                    <th style="padding:6px 10px; text-align:left;">Group</th>
                    <th style="padding:6px 10px; text-align:left;">Median Survival</th>
                </tr>
        `;
        medianResults.forEach(res => {
            medianHtml += `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:6px 10px; font-weight:bold; color:${res.color};">${res.name}</td>
                    <td style="padding:6px 10px;">${res.median}</td>
                </tr>
            `;
        });
        medianHtml += `</table>`;

        // 결과창 내부 HTML (여백 없음, 버튼 onclick 직접 연결)
        resultDiv.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 15px;">
                
                <h3 style="margin: 0; font-size: 1.1rem; color: #333; border-bottom: none; padding-bottom: 0;">📊 Analysis Result</h3>
                
                <div style="margin: 0;">${medianHtml}</div>

                <div style="position: relative; height: 300px; width: 100%; margin: 0;">
                    <canvas id="survivalChart"></canvas>
                </div>
                
                <div style="text-align: right; margin: 0;">
                    <button type="button" onclick="window.downloadSurvivalChart()" style="
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
        const xLabelInput = document.getElementById('xaxis-label');
        const xLabel = xLabelInput ? (xLabelInput.value || "Time") : "Time";

        if (chartInstance) {
            chartInstance.destroy();
        }

        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: datasets 
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                layout: {
                    padding: 0 
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Kaplan-Meier Survival Curve',
                        font: { size: 14 },
                        padding: { top: 0, bottom: 10 }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + (context.parsed.y * 100).toFixed(1) + '%';
                            }
                        }
                    },
                    legend: {
                        position: 'top', 
                        align: 'end',
                        labels: {
                            boxWidth: 10,
                            padding: 10,
                            font: { size: 11 }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: xLabel, font: {weight:'bold', size: 12} },
                        beginAtZero: true
                    },
                    y: {
                        title: { display: true, text: 'Survival Probability', font: {weight:'bold', size: 12} },
                        min: 0,
                        max: 1.05,
                        beginAtZero: true
                    }
                }
            }
        });
    }
});