document.addEventListener("DOMContentLoaded", function() {
    
    // ==========================================
    // 1. SAS Time Unit Converter (간격 수정됨)
    // ==========================================
    const timeInput = document.getElementById("time-input");
    const timeUnit = document.getElementById("time-unit");
    const convertResult = document.getElementById("convert-result");

    function convertTime() {
        const val = parseFloat(timeInput.value);
        const unit = timeUnit.value;

        if (isNaN(val)) {
            convertResult.innerHTML = "<div style='color:#888;'>Please enter a value.</div>";
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

        // 간격을 좁힌 디자인 적용 (div class="sas-result-item")
        convertResult.innerHTML = `
            <div class="sas-result-item"><strong>Days:</strong> ${resDays.toFixed(2)}</div>
            <div class="sas-result-item"><strong>Weeks:</strong> ${resWeeks.toFixed(2)}</div>
            <div class="sas-result-item"><strong>Months (SAS):</strong> ${resMonths.toFixed(2)}</div>
            <div class="sas-result-item"><strong>Years:</strong> ${resYears.toFixed(2)}</div>
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
    const downloadBtn = document.getElementById("download-btn");
    let chartInstance = null;

    // 초기 그룹 입력창 생성
    if(numGroupsSelect) {
        createGroupInputs(parseInt(numGroupsSelect.value));

        numGroupsSelect.addEventListener("change", function() {
            createGroupInputs(parseInt(this.value));
        });
    }

    // 그룹별 입력 테이블 생성 함수
    function createGroupInputs(num) {
        let html = "";
        for (let g = 1; g <= num; g++) {
            // 그룹 이름을 기본적으로 Group 1, Group 2... 로 설정
            const defaultName = g === 1 && num === 2 ? "Control" : (g === 2 && num === 2 ? "Treatment" : `Group ${g}`);
            
            html += `
            <div class="group-container" id="group-box-${g}">
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

        // 각 그룹의 N 변경 시 이벤트 리스너 다시 연결
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
            const colors = ['#007bff', '#dc3545', '#28a745', '#fd7e14']; // Blue, Red, Green, Orange

            // 결과창 초기화
            document.getElementById("median-table-area").innerHTML = "";
            document.getElementById("detail-tables-area").innerHTML = "";

            // 그룹별 루프
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

                // KM 계산
                const kmResult = calculateSingleKM(data);
                
                // 차트 데이터셋 추가
                allDatasets.push({
                    label: groupName,
                    data: kmResult.points,
                    borderColor: colors[(g-1) % 4],
                    backgroundColor: colors[(g-1) % 4],
                    borderWidth: 2,
                    fill: false,       // ★ 요청사항: 채우기 끔
                    stepped: true,     // ★ 계단식 그래프
                    tension: 0,
                    pointRadius: 2,
                    pointHoverRadius: 5
                });

                // Median 결과 저장
                medianResults.push({ name: groupName, median: kmResult.median, color: colors[(g-1) % 4] });
            }

            if (allDatasets.length === 0) {
                alert("Please enter data for at least one group.");
                return;
            }

            displayResults(medianResults, allDatasets);
        });
    }

    // 개별 그룹 KM 계산 알고리즘
    function calculateSingleKM(data) {
        data.sort((a, b) => a.time - b.time);
        let n = data.length;
        let survivalProb = 1.0;
        let points = [{x: 0, y: 1.0}]; // 시작점 (0, 100%)
        
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

            // 계단식 표현을 위해:
            // 1. 이벤트 직전 시간까지는 이전 확률 유지 (Stepped: true 옵션이 이걸 자동화해주지만, 데이터 포인트는 정확해야 함)
            points.push({ x: t, y: survivalProb });

            if (!medianFound && survivalProb <= 0.5) {
                medianTime = t;
                medianFound = true;
            }
            currentN -= info.total;
        });
        
        // 마지막 시점까지 선 연장 (선택사항, 보통 마지막 데이터 포인트에서 끝냄)
        return { median: medianTime, points: points };
    }

    function displayResults(medianResults, datasets) {
        document.getElementById("os-result").style.display = "block";
        
        // Median Table 생성 (★ 여기 수정됨: 간격 대폭 축소)
        let medianHtml = `
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 0.9rem;">
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
        document.getElementById("median-table-area").innerHTML = medianHtml;

        drawChart(datasets);
    }

    function drawChart(datasets) {
        const ctx = document.getElementById('survivalChart').getContext('2d');
        const xLabel = document.getElementById('xaxis-label').value || "Time";

        if (chartInstance) {
            chartInstance.destroy();
        }

        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: datasets // 다중 데이터셋
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
                        position: 'bottom'
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

    // ★ 그래프 다운로드 기능
    if(downloadBtn) {
        downloadBtn.addEventListener("click", function() {
            const link = document.createElement('a');
            link.download = 'survival-curve.png';
            link.href = document.getElementById('survivalChart').toDataURL('image/png', 1.0);
            link.click();
        });
    }
});