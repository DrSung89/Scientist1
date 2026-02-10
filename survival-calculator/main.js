document.addEventListener("DOMContentLoaded", function() {
    
    // ==========================================
    // 1. SAS Time Unit Converter
    // ==========================================
    const timeInput = document.getElementById("time-input");
    const timeUnit = document.getElementById("time-unit");
    const convertResult = document.getElementById("convert-result");

    function convertTime() {
        if (!timeInput || !timeUnit || !convertResult) return;

        const val = parseFloat(timeInput.value);
        const unit = timeUnit.value;

        if (isNaN(val)) {
            convertResult.innerHTML = "<div style='color:#888; padding:5px;'>Please enter a value.</div>";
            return;
        }

        let days = 0;
        if (unit === "days") days = val;
        else if (unit === "weeks") days = val * 7;
        else if (unit === "months") days = val * 30.4375;
        else if (unit === "years") days = val * 365.25;

        const resDays = days;
        const resWeeks = days / 7;
        const resMonths = days / 30.4375;
        const resYears = days / 365.25;

        convertResult.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 4px; padding: 5px 0;">
                <div style="margin: 0; line-height: 1.4;"><strong>Days:</strong> ${resDays.toFixed(2)}</div>
                <div style="margin: 0; line-height: 1.4;"><strong>Weeks:</strong> ${resWeeks.toFixed(2)}</div>
                <div style="margin: 0; line-height: 1.4; color: #0056b3;"><strong>Months (SAS):</strong> ${resMonths.toFixed(2)}</div>
                <div style="margin: 0; line-height: 1.4;"><strong>Years:</strong> ${resYears.toFixed(2)}</div>
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
    
    // 차트 객체를 전역 변수로 관리
    let chartInstance = null;

    // 초기 그룹 입력창 생성
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
            <div class="group-container" id="group-box-${g}" style="margin-bottom: 15px;">
                <div class="group-header">
                    <div>
                        <label><strong>Group Name:</strong></label>
                        <input type="text" class="group-name-input" value="${defaultName}" style="padding:4px; width:120px;">
                    </div>
                    <div>
                        <label>N:</label>
                        <select class="group-n-select" data-group="${g}" style="padding:4px;">
                            <option value="5">5</option>
                            <option value="10" selected>10</option>
                            <option value="15">15</option>
                            <option value="20">20</option>
                            <option value="30">30</option>
                            <option value="50">50</option>
                        </select>
                    </div>
                </div>
                <div class="group-data-area" id="group-data-${g}">
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
            <table style="width: 100%; border-spacing: 0 5px;">
                <thead>
                    <tr style="text-align: left; font-size: 0.85rem; color: #555;">
                        <th>No.</th>
                        <th>Time</th>
                        <th>Status (0=Live, 1=Dead)</th>
                    </tr>
                </thead>
                <tbody>
        `;
        for (let i = 1; i <= n; i++) {
            html += `
                <tr>
                    <td style="width: 10%; font-size:0.8rem;">#${i}</td>
                    <td style="width: 40%;">
                        <input type="number" class="time-val group-${groupId}-time" placeholder="Time" style="width: 90%; padding: 5px;">
                    </td>
                    <td style="width: 50%;">
                        <select class="status-val group-${groupId}-status" style="width: 95%; padding: 5px;">
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

    // [계산 버튼 클릭]
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
                    pointRadius: 3,
                    pointHoverRadius: 6
                });

                medianResults.push({ name: groupName, median: kmResult.median, color: colors[(g-1) % 4] });
            }

            if (allDatasets.length === 0) {
                alert("Please enter data for at least one group.");
                return;
            }

            // 결과를 그리는 함수 호출
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

    // ★ [핵심 수정] 결과창을 JS에서 통째로 다시 그려서 간격을 강제로 제어
function displayResults(medianResults, datasets) {
    const resultDiv = document.getElementById("os-result");
    if(!resultDiv) return;

    resultDiv.style.display = "block";
    
    // 1. Median Table HTML 생성 (간격 최소화)
    let medianHtml = `
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 0.9rem;">
            <tr style="background:#f1f1f1; border-bottom:1px solid #ccc;">
                <th style="padding:4px 8px; text-align:left;">Group</th>
                <th style="padding:4px 8px; text-align:left;">Median Survival</th>
            </tr>
    `;
    medianResults.forEach(res => {
        medianHtml += `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:4px 8px; font-weight:bold; color:${res.color};">${res.name}</td>
                <td style="padding:4px 8px;">${res.median}</td>
            </tr>
        `;
    });
    medianHtml += `</table>`;

    // 2. 결과창 내부 HTML을 완전히 덮어쓰기 (공백 제어 및 버튼 스타일 개선)
    // 다운로드 버튼 스타일 변경: 파란색 계열, 간결한 디자인, 적절한 패딩
    resultDiv.innerHTML = `
        <h3 style="margin: 0 0 10px 0; font-size: 1.1rem; color: #333;">📊 Analysis Result</h3>
        
        <div id="median-table-area">${medianHtml}</div>

        <div style="position: relative; height: 350px; width: 100%;">
            <canvas id="survivalChart"></canvas>
        </div>
        
        <div style="text-align: right; margin-top: 10px;">
            <button id="download-btn" style="background-color: #007bff; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 5px;">
                📥 Download PNG
            </button>
        </div>
    `;

    // 3. 차트 그리기
    drawChart(datasets);

    // 4. 다운로드 버튼 이벤트 다시 연결
    const newDownloadBtn = document.getElementById("download-btn");
    if(newDownloadBtn) {
        newDownloadBtn.addEventListener("click", function() {
            const canvas = document.getElementById('survivalChart');
            // 흰색 배경을 포함하여 다운로드 (투명 배경 방지)
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
            link.click();
        });
    }
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
                plugins: {
                    title: {
                        display: true,
                        text: 'Kaplan-Meier Survival Curve',
                        font: { size: 16 }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + (context.parsed.y * 100).toFixed(1) + '%';
                            }
                        }
                    },
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 15
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: xLabel, font: {weight:'bold'} },
                        beginAtZero: true
                    },
                    y: {
                        title: { display: true, text: 'Survival Probability', font: {weight:'bold'} },
                        min: 0,
                        max: 1.05,
                        beginAtZero: true
                    }
                }
            }
        });
    }
});